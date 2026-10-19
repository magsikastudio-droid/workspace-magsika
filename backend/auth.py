import os
import secrets
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError
from fastapi import HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    # Tidak ada fallback hardcoded lagi ("changeme" lama bisa ditebak siapapun
    # yang baca repo publik). Kalau env var belum diset, generate kunci acak
    # sekali per proses — aman, tapi artinya SEMUA token lama invalid tiap
    # restart (user harus login ulang) sampai SECRET_KEY permanen diisi di .env.
    SECRET_KEY = secrets.token_hex(32)
    print("[SECURITY WARNING] SECRET_KEY tidak diset di environment — pakai kunci acak sementara (ganti tiap restart). Set SECRET_KEY permanen di backend/.env di VPS.")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "525600"))  # 1 year

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
