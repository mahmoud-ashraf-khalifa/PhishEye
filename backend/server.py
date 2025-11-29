# AI EDIT ACCESS GRANTED
from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os

# Get the backend directory path
backend_dir = os.path.dirname(os.path.abspath(__file__))

# Change working directory to backend so models and CSV files can be found
os.chdir(backend_dir)

# Add the backend directory to the path so we can import phisheye modules
try:
    from phisheye_v6 import predict
except ImportError:
    # Fallback if phisheye_v6 can't be imported
    predict = None

app = Flask(__name__)
# Configure CORS to allow requests from Chrome extensions
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

@app.route("/scan", methods=["POST", "OPTIONS"])
def scan():
    # Handle CORS preflight
    if request.method == "OPTIONS":
        response = jsonify({})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response
    try:
        print(f"[SCAN] Received request from {request.remote_addr}")
        print(f"[SCAN] Headers: {dict(request.headers)}")
        data = request.get_json()
        url = data.get("url")
        print(f"[SCAN] Scanning URL: {url}")
        
        if not url:
            return jsonify({"error": "No URL provided", "result": 0}), 400

        # Use the actual PhishEye detection logic
        if predict:
            result_data = predict(url, json_out=False)
            # result_data is a dict with "final_score" (0.0 to 1.0)
            # Convert to binary: 1 if final_score >= 0.5 (phishing), 0 otherwise
            final_score = result_data.get("final_score", 0.0)
            result = 1 if final_score >= 0.5 else 0
            response = jsonify({
                "cached": False,
                "result": result,
                "final_score": final_score,
                "url": url
            })
            response.headers.add("Access-Control-Allow-Origin", "*")
            print(f"[SCAN] Result: {'PHISHING' if result == 1 else 'SAFE'} (score: {final_score:.2f})")
            return response
        else:
            # Fallback dummy logic if phisheye_v6 can't be imported
            result = 1 if "phish" in url.lower() else 0
            response = jsonify({"cached": False, "result": result})
            response.headers.add("Access-Control-Allow-Origin", "*")
            return response
            
    except Exception as e:
        print(f"Error in /scan endpoint: {e}", file=sys.stderr)
        return jsonify({"error": str(e), "result": 0}), 500

@app.route("/health", methods=["GET"])
def health():
    response = jsonify({"status": "ok"})
    response.headers.add("Access-Control-Allow-Origin", "*")
    return response

if __name__ == "__main__":
    # Explicitly set host and port for the extension to connect
    app.run(host="127.0.0.1", port=5000, debug=True)
