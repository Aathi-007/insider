import requests
import time
from datetime import datetime
import csv
import os
import sys

BASE_URL = os.environ.get("UEBA_API_URL", "http://localhost:8000")
API_KEY = os.environ.get("UEBA_API_KEY", "dev-local-key")
HEADERS = {"X-API-Key": API_KEY}

def stream_logs(file_path):
    if not os.path.exists(file_path):
        print(f"[ERROR] Could not find {file_path}. Please run data_generator.py first.")
        return

    # Verify server is running
    try:
        health = requests.get(f"{BASE_URL}/health")
        if health.status_code != 200:
            print(f"Error: Server responded with status {health.status_code}")
            return
    except requests.exceptions.ConnectionError:
        print("[ERROR]: Could not connect to the server.")
        print("Please ensure main.py is running in a separate terminal before starting this simulation.")
        return

    print("=" * 60)
    print(f"[STARTING] CONTINUOUS CSV LOG STREAMING")
    print(f"Reading from {file_path}")
    print("Sending 1 event every 5 seconds...")
    print("=" * 60)

    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            # Construct the payload
            # Update the timestamp to current so it appears as "live" data in the dashboard
            event = {
                "user_id": row["user_id"],
                "timestamp": datetime.now().isoformat(),
                "login_hour": int(float(row["login_hour"])) if row["login_hour"] else 0,
                "location": row["location"],
                "ip_address": row["ip_address"],
                "device_id": row["device_id"],
                "download_mb": float(row["download_mb"]) if row["download_mb"] else 0.0,
                "files_accessed": int(float(row["files_accessed"])) if row["files_accessed"] else 0,
                "accessed_department": row["accessed_department"]
            }

            print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Sending event {i+1} for user {event['user_id']}...")
            
            try:
                res = requests.post(f"{BASE_URL}/simulate-event", json=event, headers=HEADERS)
                if res.status_code == 200:
                    data = res.json()
                    score = data.get("final_risk_score", 0)
                    reasons = data.get("reasons", [])
                    
                    if score > 60:
                        reasons_str = ", ".join(reasons)
                        print(f"   [ALERT] HIGH RISK DETECTED! Score: {score}, Reasons: {reasons_str}")
                    else:
                        print(f"   [OK] Normal activity. Score: {score}")
                else:
                    print(f"   [ERROR] Failed to process event. Server responded with {res.status_code}: {res.text}")
            except Exception as e:
                print(f"   [ERROR] Error sending event: {e}")
            
            # Wait 5 seconds before next event
            time.sleep(5)

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(base_dir, 'data', 'activity_logs.csv')
    
    try:
        stream_logs(csv_path)
    except KeyboardInterrupt:
        print("\nStreaming stopped by user.")
        sys.exit(0)
