import sqlite3
import pandas as pd
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base

# Define paths relative to this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'data', 'ueba.db')
CSV_PATH = os.path.join(BASE_DIR, 'data', 'activity_logs.csv')
DB_URL = f"sqlite:///{DB_PATH}"

# Create SQLAlchemy engine and session factory
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """
    Returns a SQLAlchemy session.
    Yields the session to be used in FastAPI dependencies.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_connection():
    """
    Returns a raw SQLite connection.
    Maintained for backward compatibility during the ORM transition.
    """
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    # Enable foreign keys for SQLite
    conn.execute("PRAGMA foreign_keys = 1")
    return conn

def create_tables():
    """
    Creates all tables based on SQLAlchemy models.
    """
    Base.metadata.create_all(bind=engine)

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
    cursor.execute("DELETE FROM registered_agents")
    cursor.execute("DELETE FROM sqlite_sequence WHERE name='registered_agents'")
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
    print("Initializing UEBA Database with SQLAlchemy...")
    create_tables()
    print("Tables checked/created successfully using SQLAlchemy.")
    
    # We still use raw connection for seeding to prevent rewriting seed logic immediately
    conn = get_connection()
    try:
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
