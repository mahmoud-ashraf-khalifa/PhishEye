// content.js
(function() {
    'use strict';

    const WARNING_ID = 'phisheye-warning-overlay';
    let warningShown = false;

    function showWarning() {
        if (warningShown) return;
        
        const existing = document.getElementById(WARNING_ID);
        if (existing) {
            existing.remove();
        }

        const overlay = document.createElement('div');
        overlay.id = WARNING_ID;
        overlay.className = 'phisheye-warning-overlay';
        
        const logoUrl = chrome.runtime.getURL('icon88.jpg');
        
        overlay.innerHTML = `
            <div class="phisheye-warning-container">
                <div class="phisheye-warning-modal">
                    <div class="warning-left-col">
                        <div class="warning-icon-area">
                            <div class="warning-icon-shield">🛡️</div>
                        </div>
                        <h1 class="warning-title">Your Account<br>is at Risk</h1>
                    </div>
                    
                    <div class="warning-right-col">
                        <p class="warning-message">
                            This website is <strong>impersonating a legitimate service</strong> to steal your login credentials and personal information.
                        </p>
                        
                        <div class="warning-threat-box">
                            <div class="threat-item">
                                <span class="threat-icon">🔐</span>
                                <div class="threat-text">
                                    <strong>Account Takeover Risk</strong>
                                    <span class="threat-desc">Your passwords could be stolen right now</span>
                                </div>
                            </div>
                            <div class="threat-item">
                                <span class="threat-icon">💳</span>
                                <div class="threat-text">
                                    <strong>Financial Fraud Risk</strong>
                                    <span class="threat-desc">Criminals can use your payment information</span>
                                </div>
                            </div>
                            <div class="threat-item">
                                <span class="threat-icon">📱</span>
                                <div class="threat-text">
                                    <strong>Identity Theft Risk</strong>
                                    <span class="threat-desc">Your personal data is their target</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="warning-actions">
                            <button id="phisheye-leave" class="warning-btn-safe">← Leave to Safety</button>
                            <button id="phisheye-ignore" class="warning-btn-risky">I know what I'm doing</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            * {
                box-sizing: border-box;
            }
            
            .phisheye-warning-container {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                background: linear-gradient(135deg, rgba(0, 0, 0, 0.85) 0%, rgba(20, 20, 20, 0.9) 100%) !important;
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
                z-index: 2147483647 !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif !important;
                animation: fadeInDark 0.4s ease-out !important;
                padding: 20px !important;
                scale: 1.1;
            }
            
            @keyframes fadeInDark {
                from { 
                    background: linear-gradient(135deg, rgba(0, 0, 0, 0) 0%, rgba(20, 20, 20, 0) 100%);
                }
                to { 
                    background: linear-gradient(135deg, rgba(0, 0, 0, 0.7) 0%, rgba(20, 20, 20, 0.8) 100%);
                }
            }
            
            .phisheye-warning-modal {
                background: #ffffff;
                padding: 48px;
                border-radius: 16px;
                max-width: 864px;
                width: 100%;
                box-shadow: 0 20px 70px rgba(211, 47, 47, 0.3), 0 0 0 1px rgba(211, 47, 47, 0.2) !important;
                text-align: center;
                animation: slideInDanger 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
                position: relative;
                border-top: 4px solid #d32f2f;
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 48px;
                align-items: center;
                transform-origin: center;
            }
            
            @keyframes slideInDanger {
                from {
                    opacity: 0;
                    transform: translateY(40px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            
            .warning-pulse {
                position: absolute;
                top: -15px;
                left: 50%;
                transform: translateX(-50%);
                width: 30px;
                height: 30px;
                background: #d32f2f;
                border-radius: 50%;
                opacity: 0;
                animation: pulse-danger 2s ease-in-out infinite;
                box-shadow: 0 0 0 0 #d32f2f;
            }
            
            .warning-left-col {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
                padding-right: 20px;
                border-right: 2px solid #f0f0f0;
            }
            
            .warning-right-col {
                display: flex;
                flex-direction: column;
                gap: 20px;
                text-align: left;
            }
            
            @keyframes pulse-danger {
                0% {
                    opacity: 1;
                    box-shadow: 0 0 0 0 #d32f2f;
                }
                50% {
                    opacity: 1;
                }
                100% {
                    opacity: 0;
                    box-shadow: 0 0 0 15px rgba(211, 47, 47, 0);
                }
            }
            
            .warning-icon-area {
                margin-bottom: 20px;
            }
            
            .warning-icon-shield {
                font-size: 48px;
                animation: shake 0.5s ease-in-out;
            }
            
            @keyframes shake {
                0%, 100% { transform: rotate(0deg); }
                25% { transform: rotate(-5deg); }
                75% { transform: rotate(5deg); }
            }
            
            .warning-title {
                color: #1a1a1a;
                font-size: 28px;
                font-weight: 700;
                margin: 0;
                letter-spacing: -0.4px;
                line-height: 1.3;
            }
            
            .warning-message {
                color: #333;
                font-size: 15px;
                line-height: 1.6;
                margin: 0 0 20px 0;
            }
            
            .warning-message strong {
                color: #d32f2f;
                font-weight: 700;
            }
            
            .warning-threat-box {
                background: linear-gradient(135deg, #fff5f5 0%, #fde7e7 100%);
                border: 1px solid #ffcdd2;
                border-radius: 12px;
                padding: 18px;
                margin: 0 0 20px 0;
                text-align: left;
            }
            
            .threat-item {
                display: flex;
                gap: 12px;
                align-items: flex-start;
                margin-bottom: 12px;
            }
            
            .threat-item:last-child {
                margin-bottom: 0;
            }
            
            .threat-icon {
                font-size: 20px;
                flex-shrink: 0;
                margin-top: 2px;
            }
            
            .threat-text {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            
            .threat-text strong {
                color: #d32f2f;
                font-size: 13px;
                font-weight: 700;
            }
            
            .threat-desc {
                color: #666;
                font-size: 12px;
            }
            
            .warning-actions {
                display: flex;
                flex-direction: column;
                gap: 10px;
                justify-content: flex-start;
            }
            
            .warning-btn-safe {
                background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%);
                color: white;
                border: none;
                padding: 14px 20px;
                border-radius: 10px;
                font-size: 15px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 4px 15px rgba(211, 47, 47, 0.3);
                letter-spacing: 0.3px;
                order: 1;
                width: 100%;
            }
            
            .warning-btn-safe:hover {
                background: linear-gradient(135deg, #b71c1c 0%, #8b0000 100%);
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(211, 47, 47, 0.4);
            }
            
            .warning-btn-safe:active {
                transform: translateY(0);
                box-shadow: 0 2px 8px rgba(211, 47, 47, 0.3);
            }
            
            .warning-btn-risky {
                background: transparent;
                color: #999;
                border: 1px solid #ddd;
                padding: 9px 12px;
                border-radius: 8px;
                font-size: 11px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                order: 2;
                width: 100%;
            }
            
            .warning-btn-risky:hover {
                color: #666;
                border-color: #bbb;
                background: #f5f5f5;
            }
        `;
        
        document.head.appendChild(style);
        
        const insertOverlay = () => {
            if (document.body) {
                document.body.appendChild(overlay);
                document.body.style.overflow = 'hidden';
                warningShown = true;
                
                const leaveBtn = overlay.querySelector('#phisheye-leave');
                const ignoreBtn = overlay.querySelector('#phisheye-ignore');
                
                if (leaveBtn) {
                    leaveBtn.addEventListener('click', () => {
                        window.location.href = 'about:blank';
                    });
                }
                
                if (ignoreBtn) {
                    ignoreBtn.addEventListener('click', () => {
                        overlay.remove();
                        document.body.style.overflow = '';
                        warningShown = false;
                    });
                }
            } else {
                setTimeout(insertOverlay, 100);
            }
        };
        
        insertOverlay();
    }

    function showBlacklistWarning() {
        const overlay = document.createElement('div');
        overlay.id = 'phisheye-blacklist-overlay';
        overlay.className = 'phisheye-blacklist-container';
        
        overlay.innerHTML = `
            <div class="phisheye-blacklist-modal">
                <div class="blacklist-content-wrapper">
                    <div class="blacklist-icon-box">
                        <div class="blacklist-icon">🚫</div>
                    </div>
                    
                    <div class="blacklist-text-area">
                        <h1 class="blacklist-title">Access Blocked</h1>
                        <p class="blacklist-subtitle">This website has been restricted</p>
                    </div>
                    
                    <div class="blacklist-details">
                        <div class="detail-card">
                            <div class="detail-icon">📋</div>
                            <div class="detail-text">
                                <strong>Restricted Site</strong>
                                <span>This website is on your restricted list</span>
                            </div>
                        </div>
                        <div class="detail-card">
                            <div class="detail-icon">🔒</div>
                            <div class="detail-text">
                                <strong>Cannot Access</strong>
                                <span>You don't have permission to visit this page</span>
                            </div>
                        </div>
                        <div class="detail-card">
                            <div class="detail-icon">⚙️</div>
                            <div class="detail-text">
                                <strong>Settings Required</strong>
                                <span>Modify your settings to remove this restriction</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="blacklist-actions">
                        <button id="phisheye-go-home" class="blacklist-btn-home">← Go Back</button>
                    </div>
                </div>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            .phisheye-blacklist-container {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                background: linear-gradient(135deg, #f5f5f5 0%, #ececec 100%) !important;
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
                z-index: 2147483647 !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif !important;
                animation: fadeInBlack 0.3s ease-out !important;
            }
            
            @keyframes fadeInBlack {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .phisheye-blacklist-modal {
                background: white;
                width: 100%;
                max-width: 675px;
                border-radius: 20px;
                box-shadow: 0 20px 80px rgba(0, 0, 0, 0.15) !important;
                display: flex;
                justify-content: center;
                align-items: center;
                animation: slideUpBlacklist 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                border: 1px solid #e0e0e0;
            }
            
            @keyframes slideUpBlacklist {
                from {
                    opacity: 0;
                    transform: translateY(40px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            
            .blacklist-content-wrapper {
                padding: 50px 45px;
                text-align: center;
                width: 100%;
            }
            
            .blacklist-icon-box {
                margin-bottom: 28px;
            }
            
            .blacklist-icon {
                font-size: 72px;
                animation: bounce-block 0.6s ease-out;
            }
            
            @keyframes bounce-block {
                0% { transform: scale(0.3) rotate(-10deg); opacity: 0; }
                70% { transform: scale(1.1); }
                100% { transform: scale(1) rotate(0deg); opacity: 1; }
            }
            
            .blacklist-text-area {
                margin-bottom: 36px;
            }
            
            .blacklist-title {
                color: #1a1a1a;
                font-size: 38px;
                font-weight: 800;
                margin: 0 0 20px 0;
                position: relative;
                bottom: -45px;
                width: 640px;
            }
            
            .blacklist-subtitle {
                color: #777;
                font-size: 16px;
                font-weight: 500;
                margin: 0;
            }
            
            .blacklist-details {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 16px;
                margin-bottom: 40px;
            }
            
            .detail-card {
                background: #f9f9f9;
                border: 1px solid #e8e8e8;
                border-radius: 12px;
                padding: 18px 16px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
                transition: all 0.2s;
            }
            
            .detail-card:hover {
                background: #f0f0f0;
                border-color: #d0d0d0;
            }
            
            .detail-icon {
                font-size: 28px;
            }
            
            .detail-text {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
            .detail-text strong {
                color: #333;
                font-size: 13px;
                font-weight: 700;
                letter-spacing: 0.3px;
            }
            
            .detail-text span {
                color: #888;
                font-size: 12px;
                line-height: 1.4;
            }
            
            .blacklist-actions {
                display: flex;
                justify-content: center;
            }
            
            .blacklist-btn-home {
                background: linear-gradient(135deg, #333 0%, #000 100%);
                color: white;
                border: none;
                padding: 14px 32px;
                border-radius: 10px;
                font-size: 15px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
                letter-spacing: 0.5px;
            }
            
            .blacklist-btn-home:hover {
                background: linear-gradient(135deg, #000 0%, #1a1a1a 100%);
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
            }
            
            .blacklist-btn-home:active {
                transform: translateY(0);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            
            @media (max-width: 600px) {
                .blacklist-details {
                    grid-template-columns: 1fr;
                }
                
                .blacklist-title {
                    font-size: 32px;
                }
                
                .phisheye-blacklist-modal {
                    width: 95%;
                    width: 675px;
                }
                
                .blacklist-content-wrapper {
                    padding: 40px 30px;
                }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        
        const homeBtn = overlay.querySelector('#phisheye-go-home');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                window.location.href = 'about:blank';
            });
        }
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message?.type === 'PING') {
            sendResponse({ status: 'ready' });
            return true;
        }
        
        if (message?.type === 'PHISHEYE_WARNING') {
            showWarning();
            // Retry in case DOM isn't fully ready
            setTimeout(() => {
                if (!warningShown) showWarning();
            }, 100);
            setTimeout(() => {
                if (!warningShown) showWarning();
            }, 500);
            return true;
        }
        
        if (message?.type === 'PHISHEYE_BLACKLIST') {
            showBlacklistWarning();
            return true;
        }
        
        return false;
    });

    // Ensure warning shows even if message arrives before DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Content script is ready
        });
    }
})();
