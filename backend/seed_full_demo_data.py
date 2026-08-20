import os
import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import joblib
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import MinMaxScaler
from auth import get_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'data', 'ueba.db')
MODEL_PATH = os.path.join(BASE_DIR, 'data', 'isolation_forest_model.joblib')
ENCODER_PATH = os.path.join(BASE_DIR, 'data', 'encoders.joblib')

def get_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = 1")
    return conn

def init_tables(conn):
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = 0")
    cursor.execute("DROP TABLE IF EXISTS risk_events")
    cursor.execute("DROP TABLE IF EXISTS activity_logs")
    cursor.execute("DROP TABLE IF EXISTS user_baselines")
    cursor.execute("DROP TABLE IF EXISTS users")
    cursor.execute("DROP TABLE IF EXISTS resources")
    cursor.execute("DROP TABLE IF EXISTS access_violations")
    cursor.execute("DROP TABLE IF EXISTS shift_change_log")
    cursor.execute("DROP TABLE IF EXISTS trusted_devices")
    cursor.execute("DROP TABLE IF EXISTS employee_hr_status")
    cursor.execute("DROP TABLE IF EXISTS server_communications")
    cursor.execute("PRAGMA foreign_keys = 1")
    
    # Re-create tables
    cursor.execute('''
    CREATE TABLE users (
        user_id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        department TEXT,
        role TEXT DEFAULT 'employee'
    )
    ''')

    cursor.execute('''
    CREATE TABLE resources (
        resource_id TEXT PRIMARY KEY,
        resource_name TEXT NOT NULL,
        owning_department TEXT,
        sensitivity TEXT
    )
    ''')

    cursor.execute('''
    CREATE TABLE access_violations (
        violation_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        resource_id TEXT,
        requester_department TEXT,
        resource_department TEXT,
        attempted_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(user_id),
        FOREIGN KEY (resource_id) REFERENCES resources(resource_id)
    )
    ''')

    cursor.execute('''
    CREATE TABLE activity_logs (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        user_name TEXT,
        department TEXT,
        timestamp TEXT,
        login_hour INTEGER,
        location TEXT,
        ip_address TEXT,
        device_id TEXT,
        download_mb REAL,
        files_accessed INTEGER,
        accessed_department TEXT,
        is_anomaly BOOLEAN,
        ml_anomaly_score REAL DEFAULT 0.0
    )
    ''')
    
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_user_time ON activity_logs (user_id, timestamp)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs (user_id)')
    
    cursor.execute('''
    CREATE TABLE user_baselines (
        user_id TEXT PRIMARY KEY,
        avg_download_mb REAL,
        std_download_mb REAL,
        usual_login_hour_start INTEGER,
        usual_login_hour_end INTEGER,
        known_locations TEXT,
        known_devices TEXT,
        usual_department TEXT,
        last_updated TEXT,
        baseline_window_days INTEGER DEFAULT 30,
        last_recalculated TEXT
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE shift_change_log (
        log_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        old_hour_start INTEGER,
        old_hour_end INTEGER,
        new_hour_start INTEGER,
        new_hour_end INTEGER,
        detected_date TEXT,
        reason TEXT
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE trusted_devices (
        device_id TEXT,
        user_id TEXT,
        device_name TEXT,
        status TEXT DEFAULT 'unrecognized',
        added_by TEXT,
        added_date TEXT,
        notes TEXT,
        PRIMARY KEY (device_id, user_id)
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE employee_hr_status (
        user_id TEXT PRIMARY KEY,
        employment_status TEXT DEFAULT 'active',
        travel_declared BOOLEAN DEFAULT 0,
        travel_start_date TEXT,
        travel_end_date TEXT,
        notice_period_start_date TEXT,
        last_updated TEXT
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE risk_events (
        risk_event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER,
        user_id TEXT,
        risk_score INTEGER,
        reasons TEXT,
        flagged_at TEXT,
        reviewed BOOLEAN DEFAULT 0,
        status TEXT DEFAULT 'new',
        assigned_to_analyst TEXT,
        analyst_notes TEXT,
        resolved_at TEXT,
        FOREIGN KEY (event_id) REFERENCES activity_logs(event_id)
    )
    ''')
    
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_risk_events_user_score ON risk_events (user_id, risk_score, status)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_risk_events_event ON risk_events (event_id)')

    cursor.execute('''
    CREATE TABLE server_communications (
        comm_id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_server TEXT NOT NULL,
        destination_server TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        data_transferred_mb REAL,
        is_anomaly BOOLEAN DEFAULT 0
    )
    ''')
    
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_server_comm ON server_communications (source_server, timestamp)')
    conn.commit()

def seed_full_demo():
    print("Starting UEBA Seeding Script...")
    conn = get_connection()
    init_tables(conn)
    
    cursor = conn.cursor()
    
    # 1. Seed Demo Credentials
    admin1_pw = get_password_hash("password123")
    analyst1_pw = get_password_hash("password123")
    
    # Standard admin/analyst credentials (for fallback)
    admin_pw = get_password_hash("admin123")
    analyst_pw = get_password_hash("analyst123")
    
    cursor.execute("INSERT INTO users VALUES (?, ?, ?, ?, ?)", ("admin1_id", "admin1", admin1_pw, "IT", "admin"))
    cursor.execute("INSERT INTO users VALUES (?, ?, ?, ?, ?)", ("analyst1_id", "analyst1", analyst1_pw, "Security", "analyst"))
    cursor.execute("INSERT INTO users VALUES (?, ?, ?, ?, ?)", ("admin_demo", "admin", admin_pw, "IT", "admin"))
    cursor.execute("INSERT INTO users VALUES (?, ?, ?, ?, ?)", ("analyst_demo", "analyst", analyst_pw, "Security", "analyst"))
    
    # 2. Define Departments and exactly 30 users U001-U030
    departments = ["HR", "Finance", "Engineering", "Sales", "IT"]
    users_list = []
    
    # Map user IDs to departments
    # U001-U006: HR, U007-U012: Finance, U013-U018: Engineering, U019-U024: Sales, U025-U030: IT
    users_data = [
        # HR
        ("U001", "Aarav Sharma", "HR"), ("U002", "Vivaan Kapoor", "HR"), ("U003", "Aditya Sen", "HR"),
        ("U004", "Vihaan Roy", "HR"), ("U005", "Arjun Mehta", "HR"), ("U006", "Sai Patel", "HR"),
        # Finance
        ("U007", "Aanya Gupta", "Finance"), ("U008", "Diya Iyer", "Finance"), ("U009", "Kiara Joshi", "Finance"),
        ("U010", "Ananya Reddy", "Finance"), ("U011", "Alia Rao", "Finance"), ("U012", "Shruti Verma", "Finance"),
        # Engineering
        ("U013", "Kabir Nair", "Engineering"), ("U014", "Rohan Das", "Engineering"), ("U015", "Reyansh Mishra", "Engineering"),
        ("U016", "Ishaan Bhat", "Engineering"), ("U017", "Krishna Pillai", "Engineering"), ("U018", "Arnav Nair", "Engineering"),
        # Sales
        ("U019", "Pranav Deshmukh", "Sales"), ("U020", "Dhruv Chaudhari", "Sales"), ("U021", "Siddharth Shinde", "Sales"),
        ("U022", "Aditi Kulkarni", "Sales"), ("U023", "Riya Patil", "Sales"), ("U024", "Isha Joshi", "Sales"),
        # IT
        ("U025", "Devendra Singh", "IT"), ("U026", "Harish Kumar", "IT"), ("U027", "Rajesh Khanna", "IT"),
        ("U028", "Sanjay Dutt", "IT"), ("U029", "Amitabh Bachchan", "IT"), ("U030", "Shah Rukh Khan", "IT")
    ]
    
    hashed_default = get_password_hash("password123")
    for user_id, name, dept in users_data:
        username = name.lower().replace(" ", ".")
        cursor.execute("INSERT INTO users VALUES (?, ?, ?, ?, 'employee')", (user_id, username, hashed_default, dept))
        users_list.append({
            "user_id": user_id,
            "name": name,
            "username": username,
            "department": dept,
            "usual_location": "Chennai" if user_id < "U018" else "London",
            "usual_device": f"DEV_{user_id}",
            "usual_ip": f"192.168.1.{int(user_id[1:])}",
            "avg_download": 20.0
        })
        
    # Seed Resources
    resources = [
        ("RES_HR_01", "Employee_Appraisals_2026.xlsx", "HR", "high"),
        ("RES_HR_02", "HR_Payroll_Template.csv", "HR", "medium"),
        ("RES_FIN_01", "Q3_Financial_Statement.xlsx", "Finance", "critical"),
        ("RES_FIN_02", "Bank_Reconciliation.csv", "Finance", "medium"),
        ("RES_ENG_01", "Source_Code_Core_Kernel.tar.gz", "Engineering", "critical"),
        ("RES_ENG_02", "Build_Configurations.yaml", "Engineering", "low"),
        ("RES_SAL_01", "CRM_Sales_Leads_Active.db", "Sales", "high"),
        ("RES_IT_01", "Active_Directory_Schema.ldif", "IT", "critical")
    ]
    for res_id, rname, rdept, rsens in resources:
        cursor.execute("INSERT INTO resources VALUES (?, ?, ?, ?)", (res_id, rname, rdept, rsens))
        
    # Generate 90 days of normal background activity logs (from 2026-05-19 to 2026-08-17)
    start_time = datetime(2026, 5, 19, 9, 0, 0)
    end_time = datetime(2026, 8, 17, 18, 0, 0)
    
    activity_logs = []
    
    print("Generating background logs for 30 users over 90 days...")
    current_date = start_time
    while current_date <= end_time:
        is_weekend = current_date.weekday() >= 5
        # Generate logs for normal users
        for u in users_list:
            uid = u["user_id"]
            
            # Skip scenarios in dormant periods or special cases
            if uid == "U027" and datetime(2026, 6, 1) <= current_date <= datetime(2026, 7, 25):
                # U027 is dormant during this period
                continue
            if uid == "U026" and current_date >= datetime(2026, 8, 3):
                # U026 shifts to night hours later, handled below
                continue
            
            # Daily chance of log
            if is_weekend:
                chance = 0.05
            else:
                chance = 0.6
                
            if np.random.rand() < chance:
                # 1-3 logs today
                for _ in range(np.random.randint(1, 4)):
                    hour = int(np.random.choice(list(range(9, 18))))
                    minute = np.random.randint(0, 60)
                    log_time = current_date.replace(hour=hour, minute=minute, second=0)
                    download = max(1.0, np.random.normal(u["avg_download"], 3.0))
                    
                    activity_logs.append((
                        uid, u["name"], u["department"], log_time.isoformat(), hour,
                        u["usual_location"], u["usual_ip"], u["usual_device"],
                        round(download, 2), np.random.randint(1, 6), u["department"], 0
                    ))
                    
        current_date += timedelta(days=1)
        
    # 3. Specific Scenario Injections
    print("Injecting advanced threat scenarios...")
    
    # SCENARIO 2: Classic Insider Threat U016 & U017
    # U016: Massive Download Spike on 2026-08-17 at 02:15 AM
    u016 = next(u for u in users_list if u["user_id"] == "U016")
    activity_logs.append((
        "U016", u016["name"], u016["department"], "2026-08-17T02:15:00", 2,
        u016["usual_location"], u016["usual_ip"], u016["usual_device"],
        5300.0, 48, "Engineering", 1
    ))
    
    # U017: Dept Mismatch - Engineering accessing Finance files on 2026-08-17 at 23:45
    u017 = next(u for u in users_list if u["user_id"] == "U017")
    activity_logs.append((
        "U017", u017["name"], u017["department"], "2026-08-17T23:45:00", 23,
        u017["usual_location"], u017["usual_ip"], u017["usual_device"],
        45.0, 12, "Finance", 1
    ))
    
    # SCENARIO 3: Compromised Account / Impossible Travel U018 & U019
    # U018: Impossible Travel - Chennai (10:00) then London (10:20) on 2026-08-17
    u018 = next(u for u in users_list if u["user_id"] == "U018")
    activity_logs.append((
        "U018", u018["name"], u018["department"], "2026-08-17T10:00:00", 10,
        "Chennai", "182.72.100.1", u018["usual_device"],
        12.0, 2, "Engineering", 1
    ))
    activity_logs.append((
        "U018", u018["name"], u018["department"], "2026-08-17T10:20:00", 10,
        "London", "82.165.12.3", u018["usual_device"],
        8.0, 1, "Engineering", 1
    ))
    
    # U019: New device + location on same event on 2026-08-17T14:30:00
    u019 = next(u for u in users_list if u["user_id"] == "U019")
    activity_logs.append((
        "U019", u019["name"], u019["department"], "2026-08-17T14:30:00", 14,
        "New York", "216.58.200.4", "DEV_NEW_99",
        30.0, 4, "Sales", 1
    ))
    
    # SCENARIO 4: Device Trust Scenarios U020 & U021
    # U020: DEV_U020_TRUSTED pre-registered. Logs on 2026-08-17T11:00:00. Should NOT trigger.
    u020 = next(u for u in users_list if u["user_id"] == "U020")
    cursor.execute("""
        INSERT INTO trusted_devices VALUES ('DEV_U020_TRUSTED', 'U020', 'Company Issued Laptop', 'trusted', 'IT_ADMIN', ?, 'Pre-registered Device')
    """, (datetime.now().isoformat(),))
    activity_logs.append((
        "U020", u020["name"], u020["department"], "2026-08-17T11:00:00", 11,
        u020["usual_location"], u020["usual_ip"], "DEV_U020_TRUSTED",
        15.0, 3, "Sales", 0
    ))
    
    # U021: DEV_U021_PENDING used 3 times
    u021 = next(u for u in users_list if u["user_id"] == "U021")
    cursor.execute("""
        INSERT INTO trusted_devices VALUES ('DEV_U021_PENDING', 'U021', 'Pending Check Laptop', 'pending', 'SYSTEM', ?, 'Seen in logs 3 times')
    """, (datetime.now().isoformat(),))
    for d_offset in [2, 1, 0]:
        log_date = datetime(2026, 8, 17, 10, 0, 0) - timedelta(days=d_offset)
        activity_logs.append((
            "U021", u021["name"], u021["department"], log_date.isoformat(), 10,
            u021["usual_location"], u021["usual_ip"], "DEV_U021_PENDING",
            12.0, 2, "Sales", 0
        ))
        
    # SCENARIO 5: HR Context Scenarios U022, U023, U024, U025
    # U022: Travel declared & inside range. travel_declared=1 (2026-08-10 to 2026-08-20). London event. Should NOT trigger.
    u022 = next(u for u in users_list if u["user_id"] == "U022")
    cursor.execute("""
        INSERT INTO employee_hr_status VALUES ('U022', 'active', 1, '2026-08-10', '2026-08-20', NULL, ?)
    """, (datetime.now().isoformat(),))
    activity_logs.append((
        "U022", u022["name"], u022["department"], "2026-08-15T15:00:00", 15,
        "London", "82.165.12.3", u022["usual_device"],
        20.0, 4, "Sales", 0
    ))
    
    # U023: Travel declared & outside range. travel_declared=1 (2026-08-01 to 2026-08-10). London event on 2026-08-15. SHOULD trigger.
    u023 = next(u for u in users_list if u["user_id"] == "U023")
    cursor.execute("""
        INSERT INTO employee_hr_status VALUES ('U023', 'active', 1, '2026-08-01', '2026-08-10', NULL, ?)
    """, (datetime.now().isoformat(),))
    activity_logs.append((
        "U023", u023["name"], u023["department"], "2026-08-15T15:00:00", 15,
        "London", "82.165.12.3", u023["usual_device"],
        20.0, 4, "Sales", 1
    ))
    
    # U024: Notice period 1.3x multiplier. Notice period start 2026-08-01. Unusual hour login on 2026-08-17 at 23:30.
    u024 = next(u for u in users_list if u["user_id"] == "U024")
    cursor.execute("""
        INSERT INTO employee_hr_status VALUES ('U024', 'notice_period', 0, NULL, NULL, '2026-08-01', ?)
    """, (datetime.now().isoformat(),))
    activity_logs.append((
        "U024", u024["name"], u024["department"], "2026-08-17T23:30:00", 23,
        u024["usual_location"], u024["usual_ip"], u024["usual_device"],
        18.0, 3, "Sales", 1
    ))
    
    # U025: On Leave activity. employment_status='on_leave'. Logs activity on 2026-08-17.
    u025 = next(u for u in users_list if u["user_id"] == "U025")
    cursor.execute("""
        INSERT INTO employee_hr_status VALUES ('U025', 'on_leave', 0, NULL, NULL, NULL, ?)
    """, (datetime.now().isoformat(),))
    activity_logs.append((
        "U025", u025["name"], u025["department"], "2026-08-17T12:00:00", 12,
        u025["usual_location"], u025["usual_ip"], u025["usual_device"],
        10.0, 1, "IT", 1
    ))
    
    # Default HR active status for remaining users
    for u in users_list:
        if u["user_id"] not in ["U022", "U023", "U024", "U025"]:
            cursor.execute("""
                INSERT INTO employee_hr_status VALUES (?, 'active', 0, NULL, NULL, NULL, ?)
            """, (u["user_id"], datetime.now().isoformat()))
            
    # SCENARIO 6: Shift Change U026
    # U026: Day shift (9-17) for 60 days, night-shift (22-04) for last 14 days straight
    u026 = next(u for u in users_list if u["user_id"] == "U026")
    # First 60 days day shift
    for day in range(60):
        log_date = start_time + timedelta(days=day)
        if log_date.weekday() < 5:
            activity_logs.append((
                "U026", u026["name"], u026["department"], log_date.replace(hour=10, minute=0).isoformat(), 10,
                u026["usual_location"], u026["usual_ip"], u026["usual_device"],
                15.0, 3, "IT", 0
            ))
    # Last 14 days night shift (from 2026-08-04 to 2026-08-17)
    for day in range(14):
        log_date = datetime(2026, 8, 4, 23, 15, 0) + timedelta(days=day)
        activity_logs.append((
            "U026", u026["name"], u026["department"], log_date.isoformat(), 23,
            u026["usual_location"], u026["usual_ip"], u026["usual_device"],
            18.0, 3, "IT", 1 # anomalous initially
        ))
        
    # SCENARIO 7: Dormant Account U027
    # Zero activity for 45 days (2026-06-01 to 2026-07-25), sudden login 2026-08-17T03:00:00
    u027 = next(u for u in users_list if u["user_id"] == "U027")
    # Day 1-10 activity
    for day in range(10):
        log_date = start_time + timedelta(days=day)
        activity_logs.append((
            "U027", u027["name"], u027["department"], log_date.replace(hour=14, minute=0).isoformat(), 14,
            u027["usual_location"], u027["usual_ip"], u027["usual_device"],
            12.0, 2, "IT", 0
        ))
    # Single login at 3 AM on 2026-08-17
    activity_logs.append((
        "U027", u027["name"], u027["department"], "2026-08-17T03:00:00", 3,
        u027["usual_location"], u027["usual_ip"], u027["usual_device"],
        25.0, 4, "IT", 1
    ))
    
    # SCENARIO 8: Gradual Drift U028
    # Download size slowly increases over 20 days (from 20MB to 50MB, below 3x baseline 60MB)
    u028 = next(u for u in users_list if u["user_id"] == "U028")
    for day in range(70):
        log_date = start_time + timedelta(days=day)
        if log_date.weekday() < 5:
            activity_logs.append((
                "U028", u028["name"], u028["department"], log_date.replace(hour=11, minute=0).isoformat(), 11,
                u028["usual_location"], u028["usual_ip"], u028["usual_device"],
                20.0, 2, "IT", 0
            ))
    # Climb over 20 days (from day 71 to day 90)
    for day in range(20):
        log_date = start_time + timedelta(days=70+day)
        vol = 20.0 + (day * 1.5) # slowly climbs to 48.5MB
        activity_logs.append((
            "U028", u028["name"], u028["department"], log_date.replace(hour=11, minute=0).isoformat(), 11,
            u028["usual_location"], u028["usual_ip"], u028["usual_device"],
            round(vol, 2), 2, "IT", 0
        ))
        
    # SCENARIO 9: Concurrent Session Conflict U029
    # Chennai login (10:00) and London login (10:02) on 2026-08-17
    u029 = next(u for u in users_list if u["user_id"] == "U029")
    activity_logs.append((
        "U029", u029["name"], u029["department"], "2026-08-17T10:00:00", 10,
        "Chennai", "182.72.100.1", u029["usual_device"],
        15.0, 2, "Sales", 1
    ))
    activity_logs.append((
        "U029", u029["name"], u029["department"], "2026-08-17T10:02:00", 10,
        "London", "82.165.12.3", u029["usual_device"],
        22.0, 3, "Sales", 1
    ))
    
    # Insert logs into database
    print(f"Inserting {len(activity_logs)} activity log entries...")
    cursor.executemany("""
        INSERT INTO activity_logs (user_id, user_name, department, timestamp, login_hour, location, ip_address, device_id, download_mb, files_accessed, accessed_department, is_anomaly)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, activity_logs)
    conn.commit()
    
    # SCENARIO 10: Server to Server anomalies
    servers = ["SERVER_HR_01", "SERVER_HR_PORTAL", "SERVER_FINANCE_DB", "SERVER_PAYROLL", "SERVER_ENG_BUILD", "SERVER_ENG_CODE", "SERVER_ENG_TEST", "SERVER_IT_ACTIVE_DIRECTORY", "SERVER_IT_MONITOR", "SERVER_SALES_CRM", "SERVER_SALES_PORTAL", "SERVER_HQ_NAS"]
    usual_partners = {
        "SERVER_HR_01": ["SERVER_HR_PORTAL", "SERVER_HQ_NAS"],
        "SERVER_HR_PORTAL": ["SERVER_HR_01"],
        "SERVER_FINANCE_DB": ["SERVER_PAYROLL", "SERVER_HQ_NAS"],
        "SERVER_PAYROLL": ["SERVER_FINANCE_DB"],
        "SERVER_ENG_BUILD": ["SERVER_ENG_CODE", "SERVER_ENG_TEST"],
        "SERVER_ENG_CODE": ["SERVER_ENG_BUILD"],
        "SERVER_ENG_TEST": ["SERVER_ENG_BUILD"],
        "SERVER_IT_ACTIVE_DIRECTORY": ["SERVER_HR_01", "SERVER_FINANCE_DB", "SERVER_SALES_CRM"],
        "SERVER_IT_MONITOR": ["SERVER_ENG_BUILD", "SERVER_ENG_CODE"],
        "SERVER_SALES_CRM": ["SERVER_SALES_PORTAL", "SERVER_HQ_NAS"],
        "SERVER_SALES_PORTAL": ["SERVER_SALES_CRM"],
        "SERVER_HQ_NAS": ["SERVER_HR_01", "SERVER_FINANCE_DB", "SERVER_SALES_CRM"]
    }
    
    comm_records = []
    # Seed 60 days of normal server logs
    s_date = datetime(2026, 6, 18)
    for day in range(60):
        c_day = s_date + timedelta(days=day)
        for _ in range(np.random.randint(5, 10)):
            src = np.random.choice(servers)
            dst = np.random.choice(usual_partners[src])
            data = round(np.random.uniform(5.0, 500.0), 2)
            time_offset = timedelta(hours=np.random.randint(0, 24), minutes=np.random.randint(0, 60))
            comm_records.append((src, dst, (c_day + time_offset).isoformat(), data, 0))
            
    # Inject 3 server anomalies
    comm_records.append(("SERVER_HR_01", "SERVER_ENG_CODE", "2026-08-16T14:20:00", 945.0, 1))
    comm_records.append(("SERVER_FINANCE_DB", "SERVER_SALES_PORTAL", "2026-08-17T09:12:00", 1430.0, 1))
    comm_records.append(("SERVER_ENG_BUILD", "SERVER_PAYROLL", "2026-08-17T21:40:00", 725.0, 1))
    
    cursor.executemany("INSERT INTO server_communications (source_server, destination_server, timestamp, data_transferred_mb, is_anomaly) VALUES (?, ?, ?, ?, ?)", comm_records)
    conn.commit()
    
    # 4. Fit the Isolation Forest and save
    print("Training Isolation Forest ML model...")
    df_logs = pd.read_sql_query("SELECT * FROM activity_logs", conn)
    df_logs['department_mismatch'] = (df_logs['accessed_department'] != df_logs['department']).astype(int)
    
    # Encoders
    from sklearn.preprocessing import LabelEncoder
    location_encoder = LabelEncoder()
    device_encoder = LabelEncoder()
    
    # Handle unseen categories
    all_locs = sorted(df_logs['location'].unique())
    all_devs = sorted(df_logs['device_id'].unique())
    
    location_encoder.fit(all_locs)
    device_encoder.fit(all_devs)
    
    df_logs['location_encoded'] = location_encoder.transform(df_logs['location'])
    df_logs['device_encoded'] = device_encoder.transform(df_logs['device_id'])
    
    feature_cols = ['download_mb', 'login_hour', 'location_encoded', 'device_encoded', 'department_mismatch', 'files_accessed']
    
    # Train only on normal
    train_df = df_logs[df_logs['is_anomaly'] == 0]
    model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    model.fit(train_df[feature_cols])
    
    # Save encoders & model
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    joblib.dump({'location': location_encoder, 'device': device_encoder}, ENCODER_PATH)
    print("Saved trained Isolation Forest model and LabelEncoders.")
    
    # 5. Build Baselines
    print("Building user baselines...")
    from baseline import build_user_baselines, recalculate_all_baselines
    build_user_baselines()
    
    # Shift change calculation for U026
    recalculate_all_baselines()
    
    # 6. Run Risk Scoring (generate risk events)
    print("Running risk scoring engine...")
    from risk_scoring import score_all_events
    score_all_events()
    
    # 7. Apply Resolved Alerts variety and Audit Logs (SCENARIO 11 & 12)
    print("Seeding closed resolutions registry and analyst audit logs...")
    # Fetch risk events
    cursor.execute("SELECT risk_event_id, reasons, flagged_at FROM risk_events WHERE risk_score > 60")
    events = cursor.fetchall()
    
    # Resolve 10-12 alerts
    # 60% false positive, 40% confirmed threat across different reasons
    resolutions = [
        ('resolved_false_positive', "Confirmed with employee - authorized project research and download work."),
        ('resolved_false_positive', "Valid travel registration confirmed but not uploaded in time to HR database."),
        ('resolved_false_positive', "IT administrator testing active directory egress nodes."),
        ('resolved_false_positive', "Analyst confirmed employee shifts adjusted due to emergency maintenance duty."),
        ('resolved_false_positive', "Double session caused by local cellular handoff, not account hijacking."),
        ('resolved_confirmed_threat', "Escalated to HR and Legal - confirmed unauthorised data exfiltration attempt."),
        ('resolved_confirmed_threat', "Suspicious logins from anomalous IP outside travel range confirmed as compromised token."),
        ('resolved_confirmed_threat', "Account compromised via phished session token. Revoked credentials and blocked egress."),
        ('resolved_confirmed_threat', "Leave violation confirmed. Employee active during termination period.")
    ]
    
    # Seed audit trail timestamps
    analysts = ["Analyst_Priya", "Analyst_Karthik"]
    now_dt = datetime.now()
    
    for i, event in enumerate(events[:12]):
        reid, reasons, flagged_at = event
        res_idx = i % len(resolutions)
        status, note = resolutions[res_idx]
        analyst = analysts[i % len(analysts)]
        
        # Build chronological audit trail log in notes
        flagged_dt = datetime.fromisoformat(flagged_at) if 'T' in flagged_at else datetime.strptime(flagged_at, "%Y-%m-%d %H:%M:%S.%f")
        t_assigned = (flagged_dt + timedelta(minutes=15)).isoformat()
        t_comment = (flagged_dt + timedelta(hours=2)).isoformat()
        t_resolved = (flagged_dt + timedelta(hours=4)).isoformat()
        
        notes_thread = (
            f"[{t_assigned}] Assigned to {analyst}\n"
            f"[{t_comment}] {analyst}: Commencing audit investigation on {reasons.split(',')[0]}...\n"
            f"[{t_resolved}] Resolution ({status}): {note}\n"
        )
        
        cursor.execute("""
            UPDATE risk_events
            SET status = ?, resolved_at = ?, assigned_to_analyst = ?, analyst_notes = ?, reviewed = 1
            WHERE risk_event_id = ?
        """, (status, t_resolved, analyst, notes_thread, reid))
        
    conn.commit()
    conn.close()
    
    print("\n" + "=" * 50)
    print("UEBA DEMO DATA SEEDING COMPLETE!")
    print("=" * 50)
    print("CREDENTIALS:")
    print("  Administrator:      admin1 / [REDACTED]")
    print("  Security Analyst:   analyst1 / [REDACTED]")
    print("\nSCENARIO CHEAT-SHEET FOR THE LIVE DEMO:")
    print("  1. Normal Users:      U001 to U015 (Demonstrates zero alerts/normal baselines)")
    print("  2. Classic Threat:    U016 (Sudden 5.3GB download spike at 2 AM)")
    print("                        U017 (Engineering user accessing Finance files at 11 PM)")
    print("  3. Compromised Acct:  U018 (Impossible Travel Chennai 10:00 -> London 10:20)")
    print("                        U019 (Takeover - Chennai user, London loc + new device DEV_NEW_99)")
    print("  4. Device Trust:      U020 (IT pre-registered DEV_U020_TRUSTED - no alerts triggered)")
    print("                        U021 (Pending auto-promotion - device DEV_U021_PENDING used 3 times)")
    print("  5. HR Exceptions:     U022 (Travel declared for London - no alerts triggered)")
    print("                        U023 (London login outside travel window - flagged as threat)")
    print("                        U024 (Notice period started - 1.3x risk score multiplier applied)")
    print("                        U025 (On leave login event - flagged with +30 leave-violation)")
    print("  6. Adaptive Baseline: U026 (Day to Night shift change - baseline auto-adjusted)")
    print("  7. Dormant Account:   U027 (Inactive for 45 days, sudden login at 3 AM)")
    print("  8. Gradual Drift:     U028 (Slow download increase from 20MB -> 50MB over 20 days)")
    print("  9. Concurrent Login:  U029 (Chennai & London overlapping session within 2 minutes)")
    print(" 10. Server Communications: anomalies injected in server_communications table")
    print(" 11. Resolved Registry: Closed resolution history populated (60% FP, 40% Threats)")
    print(" 12. Audit Log:         Fully populated logs with Analyst Priya and Analyst Karthik")
    print("=" * 50 + "\n")

if __name__ == "__main__":
    seed_full_demo()
