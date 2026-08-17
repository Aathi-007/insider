import os
import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime
import joblib
from sklearn.preprocessing import MinMaxScaler
from database import get_connection

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
MODEL_PATH = os.path.join(DATA_DIR, 'isolation_forest_model.joblib')
ENCODER_PATH = os.path.join(DATA_DIR, 'encoders.joblib')

def get_employee_hr_status(user_id):
    """
    Fetches the HR integration status for a user.
    """
    from database import get_connection
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT employment_status, travel_declared, travel_start_date, travel_end_date, notice_period_start_date
            FROM employee_hr_status
            WHERE user_id = ?
        """, (user_id,))
        row = cursor.fetchone()
        if row:
            return {
                'employment_status': row[0],
                'travel_declared': bool(row[1]),
                'travel_start_date': row[2],
                'travel_end_date': row[3],
                'notice_period_start_date': row[4]
            }
        return {
            'employment_status': 'active',
            'travel_declared': False,
            'travel_start_date': None,
            'travel_end_date': None,
            'notice_period_start_date': None
        }
    except Exception as e:
        print(f"Error fetching employee HR status: {e}")
        return {
            'employment_status': 'active',
            'travel_declared': False,
            'travel_start_date': None,
            'travel_end_date': None,
            'notice_period_start_date': None
        }
    finally:
        conn.close()

def calculate_rule_based_score(event, baseline):
    score = 0
    reasons = []
    
    hr = get_employee_hr_status(event['user_id'])
    
    # Unusual download volume
    if baseline['avg_download_mb'] > 0 and event['download_mb'] > 3 * baseline['avg_download_mb']:
        score += 25
        reasons.append("unusual_download_volume")
        
    # Unusual login time
    if not (baseline['usual_login_hour_start'] <= event['login_hour'] <= baseline['usual_login_hour_end']):
        score += 15
        reasons.append("unusual_login_time")
        
    # Unusual location
    known_locations = str(baseline['known_locations']).split(',')
    if event['location'] not in known_locations:
        # Check if travel is declared and date matches
        is_traveling = False
        if hr['travel_declared'] and hr['travel_start_date'] and hr['travel_end_date']:
            try:
                event_date = pd.to_datetime(event['timestamp']).date().isoformat()
                if hr['travel_start_date'] <= event_date <= hr['travel_end_date']:
                    is_traveling = True
            except Exception as e:
                print(f"Error parsing event timestamp for travel check: {e}")
                
        if is_traveling:
            reasons.append("location_change_but_travel_declared")
        else:
            score += 20
            reasons.append("unusual_location")
        
    # Device status check
    from device_management import check_device_status
    status = check_device_status(event['user_id'], event['device_id'])
    if status == 'pending':
        score += 8
        reasons.append("device_pending_verification")
    elif status == 'unrecognized':
        score += 15
        reasons.append("new_unrecognized_device")
        
    # Department mismatch
    if event['accessed_department'] != baseline['usual_department']:
        score += 25
        reasons.append("department_mismatch")
        
    # Leave activity check
    if hr['employment_status'] == 'on_leave':
        score += 30
        reasons.append("activity_during_leave_period")
        
    # Concurrent session detection check
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT event_id FROM activity_logs
            WHERE user_id = ? AND event_id != ?
              AND (location != ? OR ip_address != ?)
              AND abs(strftime('%s', timestamp) - strftime('%s', ?)) <= 300
        """, (event['user_id'], event.get('event_id', -1), event['location'], event['ip_address'], event['timestamp']))
        conflict = cursor.fetchone()
        if conflict:
            score += 35
            reasons.append("concurrent_session_conflict")
    except Exception as e:
        print(f"Error checking concurrent session conflict: {e}")
    finally:
        conn.close()
        
    score = min(score, 100)
    return score, reasons

def calculate_final_risk_score(event, baseline, ml_anomaly_score):
    rule_score, reasons = calculate_rule_based_score(event, baseline)
    
    final_score = (0.6 * rule_score) + (0.4 * ml_anomaly_score)
    final_score = int(np.round(final_score))
    
    # Notice period multiplier
    hr = get_employee_hr_status(event['user_id'])
    if hr['employment_status'] == 'notice_period':
        final_score = int(np.round(final_score * 1.3))
        reasons.append("employee_in_notice_period")
        
    final_score = min(final_score, 100)
    
    if ml_anomaly_score > 70:
        reasons.append("ml_model_flagged_unusual_pattern")
        
    return final_score, reasons

def score_all_events():
    conn = get_connection()
    try:
        # Load model and encoders
        model = joblib.load(MODEL_PATH)
        encoders = joblib.load(ENCODER_PATH)
        
        # Load activity_logs
        df_logs = pd.read_sql_query("SELECT * FROM activity_logs", conn)
        
        if df_logs.empty:
            print("No activity logs to score.")
            return
            
        # Calculate ml_anomaly_score
        df_ml = df_logs.copy()
        df_ml['department_mismatch'] = (df_ml['accessed_department'] != df_ml['department']).astype(int)
        
        # Safely handle unseen labels for transform
        unseen_locs = set(df_ml['location']) - set(encoders['location'].classes_)
        if unseen_locs:
            encoders['location'].classes_ = np.sort(np.append(encoders['location'].classes_, list(unseen_locs)))
            
        unseen_devs = set(df_ml['device_id']) - set(encoders['device'].classes_)
        if unseen_devs:
            encoders['device'].classes_ = np.sort(np.append(encoders['device'].classes_, list(unseen_devs)))
            
        # Transform categories using loaded encoders
        df_ml['location_encoded'] = encoders['location'].transform(df_ml['location'])
        df_ml['device_encoded'] = encoders['device'].transform(df_ml['device_id'])
        
        feature_cols = ['download_mb', 'login_hour', 'location_encoded', 'device_encoded', 'department_mismatch', 'files_accessed']
        
        scores = model.decision_function(df_ml[feature_cols])
        scaler = MinMaxScaler(feature_range=(0, 100))
        df_logs['ml_anomaly_score'] = scaler.fit_transform((-scores).reshape(-1, 1)).flatten()
        
        # Update activity_logs table with the calculated ml_anomaly_score
        update_data = [(float(row['ml_anomaly_score']), int(row['event_id'])) for _, row in df_logs.iterrows()]
        cursor = conn.cursor()
        cursor.executemany("UPDATE activity_logs SET ml_anomaly_score = ? WHERE event_id = ?", update_data)
        conn.commit()
        
        # Load baselines into dict for fast lookup
        df_base = pd.read_sql_query("SELECT * FROM user_baselines", conn)
        baselines_dict = df_base.set_index('user_id').to_dict('index')
        
        risk_events_to_insert = []
        now = datetime.now().isoformat()
        
        # Score each event
        for _, event in df_logs.iterrows():
            user_id = event['user_id']
            if user_id not in baselines_dict:
                continue
                
            baseline = baselines_dict[user_id]
            ml_score = event['ml_anomaly_score']
            
            final_score, reasons = calculate_final_risk_score(event, baseline, ml_score)
            
            if final_score > 40:
                reasons_str = ",".join(reasons)
                risk_events_to_insert.append((
                    event['event_id'], user_id, final_score, reasons_str, now, False
                ))
                
        # Call gradual drift detection
        try:
            from baseline import detect_gradual_drift
            drift_events = detect_gradual_drift(conn)
            risk_events_to_insert.extend(drift_events)
        except Exception as e:
            print(f"Error executing gradual drift: {e}")
            
        # Insert into risk_events
        cursor = conn.cursor()
        cursor.execute("DELETE FROM risk_events") # Clear previous runs for idempotency
        
        insert_sql = '''
            INSERT INTO risk_events (event_id, user_id, risk_score, reasons, flagged_at, reviewed)
            VALUES (?, ?, ?, ?, ?, ?)
        '''
        cursor.executemany(insert_sql, risk_events_to_insert)
        conn.commit()
        
        print(f"Scored all events. {len(risk_events_to_insert)} high-risk events flagged and stored.")
        
    except Exception as e:
        print(f"Error scoring events: {e}")
    finally:
        conn.close()

def evaluate_risk_scoring():
    conn = get_connection()
    try:
        # Check SQLite boolean mapping
        df_anomalies = pd.read_sql_query("SELECT event_id FROM activity_logs WHERE is_anomaly IN (1, 'True', '1')", conn)
        total_anomalies = len(df_anomalies)
        
        if total_anomalies == 0:
            print("No known anomalies found to evaluate.")
            return
            
        anomaly_event_ids = tuple(df_anomalies['event_id'].tolist())
        
        cursor = conn.cursor()
        if len(anomaly_event_ids) == 1:
            query = "SELECT COUNT(*) FROM risk_events WHERE risk_score > 60 AND event_id = ?"
            cursor.execute(query, (anomaly_event_ids[0],))
        else:
            placeholders = ','.join(['?'] * len(anomaly_event_ids))
            query = f"SELECT COUNT(*) FROM risk_events WHERE risk_score > 60 AND event_id IN ({placeholders})"
            cursor.execute(query, anomaly_event_ids)
        num_flagged = cursor.fetchone()[0]
        
        percentage = (num_flagged / total_anomalies) * 100
        print(f"{num_flagged} out of {total_anomalies} known anomalies flagged as high risk ({percentage:.1f}%)")
        
    except Exception as e:
        print(f"Error evaluating risk scoring: {e}")
    finally:
        conn.close()

def main():
    print("Scoring all events and inserting high-risk alerts...")
    score_all_events()
    
    print("\nEvaluating risk scoring rules...")
    evaluate_risk_scoring()
    
    print("\nTop 15 Highest Risk Events:")
    print("-" * 80)
    
    conn = get_connection()
    try:
        query = "SELECT user_id, risk_score, reasons FROM risk_events ORDER BY risk_score DESC LIMIT 15"
        df = pd.read_sql_query(query, conn)
        
        if df.empty:
            print("No risk events found.")
        else:
            print(df.to_string(index=False))
            
    except Exception as e:
        print(f"Error fetching top risk events: {e}")
    finally:
        conn.close()

def get_false_positive_rate_for_pattern(reason):
    """
    Checks what percentage of resolved alerts containing this reason were marked 
    as 'resolved_false_positive' vs 'resolved_confirmed_threat'.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        # Select all resolved alerts
        cursor.execute("""
            SELECT reasons, status FROM risk_events
            WHERE status IN ('resolved_false_positive', 'resolved_confirmed_threat')
        """)
        rows = cursor.fetchall()
        
        total_resolved = 0
        fp_count = 0
        confirmed_count = 0
        
        for row in rows:
            reasons_list = [r.strip() for r in str(row[0]).split(',')]
            if reason in reasons_list:
                total_resolved += 1
                if row[1] == 'resolved_false_positive':
                    fp_count += 1
                elif row[1] == 'resolved_confirmed_threat':
                    confirmed_count += 1
                    
        if total_resolved == 0:
            return {
                "reason": reason,
                "total_resolved": 0,
                "false_positive_count": 0,
                "confirmed_threat_count": 0,
                "false_positive_rate": 0.0,
                "confirmed_threat_rate": 0.0
            }
            
        fp_rate = (fp_count / total_resolved) * 100
        confirmed_rate = (confirmed_count / total_resolved) * 100
        
        return {
            "reason": reason,
            "total_resolved": total_resolved,
            "false_positive_count": fp_count,
            "confirmed_threat_count": confirmed_count,
            "false_positive_rate": round(fp_rate, 2),
            "confirmed_threat_rate": round(confirmed_rate, 2)
        }
    except Exception as e:
        print(f"Error calculating false positive rate for reason {reason}: {e}")
        return {
            "reason": reason,
            "total_resolved": 0,
            "false_positive_count": 0,
            "confirmed_threat_count": 0,
            "false_positive_rate": 0.0,
            "confirmed_threat_rate": 0.0
        }
    finally:
        conn.close()

if __name__ == '__main__':
    main()
