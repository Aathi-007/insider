import os
import sys
import time
import socket
import getpass
import requests
from datetime import datetime

# ==========================================
# CONFIGURATION SECTION
# ==========================================
SERVER_URL = "http://localhost:8000"
API_KEY = "dev-local-key"
USER_ID = "U011"  # Mapped to this PC's assigned employee ID (e.g. U011 for Alia Rao)
CHECK_INTERVAL_SECONDS = 30
# ==========================================

def get_local_ip():
    """
    Retrieves the local IP address of this machine.
    """
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"

def get_downloads_size_mb():
    """
    Monitors the Downloads folder and calculates total size of files 
    modified in the last hour as a proxy for download activity.
    Runs flatly (no subfolder recursion) for high performance.
    """
    try:
        username = os.getlogin()
    except Exception:
        username = getpass.getuser()
        
    downloads_path = os.path.join("C:\\Users", username, "Downloads")
    if not os.path.exists(downloads_path):
        return 0.0
    
    total_size = 0
    now = time.time()
    one_hour_ago = now - 3600
    
    try:
        # Use fast non-recursive scan
        with os.scandir(downloads_path) as entries:
            for entry in entries:
                if entry.is_file():
                    try:
                        stat = entry.stat()
                        if stat.st_mtime >= one_hour_ago:
                            total_size += stat.st_size
                    except Exception:
                        continue
    except Exception:
        pass
        
    return round(total_size / (1024 * 1024), 2)

def main():
    print("=" * 60)
    print("UEBA INTRANET TELEMETRY COLLECTOR AGENT")
    print(f"Server Target: {SERVER_URL}")
    print(f"Monitoring User ID: {USER_ID}")
    print(f"Reporting Interval: {CHECK_INTERVAL_SECONDS} seconds")
    print("=" * 60)

    headers = {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY
    }
    
    while True:
        try:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Collecting telemetry...")
            
            # 1. Collect OS & Network Telemetry
            hostname = socket.gethostname()
            ip_address = get_local_ip()
            download_mb = get_downloads_size_mb()
            
            # Format event payload expected by the backend /simulate-event
            payload = {
                "user_id": USER_ID,
                "timestamp": datetime.now().isoformat(),
                "login_hour": datetime.now().hour,
                "location": "Intranet Link",
                "ip_address": ip_address,
                "device_id": hostname,
                "download_mb": download_mb,
                "files_accessed": 1,
                "accessed_department": "IT"
            }
            
            print(f"  - Hostname: {hostname}")
            print(f"  - IP Address: {ip_address}")
            print(f"  - Download MB (last hour): {download_mb} MB")
            
            # 2. POST to Backend
            endpoint = f"{SERVER_URL.rstrip('/')}/simulate-event"
            response = requests.post(endpoint, json=payload, headers=headers, timeout=10)
            
            if response.status_code == 200:
                res_data = response.json()
                print(f"  -> SUCCESS (Status {response.status_code})")
                print(f"  -> ML Anomaly Score: {res_data.get('ml_anomaly_score')}% | Final Risk Score: {res_data.get('final_risk_score')}/100")
            elif response.status_code == 403:
                print(f"  -> FORBIDDEN (Status {response.status_code}) - Access attempt blocked or department mismatch.")
            else:
                print(f"  -> WARNING (Status {response.status_code}): {response.text}")
                
        except requests.exceptions.RequestException as conn_err:
            print(f"  -> CONNECTION ERROR: Could not connect to UEBA server at {SERVER_URL}. Retrying...")
        except Exception as general_err:
            print(f"  -> ERROR during collection/transmission: {general_err}")
            
        print("-" * 40)
        time.sleep(CHECK_INTERVAL_SECONDS)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nAgent stopped by user.")
        sys.exit(0)
