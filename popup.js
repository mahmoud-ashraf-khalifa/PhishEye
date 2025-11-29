// AI EDIT ACCESS GRANTED
(async function() {
    'use strict';

    const elements = {
        toggleEnabled: document.getElementById('toggle-enabled'),
        toggleServer: document.getElementById('toggle-server'),
        serverStatusText: document.getElementById('server-status-text'),
        setupInstructions: document.getElementById('setup-instructions'),
        statusIndicator: document.getElementById('status-indicator'),
        statusText: document.querySelector('#status-indicator .status-text'),
        statusDot: document.querySelector('#status-indicator .status-dot'),
        currentSiteStatus: document.getElementById('current-site-status'),
        cachedCount: document.getElementById('cached-count'),
        whitelistCount: document.getElementById('whitelist-count'),
        blacklistCount: document.getElementById('blacklist-count'),
        openOptions: document.getElementById('open-options'),
        clearCache: document.getElementById('clear-cache'),
        lastScan: document.getElementById('last-scan')
    };

    async function getCache() {
        return new Promise(resolve => {
            chrome.storage.local.get(['cache'], (data) => {
                resolve(data.cache || {});
            });
        });
    }

    async function saveCache(cache) {
        return new Promise(resolve => {
            chrome.storage.local.set({cache}, () => resolve());
        });
    }

    // Check if backend server is running
    async function checkServerStatus() {
        try {
            const cache = await getCache();
            const backendUrl = cache.settings?.backend_url || "http://127.0.0.1:5000";
            let url = backendUrl;
            if (url.includes("localhost")) {
                url = url.replace("localhost", "127.0.0.1");
            }
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            
            const resp = await fetch(`${url}/health`, {
                method: "GET",
                mode: "cors",
                credentials: "omit",
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            return resp.ok;
        } catch (error) {
            return false;
        }
    }

    // Start the backend server
    async function startServer() {
        try {
            // Send message to background script to start server
            const response = await chrome.runtime.sendMessage({type: 'START_SERVER'});
            return response?.success || false;
        } catch (error) {
            console.error('Error starting server:', error);
            return false;
        }
    }

    // Stop the backend server
    async function stopServer() {
        try {
            const response = await chrome.runtime.sendMessage({type: 'STOP_SERVER'});
            return response?.success || false;
        } catch (error) {
            console.error('Error stopping server:', error);
            return false;
        }
    }

    // Update server status display (without flickering)
    let isUpdatingServerStatus = false;
    async function updateServerStatus(skipToggleUpdate = false) {
        if (isUpdatingServerStatus) return;
        isUpdatingServerStatus = true;
        
        try {
            const isRunning = await checkServerStatus();
            
            if (elements.serverStatusText) {
                if (isRunning) {
                    elements.serverStatusText.textContent = 'Server status: Running';
                    elements.serverStatusText.style.color = '#27ae60';
                } else {
                    elements.serverStatusText.textContent = 'Server status: Stopped';
                    elements.serverStatusText.style.color = '#e74c3c';
                }
            }
            
            // Only update toggle if not skipping (to prevent flickering)
            if (!skipToggleUpdate && elements.toggleServer) {
                // Prevent event firing during programmatic update
                const wasChecked = elements.toggleServer.checked;
                elements.toggleServer.checked = isRunning;
                
                // Save state to cache
                const cache = await getCache();
                cache.settings = cache.settings || {};
                cache.settings.server_running = isRunning;
                await saveCache(cache);
            }
        } finally {
            isUpdatingServerStatus = false;
        }
    }

    // Function to update the current site status display
    function updateCurrentSiteStatus(type, domain = '') {
        let text = 'Scanning...';
        let className = 'checking'; // Default checking color (orange)

        if (type === 'safe') {
            text = `Safe: ${domain}`;
            className = 'safe'; // Green
        } else if (type === 'phishing') {
            text = `Phishing: ${domain}`;
            className = 'phishing'; // Red
        } else if (type === 'error') {
            text = `Error: ${domain}`; // Or a more generic message
            className = 'error'; // Grey or another error color
        }

        elements.currentSiteStatus.innerHTML = `<span class="status-text">${text}</span>`;
        elements.currentSiteStatus.className = `status-display ${className}`;
    }

    async function updateUI() {
        try {
            const cache = await getCache();
            const settings = cache.settings || {};
            
            // Update toggle
            elements.toggleEnabled.checked = settings.enabled !== false;
            
            // Update global status indicator (top right)
            if (settings.enabled !== false) {
                elements.statusText.textContent = 'Active';
                elements.statusIndicator.classList.add('safe'); // Assuming active means safe state for the icon
                elements.statusIndicator.classList.remove('phishing', 'error');
            } else {
                elements.statusText.textContent = 'Disabled';
                elements.statusIndicator.classList.remove('safe', 'phishing', 'error');
                // No specific class for disabled, default will be grey dot from CSS
            }
            
            // Update stats
            const cachedCount = Object.keys(cache.subdomains || {}).length;
            const whitelistCount = (cache.whitelist || []).length;
            const blacklistCount = (cache.blacklist || []).length;
            
            elements.cachedCount.textContent = cachedCount;
            elements.whitelistCount.textContent = whitelistCount;
            elements.blacklistCount.textContent = blacklistCount;
            
            // Update current site status based on active tab
            chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
                if (tabs[0] && tabs[0].url) {
                    const currentUrl = new URL(tabs[0].url);
                    const domain = currentUrl.hostname;
                    const cachedEntry = cache.subdomains?.[domain];

                    if (!settings.enabled) {
                        updateCurrentSiteStatus('error', 'Protection Disabled');
                    } else if (cache.whitelist?.includes(domain)) {
                        updateCurrentSiteStatus('safe', 'Whitelisted');
                    } else if (cache.blacklist?.includes(domain)) {
                        updateCurrentSiteStatus('phishing', 'Blacklisted');
                    } else if (cachedEntry) {
                        if (cachedEntry.type === 1) { // Phishing
                            updateCurrentSiteStatus('phishing', domain);
                        } else { // Safe
                            updateCurrentSiteStatus('safe', domain);
                        }
                    } else {
                        // If not cached, or other conditions, show scanning or unknown
                        updateCurrentSiteStatus('checking', domain);
                    }
                } else {
                    updateCurrentSiteStatus('error', 'No active tab');
                }
            });

            // Update last scan
            const lastScanTime = cache.last_scan_time;
            if (lastScanTime) {
                const date = new Date(lastScanTime);
                const now = new Date();
                const diff = Math.floor((now - date) / 1000);
                
                if (diff < 60) {
                    elements.lastScan.textContent = `${diff}s ago`;
                } else if (diff < 3600) {
                    elements.lastScan.textContent = `${Math.floor(diff / 60)}m ago`;
                } else if (diff < 86400) {
                    elements.lastScan.textContent = `${Math.floor(diff / 3600)}h ago`;
                } else if (diff < 604800) { // Less than 7 days
                    elements.lastScan.textContent = `${Math.floor(diff / 86400)}d ago`;
                }
                else {
                    elements.lastScan.textContent = date.toLocaleDateString();
                }
            } else {
                elements.lastScan.textContent = 'Never';
            }
        } catch (error) {
            console.error('Error updating UI:', error);
            updateCurrentSiteStatus('error', 'UI Error');
        }
    }

    // Event listeners
    elements.toggleEnabled.addEventListener('change', async (e) => {
        const cache = await getCache();
        cache.settings = cache.settings || {};
        cache.settings.enabled = e.target.checked;
        await saveCache(cache);
        await updateUI();
        chrome.runtime.sendMessage({type: 'REFRESH_SETTINGS'}); // Notify background script
    });

    // Server toggle event listener
    if (elements.toggleServer) {
        let isToggling = false;
        elements.toggleServer.addEventListener('change', async (e) => {
            if (isToggling) return;
            isToggling = true;
            
            const shouldStart = e.target.checked;
            
            if (shouldStart) {
                // Check if already running first
                let isRunning = await checkServerStatus();
                if (isRunning) {
                    await updateServerStatus(false);
                    isToggling = false;
                    return;
                }
                
                // Try to start server using Native Messaging (if setup was done)
                elements.serverStatusText.textContent = 'Server status: Starting...';
                elements.serverStatusText.style.color = '#f39c12';
                
                try {
                    const response = await chrome.runtime.sendMessage({type: 'START_SERVER'});
                    
                    if (response && response.success) {
                        // Wait for server to start
                        let serverStarted = false;
                        for (let i = 0; i < 8; i++) {
                            serverStarted = await checkServerStatus();
                            if (serverStarted) break;
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            elements.serverStatusText.textContent = `Server status: Starting... (${i + 1}/8)`;
                        }
                        
                        if (serverStarted) {
                            await updateServerStatus(false);
                        } else {
                            elements.serverStatusText.textContent = 'Server status: Not started - run setup first';
                            elements.serverStatusText.style.color = '#e74c3c';
                            e.target.checked = false;
                        }
                    } else {
                        elements.serverStatusText.textContent = 'Server status: Setup required - download setup file';
                        elements.serverStatusText.style.color = '#e74c3c';
                        e.target.checked = false;
                    }
                } catch (error) {
                    console.error('Error starting server:', error);
                    elements.serverStatusText.textContent = 'Server status: Setup required';
                    elements.serverStatusText.style.color = '#e74c3c';
                    e.target.checked = false;
                }
                
                isToggling = false;
            } else {
                await stopServer();
                await new Promise(resolve => setTimeout(resolve, 1000));
                await updateServerStatus(false);
            }
            
            isToggling = false;
        });
    }

    elements.openOptions.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    elements.setupInstructions.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('setup.html') });
    });

    elements.clearCache.addEventListener('click', async () => {
        if (confirm('Clear all cached scan results?')) {
            const cache = await getCache();
            cache.subdomains = {};
            await saveCache(cache);
            await updateUI();
            chrome.runtime.sendMessage({type: 'REFRESH_SETTINGS'}); // Notify background script
        }
    });

    // Initial load - restore toggle states first to prevent flickering
    // Add a class to disable transitions during initial load
    document.body.classList.add('initial-loading');
    
    const cache = await getCache();
    const settings = cache.settings || {};
    
    // Restore server toggle state from cache (check actual status)
    if (elements.toggleServer) {
        const isRunning = await checkServerStatus();
        elements.toggleServer.checked = isRunning;
        
        // Save state
        cache.settings = cache.settings || {};
        cache.settings.server_running = isRunning;
        await saveCache(cache);
    }
    
    // Now update UI
    await updateUI();
    await updateServerStatus(true); // Skip toggle update on initial load
    
    // Remove loading class after a short delay to enable transitions
    setTimeout(() => {
        document.body.classList.remove('initial-loading');
    }, 100);
    
    // Update intervals
    let updateInterval = setInterval(updateUI, 2000);
    let serverStatusInterval = setInterval(() => updateServerStatus(false), 3000);
    
    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.cache) {
            updateUI();
        }
    });

    // Initial call for current site status
    updateCurrentSiteStatus('checking');

})();
