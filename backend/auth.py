import os
from datetime import datetime, timedelta
import jwt
import bcrypt
from typing import Optional

# JWT settings
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "super-secret-key-for-local-dev-only")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day

from typing import Tuple, Optional
import hashlib

def verify_password(plain_password: str, hashed_password: str) -> Tuple[bool, bool]:
    """
    Verifies a password against a hash.
    Returns a tuple of (is_valid, needs_rehash).
    """
    try:
        is_valid = bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
        return is_valid, False
    except ValueError:
        # Fallback for plain-text or weakly hashed passwords that aren't valid bcrypt hashes
        
        # Check plain text
        if plain_password == hashed_password:
            return True, True
            
        # Check MD5
        md5_hash = hashlib.md5(plain_password.encode()).hexdigest()
        if md5_hash == hashed_password:
            return True, True
            
        # Check SHA-1
        sha1_hash = hashlib.sha1(plain_password.encode()).hexdigest()
        if sha1_hash == hashed_password:
            return True, True
            
        return False, False

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12)).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
