import requests
import sys

API_BASE = "http://localhost:8000"
API_KEY = "dev-local-key"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

def main():
    print("============================================================")
    print("[STARTING] ANALYST WORKFLOW SIMULATION...")
    print("============================================================")
    
    # 1. Fetch alerts
    try:
        response = requests.get(f"{API_BASE}/alerts", headers=headers)
        if response.status_code != 200:
            print(f"Error fetching alerts: {response.status_code} - {response.text}")
            sys.exit(1)
        response_data = response.json()
        alerts = response_data.get("alerts", [])
    except Exception as e:
        print(f"Connection failed: {e}")
        sys.exit(1)
        
    print(f"Found {len(alerts)} active alerts.")
    if len(alerts) < 10:
        print("Warning: Less than 10 alerts available. Resolving all available alerts instead.")
        to_resolve_count = len(alerts)
    else:
        to_resolve_count = 10
        
    if to_resolve_count == 0:
        print("No alerts to resolve. Exiting.")
        sys.exit(0)
        
    # We will pick alerts and resolve them
    # 60% false positive, 40% confirmed threat
    # 6 out of 10 -> resolved_false_positive
    # 4 out of 10 -> resolved_confirmed_threat
    
    resolved_summaries = []
    
    for i, alert in enumerate(alerts[:to_resolve_count]):
        risk_event_id = alert["risk_event_id"]
        reasons = alert.get("reasons", [])
        primary_reason = reasons[0] if reasons else "unknown_pattern"
        
        # Decide resolution status
        if i % 5 in (0, 2, 4):  # i = 0, 2, 4, 5, 7, 9 (60%)
            status = "resolved_false_positive"
            note = f"False positive confirmed. Legitimate activity verified under rule tag {primary_reason}."
        else:  # i = 1, 3, 6, 8 (40%)
            status = "resolved_confirmed_threat"
            note = f"Malicious anomaly pattern detected for {primary_reason}. Escalated alert resolved."
            
        payload = {
            "resolution_status": status,
            "final_note": note
        }
        
        url = f"{API_BASE}/alerts/{risk_event_id}/resolve"
        res = requests.patch(url, headers=headers, json=payload)
        
        if res.status_code == 200:
            print(f"[RESOLVED] Alert #{risk_event_id} ({alert['user_name']}) as {status}")
            resolved_summaries.append({
                "id": risk_event_id,
                "user": alert["user_name"],
                "reason": primary_reason,
                "status": status
            })
        else:
            print(f"[ERROR] Failed to resolve Alert #{risk_event_id}: {res.status_code} - {res.text}")
            
    print("\n============================================================")
    print("SIMULATION SUMMARY")
    print("============================================================")
    if len(resolved_summaries) > 0:
        print(f"Total resolved: {len(resolved_summaries)}")
        fp_count = sum(1 for r in resolved_summaries if r["status"] == "resolved_false_positive")
        threat_count = sum(1 for r in resolved_summaries if r["status"] == "resolved_confirmed_threat")
        print(f"False Positives resolved: {fp_count} ({fp_count/len(resolved_summaries)*100:.1f}%)")
        print(f"Confirmed Threats resolved: {threat_count} ({threat_count/len(resolved_summaries)*100:.1f}%)")
        print("------------------------------------------------------------")
        for r in resolved_summaries:
            print(f"Alert #{r['id']} | User: {r['user']} | Rule: {r['reason']} | Status: {r['status']}")
    else:
        print("No alerts resolved.")
    print("============================================================")

if __name__ == "__main__":
    main()
