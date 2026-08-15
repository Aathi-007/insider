import os
import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime
from collections import deque
import time
from fastapi import FastAPI, HTTPException, Security, Depends, Request
from fastapi.security.api_key import APIKeyHeader
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List
import joblib
from sklearn.preprocessing import MinMaxScaler
import uvicorn

from database import get_connection
from risk_scoring import calculate_rule_based_score, calculate_final_risk_score
from auth import verify_password, create_access_token, verify_token

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
MODEL_PATH = os.path.join(DATA_DIR, 'isolation_forest_model.joblib')
ENCODER_PATH = os.path.join(DATA_DIR, 'encoders.joblib')

# Load model and encoders once at startup
try:
    model = joblib.load(MODEL_PATH)
    encoders = joblib.load(ENCODER_PATH)
except Exception as e:
    print(f"Warning: Could not load model or encoders. {e}")
    model = None
    encoders = None

app = FastAPI(title="UEBA API", description="User Entity Behavior Analytics API")

cors_origins_str = os.environ.get("CORS_ORIGINS")
if cors_origins_str:
    cors_origins = [origin.strip() for origin in cors_origins_str.split(",")]
else:
    cors_origins = ["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store the last 1000 requests to track real-time traffic
api_traffic_log = deque(maxlen=2000)

# Pre-seed with some dummy background noise for the last 15 minutes
import random
now_ts = time.time()
for i in range(15 * 60): # 15 minutes of seconds
    if random.random() > 0.3: # 70% chance of a GET request each second
        api_traffic_log.append({
            "timestamp": now_ts - i,
            "method": "GET",
            "is_abnormal": random.random() < 0.02
        })
    if random.random() > 0.95: # 5% chance of a POST request each second
        api_traffic_log.append({
            "timestamp": now_ts - i,
            "method": "POST",
            "is_abnormal": random.random() < 0.15
        })

@app.middleware("http")
async def track_api_traffic(request: Request, call_next):
    # Initialize state
    request.state.is_abnormal = False
    
    response = await call_next(request)
    
    is_abnormal = getattr(request.state, "is_abnormal", False) or response.status_code >= 400
    
    if request.method in ("GET", "POST"):
        api_traffic_log.append({
            "timestamp": time.time(),
            "method": request.method,
            "is_abnormal": is_abnormal
        })
    return response

API_KEY = os.environ.get("UEBA_API_KEY", "dev-local-key")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
security = HTTPBearer()

async def get_api_key(api_key: str = Security(api_key_header)):
    if api_key == API_KEY:
        return api_key
    raise HTTPException(status_code=401, detail="Invalid or missing API Key")


class EventSimulation(BaseModel):
    user_id: str
    timestamp: str
    login_hour: int
    location: str
    ip_address: str
    device_id: str
    download_mb: float
    files_accessed: int
    accessed_department: str

class AccessRequest(BaseModel):
    resource_id: str
    user_id: str = "U001"
    department: str = "Engineering"
    username: str = "test.user"

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterDeviceRequest(BaseModel):
    user_id: str
    device_id: str
    device_name: str

class UpdateHRStatusRequest(BaseModel):
    user_id: str
    employment_status: str  # 'active', 'notice_period', 'on_leave'
    travel_declared: bool
    travel_start_date: str = None
    travel_end_date: str = None
    notice_period_start_date: str = None

class AssignAlertRequest(BaseModel):
    analyst_name: str

class AddNoteRequest(BaseModel):
    note: str

class ResolveAlertRequest(BaseModel):
    resolution_status: str = None  # 'resolved_false_positive' or 'resolved_confirmed_threat'
    final_note: str = None
    resolution: str = None
    note: str = None

@app.post("/login")
def login(request: LoginRequest):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT user_id, username, password_hash, role, department FROM users WHERE username = ?", 
            (request.username.strip(),)
        )
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid username or password")
        
        user_id, username, password_hash, role, department = user
        if not verify_password(request.password, password_hash):
            raise HTTPException(status_code=401, detail="Invalid username or password")
            
        token = create_access_token(data={
            "sub": username, 
            "user_id": user_id, 
            "role": role, 
            "department": department
        })
        return {"access_token": token, "token_type": "bearer"}
    finally:
        conn.close()

@app.post("/access-request")
def access_request(request: AccessRequest, http_request: Request, api_key: str = Depends(get_api_key)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        # Check if resource exists
        cursor.execute("SELECT owning_department FROM resources WHERE resource_id = ?", (request.resource_id,))
        resource = cursor.fetchone()
        if not resource:
            raise HTTPException(status_code=404, detail="Resource not found")
            
        resource_dept = resource[0]
        user_dept = request.department
        user_id = request.user_id
        user_name = request.username
        timestamp = datetime.now().isoformat()
        
        if resource_dept == user_dept:
            # Allow access and log normal activity
            cursor.execute('''
                INSERT INTO activity_logs (
                    user_id, user_name, department, timestamp, login_hour, 
                    location, ip_address, device_id, download_mb, files_accessed, 
                    accessed_department, is_anomaly
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                user_id, user_name, user_dept, timestamp, datetime.now().hour,
                "Unknown", "0.0.0.0", "Unknown", 0.0, 1, resource_dept, False
            ))
            conn.commit()
            return {"allowed": True}
        else:
            # Deny access: 1. log activity as anomaly
            cursor.execute('''
                INSERT INTO activity_logs (
                    user_id, user_name, department, timestamp, login_hour, 
                    location, ip_address, device_id, download_mb, files_accessed, 
                    accessed_department, is_anomaly
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                user_id, user_name, user_dept, timestamp, datetime.now().hour,
                "Unknown", "0.0.0.0", "Unknown", 0.0, 1, resource_dept, True
            ))
            new_event_id = cursor.lastrowid
            
            # 2. Log access violation
            cursor.execute('''
                INSERT INTO access_violations (
                    user_id, resource_id, requester_department, resource_department, attempted_at
                ) VALUES (?, ?, ?, ?, ?)
            ''', (user_id, request.resource_id, user_dept, resource_dept, timestamp))
            
            # 3. Create risk event
            cursor.execute('''
                INSERT INTO risk_events (event_id, user_id, risk_score, reasons, flagged_at, reviewed)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                new_event_id, user_id, 90, "unauthorized_cross_department_access", timestamp, False
            ))
            
            http_request.state.is_abnormal = True
            conn.commit()
            return JSONResponse(status_code=403, content={"allowed": False})
            
    finally:
        conn.close()

@app.get("/")
def read_root():
    return {
        "message": "Welcome to the UEBA API",
        "endpoints": [
            "GET /alerts",
            "GET /alerts/summary",
            "GET /user/{user_id}",
            "PATCH /alerts/{risk_event_id}/review",
            "POST /simulate-event",
            "POST /login",
            "POST /access-request",
            "GET /health"
        ]
    }

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/alerts")
def get_alerts(api_key: str = Depends(get_api_key)):
    conn = get_connection()
    try:
        query = """
        SELECT r.risk_event_id, r.user_id, a.user_name, a.department, r.risk_score, r.reasons, r.flagged_at, r.reviewed,
               r.status, r.assigned_to_analyst, r.analyst_notes, r.resolved_at
        FROM risk_events r
        JOIN activity_logs a ON r.event_id = a.event_id
        WHERE r.risk_score > 60
        ORDER BY r.risk_score DESC
        """
        df = pd.read_sql_query(query, conn)
        
        alerts = []
        for _, row in df.iterrows():
            alerts.append({
                "risk_event_id": row['risk_event_id'],
                "user_id": row['user_id'],
                "user_name": row['user_name'],
                "department": row['department'],
                "risk_score": row['risk_score'],
                "reasons": str(row['reasons']).split(',') if pd.notnull(row['reasons']) and str(row['reasons']) != "" else [],
                "flagged_at": row['flagged_at'],
                "reviewed": bool(row['reviewed']),
                "status": row['status'],
                "assigned_to_analyst": row['assigned_to_analyst'],
                "analyst_notes": row['analyst_notes'],
                "resolved_at": row['resolved_at']
            })
        return alerts
    finally:
        conn.close()

@app.get("/alerts/summary")
def get_alerts_summary(api_key: str = Depends(get_api_key)):
    conn = get_connection()
    try:
        df = pd.read_sql_query("SELECT risk_score FROM risk_events", conn)
        total_alerts = len(df)
        high_risk = len(df[df['risk_score'] > 80])
        medium_risk = len(df[(df['risk_score'] > 60) & (df['risk_score'] <= 80)])
        
        return {
            "total_alerts": total_alerts,
            "high_risk_count": high_risk,
            "medium_risk_count": medium_risk,
            "timestamp": datetime.now().isoformat()
        }
    finally:
        conn.close()

@app.get("/analytics/daily-risk")
def get_daily_risk(api_key: str = Depends(get_api_key)):
    conn = get_connection()
    try:
        # Get the average risk score per user per day for the last 30 days
        query = """
        SELECT r.user_id, u.username as user_name, date(r.flagged_at) as date, AVG(r.risk_score) as avg_score
        FROM risk_events r
        JOIN users u ON r.user_id = u.user_id
        WHERE date(r.flagged_at) >= date('now', '-30 days')
        GROUP BY r.user_id, date(r.flagged_at)
        """
        df = pd.read_sql_query(query, conn)
        return df.to_dict(orient="records")
    finally:
        conn.close()

@app.get("/analytics/department-behaviour")
def get_department_behaviour(range: str = "week", api_key: str = Depends(get_api_key)):
    from datetime import timedelta
    conn = get_connection()
    try:
        query = """
        SELECT r.risk_score, r.reasons, r.flagged_at, r.status, a.department
        FROM risk_events r
        JOIN activity_logs a ON r.event_id = a.event_id
        """
        df = pd.read_sql_query(query, conn)
        
        # Parse flagged_at
        df['flagged_dt'] = pd.to_datetime(df['flagged_at'])
        
        now = datetime.now()
        
        # Filter for range
        if range == "month":
            cutoff = now - timedelta(days=30)
            df_period = df[df['flagged_dt'] >= cutoff]
        elif range == "alltime":
            df_period = df
        else: # default: week
            cutoff = now - timedelta(days=7)
            df_period = df[df['flagged_dt'] >= cutoff]
            
        this_week_cutoff = now - timedelta(days=7)
        last_week_cutoff_start = now - timedelta(days=14)
        last_week_cutoff_end = now - timedelta(days=7)
        
        df_this_week = df[df['flagged_dt'] >= this_week_cutoff]
        df_last_week = df[(df['flagged_dt'] >= last_week_cutoff_start) & (df['flagged_dt'] < last_week_cutoff_end)]
        
        departments = ["HR", "Finance", "Engineering", "Sales", "IT"]
        dept_results = {}
        
        for dept in departments:
            # Filter all alerts for this dept
            dept_df_all = df[df['department'].str.lower() == dept.lower()]
            dept_df_period = df_period[df_period['department'].str.lower() == dept.lower()]
            dept_df_this_week = df_this_week[df_this_week['department'].str.lower() == dept.lower()]
            dept_df_last_week = df_last_week[df_last_week['department'].str.lower() == dept.lower()]
            
            # Health score in selected period
            if not dept_df_period.empty:
                avg_risk = dept_df_period['risk_score'].mean()
                health_score = max(0, round(100 - avg_risk))
            else:
                health_score = 100
                
            # Trend comparison: this week vs last week
            if not dept_df_this_week.empty:
                avg_this_week = dept_df_this_week['risk_score'].mean()
                health_this_week = max(0, round(100 - avg_this_week))
            else:
                health_this_week = 100
                
            if not dept_df_last_week.empty:
                avg_last_week = dept_df_last_week['risk_score'].mean()
                health_last_week = max(0, round(100 - avg_last_week))
            else:
                health_last_week = 100
                
            trend_change_points = health_this_week - health_last_week
            if trend_change_points > 0:
                trend_direction = "up"
            elif trend_change_points < 0:
                trend_direction = "down"
            else:
                trend_direction = "flat"
                
            # Active high risk count: unresolved risk_score > 80 (across all time)
            active_high_risk = dept_df_all[
                (dept_df_all['risk_score'] > 80) & 
                (~dept_df_all['status'].fillna('').str.startswith('resolved'))
            ]
            active_high_risk_count = len(active_high_risk)
            
            # Top 3 reasons
            reasons_list = []
            for reasons_str in dept_df_period['reasons'].dropna():
                if reasons_str:
                    for r in reasons_str.split(','):
                        if r.strip():
                            reasons_list.append(r.strip())
            from collections import Counter
            top_3 = [{"reason": reason, "count": count} for reason, count in Counter(reasons_list).most_common(3)]
            
            # Sparkline data for last 14 days
            sparkline_data = []
            for i in range(14):
                day = (now - timedelta(days=(13 - i))).date()
                day_alerts = dept_df_all[dept_df_all['flagged_dt'].dt.date == day]
                if not day_alerts.empty:
                    sparkline_data.append(round(day_alerts['risk_score'].mean(), 1))
                else:
                    sparkline_data.append(0.0)
                    
            dept_results[dept] = {
                "behaviour_health_score": health_score,
                "trend_direction": trend_direction,
                "trend_change_points": trend_change_points,
                "active_high_risk_count": active_high_risk_count,
                "top_3_reasons": top_3,
                "sparkline_data": sparkline_data
            }
            
        # Determine most improved and needs attention
        most_improved = None
        max_improvement = -9999
        for dept in departments:
            change = dept_results[dept]["trend_change_points"]
            if change > max_improvement:
                max_improvement = change
                most_improved = dept
                
        needs_attention = None
        min_improvement = 9999
        for dept in departments:
            change = dept_results[dept]["trend_change_points"]
            if change < min_improvement:
                min_improvement = change
                needs_attention = dept
                
        most_improved_data = {"name": most_improved, "change": max_improvement} if max_improvement > 0 else None
        if not most_improved_data:
            # Fallback to highest health score
            top_dept = max(departments, key=lambda d: dept_results[d]["behaviour_health_score"])
            most_improved_data = {"name": top_dept, "score": dept_results[top_dept]["behaviour_health_score"]}
            
        needs_attention_data = {"name": needs_attention, "change": min_improvement} if min_improvement < 0 else None
        if not needs_attention_data:
            # Fallback to lowest health score
            worst_dept = min(departments, key=lambda d: dept_results[d]["behaviour_health_score"])
            needs_attention_data = {"name": worst_dept, "score": dept_results[worst_dept]["behaviour_health_score"]}
            
        return {
            "departments": dept_results,
            "most_improved_department": most_improved_data,
            "needs_attention_department": needs_attention_data
        }
    finally:
        conn.close()
@app.get("/analytics/company-behavior-trend")
def get_company_behavior_trend(api_key: str = Depends(get_api_key)):
    from datetime import timedelta
    now = datetime.now()
    
    # Create buckets for the last 15 minutes, minute by minute
    buckets = {}
    for i in range(15):
        t = now - timedelta(minutes=i)
        buckets[t.strftime("%H:%M")] = {
            "get_normal": 0,
            "get_abnormal": 0,
            "post_normal": 0,
            "post_abnormal": 0
        }
        
    for log in api_traffic_log:
        log_time = datetime.fromtimestamp(log["timestamp"])
        time_key = log_time.strftime("%H:%M")
        if time_key in buckets:
            method = log["method"]
            is_abnormal = log.get("is_abnormal", False)
            
            if method == "GET":
                if is_abnormal:
                    buckets[time_key]["get_abnormal"] += 1
                else:
                    buckets[time_key]["get_normal"] += 1
            elif method == "POST":
                if is_abnormal:
                    buckets[time_key]["post_abnormal"] += 1
                else:
                    buckets[time_key]["post_normal"] += 1
                
    # Format and sort results
    res = []
    for k in sorted(buckets.keys()):
        res.append({
            "displayDate": k,
            "get_normal": buckets[k]["get_normal"],
            "get_abnormal": buckets[k]["get_abnormal"],
            "post_normal": buckets[k]["post_normal"],
            "post_abnormal": buckets[k]["post_abnormal"]
        })
    return res

@app.get("/users")
def get_users(api_key: str = Depends(get_api_key)):
    conn = get_connection()
    try:
        query = """
        SELECT u.user_id, u.username, u.department, COALESCE(MAX(r.risk_score), 0) as max_risk
        FROM users u
        LEFT JOIN risk_events r ON u.user_id = r.user_id AND r.flagged_at >= date('now', '-7 days')
        GROUP BY u.user_id
        ORDER BY max_risk DESC, u.username ASC
        """
        df = pd.read_sql_query(query, conn)
        return df.to_dict(orient="records")
    finally:
        conn.close()

@app.get("/user/{user_id}")
def get_user_data(user_id: str, api_key: str = Depends(get_api_key)):
    conn = get_connection()
    try:
        df_base = pd.read_sql_query("SELECT * FROM user_baselines WHERE user_id = ?", conn, params=(user_id,))
        if df_base.empty:
            raise HTTPException(status_code=404, detail=f"User {user_id} not found in baselines.")
        baseline = df_base.iloc[0].to_dict()
        
        df_activity = pd.read_sql_query("SELECT * FROM activity_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT 100", conn, params=(user_id,))
        activity_history = df_activity.to_dict(orient='records')
        
        df_risk = pd.read_sql_query("SELECT * FROM risk_events WHERE user_id = ? ORDER BY risk_score DESC", conn, params=(user_id,))
        risk_history = []
        for _, row in df_risk.iterrows():
            r_dict = row.to_dict()
            r_dict['reasons'] = str(r_dict['reasons']).split(',') if pd.notnull(r_dict['reasons']) and r_dict['reasons'] != "" else []
            r_dict['reviewed'] = bool(r_dict['reviewed'])
            risk_history.append(r_dict)
            
        return {
            "baseline": baseline,
            "activity_history": activity_history,
            "risk_history": risk_history
        }
    finally:
        conn.close()

@app.patch("/alerts/{risk_event_id}/review")
def review_alert(risk_event_id: int, api_key: str = Depends(get_api_key)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE risk_events SET reviewed = 1 WHERE risk_event_id = ?", (risk_event_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Risk event not found.")
        conn.commit()
        return {"status": "success", "message": f"Alert {risk_event_id} marked as reviewed."}
    finally:
        conn.close()

@app.post("/simulate-event")
def simulate_event(event: EventSimulation, http_request: Request, api_key: str = Depends(get_api_key)):
    if model is None or encoders is None:
        raise HTTPException(status_code=500, detail="Model or encoders not loaded properly.")
        
    conn = get_connection()
    try:
        df_base = pd.read_sql_query("SELECT * FROM user_baselines WHERE user_id = ?", conn, params=(event.user_id,))
        if df_base.empty:
            raise HTTPException(status_code=404, detail=f"Baseline not found for user {event.user_id}")
        baseline = df_base.iloc[0].to_dict()
        
        event_dict = event.model_dump()
        
        df_user = pd.read_sql_query("SELECT user_name, department FROM activity_logs WHERE user_id = ? LIMIT 1", conn, params=(event.user_id,))
        user_name = df_user.iloc[0]['user_name'] if not df_user.empty else "Unknown"
        department = df_user.iloc[0]['department'] if not df_user.empty else "Unknown"
        
        event_dict['user_name'] = user_name
        event_dict['department'] = department
        event_dict['is_anomaly'] = 0
        
        # Load all past data to get an accurate scaled ML score
        df_logs = pd.read_sql_query("SELECT * FROM activity_logs", conn)
        df_all = pd.concat([df_logs, pd.DataFrame([event_dict])], ignore_index=True)
        
        df_all['department_mismatch'] = (df_all['accessed_department'] != df_all['department']).astype(int)
        
        # Safely handle unseen labels for transform across all historical data
        unseen_locs = set(df_all['location']) - set(encoders['location'].classes_)
        if unseen_locs:
            encoders['location'].classes_ = np.sort(np.append(encoders['location'].classes_, list(unseen_locs)))
            
        unseen_devs = set(df_all['device_id']) - set(encoders['device'].classes_)
        if unseen_devs:
            encoders['device'].classes_ = np.sort(np.append(encoders['device'].classes_, list(unseen_devs)))
            
        df_all['location_encoded'] = encoders['location'].transform(df_all['location'])
        df_all['device_encoded'] = encoders['device'].transform(df_all['device_id'])
        
        feature_cols = ['download_mb', 'login_hour', 'location_encoded', 'device_encoded', 'department_mismatch', 'files_accessed']
        
        scores_all = model.decision_function(df_all[feature_cols])
        scaler = MinMaxScaler(feature_range=(0, 100))
        scaled_scores = scaler.fit_transform((-scores_all).reshape(-1, 1)).flatten()
        
        ml_score = scaled_scores[-1]
        event_dict['ml_anomaly_score'] = ml_score
        
        final_score, reasons = calculate_final_risk_score(event_dict, baseline, ml_score)
        
        # Insert event into activity_logs
        cursor = conn.cursor()
        insert_log_sql = '''
            INSERT INTO activity_logs (
                user_id, user_name, department, timestamp, login_hour, 
                location, ip_address, device_id, download_mb, files_accessed, 
                accessed_department, is_anomaly
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''
        cursor.execute(insert_log_sql, (
            event_dict['user_id'], event_dict['user_name'], event_dict['department'], 
            event_dict['timestamp'], event_dict['login_hour'], event_dict['location'], 
            event_dict['ip_address'], event_dict['device_id'], event_dict['download_mb'], 
            event_dict['files_accessed'], event_dict['accessed_department'], False
        ))
        new_event_id = cursor.lastrowid
        
        if final_score > 40:
            insert_risk_sql = '''
                INSERT INTO risk_events (event_id, user_id, risk_score, reasons, flagged_at, reviewed)
                VALUES (?, ?, ?, ?, ?, ?)
            '''
            cursor.execute(insert_risk_sql, (
                new_event_id, event_dict['user_id'], final_score, ",".join(reasons), datetime.now().isoformat(), False
            ))
            http_request.state.is_abnormal = True
            
        conn.commit()
        
        return {
            "status": "success",
            "message": "Event processed.",
            "event_id": new_event_id,
            "ml_anomaly_score": round(ml_score, 2),
            "final_risk_score": final_score,
            "reasons": reasons
        }
    finally:
        conn.close()

@app.post("/admin/register-device")
def admin_register_device(request: RegisterDeviceRequest, api_key: str = Depends(get_api_key)):
    from device_management import register_trusted_device
    success = register_trusted_device(request.user_id, request.device_id, request.device_name, "IT_ADMIN")
    if success:
        return {"status": "success", "message": f"Device {request.device_id} registered for user {request.user_id}."}
    else:
        raise HTTPException(status_code=500, detail="Failed to register device.")

@app.get("/admin/devices/{user_id}")
def admin_get_devices(user_id: str, api_key: str = Depends(get_api_key)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        # 1. Fetch registered devices
        cursor.execute("""
            SELECT device_id, user_id, device_name, status, added_by, added_date, notes 
            FROM trusted_devices 
            WHERE user_id = ?
        """, (user_id,))
        registered = {}
        for row in cursor.fetchall():
            registered[row[0]] = {
                "device_id": row[0],
                "user_id": row[1],
                "device_name": row[2],
                "status": row[3],
                "added_by": row[4],
                "added_date": row[5],
                "notes": row[6]
            }
            
        # 2. Fetch all unique device_ids used in activity logs
        cursor.execute("""
            SELECT DISTINCT device_id FROM activity_logs 
            WHERE user_id = ?
        """, (user_id,))
        for row in cursor.fetchall():
            dev_id = row[0]
            if dev_id not in registered:
                registered[dev_id] = {
                    "device_id": dev_id,
                    "user_id": user_id,
                    "device_name": "Unregistered Device",
                    "status": "unrecognized",
                    "added_by": "NONE",
                    "added_date": "NONE",
                    "notes": "Unregistered device seen in activity logs"
                }
                
        return list(registered.values())
    finally:
        conn.close()

@app.post("/admin/update-hr-status")
def admin_update_hr_status(request: UpdateHRStatusRequest, api_key: str = Depends(get_api_key)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        now_str = datetime.now().isoformat()
        cursor.execute("""
            INSERT INTO employee_hr_status (
                user_id, employment_status, travel_declared, travel_start_date, 
                travel_end_date, notice_period_start_date, last_updated
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                employment_status=excluded.employment_status,
                travel_declared=excluded.travel_declared,
                travel_start_date=excluded.travel_start_date,
                travel_end_date=excluded.travel_end_date,
                notice_period_start_date=excluded.notice_period_start_date,
                last_updated=excluded.last_updated
        """, (
            request.user_id, request.employment_status, int(request.travel_declared),
            request.travel_start_date, request.travel_end_date, 
            request.notice_period_start_date, now_str
        ))
        conn.commit()
        return {"status": "success", "message": f"HR status updated for user {request.user_id}."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update HR status: {e}")
    finally:
        conn.close()

@app.get("/admin/hr-status/{user_id}")
def admin_get_hr_status(user_id: str, api_key: str = Depends(get_api_key)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT user_id, employment_status, travel_declared, travel_start_date, 
                   travel_end_date, notice_period_start_date, last_updated 
            FROM employee_hr_status 
            WHERE user_id = ?
        """, (user_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="HR status not found for user.")
            
        return {
            "user_id": row[0],
            "employment_status": row[1],
            "travel_declared": bool(row[2]),
            "travel_start_date": row[3],
            "travel_end_date": row[4],
            "notice_period_start_date": row[5],
            "last_updated": row[6]
        }
    finally:
        conn.close()

@app.patch("/alerts/{risk_event_id}/assign")
def assign_alert(risk_event_id: int, request: AssignAlertRequest, api_key: str = Depends(get_api_key)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT analyst_notes FROM risk_events WHERE risk_event_id = ?", (risk_event_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Alert not found")
            
        existing_notes = row[0] or ""
        timestamp = datetime.now().isoformat()
        new_note_entry = f"[{timestamp}] Assigned to {request.analyst_name}\n"
        updated_notes = existing_notes + new_note_entry
            
        cursor.execute("""
            UPDATE risk_events 
            SET assigned_to_analyst = ?, status = 'under_review', reviewed = 1, analyst_notes = ?
            WHERE risk_event_id = ?
        """, (request.analyst_name, updated_notes, risk_event_id))
        conn.commit()
        return {"status": "success", "message": f"Alert {risk_event_id} assigned to {request.analyst_name}."}
    finally:
        conn.close()

@app.patch("/alerts/{risk_event_id}/add-note")
def add_alert_note(risk_event_id: int, request: AddNoteRequest, api_key: str = Depends(get_api_key)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT analyst_notes FROM risk_events WHERE risk_event_id = ?", (risk_event_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Alert not found")
            
        existing_notes = row[0] or ""
        timestamp = datetime.now().isoformat()
        new_note_entry = f"[{timestamp}] {request.note}\n"
        updated_notes = existing_notes + new_note_entry
        
        cursor.execute("""
            UPDATE risk_events 
            SET analyst_notes = ?
            WHERE risk_event_id = ?
        """, (updated_notes, risk_event_id))
        conn.commit()
        return {"status": "success", "message": f"Note added to Alert {risk_event_id}."}
    finally:
        conn.close()

@app.patch("/alerts/{risk_event_id}/resolve")
def resolve_alert(risk_event_id: int, request: ResolveAlertRequest, api_key: str = Depends(get_api_key)):
    res_status = request.resolution_status or request.resolution
    res_note = request.final_note or request.note
    if not res_status or not res_note:
        raise HTTPException(status_code=400, detail="Missing resolution status or note.")
        
    if res_status not in ('resolved_false_positive', 'resolved_confirmed_threat'):
        raise HTTPException(status_code=400, detail="Invalid resolution status. Must be 'resolved_false_positive' or 'resolved_confirmed_threat'")
        
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT analyst_notes FROM risk_events WHERE risk_event_id = ?", (risk_event_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Alert not found")
            
        existing_notes = row[0] or ""
        timestamp = datetime.now().isoformat()
        new_note_entry = f"[{timestamp}] Resolution ({res_status}): {res_note}\n"
        updated_notes = existing_notes + new_note_entry
        
        cursor.execute("""
            UPDATE risk_events 
            SET status = ?, resolved_at = ?, analyst_notes = ?
            WHERE risk_event_id = ?
        """, (res_status, timestamp, updated_notes, risk_event_id))
        conn.commit()
        return {"status": "success", "message": f"Alert {risk_event_id} resolved as {res_status}."}
    finally:
        conn.close()

@app.patch("/alerts/{risk_event_id}/escalate")
def escalate_alert(risk_event_id: int, api_key: str = Depends(get_api_key)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT analyst_notes FROM risk_events WHERE risk_event_id = ?", (risk_event_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Alert not found")
            
        existing_notes = row[0] or ""
        timestamp = datetime.now().isoformat()
        new_note_entry = f"[{timestamp}] Escalated to department head / HR\n"
        updated_notes = existing_notes + new_note_entry
            
        cursor.execute("""
            UPDATE risk_events 
            SET status = 'escalated', analyst_notes = ?
            WHERE risk_event_id = ?
        """, (updated_notes, risk_event_id))
        conn.commit()
        return {"status": "success", "message": f"Alert {risk_event_id} status updated to 'escalated'."}
    finally:
        conn.close()

@app.get("/analytics/rule-accuracy")
def get_rule_accuracy(api_key: str = Depends(get_api_key)):
    from risk_scoring import get_false_positive_rate_for_pattern
    reasons_to_check = [
        "unusual_download_volume",
        "unusual_login_time",
        "unusual_location",
        "new_unrecognized_device",
        "device_pending_verification",
        "department_mismatch",
        "activity_during_leave_period",
        "location_change_but_travel_declared",
        "employee_in_notice_period",
        "ml_model_flagged_unusual_pattern"
    ]
    
    accuracy_report = {}
    for reason in reasons_to_check:
        metrics = get_false_positive_rate_for_pattern(reason)
        accuracy_report[reason] = metrics
        
    return accuracy_report

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
