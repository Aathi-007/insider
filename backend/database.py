import sqlite3
import pandas as pd
import os

# Define paths relative to this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'data', 'ueba.db')
CSV_PATH = os.path.join(BASE_DIR, 'data', 'activity_logs.csv')

def get_connection():
    """
    Returns a connection to the SQLite database.
    Can be reused by other modules like baseline.py or risk_scoring.py.
    """
    # Ensure the data directory exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    # Enable foreign keys for SQLite
    conn.execute("PRAGMA foreign_keys = 1")
    return conn

def create_tables(conn):
    """
    Creates the necessary tables for the UEBA project.
    """
    cursor = conn.cursor()
    
    # Table: users
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        department TEXT,
        role TEXT DEFAULT 'employee'
    )
    ''')

    # Table: resources
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS resources (
        resource_id TEXT PRIMARY KEY,
        resource_name TEXT NOT NULL,
        owning_department TEXT,
        sensitivity TEXT
    )
    ''')

    # Table: access_violations
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS access_violations (
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

    # Table 1: activity_logs
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS activity_logs (
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
    
    # Create index on user_id and timestamp for fast lookups
    cursor.execute('''
    CREATE INDEX IF NOT EXISTS idx_user_time 
    ON activity_logs (user_id, timestamp)
    ''')
    
    # Table 2: user_baselines (Empty structure for now)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS user_baselines (
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
    
    # Table: shift_change_log
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS shift_change_log (
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
    
    # Table: trusted_devices
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS trusted_devices (
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
    
    # Table: employee_hr_status
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS employee_hr_status (
        user_id TEXT PRIMARY KEY,
        employment_status TEXT DEFAULT 'active',
        travel_declared BOOLEAN DEFAULT 0,
        travel_start_date TEXT,
        travel_end_date TEXT,
        notice_period_start_date TEXT,
        last_updated TEXT
    )
    ''')
    
    # Table 3: risk_events (Empty structure for now)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS risk_events (
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

    # Table: server_communications
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS server_communications (
        comm_id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_server TEXT NOT NULL,
        destination_server TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        data_transferred_mb REAL,
        is_anomaly BOOLEAN DEFAULT 0
    )
    ''')
    
    # Create index on source_server and timestamp for fast lookups
    cursor.execute('''
    CREATE INDEX IF NOT EXISTS idx_server_comm
    ON server_communications (source_server, timestamp)
    ''')
    
    # Create indexes for query optimization
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_risk_events_user_score ON risk_events (user_id, risk_score, status)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_risk_events_event ON risk_events (event_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs (user_id)')
    
    conn.commit()

def generate_server_communications(conn):
    """
    Generates synthetic server-to-server communication logs.
    """
    import random
    from datetime import datetime, timedelta
    
    cursor = conn.cursor()
    cursor.execute("DELETE FROM server_communications")
    cursor.execute("DELETE FROM sqlite_sequence WHERE name='server_communications'")
    conn.commit()
    
    # 1. Internal servers across departments (12 servers)
    servers = [
        "SERVER_HR_01", "SERVER_HR_PORTAL", 
        "SERVER_FINANCE_DB", "SERVER_PAYROLL", 
        "SERVER_ENG_BUILD", "SERVER_ENG_CODE", "SERVER_ENG_TEST", 
        "SERVER_IT_ACTIVE_DIRECTORY", "SERVER_IT_MONITOR", 
        "SERVER_SALES_CRM", "SERVER_SALES_PORTAL", "SERVER_HQ_NAS"
    ]
    
    # 2. Map of usual partners (2-4 per server)
    usual_partners = {
        "SERVER_HR_01": ["SERVER_HR_PORTAL", "SERVER_IT_ACTIVE_DIRECTORY", "SERVER_HQ_NAS"],
        "SERVER_HR_PORTAL": ["SERVER_HR_01", "SERVER_IT_ACTIVE_DIRECTORY"],
        "SERVER_FINANCE_DB": ["SERVER_PAYROLL", "SERVER_IT_ACTIVE_DIRECTORY", "SERVER_HQ_NAS"],
        "SERVER_PAYROLL": ["SERVER_FINANCE_DB", "SERVER_IT_ACTIVE_DIRECTORY"],
        "SERVER_ENG_BUILD": ["SERVER_ENG_CODE", "SERVER_ENG_TEST", "SERVER_IT_MONITOR"],
        "SERVER_ENG_CODE": ["SERVER_ENG_BUILD", "SERVER_IT_MONITOR"],
        "SERVER_ENG_TEST": ["SERVER_ENG_BUILD", "SERVER_IT_MONITOR"],
        "SERVER_IT_ACTIVE_DIRECTORY": ["SERVER_HR_01", "SERVER_FINANCE_DB", "SERVER_SALES_CRM"],
        "SERVER_IT_MONITOR": ["SERVER_ENG_BUILD", "SERVER_ENG_CODE", "SERVER_ENG_TEST", "SERVER_HQ_NAS"],
        "SERVER_SALES_CRM": ["SERVER_SALES_PORTAL", "SERVER_IT_ACTIVE_DIRECTORY", "SERVER_HQ_NAS"],
        "SERVER_SALES_PORTAL": ["SERVER_SALES_CRM", "SERVER_IT_ACTIVE_DIRECTORY"],
        "SERVER_HQ_NAS": ["SERVER_HR_01", "SERVER_FINANCE_DB", "SERVER_SALES_CRM", "SERVER_IT_MONITOR"]
    }
    
    # 3. Simulate 75 days of normal communications (approx 5-10 records per day)
    start_date = datetime.now() - timedelta(days=75)
    comm_records = []
    
    for day in range(76):
        current_day = start_date + timedelta(days=day)
        num_records = random.randint(5, 10)
        for _ in range(num_records):
            source = random.choice(servers)
            dest = random.choice(usual_partners[source])
            time_offset = timedelta(
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59),
                seconds=random.randint(0, 59)
            )
            timestamp = (current_day + time_offset).isoformat()
            data_mb = round(random.uniform(5.0, 500.0), 2)
            comm_records.append((source, dest, timestamp, data_mb, 0))
            
    # 4. Inject 4 specific anomalies in the last 2-3 days
    recent_day = datetime.now() - timedelta(days=2)
    
    anomalies = [
        ("SERVER_HR_01", "SERVER_ENG_CODE", (recent_day + timedelta(hours=10)).isoformat(), 950.0, 1),
        ("SERVER_FINANCE_DB", "SERVER_SALES_PORTAL", (recent_day + timedelta(hours=14)).isoformat(), 1420.0, 1),
        ("SERVER_ENG_BUILD", "SERVER_PAYROLL", (recent_day + timedelta(hours=16, days=1)).isoformat(), 720.0, 1),
        ("SERVER_SALES_CRM", "SERVER_ENG_TEST", (recent_day + timedelta(hours=19, days=1)).isoformat(), 110.0, 1)
    ]
    
    comm_records.extend(anomalies)
    
    # Insert all records
    cursor.executemany("""
        INSERT INTO server_communications (source_server, destination_server, timestamp, data_transferred_mb, is_anomaly)
        VALUES (?, ?, ?, ?, ?)
    """, comm_records)
    conn.commit()
    print(f"Generated {len(comm_records)} server communication logs (including {len(anomalies)} anomalies).")


def load_csv_to_db(conn):
    """
    Reads the activity_logs.csv file and inserts it into the activity_logs table.
    It clears the table first to ensure duplicate-run safety.
    """
    if not os.path.exists(CSV_PATH):
        print(f"Error: CSV file not found at {CSV_PATH}")
        return 0

    cursor = conn.cursor()
    
    # Duplicate-run safety: Clear the table and reset the autoincrement sequence
    cursor.execute("DELETE FROM risk_events")
    cursor.execute("DELETE FROM activity_logs")
    cursor.execute("DELETE FROM sqlite_sequence WHERE name='activity_logs'")
    cursor.execute("DELETE FROM sqlite_sequence WHERE name='risk_events'")
    conn.commit()

    # Read CSV using pandas
    df = pd.read_csv(CSV_PATH)
    
    # Columns mapping exactly to the database schema (excluding event_id)
    columns = [
        'user_id', 'user_name', 'department', 'timestamp', 'login_hour', 
        'location', 'ip_address', 'device_id', 'download_mb', 'files_accessed', 
        'accessed_department', 'is_anomaly'
    ]
    
    # Ensure pandas uses standard python bool/int instead of numpy types if needed
    data_to_insert = df[columns].to_records(index=False).tolist()
    
    # Insert query using parameterized statements
    insert_sql = f'''
        INSERT INTO activity_logs ({', '.join(columns)})
        VALUES ({', '.join(['?'] * len(columns))})
    '''
    
    cursor.executemany(insert_sql, data_to_insert)
    conn.commit()
    
    return len(data_to_insert)

def seed_employee_hr_status(conn):
    from datetime import datetime
    cursor = conn.cursor()
    cursor.execute("DELETE FROM employee_hr_status")
    
    # Fetch all user_ids from activity_logs
    cursor.execute("SELECT DISTINCT user_id FROM activity_logs")
    user_ids = [row[0] for row in cursor.fetchall()]
    if not user_ids:
        user_ids = [f"U{i:03d}" for i in range(1, 31)]
        
    last_updated = datetime.now().isoformat()
    
    # 2 users on travel: U002 and U003
    # 1 user in notice period: U004
    # 1 user on leave: U005
    hr_records = []
    for uid in user_ids:
        if uid == 'U002':
            hr_records.append((uid, 'active', 1, '2026-08-01', '2026-08-30', None, last_updated))
        elif uid == 'U003':
            hr_records.append((uid, 'active', 1, '2026-08-10', '2026-08-20', None, last_updated))
        elif uid == 'U004':
            hr_records.append((uid, 'notice_period', 0, None, None, '2026-08-01', last_updated))
        elif uid == 'U005':
            hr_records.append((uid, 'on_leave', 0, None, None, None, last_updated))
        else:
            hr_records.append((uid, 'active', 0, None, None, None, last_updated))
            
    cursor.executemany("""
        INSERT INTO employee_hr_status (user_id, employment_status, travel_declared, travel_start_date, travel_end_date, notice_period_start_date, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, hr_records)
    conn.commit()
    print(f"Seeded employee HR status for {len(hr_records)} users.")

def main():
    print("Initializing UEBA Database...")
    conn = get_connection()
    
    try:
        # Create the tables
        create_tables(conn)
        print("Tables checked/created successfully.")
        
        # Load the CSV data
        print("Loading CSV data into activity_logs table...")
        rows_loaded = load_csv_to_db(conn)
        print(f"Total rows successfully loaded: {rows_loaded}")
        
        # Seed employee HR status
        seed_employee_hr_status(conn)
        
        # Seed server communications
        print("Generating synthetic server communication logs...")
        generate_server_communications(conn)
        
        # Print summary
        print("\n" + "="*40)
        print("DATABASE SUMMARY")
        print("="*40)
        
        cursor = conn.cursor()
        tables = ['users', 'resources', 'access_violations', 'activity_logs', 'user_baselines', 'risk_events', 'trusted_devices', 'employee_hr_status', 'server_communications']
        
        for table in tables:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
            exists = cursor.fetchone() is not None
            
            if exists:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                print(f"Table '{table}' -> Exists (Row count: {count})")
            else:
                print(f"Table '{table}' -> MISSING")
                
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        conn.close()
    
    print("\nDatabase initialization complete.")

if __name__ == "__main__":
    main()
