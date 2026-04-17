import bcrypt
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from app.core.config import settings
from cryptography.fernet import Fernet

def get_fernet():
    if not settings.FERNET_KEY:
        return None
    return Fernet(settings.FERNET_KEY.encode())

def encrypt_token(token: str) -> str:
    if not token: return ""
    f = get_fernet()
    if not f: return token # Fallback if key missing (though shouldn't happen)
    return f.encrypt(token.encode()).decode()

def decrypt_token(encrypted_token: str) -> str:
    if not encrypted_token: return ""
    f = get_fernet()
    if not f: return encrypted_token
    try:
        return f.decrypt(encrypted_token.encode()).decode()
    except Exception:
        return encrypted_token # Fallback if decryption fails (e.g. was stored plain)

def verify_password(plain_password: str, hashed_password: str):
    return bcrypt.checkpw(
        plain_password.encode('utf-8'), 
        hashed_password.encode('utf-8')
    )

def get_password_hash(password: str):
    # Hash a password for the first time
    # (bcrypt handles the salt automatically)
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str):
    try:
        decoded_token = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return decoded_token if decoded_token["exp"] >= datetime.now(timezone.utc).timestamp() else None
    except JWTError:
        return None
