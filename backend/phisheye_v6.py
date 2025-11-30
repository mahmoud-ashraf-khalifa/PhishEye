#!/usr/bin/env python3
# phisheye_v6.py
# PhishEye v6 — parallel, two-ML fusion, Tranco + OpenPageRank + Google SafeBrowsing

import os
import sys
import argparse
import urllib.parse
import tldextract
import requests
import joblib
import csv
import re
import ipaddress
import whois
import dns.resolver
import math
import concurrent.futures
import json
from datetime import datetime
from bs4 import BeautifulSoup

# -------------------------
# Config / placeholders
# -------------------------
OPENPAGERANK_API_KEY = os.getenv("OPENPAGERANK_API_KEY", "!PUT YOUR API KEY HERE!") # dont change the ("OPENPAGERANK_API_KEY",
SAFEBROWSING_API_KEY = os.getenv("SAFEBROWSING_API_KEY", "!PUT YOUR API KEY HERE!") # dont change the ("SAFEBROWSING_API_KEY",
TRANCO_PATH = os.getenv("TRANCO_PATH", "top-1m.csv")     # required
URL_MODEL_PATH = os.getenv("URL_MODEL_PATH", "model-20.pkl")
DNS_MODEL_PATH = os.getenv("DNS_MODEL_PATH", "model-dns.pkl")
THREADS = int(os.getenv("PHISHEYE_THREADS", "12"))

# Tunnels list (as you used previously)
TUNNELS = [".loca.lt", ".ngrok-free.com", "ngrok.io", "localtunnel.me", "trycloudflare.com"]

# -------------------------
# Utilities
# -------------------------
def entropy(s: str) -> float:
    if not s:
        return 0.0
    prob = [float(s.count(c)) / len(s) for c in set(s)]
    return -sum(p * math.log2(p) for p in prob if p > 0)

def has_repeat_digits(s: str) -> int:
    digits = re.findall(r"\d", s)
    return 1 if len(digits) != len(set(digits)) else 0

def is_tunneling_domain(host: str) -> bool:
    host = host.lower()
    return any(host.endswith(t) or (t in host) for t in TUNNELS)

# -------------------------
# Load Tranco top-1m into memory (dict domain->rank)
# -------------------------
def load_tranco(path):
    mapping = {}
    try:
        with open(path, newline='') as f:
            reader = csv.reader(f)
            for row in reader:
                if not row: continue
                # row may be like "1,google.com"
                if len(row) >= 2:
                    rank = row[0].strip()
                    dom = row[1].strip().lower()
                else:
                    # line may be "1,google.com" but csv split keeps it; handle fallback
                    parts = row[0].split(",")
                    if len(parts) >= 2:
                        rank = parts[0].strip(); dom = parts[1].strip().lower()
                    else:
                        continue
                try:
                    mapping[dom] = int(rank)
                except:
                    continue
    except FileNotFoundError:
        # user may not have tranco file; return empty mapping
        return {}
    return mapping

TRANC0 = load_tranco(TRANCO_PATH)

# -------------------------
# Tranco rank lookup (ONLY checks the EXACT full host/subdomain, no fallback)
# Returns rank (int) or None
# -------------------------
def tranco_rank_lookup(host: str):
    if not host:
        return None
    host = host.lower()
    # ONLY check exact host (full subdomain) - NO fallback to registered domain
    if host in TRANC0:
        return TRANC0[host]
    return None

# -------------------------
# OpenPageRank check (uses FULL subdomain/host) -> returns decimal score (0-10) or None
# -------------------------
def get_openpagerank_score(host: str):
    if not host:
        return None
    # Use the full host (subdomain included) instead of just registered domain
    try:
        url = "https://openpagerank.com/api/v1.0/getPageRank"
        params = {"domains[]": host}
        headers = {"API-OPR": OPENPAGERANK_API_KEY}
        r = requests.get(url, params=params, headers=headers, timeout=4)
        if r.status_code != 200:
            return None
        js = r.json()
        score = js.get("response", [{}])[0].get("page_rank_decimal")
        # OpenPageRank returns decimal between 0 and 1 historically; earlier logic expected 0-10 scale
        # We normalize: if page_rank_decimal <=1 assume 0-1 -> *10
        if score is None:
            return None
        try:
            sc_float = float(score)
            if sc_float <= 1:
                sc_float = sc_float * 10.0
            return sc_float
        except:
            return None
    except Exception:
        return None

# -------------------------
# Google Safe Browsing check -> returns True if matched (blacklist)
# -------------------------
def check_safe_browsing(url: str) -> bool:
    if not SAFEBROWSING_API_KEY or "YOUR_SAFEBROWSING_KEY" in SAFEBROWSING_API_KEY:
        # placeholder/no-key => treat as unknown (False)
        return False
    endpoint = f"https://safebrowsing.googleapis.com/v4/threatMatches:find?key={SAFEBROWSING_API_KEY}"
    body = {
        "client": {"clientId": "PhishEye", "clientVersion": "1.0"},
        "threatInfo": {
            "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "PHISHING", "UNWANTED_SOFTWARE"],
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": url}]
        }
    }
    try:
        r = requests.post(endpoint, json=body, timeout=4)
        if r.status_code != 200:
            return False
        data = r.json()
        return "matches" in data
    except Exception:
        return False

# -------------------------
# DOM permission quick scan (if DOM file provided)
# -------------------------
def dom_permission_scan_from_html(html_text: str):
    try:
        soup = BeautifulSoup(html_text, "html.parser")
        scripts = " ".join(s.get_text().lower() for s in soup.find_all("script"))
        score = 0.0
        if "navigator.geolocation" in scripts:
            score += 0.08
        if "getusermedia" in scripts:
            score += 0.06
        if "notification.requestpermission" in scripts or "new notification" in scripts:
            score += 0.05
        for iframe in soup.find_all("iframe"):
            allow = (iframe.get("allow") or "").lower()
            if any(k in allow for k in ["geolocation","camera","microphone","clipboard"]):
                score += 0.08
                break
        return min(score, 0.95)
    except Exception:
        return 0.0

# -------------------------
# URL feature extractor (20 features) — matches model-20.pkl expected order
# Returns list of floats (length 20)
# -------------------------
def extract_url_features(url: str):
    parsed = urllib.parse.urlparse(url if url.startswith(("http://","https://")) else "https://" + url)
    host = parsed.hostname or ""
    path = parsed.path or ""
    query = parsed.query or ""
    fqdn = host.lower()

    features = [
        len(url),                          # url_length
        url.count("."),                    # number_of_dots_in_url
        has_repeat_digits(url),            # having_repeated_digits_in_url
        len(re.findall(r"\d", url)),       # number_of_digits_in_url
        len(re.findall(r"[^\w]", url)),    # number_of_special_char_in_url
        url.count("-"),                    # number_of_hyphens_in_url
        url.count("_"),                    # number_of_underline_in_url
        url.count("/"),                    # number_of_slash_in_url
        url.count("?"),                    # number_of_questionmark_in_url
        url.count("="),                    # number_of_equal_in_url
        url.count("@"),                    # number_of_at_in_url
        url.count("$"),                    # number_of_dollar_in_url
        url.count("!"),                    # number_of_exclamation_in_url
        url.count("#"),                    # number_of_hashtag_in_url
        url.count("%"),                    # number_of_percent_in_url
        len(host),                         # domain_length
        host.count("."),                   # number_of_dots_in_domain
        host.count("-"),                   # number_of_hyphens_in_domain
        1 if re.search(r"[^\w.-]", host) else 0,  # having_special_characters_in_domain
        len(re.findall(r"[^\w.-]", host))         # number_of_special_characters_in_domain
    ]
    # ensure 20 items (these are first 20 as requested). If your model expects different order, adapt accordingly.
    return features[:20]

# -------------------------
# DNS / WHOIS feature extractor (the CSV sample columns)
# Returns list matching training order for model-dns.pkl
# (exclude 'domain' first column)
# -------------------------
def extract_dns_whois_features(url: str):
    parsed = urllib.parse.urlparse(url if url.startswith(("http://","https://")) else "https://" + url)
    host = parsed.hostname or parsed.path or ""
    features = {
        "dns_a": 0,
        "dns_mx": 0,
        "dns_ns": 0,
        "dns_ttl": -1,
        "whois_exists": 0,
        "whois_country": "",
        "domain_age_days": -1,
        "domain_expire_days": -1,
        "domain_creation_year": -1,
        "registrar_exists": 0,
        "name_servers_count": 0,
        "mx_count": 0,
        "a_count": 0,
        "is_ip": 0,
        "valid_tld": 0,
        "domain_length": len(host),
        "subdomain_count": host.count(".")
    }

    # DNS lookups (short timeouts)
    try:
        answers = dns.resolver.resolve(host, "A", lifetime=2)
        features["dns_a"] = 1
        features["a_count"] = len(answers)
    except Exception:
        pass
    try:
        mx = dns.resolver.resolve(host, "MX", lifetime=2)
        features["dns_mx"] = 1
        features["mx_count"] = len(mx)
    except Exception:
        pass
    try:
        ns = dns.resolver.resolve(host, "NS", lifetime=2)
        features["dns_ns"] = 1
        features["name_servers_count"] = len(ns)
    except Exception:
        pass
    try:
        soa = dns.resolver.resolve(host, "SOA", lifetime=2)
        # dns.resolver returns RRset; TTL from the response object may not be direct; safe fallback:
        features["dns_ttl"] = getattr(soa.rrset, "ttl", -1) if soa is not None else -1
    except Exception:
        pass

    # WHOIS (can be slow, run in threadpool)
    try:
        w = whois.whois(host)
        features["whois_exists"] = 1
        if getattr(w, "country", None):
            features["whois_country"] = str(w.country)
        created = getattr(w, "creation_date", None)
        if isinstance(created, list):
            created = created[0] if created else None
        if created:
            features["domain_age_days"] = (datetime.now() - created).days
            features["domain_creation_year"] = created.year
        exp = getattr(w, "expiration_date", None)
        if isinstance(exp, list):
            exp = exp[0] if exp else None
        if exp:
            features["domain_expire_days"] = (exp - datetime.now()).days
        if getattr(w, "registrar", None):
            features["registrar_exists"] = 1
    except Exception:
        pass

    # is_ip
    try:
        ipaddress.ip_address(host)
        features["is_ip"] = 1
    except Exception:
        features["is_ip"] = 0

    # valid_tld
    if "." in host:
        tld = host.split(".")[-1]
        features["valid_tld"] = 1 if len(tld) >= 2 else 0

    # Return feature vector in reproducible order (list of values, excluding domain)
    ordered = [
        features["dns_a"],
        features["dns_mx"],
        features["dns_ns"],
        features["dns_ttl"],
        features["whois_exists"],
        features["whois_country"] or "",
        features["domain_age_days"],
        features["domain_expire_days"],
        features["domain_creation_year"],
        features["registrar_exists"],
        features["name_servers_count"],
        features["mx_count"],
        features["a_count"],
        features["is_ip"],
        features["valid_tld"],
        features["domain_length"],
        features["subdomain_count"]
    ]
    return ordered

# -------------------------
# Load ML models (joblib)
# -------------------------
def load_models():
    url_model = None
    dns_model = None
    try:
        url_model = joblib.load(URL_MODEL_PATH)
    except Exception as e:
        print("Warning: couldn't load URL model:", e, file=sys.stderr)
    try:
        dns_model = joblib.load(DNS_MODEL_PATH)
    except Exception as e:
        print("Warning: couldn't load DNS/WHOIS model:", e, file=sys.stderr)
    return url_model, dns_model

# -------------------------
# The main prediction pipeline (parallelized)
# -------------------------
def predict(url: str, dom_path: str = None, json_out: bool = False):
    # Normalize
    u = url.strip()
    if not u:
        raise ValueError("empty url")
    if not u.startswith(("http://","https://")):
        u = "https://" + u

    parsed = urllib.parse.urlparse(u)
    host = parsed.hostname or ""
    extracted = tldextract.extract(host)
    registered = ".".join(part for part in [extracted.domain, extracted.suffix] if part)

    # Prepare thread pool for parallel calls
    with concurrent.futures.ThreadPoolExecutor(max_workers=THREADS) as ex:
        # schedule tasks in parallel - CHANGED: use full host for OpenPageRank instead of registered domain
        fut_opr = ex.submit(get_openpagerank_score, host)
        fut_sb = ex.submit(check_safe_browsing, u)
        fut_tranco = ex.submit(tranco_rank_lookup, host)
        # If DOM given, read it now (no network)
        dom_html = None
        if dom_path:
            try:
                with open(dom_path, "r", encoding="utf-8", errors="ignore") as fh:
                    dom_html = fh.read()
            except Exception:
                dom_html = None

        # Evaluate initial whitelist/blacklist in required order but get results from futures (they run in parallel)
        opr_score = fut_opr.result(timeout=6)   # may raise, catch below
        # Step 1: OpenPageRank whitelist: if >=5 -> legit immediately
        if opr_score is not None and opr_score >= 5.0:
            out = {"url": u, "final_score": 0.0, "reason": "OpenPageRank >= 5 -> LEGIT", "opr_score": opr_score}
            if json_out:
                print(json.dumps(out, indent=2))
            else:
                print("0")
            return out

        # Step 2: SafeBrowsing blacklist
        sb_match = fut_sb.result(timeout=6)
        if sb_match:
            out = {"url": u, "final_score": 1.0, "reason": "Google SafeBrowsing -> PHISHING", "safe_browsing": True}
            if json_out:
                print(json.dumps(out, indent=2))
            else:
                print("1")
            return out

        # Step 3: Tranco whitelist/scan (check subdomain first then registered)
        t_rank = fut_tranco.result(timeout=6)
        # quick logic per your rules:
        if t_rank is not None:
            # If rank <= 300k -> legit (stop)
            if t_rank <= 300_000:
                out = {"url": u, "final_score": 0.0, "reason": f"Tranco rank {t_rank} <=300k -> LEGIT", "tranco_rank": t_rank}
                if json_out:
                    print(json.dumps(out, indent=2))
                else:
                    print("0")
                return out
            # If rank <= 500k -> also treat as legit per your later instruction
            if t_rank <= 500_000:
                out = {"url": u, "final_score": 0.0, "reason": f"Tranco rank {t_rank} <=500k -> LEGIT", "tranco_rank": t_rank}
                if json_out:
                    print(json.dumps(out, indent=2))
                else:
                    print("0")
                return out
            # If 500k < rank <= 1M -> reduce final_score by 0.30 (applied later)
            if 500_000 < t_rank <= 1_000_000:
                tranco_adj = -0.30
            else:
                tranco_adj = 0.0
        else:
            # not found in top-1m -> add 0.5 as per your instruction
            tranco_adj = 0.5

        # Tunnel bonus
        tunnel_bonus = 0.5 if is_tunneling_domain(host) else 0.0

        # DOM scan score if provided
        dom_score = dom_permission_scan_from_html(dom_html) if dom_html else 0.0

        # Now run ML models in parallel (URL model always; DNS model always because you asked mandatory)
        url_model, dns_model = load_models()
        # Prepare features
        url_feats = extract_url_features(u)  # list length 20
        # DNS/WHOIS extraction can be blocking; run in threadpool
        fut_dns_feats = ex.submit(extract_dns_whois_features, u)
        # Evaluate models (parallel)
        fut_url_ml = ex.submit(lambda m, f: m.predict_proba([f])[0][1] if m else 0.5, url_model, url_feats)
        fut_dns_ml = ex.submit(lambda m, f: m.predict_proba([f])[0][1] if m else 0.5, dns_model, fut_dns_feats.result())

        try:
            url_ml = fut_url_ml.result(timeout=8)
        except Exception:
            url_ml = 0.5
        try:
            dns_ml = fut_dns_ml.result(timeout=8)
        except Exception:
            dns_ml = 0.5

        # combine MLs: half url, half dns
        ml_combined = 0.5 * url_ml + 0.5 * dns_ml

        # initial final_score before ML: apply tranco_adj and tunnel bonus and dom_score
        # The user wanted final_score starting at 0 and applying tranco adjustments:
        final_score_partial = 0.0
        final_score_partial += tranco_adj
        final_score_partial += tunnel_bonus
        final_score_partial += dom_score
        # clamp partial (it can be negative if tranco_adj negative)
        # If partial < 0 and later rule: "if final_score < 0, ML_output = ML_output * 0.5" (you gave earlier)
        ml_for_formula = ml_combined
        if final_score_partial < 0:
            ml_for_formula = ml_combined * 0.5

        # formula final_score = ((1 - final_score_partial) * ML_output) + final_score_partial
        final_score = ((1.0 - final_score_partial) * ml_for_formula) + final_score_partial

        # extra safety clamps
        if final_score < 0.0:
            final_score = 0.0
        if final_score > 1.0:
            final_score = 1.0

        out = {
            "url": u,
            "final_score": final_score,
            "ml_combined": ml_combined,
            "url_ml": url_ml,
            "dns_ml": dns_ml,
            "tranco_adj": tranco_adj,
            "tranco_rank": t_rank,
            "opr_score": opr_score,
            "safe_browsing": sb_match,
            "tunnel_bonus": tunnel_bonus,
            "dom_score": dom_score
        }

        if json_out:
            print(json.dumps(out, indent=2))
        else:
            # Output 1 if phishing (final_score >= 0.5), 0 if legit
            if final_score >= 0.5:
                print("1")
            else:
                print("0")
        return out

# -------------------------
# CLI
# -------------------------
def main():
    p = argparse.ArgumentParser(description="PhishEye v6 — fast scanner")
    p.add_argument("url", help="URL to scan")
    p.add_argument("--json", action="store_true", help="Output JSON")
    p.add_argument("--dom", help="Path to saved HTML (optional DOM permission scan)")
    args = p.parse_args()

    try:
        predict(args.url, dom_path=args.dom, json_out=args.json)
    except Exception as e:
        print("Error:", e, file=sys.stderr)
        sys.exit(2)

if __name__ == "__main__":
    main()
