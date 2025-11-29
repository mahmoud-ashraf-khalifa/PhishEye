// AI EDIT ACCESS GRANTED
(function() {
    'use strict';

    const navButtons = document.querySelectorAll('.nav-btn');
    const settingsContent = document.getElementById('settings-content');

    function setActiveTab(tabName) {
        navButtons.forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            setActiveTab(btn.dataset.tab);
            showTab(btn.dataset.tab);
        });
    });

    async function loadCache() {
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

    function normalizeDomain(domain) {
        return domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    }

    async function showTab(tab) {
        const cache = await loadCache();
        
        if (tab === 'general') {
            const s = cache.settings || {};
            settingsContent.innerHTML = `
                <div class="section">
                    <h3>General Settings</h3>
                    
                    <div class="form-group">
                        <div class="toggle-switch">
                            <label for="enable-protection">Enable Phishing Protection</label>
                            <label class="switch">
                                <input type="checkbox" id="enable-protection" ${s.enabled !== false ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                        </div>
                        <p class="info-text">When enabled, PhishEye will automatically scan websites for phishing attempts</p>
                    </div>
                    
                    <div class="form-group">
                        <label for="backend-url">Backend Server URL</label>
                        <input type="text" id="backend-url" value="${s.backend_url || 'http://127.0.0.1:5000'}" placeholder="http://127.0.0.1:5000">
                        <p class="info-text">URL of your PhishEye backend server</p>
                    </div>
                    
                    <div class="form-group">
                        <label for="cache-expiry">Cache Expiry (days)</label>
                        <input type="number" id="cache-expiry" value="${s.cache_expiry_days || 7}" min="1" max="30">
                        <p class="info-text">How long to cache scan results before re-scanning</p>
                    </div>
                    
                    <button class="btn btn-primary" id="save-general-settings">Save Settings</button>
                </div>
            `;
            document.getElementById('save-general-settings').addEventListener('click', saveGeneralSettings);
        }
        else if (tab === 'cache') {
            const domains = Object.entries(cache.subdomains || {});
            let html = `
                <div class="section">
                    <h3>Cached Domains (${domains.length})</h3>
                    ${domains.length > 0 ? `
                        <table>
                            <thead>
                                <tr>
                                    <th>Domain</th>
                                    <th>Status</th>
                                    <th>Cached Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                    ` : '<p class="info-text">No cached domains yet.</p>'}
            `;
            
            for (let [dom, entry] of domains) {
                const date = new Date(entry.timestamp);
                html += `
                    <tr>
                        <td><strong>${dom}</strong></td>
                        <td><span class="badge ${entry.type === 1 ? 'badge-danger' : 'badge-success'}">${entry.type === 1 ? 'Phishing' : 'Safe'}</span></td>
                        <td>${date.toLocaleString()}</td>
                        <td>
                            <button class="btn btn-secondary" data-action="toggle-cache" data-domain="${dom.replace(/"/g, '"')}"'>Toggle</button>
                            <button class="btn btn-danger" data-action="delete-cache" data-domain="${dom.replace(/"/g, '"')}"'>Delete</button>
                        </td>
                    </tr>
                `;
            }
            
            if (domains.length > 0) {
                html += '</tbody></table>';
            }
            
            html += `
                <button class="btn btn-danger" id="clear-all-cache-btn" style="margin-top: 20px;">Clear All Cache</button>
                </div>
            `;
            settingsContent.innerHTML = html;
            
            document.getElementById('clear-all-cache-btn').addEventListener('click', clearAllCache);
        }
        else if (tab === 'whitelist') {
            const whitelist = cache.whitelist || [];
            settingsContent.innerHTML = `
                <div class="section">
                    <h3>Whitelist (${whitelist.length})</h3>
                    <p class="info-text">Domains in the whitelist will never be flagged as phishing</p>
                    
                    <div class="input-group">
                        <input type="text" id="wl-input" placeholder="example.com">
                        <button class="btn btn-primary" id="add-whitelist-domain">Add Domain</button>
                    </div>
                    
                    ${whitelist.length > 0 ? `
                        <div style="margin-top: 20px;">
                            ${whitelist.map(d => `
                                <div class="list-item">
                                    <span><strong>${d}</strong></span>
                                    <button class="btn btn-danger" data-action="delete-whitelist" data-domain="${d.replace(/"/g, '"')}"'>Remove</button>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="info-text">No whitelisted domains.</p>'}
                </div>
            `;
             document.getElementById('add-whitelist-domain').addEventListener('click', addWhitelist);
             document.getElementById('wl-input').addEventListener('keypress', (event) => {
                 if (event.key === 'Enter') addWhitelist();
             });
        }
        else if (tab === 'blacklist') {
            const blacklist = cache.blacklist || [];
            settingsContent.innerHTML = `
                <div class="section">
                    <h3>Blacklist (${blacklist.length})</h3>
                    <p class="info-text">Domains in the blacklist will always be flagged as phishing</p>
                    
                    <div class="input-group">
                        <input type="text" id="bl-input" placeholder="malicious-site.com">
                        <button class="btn btn-primary" id="add-blacklist-domain">Add Domain</button>
                    </div>
                    
                    ${blacklist.length > 0 ? `
                        <div style="margin-top: 20px;">
                            ${blacklist.map(d => `
                                <div class="list-item">
                                    <span><strong>${d}</strong></span>
                                    <button class="btn btn-danger" data-action="delete-blacklist" data-domain="${d.replace(/"/g, '"')}"'>Remove</button>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="info-text">No blacklisted domains.</p>'}
                </div>
            `;
            document.getElementById('add-blacklist-domain').addEventListener('click', addBlacklist);
            document.getElementById('bl-input').addEventListener('keypress', (event) => {
                if (event.key === 'Enter') addBlacklist();
            });
        }
        else if (tab === 'advanced') {
            const s = cache.settings || {};
            settingsContent.innerHTML = `
                <div class="section">
                    <h3>Advanced Settings</h3>
                    
                    <div class="form-group">
                        <label for="debounce-delay">Scan Debounce Delay (ms)</label>
                        <input type="number" id="debounce-delay" value="${s.debounce_delay || 1500}" min="0" max="5000" step="100">
                        <p class="info-text">Delay before scanning after page load (prevents rapid scans during navigation)</p>
                    </div>
                    
                    <div class="form-group">
                        <label for="cooldown-seconds">Scan Cooldown (seconds)</label>
                        <input type="number" id="cooldown-seconds" value="${s.cooldown_seconds || 5}" min="1" max="60">
                        <p class="info-text">Minimum time between scans of the same URL</p>
                    </div>
                    
                    <div class="form-group">
                        <label for="request-timeout">Request Timeout (seconds)</label>
                        <input type="number" id="request-timeout" value="${s.request_timeout || 10}" min="1" max="60">
                        <p class="info-text">Maximum time to wait for backend response</p>
                    </div>
                    
                    <div class="form-group">
                        <div class="toggle-switch">
                            <label for="show-logs">Show Detailed Logs</label>
                            <label class="switch">
                                <input type="checkbox" id="show-logs" ${s.show_logs === true ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                        </div>
                        <p class="info-text">Enable detailed console logging for debugging</p>
                    </div>
                    
                    <button class="btn btn-primary" id="save-advanced-settings">Save Advanced Settings</button>
                </div>
            `;
            document.getElementById('save-advanced-settings').addEventListener('click', saveAdvancedSettings);
        }
    }

    window.saveGeneralSettings = async function() {
        const cache = await loadCache();
        cache.settings = cache.settings || {};
        cache.settings.enabled = document.getElementById('enable-protection').checked;
        cache.settings.backend_url = document.getElementById('backend-url').value.trim();
        cache.settings.cache_expiry_days = parseInt(document.getElementById('cache-expiry').value) || 7;
        await saveCache(cache);
        showNotification('Settings saved successfully!');
        showTab('general');
    };

    window.saveAdvancedSettings = async function() {
        const cache = await loadCache();
        cache.settings = cache.settings || {};
        cache.settings.debounce_delay = parseInt(document.getElementById('debounce-delay').value) || 1500;
        cache.settings.cooldown_seconds = parseInt(document.getElementById('cooldown-seconds').value) || 5;
        cache.settings.request_timeout = parseInt(document.getElementById('request-timeout').value) || 10;
        cache.settings.show_logs = document.getElementById('show-logs').checked;
        await saveCache(cache);
        showNotification('Advanced settings saved! Reload the extension for changes to take effect.');
        showTab('advanced');
    };

    const editCache = async function(dom) {
        const cache = await loadCache();
        const entry = cache.subdomains?.[dom];
        if (entry) {
            entry.type = entry.type === 1 ? 0 : 1;
            await saveCache(cache);
            showTab('cache');
        }
    };

    const deleteCache = async function(dom) {
        if (!confirm(`Delete cache entry for ${dom}?`)) return;
        const cache = await loadCache();
        delete cache.subdomains?.[dom];
        await saveCache(cache);
        showTab('cache');
    };

    const clearAllCache = async function() {
        if (!confirm('Clear all cached domains? This cannot be undone.')) return;
        const cache = await loadCache();
        cache.subdomains = {};
        await saveCache(cache);
        showNotification('Cache cleared successfully!');
        showTab('cache');
    };

    const addWhitelist = async function() {
        const input = document.getElementById('wl-input');
        const val = normalizeDomain(input.value);
        if (!val) {
            showNotification('Please enter a valid domain', 'error');
            return;
        }
        const cache = await loadCache();
        cache.whitelist = cache.whitelist || [];
        if (!cache.whitelist.includes(val)) {
            cache.whitelist.push(val);
            await saveCache(cache);
            input.value = '';
            showNotification('Domain added to whitelist', 'success');
            showTab('whitelist');
            chrome.runtime.sendMessage({type: 'REFRESH_SETTINGS'});
        } else {
            showNotification('Domain already in whitelist', 'error');
        }
    };

    const delWhitelist = async function(d) {
        if (!confirm(`Remove ${d} from whitelist?`)) return;
        const cache = await loadCache();
        cache.whitelist = (cache.whitelist || []).filter(x => x !== d);
        await saveCache(cache);
        showNotification('Domain removed from whitelist', 'success');
        showTab('whitelist');
        chrome.runtime.sendMessage({type: 'REFRESH_SETTINGS'});
    };

    const addBlacklist = async function() {
        const input = document.getElementById('bl-input');
        const val = normalizeDomain(input.value);
        if (!val) {
            showNotification('Please enter a valid domain', 'error');
            return;
        }
        const cache = await loadCache();
        cache.blacklist = cache.blacklist || [];
        if (!cache.blacklist.includes(val)) {
            cache.blacklist.push(val);
            await saveCache(cache);
            input.value = '';
            showNotification('Domain added to blacklist', 'success');
            showTab('blacklist');
            chrome.runtime.sendMessage({type: 'REFRESH_SETTINGS'});
        } else {
            showNotification('Domain already in blacklist', 'error');
        }
    };

    const delBlacklist = async function(d) {
        if (!confirm(`Remove ${d} from blacklist?`)) return;
        const cache = await loadCache();
        cache.blacklist = (cache.blacklist || []).filter(x => x !== d);
        await saveCache(cache);
        showNotification('Domain removed from blacklist', 'success');
        showTab('blacklist');
        chrome.runtime.sendMessage({type: 'REFRESH_SETTINGS'});
    };

    function showNotification(message, type = 'success') {
        let notificationContainer = document.getElementById('notification-container');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            document.body.appendChild(notificationContainer);
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        notificationContainer.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out forwards';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Add event delegation for dynamically created buttons within settingsContent
    settingsContent.addEventListener('click', async (event) => {
        const target = event.target;
        const action = target.dataset.action;
        const domain = target.dataset.domain;

        if (action === 'toggle-cache') {
            await editCache(domain);
        } else if (action === 'delete-cache') {
            await deleteCache(domain);
        } else if (action === 'delete-whitelist') {
            await delWhitelist(domain);
        } else if (action === 'delete-blacklist') {
            await delBlacklist(domain);
        }
    });

    // Initial load
    showTab('general');
})();
