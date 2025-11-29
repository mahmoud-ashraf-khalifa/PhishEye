// background.js - Main service worker for PhishEye
// Handles URL scanning, caching, and warning dispatch
// TODO: add persistent state recovery on extension restart

const VERSION = "3.0";
const LOG_PREFIX = "[PhishEye]";

// Tracking active scans to avoid duplicate requests
const activeScans = new Set();
const recentScans = new Map(); // domain -> timestamp
const scriptInjected = new Set(); // which tabs have content script loaded

// Settings get read frequently so cache them to reduce storage calls
let settings = null;
let settingsLastRead = 0;
const SETTINGS_CACHE_MS = 5000;

async function loadSettings() {
    // only reload if cache expired
    if (settings && Date.now() - settingsLastRead < SETTINGS_CACHE_MS) {
        return settings;
    }
    
    const stored = await getFromStorage();
    settings = {
        enabled: stored.settings?.enabled !== false,
        backendUrl: stored.settings?.backend_url || "http://127.0.0.1:5000",
        cacheExpiryDays: stored.settings?.cache_expiry_days || 7,
        debounceMs: stored.settings?.debounce_delay || 1500,
        cooldownSec: stored.settings?.cooldown_seconds || 5,
        timeoutMs: (stored.settings?.request_timeout || 10) * 1000,
        debug: stored.settings?.show_logs || false
    };
    settingsLastRead = Date.now();
    return settings;
}

async function getFromStorage() {
    return new Promise(resolve => {
        chrome.storage.local.get(["cache"], data => resolve(data.cache || {}));
    });
}

async function saveToStorage(data) {
    settings = null; // invalidate settings cache
    return new Promise(resolve => {
        chrome.storage.local.set({cache: data}, () => resolve());
    });
}

function extractDomain(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname.replace(/^www\./, '').toLowerCase();
    } catch (e) {
        return null;
    }
}

function log(msg, obj) {
    if (settings?.debug) console.log(`${LOG_PREFIX} ${msg}`, obj || '');
}

// Make sure content script can talk to us
// Chrome doesn't always inject scripts declared in manifest, so we handle it manually
async function injectScript(tabId) {
    if (scriptInjected.has(tabId)) return true;
    
    try {
        const tab = await chrome.tabs.get(tabId);
        
        // Some pages can't have scripts injected (chrome://, about://, etc)
        if (!tab.url?.startsWith('http')) return false;
        
        await chrome.scripting.executeScript({
            target: {tabId},
            files: ['content.js']
        });
        
        scriptInjected.add(tabId);
        return true;
    } catch (err) {
        // Script might already be there, try sending a ping
        try {
            await chrome.tabs.sendMessage(tabId, {type: 'PING'});
            scriptInjected.add(tabId);
            return true;
        } catch (e) {
            // nope, not there
            return false;
        }
    }
}

// Send phishing warning to content script
// Retries a few times in case content script isn't ready yet
async function sendPhishingAlert(tabId) {
    const injected = await injectScript(tabId);
    if (!injected) {
        // Last resort - try anyway after a delay
        setTimeout(() => {
            chrome.tabs.sendMessage(tabId, {type: "PHISHEYE_WARNING"}).catch(() => {});
        }, 500);
        return;
    }
    
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await chrome.tabs.sendMessage(tabId, {type: "PHISHEYE_WARNING"});
            log("Phishing warning sent");
            return;
        } catch (err) {
            if (attempt < 2) {
                await sleep(300 * (attempt + 1));
            }
        }
    }
    log("Warning delivery failed after retries");
}

// Same for blacklist warning
async function sendBlockedAlert(tabId) {
    const injected = await injectScript(tabId);
    if (!injected) {
        setTimeout(() => {
            chrome.tabs.sendMessage(tabId, {type: "PHISHEYE_BLACKLIST"}).catch(() => {});
        }, 500);
        return;
    }
    
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await chrome.tabs.sendMessage(tabId, {type: "PHISHEYE_BLACKLIST"});
            log("Blocked alert sent");
            return;
        } catch (err) {
            if (attempt < 2) {
                await sleep(300 * (attempt + 1));
            }
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Main scanning function
// Checks whitelist/blacklist/cache, then queries backend
async function scanUrl(tabId, url) {
    const opts = await loadSettings();
    
    if (activeScans.has(url)) return; // already scanning this
    
    const domain = extractDomain(url);
    if (!domain) return;
    
    // Check cooldown - don't hammer the same domain
    const lastTime = recentScans.get(domain);
    if (lastTime && Date.now() - lastTime < opts.cooldownSec * 1000) {
        return;
    }
    
    log(`Scanning: ${url}`);
    activeScans.add(url);
    
    try {
        if (!opts.enabled) return;
        
        const stored = await getFromStorage();
        
        // Whitelist check - skip these domains entirely
        if (stored.whitelist?.some(w => domain === w || domain.endsWith('.' + w))) {
            log(`${domain} is whitelisted`);
            return;
        }
        
        // Blacklist check - show strict warning
        if (stored.blacklist?.some(b => domain === b || domain.endsWith('.' + b))) {
            log(`${domain} is blacklisted - showing warning`);
            await sendBlockedAlert(tabId);
            return;
        }
        
        // Check cache first
        const cached = stored.subdomains?.[domain];
        if (cached) {
            const cacheAgeDays = (Date.now() - cached.timestamp) / (1000 * 60 * 60 * 24);
            if (cacheAgeDays < opts.cacheExpiryDays) {
                log(`Using cached result for ${domain} (${cacheAgeDays.toFixed(1)} days old)`);
                if (cached.type === 1) {
                    await sendPhishingAlert(tabId);
                }
                return;
            }
        }
        
        // Hit the backend
        await queryBackend(tabId, url, domain, opts);
        
    } finally {
        activeScans.delete(url);
        recentScans.set(domain, Date.now());
    }
}

async function queryBackend(tabId, url, domain, opts) {
    try {
        let backend = opts.backendUrl.replace("localhost", "127.0.0.1");
        const startTime = Date.now();
        
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
        
        const resp = await fetch(`${backend}/scan`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({url}),
            signal: controller.signal
        });
        
        clearTimeout(timer);
        
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        
        const result = await resp.json();
        const elapsed = Date.now() - startTime;
        
        log(`Backend result: ${result.result === 1 ? "PHISHING" : "SAFE"} (${elapsed}ms)`);
        
        // Save to cache
        const stored = await getFromStorage();
        stored.subdomains = stored.subdomains || {};
        stored.subdomains[domain] = {
            type: result.result === 1 ? 1 : 0,
            timestamp: Date.now()
        };
        await saveToStorage(stored);
        
        if (result.result === 1) {
            await sendPhishingAlert(tabId);
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            log(`Scan timeout (${opts.timeoutMs}ms)`);
        } else {
            log(`Backend error: ${err.message}`);
        }
    }
}

// Debounce rapid navigation events
// (user might tab around a lot, don't spam scans)
const debounceTimers = new Map();

async function debouncedScan(tabId, url) {
    const opts = await loadSettings();
    const key = `${tabId}-${url}`;
    
    if (debounceTimers.has(key)) {
        clearTimeout(debounceTimers.get(key));
    }
    
    const timer = setTimeout(() => {
        scanUrl(tabId, url);
        debounceTimers.delete(key);
    }, opts.debounceMs);
    
    debounceTimers.set(key, timer);
}

// ============ EVENT LISTENERS ============

// New page loaded
chrome.tabs.onUpdated.addListener((tabId, changes, tab) => {
    if (changes.status === 'complete' && tab.url?.startsWith('http')) {
        debouncedScan(tabId, tab.url);
    }
});

// User clicked on a tab
chrome.tabs.onActivated.addListener(async activeInfo => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (!tab.url?.startsWith('http')) return;
        
        const opts = await loadSettings();
        const cooldown = opts.cooldownSec * 1000;
        const lastScan = recentScans.get(extractDomain(tab.url));
        
        if (!lastScan || Date.now() - lastScan >= cooldown) {
            scanUrl(activeInfo.tabId, tab.url);
        }
    } catch (err) {
        // tab might not be accessible
    }
});

// Clean up when tab closes
chrome.tabs.onRemoved.addListener(tabId => {
    scriptInjected.delete(tabId);
    // also clean up any pending debounce timers for this tab
    for (const [key, timer] of debounceTimers.entries()) {
        if (key.startsWith(`${tabId}-`)) {
            clearTimeout(timer);
            debounceTimers.delete(key);
        }
    }
});

// ============ STARTUP & HEALTH CHECK ============

async function healthCheck() {
    try {
        const opts = await loadSettings();
        let backend = opts.backendUrl.replace("localhost", "127.0.0.1");
        
        const resp = await fetch(`${backend}/health`, {
            method: "GET",
            mode: "cors",
            signal: AbortSignal.timeout(3000)
        });
        
        if (resp.ok) {
            log(`Backend online at ${backend}`);
        } else {
            console.warn(`${LOG_PREFIX} Backend returned ${resp.status}`);
        }
    } catch (err) {
        console.warn(`${LOG_PREFIX} Backend not reachable - make sure it's running`);
    }
}

// Check backend when extension loads
healthCheck();

// Listen for storage changes and invalidate settings cache
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.cache) {
        settings = null;
    }
});
