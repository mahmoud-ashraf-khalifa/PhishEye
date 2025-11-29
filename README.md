# 🛡️ PhishEye - Real-Time Phishing Detection Extension

Stop phishing attacks before they happen. PhishEye is a Chrome extension that uses machine learning to detect and block phishing attempts in real-time, protecting your accounts and data with zero friction.

## The Problem

Phishing attacks aren't slowing down. In fact, they're getting smarter. Every day, thousands of people fall for convincing fake login pages, credential harvesters, and financial scams. By the time you realize something's wrong, attackers already have your information. Traditional security relies on known threats and user awareness—both fail constantly. You need something that catches phishing *before* you click.

## The Solution

PhishEye combines machine learning with behavioral analysis to scan every URL you visit. The moment you land on a phishing site, you get an aggressive, hard-to-ignore warning designed specifically to stop you in your tracks. It's not a notification you can accidentally dismiss—it's a blocker that demands your attention.

## 🚀 Key Features

### **Intelligent URL Scanning**
- ML-powered detection using a Random Forest model trained on 500k+ real phishing URLs
- Analyzes 20+ features: domain age, SSL validity, URL structure, WHOIS data, DNS reputation, suspicious keywords
- Results cached for 7 days—fast response, minimal backend load

### **Two Smart Warning Systems**

**🚨 Phishing Alert** - Psychological Design to Prevent Bypass
- Large, impossible-to-miss red warning modal 
- Prominent "Leave Site" button with psychological weighting
- Tiny, hard-to-click "Skip" button positioned below
- Animated threat descriptions showing real risks: account takeover, financial fraud, identity theft
- Pulsing red dot + shield animation to capture attention
- 50% darker background overlay to block site interaction

**🔒 Blacklist Enforcement** - Strict No-Bypass Mode
- For parental controls, addiction recovery, company policies
- Card-based modal (not full-screen) with neutral, non-threatening language
- Only "Go Back" button—no skip option available
- Informational detail cards explaining why access is blocked
- Professional appearance matching system security dialogs

### **Smart Caching & Performance**
- 7-day result caching reduces backend calls by ~80%
- Average scan time: <500ms with caching enabled
- Whitelist for trusted sites, blacklist for blocked domains
- Settings menu for easy customization

### **Multiple Detection Methods**
- Random Forest ML classification (20 trained features)
- DNS reputation checking (secondary model)
- Domain age and SSL certificate validation
- WHOIS lookups for registration anomalies
- URL pattern and structure analysis
- Google SafeBrowsing API
- Open PageRank API
- Tranco Top 1M List

## 📋 How It Works

```
User visits website
    ↓
background.js intercepts URL
    ↓
Check whitelist? → Skip scan, allow access
    ↓
Check blacklist? → Show strict enforcement warning
    ↓
Check cache (7-day TTL)? → Use cached result
    ↓
Send to backend to scan (Flask server)
    ↓
Classification: Phishing or Safe
    ↓
Cache result for 7 days
    ↓
content.js displays appropriate warning or allows access
```

## 📊 Model Details

**Training Data:**
- 167,000+ URLs to train on 
- 80/20 train/test split

**Features Analyzed:**
- Domain age and registration info
- SSL/TLS certificate validity and issuer reputation
- URL length, path complexity, suspicious keywords
- DNS records (MX, SPF, DKIM validation)
- WHOIS registration patterns
- Historical domain reputation
- Domain popularity

**Model Architecture:**
- Random Forest Classifier: 100 decision trees
- Parallel processing (n_jobs=-1) for speed
- Random state fixed for reproducibility
- DNS-based lightweight model for offline scoring

## 🔧 Installation & Setup

### Quick Start

**1. Clone the Repository**
```bash
git clone https://github.com/mahmoud-ashraf-khalifa/PhishEye.git
cd PhishEye
```

**2. Set Up the Backend**
```bash
# On Windows
cd PhishEye\backend
python -m venv PhishEye_venv
PhishEye_venv\Scripts\activate
pip install -r requirements.txt

# On Mac/Linux
cd PhishEye/backend
python -m venv PhishEye_venv
source PhishEye_venv/bin/activate
pip install -r requirements.txt
```

**3. Start the Flask Server**
```bash
python server.py
# Server runs on http://localhost:5000
```

**4. Load the Extension**

Open Chrome and go to the Extension Manager:
```
chrome://extensions/
```

1. **Enable Developer Mode**
   - Look for the toggle in the top-right corner
   - Click it to turn on "Developer mode"

2. **Load Unpacked**
   - Click the "Load unpacked" button (appears after enabling Developer mode)
   - Navigate to your PhishEye project folder
   - Select the `PhishEye/` folder and confirm

3. **Verify Installation**
   - You should see PhishEye appear in your extensions list
   - A PhishEye icon will appear in your Chrome toolbar (top-right)
   - If you see any errors, check that Flask server is running on localhost:5000

**5. Test It Out**
- Click the PhishEye icon in your toolbar
- Click "Open Setup Page" to verify backend connection
- Try visiting a test phishing site (use caution!) or add URLs to your whitelist/blacklist
- **Note:** The host should always be on when scaning

### System Requirements
- **Browser:** Chrome 91+, Firefox 88+ (with manifest adaptation)
- **Python:** 3.8 or higher
- **OS:** Windows, macOS, Linux
- **RAM:** 512MB minimum (venv + Flask server)

## 📁 Project Structure

```
PhishEye/                         # Chrome Extension root
├── manifest.json                  # Extension configuration (Manifest V3)
├── background.js                  # Service worker - URL scanning logic
├── content.js                     # Content script - warning UI injection
├── popup.html                     # Extension popup template
├── popup.js                       # Popup logic (stats, quick actions)
├── popup.css                      # Popup styling
├── options.html                   # Settings page
├── options.js                     # Settings logic (whitelist, blacklist,cache)
├── styles.css                     # Global extension styles
├── setup.html                     # Backend setup instructions
├── cache.json                     # Local scan result cache
|
└── backend/                       # Flask backend server
    ├── server.py                  # Flask app + API endpoints
    ├── phisheye_v6.py             # ML model logic + feature extraction
    ├── model-20.pkl               # Random Forest model (trained)
    ├── model-dns.pkl              # DNS reputation model
    ├── phishing_features_20_sampled.csv  # Training data (sample)
    ├── requirements.txt           # Python dependencies
    └── PhishEye_venv/             # Virtual environment
```

## 🛠️ Configuration

### Whitelist/Blacklist Management
1. Click PhishEye icon → "Options"
2. **Whitelist:** Add domains you trust (skips all scans)
3. **Blacklist:** Add domains to block (shows enforcement warning)
4. Changes save automatically to browser storage

### Customizable Settings
- **Scan Timeout:** Default 10 seconds (adjust if backend is slow)
- **Cache Duration:** Default 7 days (change in `background.js`)
- **Model Selection:** Switch between Random Forest and DNS-based detection

### Backend Configuration
Edit `server.py` to adjust:
```python
CORS_ALLOWED_ORIGINS = ['chrome://extensions/']
SCAN_TIMEOUT = 10  # seconds
CACHE_TTL = 604800  # 7 days in seconds
```

## 📦 Dependencies

### Python (Backend)
```
Flask==3.1.2
flask-cors==6.0.1
scikit-learn==1.7.2
numpy==2.3.5
scipy==1.16.3
joblib==1.5.2
requests==2.32.5
beautifulsoup4==4.14.2
tldextract==5.3.0
whois==1.20240129.2
dnspython==2.8.0
```

### Browser APIs (Frontend)
- Chrome Extensions API (Manifest V3)
- Storage API (local + sync)
- Tabs API (URL monitoring)
- Runtime API (message passing)

## 📈 Performance Metrics

- **Scan Speed:** <500ms average (with caching)
- **False Positive Rate:** ~2-3% (varies by dataset)
- **Cache Hit Rate:** ~78% (after 7-day window)
- **Memory Usage:** ~130MB (Venv not included)
- **Backend CPU:** <5% during idle scans

**Real Talk:** Without caching, scanning every URL would crush your backend and slow down browsing. The 7-day TTL is a practical balance—most phishing URLs don't live long anyway, so stale data is less of a risk than you'd think.

## 🚨 How Warnings Work

### Phishing Warning (Aggressive Design)
You see this when we detect a phishing URL. Here's what makes it hard to ignore:
- **Color:** Bright red gradient button with white text
- **Contrast:** 50% darker background overlay blocks site interaction
- **Animation:** Shield emoji shakes, red dot pulses, modal slides up
- **Content:** Shows specific threats (Account Takeover, Financial Fraud, Identity Theft)

Why this design? Phishing works because people click on things while distracted. This warning is intentionally hard to dismiss quickly. You have to *think* to skip it.

### Blacklist Warning (Strict Enforcement)
Used for:
- Parental controls (restrict adult content)
- Addiction recovery (block gaming/social sites during recovery hours)
- Corporate policies (company-wide restrictions)
- Personal productivity (blocking distracting sites)

This warning is different—no skip button exists. Users get information on *why* the site is blocked, then must go home. No judgment, no fear tactics. Just enforcement.

## ⚙️ Advanced Usage

### Adding Custom Models
Replace `model-20.pkl` with your own trained Random Forest:
```python
from sklearn.ensemble import RandomForestClassifier
import joblib

# Train your model...
joblib.dump(model, 'model-20.pkl')
```

### Offline Mode
PhishEye works partially offline using cached results (7-day window). For full offline functionality, use the DNS-based model (lightweight, no internet required).

### Integrating with Security Tools
The backend API exposes scan results:
```bash
curl -X POST http://localhost:5000/scan \
  -H "Content-Type: application/json" \
  -d '{"url": "http://suspicious-site.com"}'
```

Response:
```json
{
  "url": "http://suspicious-site.com",
  "is_phishing": true,
  "confidence": 0.89,
  "cached": false,
  "scan_time": 0.342
}
```

## 🐛 Troubleshooting

**"Warning isn't showing up"**
- Reload the extension: `chrome://extensions/` → Click reload icon
- Check that backend is running: `http://localhost:5000/health`
- Verify the URL isn't whitelisted in Options

**"Backend connection error"**
- Is Flask server running? Try: `python PhishEye/backend/server.py`
- Check port 5000 is available: `netstat -ano | findstr :5000` (Windows)
- Verify CORS settings in `server.py` include your Chrome extension ID

**"Slow scans / timeout errors"**
- Increase `SCAN_TIMEOUT` in `server.py` (default: 10s)
- Check backend server performance: high CPU = model inference bottleneck
- Enable caching: already default, but verify cache.json exists

**"False positives (safe sites blocked)"**
- Add the site to whitelist in Options
- Report the false positive (helps retrain model)
- Check if site recently changed owners (legitimate sites get compromised)

**"Model accuracy seems off"**
- Dataset has ~2-3% false positive rate by design
- Real phishing URLs evolve constantly—retraining needed periodically
- Mixed results? Try the DNS-based model instead

## 🚧 Known Limitations

- **Backend Required:** Currently needs Flask server running locally (not cloud-based)
- **No Real-Time Updates:** Model doesn't auto-update when new phishing discovered
- **Limited Offline:** Only cached results available without internet
- **Training Data:** Model trained on historical URLs—0-day phishing may slip through
- **Performance Trade-off:** Hosting an extension like this locally migth cause slight lag on low-end pc's

## 🤝 Contributing

Found a bug? Have a better idea for the warning design? Want to improve model accuracy?

**We'd love your help:**
1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-idea`
3. Make your changes
4. Test thoroughly (false positives break trust)
5. Submit a pull request with details on what you changed and why

**Specific areas we need help with:**
- Model improvements (better feature engineering)
- False positive reduction
- UI/UX feedback (is the warning actually effective?)
- Testing on different sites
- Documentation improvements
- Backend optimization

## 📄 License

MIT License - Use this however you want, but include the license and don't blame us if something breaks.

## 👤 About

PhishEye started as a frustration with how many phishing attacks slip through traditional security. Standard browser warnings are easy to ignore. This extension takes a different approach: make the warning so prominent and psychologically designed that it *forces* you to think twice before clicking.

Built with ❤️ by security enthusiasts who got tired of resetting compromised passwords.

---

**Have questions? Found a phishing site that slipped through? Reach out:**
- 📧 Email: mahmoudashraf5151@gmail.com
- 💬 Issues: GitHub Issues tab
- 💡 Ideas: GitHub Discussions

---

**Ready to protect yourself? Install PhishEye today.**



