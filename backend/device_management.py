import sqlite3
from datetime import datetime
from database import get_connection

def register_trusted_device(user_id, device_id, device_name, added_by):
    """
    Registers a device as trusted for a user.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        now_str = datetime.now().isoformat()
        cursor.execute("""
            INSERT INTO trusted_devices (device_id, user_id, device_name, status, added_by, added_date, notes)
            VALUES (?, ?, ?, 'trusted', ?, ?, 'Registered as trusted device')
            ON CONFLICT(device_id, user_id) DO UPDATE SET
                device_name=excluded.device_name,
                status='trusted',
                added_by=excluded.added_by,
                added_date=excluded.added_date,
                notes=excluded.notes
        """, (device_id, user_id, device_name, added_by, now_str))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error registering trusted device {device_id} for user {user_id}: {e}")
        return False
    finally:
        conn.close()

def check_device_status(user_id, device_id):
    """
    Checks the trust status of a device for a user.
    If the device is not registered, it runs auto-promotion logic first.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT status FROM trusted_devices 
            WHERE user_id = ? AND device_id = ?
        """, (user_id, device_id))
        row = cursor.fetchone()
        
        if row:
            return row[0]
            
        # Device not found at all, check if it qualifies for pending promotion
        conn.close() # Close connection before calling auto_flag_pending_device to avoid locking issues
        auto_flag_pending_device(user_id, device_id)
        
        # Re-check status
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT status FROM trusted_devices 
            WHERE user_id = ? AND device_id = ?
        """, (user_id, device_id))
        row2 = cursor.fetchone()
        if row2:
            return row2[0]
            
        return 'unrecognized'
    except Exception as e:
        print(f"Error checking device status: {e}")
        return 'unrecognized'
    finally:
        try:
            conn.close()
        except:
            pass

def auto_flag_pending_device(user_id, device_id):
    """
    If a device is used 3+ times by the same user without being flagged as high risk (risk_score > 60)
    each time, auto-promote it to 'pending' status.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        # Check current status
        cursor.execute("""
            SELECT status FROM trusted_devices 
            WHERE user_id = ? AND device_id = ?
        """, (user_id, device_id))
        row = cursor.fetchone()
        
        if row and row[0] in ('trusted', 'pending'):
            return False
            
        # Count logs with this device for this user where there is NO associated risk_event with score > 60
        cursor.execute("""
            SELECT COUNT(*) FROM activity_logs a
            LEFT JOIN risk_events r ON a.event_id = r.event_id AND r.risk_score > 60
            WHERE a.user_id = ? AND a.device_id = ? AND r.risk_event_id IS NULL
        """, (user_id, device_id))
        count = cursor.fetchone()[0]
        
        if count >= 3:
            now_str = datetime.now().isoformat()
            cursor.execute("""
                INSERT INTO trusted_devices (device_id, user_id, device_name, status, added_by, added_date, notes)
                VALUES (?, ?, ?, 'pending', 'AUTO_DETECTED', ?, 'Auto-promoted after 3+ low-risk activities')
                ON CONFLICT(device_id, user_id) DO UPDATE SET
                    status='pending',
                    added_by='AUTO_DETECTED',
                    added_date=excluded.added_date,
                    notes=excluded.notes
            """, (device_id, user_id, f"Auto-detected Device {device_id[:4]}", now_str))
            conn.commit()
            return True
            
        return False
    except Exception as e:
        print(f"Error auto flagging pending device: {e}")
        return False
    finally:
        conn.close()
