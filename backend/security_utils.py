import time
import logging

logger = logging.getLogger("ueba_app")

# In-memory stores
# Format: { "ip_address": {"count": int, "window_start": float} }
ip_request_counts = {}

# Format: { "username": {"attempts": int, "locked_until": float} }
user_login_attempts = {}

# Configuration
RATE_LIMIT_MAX_REQUESTS = 10
RATE_LIMIT_WINDOW_SEC = 60
LOCKOUT_MAX_ATTEMPTS = 5
LOCKOUT_DURATION_SEC = 15 * 60  # 15 minutes

def check_ip_rate_limit(ip_address: str) -> bool:
    """Returns True if the IP is within limits, False if rate limited."""
    now = time.time()
    
    if ip_address not in ip_request_counts:
        ip_request_counts[ip_address] = {"count": 1, "window_start": now}
        return True
        
    record = ip_request_counts[ip_address]
    
    # If window has expired, reset it
    if now - record["window_start"] > RATE_LIMIT_WINDOW_SEC:
        record["count"] = 1
        record["window_start"] = now
        return True
        
    # Increment and check limit
    record["count"] += 1
    if record["count"] > RATE_LIMIT_MAX_REQUESTS:
        return False
        
    return True

def record_failed_attempt(username: str):
    """Records a failed attempt and locks the account if threshold is reached."""
    now = time.time()
    username = username.lower()
    
    if username not in user_login_attempts:
        user_login_attempts[username] = {"attempts": 1, "locked_until": 0.0}
    else:
        record = user_login_attempts[username]
        # Only increment if not currently locked
        if record["locked_until"] < now:
            record["attempts"] += 1
            
    # Check if we should lock
    if user_login_attempts[username]["attempts"] >= LOCKOUT_MAX_ATTEMPTS:
        if user_login_attempts[username]["locked_until"] < now:
            user_login_attempts[username]["locked_until"] = now + LOCKOUT_DURATION_SEC
            send_lockout_email(username)

def clear_failed_attempts(username: str):
    """Clears failed attempts upon successful login."""
    username = username.lower()
    if username in user_login_attempts:
        user_login_attempts[username] = {"attempts": 0, "locked_until": 0.0}

def get_progressive_delay(username: str) -> float:
    """Returns the delay in seconds based on failed attempts."""
    username = username.lower()
    if username not in user_login_attempts:
        return 0.0
        
    attempts = user_login_attempts[username]["attempts"]
    if attempts <= 1:
        return 0.0
    elif attempts == 2:
        return 1.0
    elif attempts == 3:
        return 2.5
    elif attempts >= 4:
        return 5.0
    return 0.0

def is_account_locked(username: str) -> bool:
    """Returns True if the account is currently locked."""
    username = username.lower()
    now = time.time()
    if username in user_login_attempts:
        if user_login_attempts[username]["locked_until"] > now:
            return True
        elif user_login_attempts[username]["locked_until"] != 0.0:
            # Lockout expired, reset attempts so they can try again safely
            user_login_attempts[username]["attempts"] = 0
            user_login_attempts[username]["locked_until"] = 0.0
            
    return False

def send_lockout_email(username: str):
    """Simulates sending an email notification with a reset link."""
    # In a real app, this would use SMTP or an email service API.
    # We log it loudly so it can be seen in the demo/dev environment.
    logger.warning(f"*** MOCK EMAIL SENT ***")
    logger.warning(f"To: {username}@organization.local")
    logger.warning(f"Subject: Security Alert: Account Locked Due to Excessive Failed Logins")
    logger.warning(f"Body: Hello {username}, your account has been locked for 15 minutes due to multiple failed login attempts.")
    logger.warning(f"If this was not you, please reset your password immediately: https://insider-dashboard.local/reset-password")
    logger.warning(f"***********************")
