import pandas as pd
import numpy as np
from datetime import datetime
from database import get_connection

def ensure_db_schema():
    """
    Migrates the database schema for existing databases to add missing columns/tables.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        # Check and migrate user_baselines table
        cursor.execute("PRAGMA table_info(user_baselines)")
        columns = [row[1] for row in cursor.fetchall()]
        if 'baseline_window_days' not in columns:
            cursor.execute("ALTER TABLE user_baselines ADD COLUMN baseline_window_days INTEGER DEFAULT 30")
        if 'last_recalculated' not in columns:
            cursor.execute("ALTER TABLE user_baselines ADD COLUMN last_recalculated TEXT")
            
        # Create shift_change_log table
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
        
        # Create trusted_devices table
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
        
        # Create employee_hr_status table
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
        
        # Seed missing users in employee_hr_status relative to user_baselines or activity_logs
        cursor.execute("SELECT DISTINCT user_id FROM user_baselines")
        baseline_users = [row[0] for row in cursor.fetchall()]
        
        cursor.execute("SELECT user_id FROM employee_hr_status")
        hr_users = set(row[0] for row in cursor.fetchall())
        
        missing_users = [u for u in baseline_users if u not in hr_users]
        if missing_users:
            now_str = datetime.now().isoformat()
            missing_records = []
            for uid in missing_users:
                if uid == 'U002':
                    missing_records.append((uid, 'active', 1, '2026-08-01', '2026-08-30', None, now_str))
                elif uid == 'U003':
                    missing_records.append((uid, 'active', 1, '2026-08-10', '2026-08-20', None, now_str))
                elif uid == 'U004':
                    missing_records.append((uid, 'notice_period', 0, None, None, '2026-08-01', now_str))
                elif uid == 'U005':
                    missing_records.append((uid, 'on_leave', 0, None, None, None, now_str))
                else:
                    missing_records.append((uid, 'active', 0, None, None, None, now_str))
            cursor.executemany("""
                INSERT INTO employee_hr_status (user_id, employment_status, travel_declared, travel_start_date, travel_end_date, notice_period_start_date, last_updated)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, missing_records)
            print(f"Schema Check: Seeded default HR status for {len(missing_records)} missing users.")
            
        # Check and migrate risk_events table
        cursor.execute("PRAGMA table_info(risk_events)")
        re_columns = [row[1] for row in cursor.fetchall()]
        if 'status' not in re_columns:
            cursor.execute("ALTER TABLE risk_events ADD COLUMN status TEXT DEFAULT 'new'")
        if 'assigned_to_analyst' not in re_columns:
            cursor.execute("ALTER TABLE risk_events ADD COLUMN assigned_to_analyst TEXT")
        if 'analyst_notes' not in re_columns:
            cursor.execute("ALTER TABLE risk_events ADD COLUMN analyst_notes TEXT")
        if 'resolved_at' not in re_columns:
            cursor.execute("ALTER TABLE risk_events ADD COLUMN resolved_at TEXT")
            
        conn.commit()
    except Exception as e:
        print(f"Error checking/migrating schema: {e}")
    finally:
        conn.close()


def build_user_baselines():
    """
    Builds baseline behavioral profiles for each user based on historical activity logs.
    Excludes anomalies (where is_anomaly = 1) from the baseline calculations.
    Only uses the last 30 days of normal activity logs relative to the maximum log timestamp.
    """
    ensure_db_schema()
    conn = get_connection()
    
    try:
        cursor = conn.cursor()
        
        # Load activity_logs excluding anomalies
        query = "SELECT * FROM activity_logs WHERE is_anomaly = 0"
        df = pd.read_sql_query(query, conn)
        
        if df.empty:
            print("No normal activity logs found to build baselines.")
            return 0
            
        # Filter for the last 30 days relative to the maximum timestamp of normal activity logs
        df['parsed_timestamp'] = pd.to_datetime(df['timestamp'], format='mixed', errors='coerce')
        max_ts = df['parsed_timestamp'].max()
        if pd.notnull(max_ts):
            cutoff_date = max_ts - pd.Timedelta(days=30)
            df = df[df['parsed_timestamp'] >= cutoff_date]
            
        if df.empty:
            print("No activity logs in the last 30 days to build baselines.")
            return 0
            
        baselines = []
        
        # Group by user_id
        for user_id, user_data in df.groupby('user_id'):
            # a. Calculate avg_download_mb
            avg_download_mb = user_data['download_mb'].mean()
            
            # b. Calculate std_download_mb (use 0 if only one event exists)
            if len(user_data) > 1:
                std_download_mb = user_data['download_mb'].std(ddof=1)
            else:
                std_download_mb = 0.0
                
            # c. Calculate usual_login_hour_start and usual_login_hour_end
            # 5th percentile and 95th percentile
            usual_login_hour_start = int(np.percentile(user_data['login_hour'], 5))
            usual_login_hour_end = int(np.percentile(user_data['login_hour'], 95))
            
            # d. Calculate known_locations
            total_events = len(user_data)
            location_counts = user_data['location'].value_counts()
            valid_locations = location_counts[location_counts > 0.05 * total_events].index.tolist()
            known_locations = ",".join(valid_locations)
            
            # e. Calculate known_devices
            device_counts = user_data['device_id'].value_counts()
            valid_devices = device_counts[device_counts > 0.05 * total_events].index.tolist()
            known_devices = ",".join(valid_devices)
            
            # f. Calculate usual_department (most frequent)
            usual_department = user_data['accessed_department'].mode().iloc[0] if not user_data['accessed_department'].mode().empty else ""
            
            # g. Set last_updated
            last_updated = datetime.now().isoformat()
            
            # Register valid baseline devices as trusted
            for dev_id in valid_devices:
                cursor.execute("""
                    INSERT INTO trusted_devices (device_id, user_id, device_name, status, added_by, added_date, notes)
                    VALUES (?, ?, ?, 'trusted', 'AUTO_DETECTED', ?, 'Registered as trusted during baseline computation')
                    ON CONFLICT(device_id, user_id) DO UPDATE SET
                        status='trusted',
                        added_by='AUTO_DETECTED',
                        added_date=excluded.added_date,
                        notes=excluded.notes
                """, (dev_id, user_id, f"Baseline Device {dev_id[:4]}", last_updated))
            
            baselines.append((
                user_id, float(avg_download_mb), float(std_download_mb),
                usual_login_hour_start, usual_login_hour_end,
                known_locations, known_devices, usual_department, last_updated,
                30, last_updated
            ))
            
        # 4. Insert or update (upsert) each user's calculated baseline
        upsert_sql = '''
            INSERT INTO user_baselines (
                user_id, avg_download_mb, std_download_mb, usual_login_hour_start,
                usual_login_hour_end, known_locations, known_devices,
                usual_department, last_updated, baseline_window_days, last_recalculated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                avg_download_mb=excluded.avg_download_mb,
                std_download_mb=excluded.std_download_mb,
                usual_login_hour_start=excluded.usual_login_hour_start,
                usual_login_hour_end=excluded.usual_login_hour_end,
                known_locations=excluded.known_locations,
                known_devices=excluded.known_devices,
                usual_department=excluded.usual_department,
                last_updated=excluded.last_updated,
                baseline_window_days=excluded.baseline_window_days,
                last_recalculated=excluded.last_recalculated
        '''
        
        cursor.executemany(upsert_sql, baselines)
        conn.commit()
        
        return len(baselines)
        
    except Exception as e:
        print(f"Error building baselines: {e}")
        return 0
    finally:
        conn.close()


def detect_sustained_shift(user_id):
    """
    Checks if the user has shown a CONSISTENT new login_hour pattern (outside their current baseline range)
    for 5 or more consecutive days in the last 14 days.
    Returns: (is_shifted, suggested_hour_range)
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        # 1. Fetch user's current baseline login hour range
        cursor.execute("""
            SELECT usual_login_hour_start, usual_login_hour_end 
            FROM user_baselines 
            WHERE user_id = ?
        """, (user_id,))
        baseline = cursor.fetchone()
        if not baseline:
            return False, None
            
        start_hour, end_hour = baseline
        
        # 2. Get the latest timestamp in the entire database to define the 14-day window
        cursor.execute("SELECT MAX(timestamp) FROM activity_logs")
        max_ts_str = cursor.fetchone()[0]
        if not max_ts_str:
            return False, None
            
        max_time = pd.to_datetime(max_ts_str)
        cutoff_time = max_time - pd.Timedelta(days=14)
        
        # 3. Fetch all logs for this user in the last 14 days
        # We include both anomaly and normal logs since new shift behavior starts as anomaly logs
        query = """
            SELECT timestamp, login_hour 
            FROM activity_logs 
            WHERE user_id = ? AND timestamp >= ?
            ORDER BY timestamp ASC
        """
        df_user = pd.read_sql_query(query, conn, params=(user_id, cutoff_time.isoformat()))
        if df_user.empty:
            return False, None
            
        df_user['parsed_time'] = pd.to_datetime(df_user['timestamp'], format='mixed', errors='coerce')
        df_user['date'] = df_user['parsed_time'].dt.date
        
        # Group by date
        daily_logins = {}
        for date, group in df_user.groupby('date'):
            daily_logins[date] = group['login_hour'].tolist()
            
        # Get all calendar dates in the 14-day window
        end_date = max_time.date()
        dates_seq = [end_date - pd.Timedelta(days=d) for d in range(14)]
        dates_seq.reverse()  # Chronological order
        
        # We want to find a consecutive subsegment of 5 or more days where:
        # - The user is active on each day
        # - All login hours on that day are outside [start_hour, end_hour]
        day_status = []
        for dt in dates_seq:
            if dt in daily_logins:
                hours = daily_logins[dt]
                # Check if all hours on this day are outside the baseline range
                outside = all(not (start_hour <= h <= end_hour) for h in hours)
                day_status.append((dt, outside, hours))
            else:
                day_status.append((dt, False, []))
                
        # Find the longest consecutive run of True status
        longest_run = []
        current_run = []
        for dt, outside, hours in day_status:
            if outside:
                current_run.append((dt, hours))
            else:
                if len(current_run) >= 5:
                    # Check consistency: max-min login hour spread across the run is <= 6 hours
                    all_run_hours = [h for day_info in current_run for h in day_info[1]]
                    if max(all_run_hours) - min(all_run_hours) <= 6:
                        if len(current_run) > len(longest_run):
                            longest_run = current_run
                current_run = []
        # Check last run if sequence ends on a True
        if len(current_run) >= 5:
            all_run_hours = [h for day_info in current_run for h in day_info[1]]
            if max(all_run_hours) - min(all_run_hours) <= 6:
                if len(current_run) > len(longest_run):
                    longest_run = current_run
                    
        if len(longest_run) >= 5:
            all_run_hours = [h for day_info in longest_run for h in day_info[1]]
            new_start = min(all_run_hours)
            new_end = max(all_run_hours)
            return True, (new_start, new_end)
            
        return False, None
    except Exception as e:
        print(f"Error detecting sustained shift for user {user_id}: {e}")
        return False, None
    finally:
        conn.close()


def auto_adjust_baseline_for_shift(user_id, new_range=None):
    """
    If detect_sustained_shift() returns True, updates that user's usual_login_hour_start
    and usual_login_hour_end in user_baselines to match their new consistent pattern,
    and logs this change to shift_change_log.
    """
    if new_range is None:
        shifted, new_range = detect_sustained_shift(user_id)
        if not shifted:
            return False
            
    new_start, new_end = new_range
    conn = get_connection()
    try:
        cursor = conn.cursor()
        # Get old values
        cursor.execute("""
            SELECT usual_login_hour_start, usual_login_hour_end 
            FROM user_baselines 
            WHERE user_id = ?
        """, (user_id,))
        old_val = cursor.fetchone()
        if not old_val:
            return False
            
        old_start, old_end = old_val
        
        # Avoid duplicate logs if the baseline is already adjusted
        if old_start == new_start and old_end == new_end:
            return False
            
        # Update user_baselines
        now_str = datetime.now().isoformat()
        cursor.execute("""
            UPDATE user_baselines 
            SET usual_login_hour_start = ?, usual_login_hour_end = ?, 
                last_updated = ?, last_recalculated = ? 
            WHERE user_id = ?
        """, (new_start, new_end, now_str, now_str, user_id))
        
        # Log this change to shift_change_log
        cursor.execute("""
            INSERT INTO shift_change_log (
                user_id, old_hour_start, old_hour_end, new_hour_start, new_hour_end, detected_date, reason
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id, old_start, old_end, new_start, new_end, 
            datetime.now().strftime("%Y-%m-%d"), 
            "Sustained login hour shift detected over consecutive days"
        ))
        
        conn.commit()
        return True
    except Exception as e:
        print(f"Error adjusting baseline for user {user_id}: {e}")
        return False
    finally:
        conn.close()


def recalculate_all_baselines():
    """
    Recalculates baselines for all users and checks for sustained behavioral shifts.
    Designed to run periodically (e.g. daily).
    """
    ensure_db_schema()
    
    # 1. Re-run baseline calculations for all active users
    num_updated = build_user_baselines()
    
    # 2. Check for sustained shifts for all users in the user_baselines database
    conn = get_connection()
    adjusted_users = []
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT user_id FROM user_baselines")
        users = [row[0] for row in cursor.fetchall()]
        
        for user_id in users:
            shifted, new_range = detect_sustained_shift(user_id)
            if shifted:
                # Attempt to auto-adjust baseline
                success = auto_adjust_baseline_for_shift(user_id, new_range)
                if success:
                    adjusted_users.append((user_id, new_range))
    except Exception as e:
        print(f"Error during baseline recalculation check: {e}")
    finally:
        conn.close()
        
    # Print summary
    print("\n" + "=" * 50)
    print("RECALCULATE ALL BASELINES SUMMARY")
    print("=" * 50)
    print(f"Users with baselines calculated/updated: {num_updated}")
    print(f"Users with auto-detected & adjusted shift changes: {len(adjusted_users)}")
    if adjusted_users:
        print("\nShift Change Adjustments:")
        for user_id, new_range in adjusted_users:
            print(f"- User {user_id}: New Hour Range -> {new_range[0]} - {new_range[1]}")
    print("=" * 50 + "\n")
    
    return num_updated, adjusted_users


def print_baseline_summary():
    """
    Prints a readable table showing all users' baselines for manual sanity-check.
    """
    conn = get_connection()
    try:
        query = "SELECT user_id, avg_download_mb, usual_login_hour_start, usual_login_hour_end, known_locations, known_devices, usual_department FROM user_baselines"
        df = pd.read_sql_query(query, conn)
        
        if df.empty:
            print("No baselines found.")
            return
            
        print("\nUser Baselines Summary:")
        print("-" * 80)
        
        # Formatting for a readable table
        df['login_hour_range'] = df['usual_login_hour_start'].astype(str) + " - " + df['usual_login_hour_end'].astype(str)
        
        # Select columns to display
        display_df = df[['user_id', 'avg_download_mb', 'login_hour_range', 'known_locations', 'known_devices', 'usual_department']].copy()
        display_df['avg_download_mb'] = display_df['avg_download_mb'].round(2)
        
        # Using string conversion instead of to_markdown which requires tabulate package
        print(display_df.to_string(index=False))
        
    except Exception as e:
        print(f"Error printing baseline summary: {e}")
    finally:
        conn.close()


def detect_gradual_drift(conn):
    """
    Compares each user's 7-day rolling average download_mb against their 30-day baseline average.
    If the 7-day average is more than 40% higher for 5+ consecutive days without any single day
    triggering the normal spike threshold (> 3x baseline), it returns a list of risk events to insert.
    """
    import pandas as pd
    drift_events = []
    
    try:
        # Get baselines
        df_base = pd.read_sql_query("SELECT user_id, avg_download_mb FROM user_baselines", conn)
        if df_base.empty:
            return []
            
        baselines = df_base.set_index('user_id')['avg_download_mb'].to_dict()
        
        for user_id, baseline_avg in baselines.items():
            if baseline_avg <= 0:
                continue
                
            # Fetch logs for this user
            df_user = pd.read_sql_query("""
                SELECT event_id, timestamp, download_mb FROM activity_logs 
                WHERE user_id = ? 
                ORDER BY timestamp ASC
            """, conn, params=(user_id,))
            
            if df_user.empty or len(df_user) < 5:
                continue
                
            df_user['parsed_time'] = pd.to_datetime(df_user['timestamp'], format='mixed', errors='coerce')
            df_user = df_user.dropna(subset=['parsed_time'])
            df_user['date'] = df_user['parsed_time'].dt.date
            
            # Group by date to get daily records
            daily_groups = df_user.groupby('date')
            unique_dates = sorted(list(daily_groups.groups.keys()))
            
            matching_dates = []
            for current_date in unique_dates:
                # 7-day window: [current_date - 6 days, current_date]
                start_window = current_date - pd.Timedelta(days=6)
                window_events = df_user[(df_user['date'] >= start_window) & (df_user['date'] <= current_date)]
                
                if window_events.empty:
                    continue
                    
                rolling_7d_avg = window_events['download_mb'].mean()
                
                # Check if rolling average is > 1.4 * baseline_avg
                is_above_40 = rolling_7d_avg > 1.4 * baseline_avg
                
                # Check if any event on current_date has download_mb > 3.0 * baseline_avg
                day_events = daily_groups.get_group(current_date)
                has_spike = any(day_events['download_mb'] > 3.0 * baseline_avg)
                
                if is_above_40 and not has_spike:
                    matching_dates.append(current_date)
                    
            # Find consecutive runs of 5+ days
            consecutive_runs = []
            current_run = []
            for d in matching_dates:
                if not current_run:
                    current_run.append(d)
                else:
                    if (d - current_run[-1]).days == 1:
                        current_run.append(d)
                    else:
                        if len(current_run) >= 5:
                            consecutive_runs.append(current_run)
                        current_run = [d]
            if len(current_run) >= 5:
                consecutive_runs.append(current_run)
                
            # For each run of 5+ days, create an alert associated with the last event of the last day
            for run in consecutive_runs:
                last_day = run[-1]
                last_day_events = daily_groups.get_group(last_day)
                last_event = last_day_events.iloc[-1]
                
                drift_events.append((
                    int(last_event['event_id']),
                    user_id,
                    45, # lower severity score
                    "gradual_usage_increase",
                    str(last_event['timestamp']),
                    0 # False/reviewed
                ))
                
    except Exception as e:
        print(f"Error detecting gradual drift: {e}")
        
    return drift_events


if __name__ == "__main__":
    print("Recalculating all user baselines (including shift detection)...")
    recalculate_all_baselines()
    print_baseline_summary()
