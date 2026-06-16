import os
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

try:
    import certifi
except ImportError:
    certifi = None
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.encoders import ENCODERS_BY_TYPE
from fastapi.middleware.cors import CORSMiddleware

# Biar ObjectId MongoDB bisa di-serialize ke JSON tanpa error
ENCODERS_BY_TYPE[ObjectId] = str
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field

try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
    SCHEDULER_AVAILABLE = True
except ImportError:
    SCHEDULER_AVAILABLE = False

import urllib.request as _urllib_request
import json as _json

from auth import create_access_token, decode_token, oauth2_scheme

load_dotenv()

# ─── Firebase Admin SDK ───────────────────────────────────────────────────────
try:
    import firebase_admin
    from firebase_admin import credentials as fb_credentials, messaging as fb_messaging
    _sa_path = os.path.join(os.path.dirname(__file__), "firebase-service-account.json")
    if os.path.exists(_sa_path) and not firebase_admin._apps:
        _cred = fb_credentials.Certificate(_sa_path)
        firebase_admin.initialize_app(_cred)
    FCM_AVAILABLE = bool(firebase_admin._apps)
    print(f"[FCM] Firebase admin initialized: {FCM_AVAILABLE}")
except Exception as _e:
    FCM_AVAILABLE = False
    print(f"[FCM] Firebase admin not available: {_e}")



BACKEND_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

def _call_ai(prompt: str, max_tokens: int = 800) -> str:
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY tidak disetel di server")
    url = "https://api.anthropic.com/v1/messages"
    body = _json.dumps({
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }).encode("utf-8")
    req = _urllib_request.Request(url, data=body, headers={
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
    }, method="POST")
    try:
        with _urllib_request.urlopen(req, timeout=30) as resp:
            data = _json.loads(resp.read().decode("utf-8"))
    except _urllib_request.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Claude API {e.code}: {err_body[:300]}")
    return data["content"][0]["text"]
MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "admin_dashboard")
SECRET_KEY = os.getenv("SECRET_KEY", "changeme")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "43200"))

client_kwargs = {
    "serverSelectionTimeoutMS": 15000,
    "connectTimeoutMS": 15000,
    "socketTimeoutMS": 30000,
}
if MONGO_URI.startswith("mongodb+"):
    if certifi is not None:
        client_kwargs["tlsCAFile"] = certifi.where()
    else:
        client_kwargs["tlsAllowInvalidCertificates"] = True

client = AsyncIOMotorClient(MONGO_URI, **client_kwargs)
db = client[DB_NAME]

mock_orders = [
    {"id": "ord-001", "client": "PT Magsika", "project": "Website Landing Page", "status": "Done", "total": 12500, "deadline": "2025-06-22", "created_at": "2025-06-10", "artists": ["Alice"], "platform": "Fiverr Magsika", "market": "Magsika", "order_id": "FVR-8821", "work_type": "Modeling", "payment_status": "Lunas", "folder_code": "250610-MGSK01-ALIC-MDL", "marketer": "Ivo", "notes": ""},
    {"id": "ord-002", "client": "Eirene Studio", "project": "Brand Identity", "status": "Modeling", "total": 8200, "deadline": "2025-06-27", "created_at": "2025-06-12", "artists": ["Bob"], "platform": "Fiverr Eirene", "market": "Eirene", "order_id": "FVR-8822", "work_type": "Modeling", "payment_status": "DP", "folder_code": "250612-EIRE01-BOB-MDL", "marketer": "Novita", "notes": ""},
    {"id": "ord-003", "client": "Lolicharm", "project": "Product Catalog", "status": "Teksturing", "total": 9400, "deadline": "2025-07-02", "created_at": "2025-06-15", "artists": ["Charlie"], "platform": "Etsy Lolicharm", "market": "Lolicharm", "order_id": "ETY-0023", "work_type": "Print", "payment_status": "Belum Lunas", "folder_code": "250615-LOLI01-CHAR-PRT", "marketer": "Ivo", "notes": ""},
    {"id": "ord-004", "client": "Direct Client", "project": "Campaign Assets", "status": "Done", "total": 7200, "deadline": "2025-06-18", "created_at": "2025-06-07", "artists": ["Dana"], "platform": "Direct", "market": "Magsika", "order_id": "DIR-0041", "work_type": "Animation", "payment_status": "Lunas", "folder_code": "250607-MGSK01-DANA-ANM", "marketer": "Ivo", "notes": ""},
    {"id": "ord-005", "client": "Komunitas LTK", "project": "Social Media Kit", "status": "Pending", "total": 4800, "deadline": "2025-07-10", "created_at": "2025-06-20", "artists": ["Alice"], "platform": "Komunitas", "market": "Magsika", "order_id": "KOM-0012", "work_type": "Vroid", "payment_status": "Belum Lunas", "folder_code": "250620-MGSK01-ALIC-VRD", "marketer": "Novita", "notes": ""},
    {"id": "ord-006", "client": "Studio Magsika", "project": "Ecommerce Design", "status": "Rigging", "total": 15000, "deadline": "2025-06-30", "created_at": "2025-06-18", "artists": ["Bob"], "platform": "Fiverr Magsika", "market": "Magsika", "order_id": "FVR-8826", "work_type": "Rigging", "payment_status": "DP", "folder_code": "250618-MGSK01-BOB-RIG", "marketer": "Ivo", "notes": ""},
]

DEFAULT_USER = {
    "username": "admin",
    "full_name": "Studio Admin",
    "email": "admin@magsika.local",
    "role": "admin",
    "status": "active",
}

pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def format_order(record: dict) -> dict:
    return {
        "id": str(record.get("_id")) if record.get("_id") else record.get("id"),
        "project": record.get("project", "Untitled"),
        "client": record.get("client", "Unknown"),
        "status": record.get("status", "Pending"),
        "total": record.get("total", 0),
        "deadline": record.get("deadline"),
        "artists": record.get("artists", []),
        "artist_contributions": record.get("artist_contributions", []),
        "platform": record.get("platform", "Direct"),
        "market": record.get("market", "Magsika"),
        "order_id": record.get("order_id", ""),
        "work_type": record.get("work_type", "Modeling"),
        "payment_status": record.get("payment_status", "Belum Lunas"),
        "folder_code": record.get("folder_code", ""),
        "marketer": record.get("marketer", ""),
        "notes": record.get("notes", ""),
        "fee_freelance": record.get("fee_freelance", 0),
        "order_date": record.get("order_date", record.get("created_at", "")[:10] if record.get("created_at") else ""),
        "created_at": record.get("created_at"),
        "completed_at": record.get("completed_at"),
        "revision_count": record.get("revision_count", 0),
    }


def format_chat_entry(record: dict) -> dict:
    return {
        "id": str(record.get("_id")) if record.get("_id") else record.get("id"),
        "date": record.get("date", ""),
        "tipe": record.get("tipe", "New Client"),
        "username": record.get("username", ""),
        "estimasi": record.get("estimasi"),
        "budget": record.get("budget"),
        "agreed": record.get("agreed"),
        "real": record.get("real"),
        "status": record.get("status", "Discussing"),
        "akun": record.get("akun", "Magsika"),
        "catatan": record.get("catatan", ""),
    }


def format_freelance_artist(record: dict) -> dict:
    return {
        "id": str(record.get("_id")) if record.get("_id") else record.get("id"),
        "name": record.get("name", ""),
        "bank": record.get("bank", ""),
        "rekening": record.get("rekening", ""),
        "phone": record.get("phone", ""),
        "notes": record.get("notes", ""),
    }


def format_freelance_project(record: dict) -> dict:
    return {
        "id": str(record.get("_id")) if record.get("_id") else record.get("id"),
        "artist_id": record.get("artist_id", ""),
        "project_name": record.get("project_name", ""),
        "order_id": record.get("order_id", ""),
        "fee": record.get("fee", 0),
        "dp_amount": record.get("dp_amount"),
        "dp_date": record.get("dp_date"),
        "pelunasan_date": record.get("pelunasan_date"),
        "status_bayar": record.get("status_bayar", "Belum Lunas"),
        "notes": record.get("notes", ""),
    }


def to_object_id(value: str):
    try:
        return ObjectId(value)
    except Exception:
        return value


def format_task(record: dict) -> dict:
    return {
        "id": str(record.get("_id")) if record.get("_id") else record.get("id"),
        "title": record.get("title", "Untitled Task"),
        "assignee": record.get("assignee", "Unassigned"),
        "assignee_type": record.get("assignee_type", "tim"),
        "status": record.get("status", "pending"),
        "date": record.get("date"),
        "notes": record.get("notes", ""),
        "order_id": record.get("order_id"),
        "time_elapsed": record.get("time_elapsed", 0),
        "timer_started": record.get("timer_started"),
        "order_num": record.get("order_num", 999),
    }


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    username: str
    full_name: str
    email: EmailStr
    role: str
    status: str


class ArtistContribution(BaseModel):
    name: str
    type: str = "Tim"
    percent: int = 100


class OrderCreate(BaseModel):
    project: str
    client: str
    total: float
    status: str = Field(default="Pending")
    deadline: Optional[str] = None
    order_date: Optional[str] = None
    artists: Optional[List[str]] = []
    artist_contributions: Optional[List[ArtistContribution]] = []
    platform: Optional[str] = None
    market: Optional[str] = None
    order_id: Optional[str] = None
    work_type: Optional[str] = None
    payment_status: Optional[str] = Field(default="Belum Lunas")
    folder_code: Optional[str] = None
    marketer: Optional[str] = None
    notes: Optional[str] = None
    fee_freelance: Optional[float] = 0
    revision_count: Optional[int] = 0
    completed_at: Optional[str] = None


class OrderUpdate(BaseModel):
    project: Optional[str] = None
    client: Optional[str] = None
    total: Optional[float] = None
    status: Optional[str] = None
    deadline: Optional[str] = None
    order_date: Optional[str] = None
    artists: Optional[List[str]] = None
    artist_contributions: Optional[List[Dict[str, Any]]] = None
    platform: Optional[str] = None
    market: Optional[str] = None
    order_id: Optional[str] = None
    work_type: Optional[str] = None
    payment_status: Optional[str] = None
    folder_code: Optional[str] = None
    marketer: Optional[str] = None
    notes: Optional[str] = None
    fee_freelance: Optional[float] = None
    revision_count: Optional[int] = None
    completed_at: Optional[str] = None


class ChatEntryCreate(BaseModel):
    date: str
    tipe: str = "New Client"
    username: str = ""
    estimasi: Optional[float] = None
    budget: Optional[float] = None
    agreed: Optional[float] = None
    real: Optional[float] = None
    status: str = "Discussing"
    akun: str = "Magsika"
    catatan: Optional[str] = None


class ChatEntryUpdate(BaseModel):
    date: Optional[str] = None
    tipe: Optional[str] = None
    username: Optional[str] = None
    estimasi: Optional[float] = None
    budget: Optional[float] = None
    agreed: Optional[float] = None
    real: Optional[float] = None
    status: Optional[str] = None
    akun: Optional[str] = None
    catatan: Optional[str] = None


class FreelanceArtistCreate(BaseModel):
    name: str
    bank: Optional[str] = None
    rekening: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


class FreelanceArtistUpdate(BaseModel):
    name: Optional[str] = None
    bank: Optional[str] = None
    rekening: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


class FreelanceProjectCreate(BaseModel):
    artist_id: str
    project_name: str
    order_id: Optional[str] = None
    fee: float = 0
    dp_amount: Optional[float] = None
    dp_date: Optional[str] = None
    pelunasan_date: Optional[str] = None
    status_bayar: str = Field(default="Belum Lunas")
    notes: Optional[str] = None


class FreelanceProjectUpdate(BaseModel):
    project_name: Optional[str] = None
    fee: Optional[float] = None
    dp_amount: Optional[float] = None
    dp_date: Optional[str] = None
    pelunasan_date: Optional[str] = None
    status_bayar: Optional[str] = None
    notes: Optional[str] = None
    order_id: Optional[str] = None


class TaskBase(BaseModel):
    title: str
    assignee: str = "Unassigned"
    assignee_type: str = Field(default="tim")
    status: str = Field(default="pending")
    date: Optional[str] = None
    notes: Optional[str] = None
    order_id: Optional[str] = None
    time_elapsed: int = 0
    timer_started: Optional[str] = None
    order_num: Optional[int] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    assignee: Optional[str] = None
    assignee_type: Optional[str] = None
    status: Optional[str] = None
    date: Optional[str] = None
    notes: Optional[str] = None
    time_elapsed: Optional[int] = None
    timer_started: Optional[str] = None
    order_num: Optional[int] = None


app = FastAPI(title="Admin Dashboard API")


class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, message: dict):
        import json
        data = json.dumps(message)
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()

app.add_middleware(
    CORSMiddleware,
    allow_origins=BACKEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

scheduler = AsyncIOScheduler() if SCHEDULER_AVAILABLE else None


async def auto_fail_tasks():
    """Jam 23:59 WIB — task pending/in-progress otomatis jadi failed, hentikan timer."""
    from datetime import timedelta
    jkt_now = datetime.now(timezone.utc) + timedelta(hours=7)
    today = jkt_now.strftime("%Y-%m-%d")
    try:
        # Task hari ini yang belum selesai → gagal
        await db.tasks.update_many(
            {"date": today, "status": {"$in": ["pending", "in progress"]}},
            {"$set": {"status": "failed", "timer_started": None}},
        )
        # Task dari hari-hari sebelumnya yang masih pending (belum pernah dimulai) → gagal
        await db.tasks.update_many(
            {"date": {"$lt": today}, "status": "pending"},
            {"$set": {"status": "failed"}},
        )
    except Exception as e:
        print(f"[auto_fail] Error: {e}")


async def carry_forward_tasks():
    """Jam 00:01 WIB — task pending/in progress/in_revision/gagal kemarin dibawa ke hari ini."""
    from datetime import datetime, timezone, timedelta
    jkt_now = datetime.now(timezone.utc) + timedelta(hours=7)
    today_wday = jkt_now.weekday()  # 0=Senin ... 6=Minggu
    if today_wday in (5, 6):
        return
    today_str = jkt_now.strftime("%Y-%m-%d")
    yesterday = (jkt_now - timedelta(days=1)).strftime("%Y-%m-%d")
    carry_statuses = ["failed", "pending", "in progress", "in_revision"]
    try:
        carry_tasks = await db.tasks.find({"date": yesterday, "status": {"$in": carry_statuses}}).to_list(500)
        created = 0
        for t in carry_tasks:
            order_id_str = str(t.get("order_id", ""))
            assignee = t.get("assignee", "")
            existing = await db.tasks.find_one({
                "date": today_str, "assignee": assignee,
                "order_id": t.get("order_id"),
            })
            if existing:
                continue
            count = await db.tasks.count_documents({"assignee": assignee, "date": today_str})
            await db.tasks.insert_one({
                "title": t.get("title", ""),
                "assignee": assignee,
                "assignee_type": t.get("assignee_type", "tim"),
                "status": "pending",
                "date": today_str,
                "notes": t.get("notes", ""),
                "order_id": order_id_str or None,
                "time_elapsed": 0,
                "timer_started": None,
                "order_num": count,
            })
            created += 1
        print(f"[carry_forward] {created} task dibawa ke {today_str}")
    except Exception as e:
        print(f"[carry_forward] Error: {e}")


async def auto_generate_daily_tasks(target_date: Optional[str] = None) -> dict:
    from datetime import timedelta
    jkt_now = datetime.now(timezone.utc) + timedelta(hours=7)
    today = target_date or jkt_now.strftime("%Y-%m-%d")
    created = 0
    skipped = 0
    try:
        orders = await db.orders.find().to_list(500)
    except Exception as e:
        return {"created": 0, "skipped": 0, "error": str(e)}
    orders.sort(key=lambda o: (o.get("deadline") is None, o.get("deadline") or ""))
    for order in orders:
        st = order.get("status", "")
        if st.lower() in ["done", "cancel"]:
            continue
        contributions = order.get("artist_contributions", [])
        if not contributions:
            contributions = [{"name": a, "type": "Tim", "percent": 100} for a in order.get("artists", []) if a]
        if not contributions:
            continue
        order_id_str = str(order.get("_id", order.get("id", "")))
        for contrib in contributions:
            artist_name = contrib.get("name", "").strip()
            if not artist_name:
                continue
            count = await db.tasks.count_documents({"assignee": artist_name, "date": today})
            result = await db.tasks.update_one(
                {"order_id": order_id_str, "assignee": artist_name, "date": today},
                {"$setOnInsert": {
                    "title": f"{order.get('project', '')} — {artist_name}",
                    "assignee": artist_name,
                    "assignee_type": "freelance" if contrib.get("type") == "Freelance" else "tim",
                    "status": "pending",
                    "date": today,
                    "notes": order.get("folder_code", ""),
                    "order_id": order_id_str,
                    "time_elapsed": 0,
                    "timer_started": None,
                    "order_num": count,
                }},
                upsert=True,
            )
            if result.upserted_id:
                created += 1
            else:
                skipped += 1
    return {"created": created, "skipped": skipped}


@app.on_event("startup")
async def on_startup():
    if scheduler:
        scheduler.add_job(auto_generate_daily_tasks, CronTrigger(hour=0, minute=0, timezone="Asia/Jakarta"))
        scheduler.add_job(auto_fail_tasks, CronTrigger(hour=23, minute=59, timezone="Asia/Jakarta"))
        scheduler.add_job(carry_forward_tasks, CronTrigger(hour=0, minute=1, timezone="Asia/Jakarta"))
        scheduler.add_job(auto_daily_ai_reports, CronTrigger(hour=17, minute=0, timezone="Asia/Jakarta"))
        # Load deadline from DB (default 16:30)
        _deadline = {"hour": 16, "minute": 30}
        try:
            _doc = await db.settings.find_one({"key": "daily_report_deadline"})
            if _doc:
                _deadline = {"hour": _doc.get("hour", 16), "minute": _doc.get("minute", 30)}
        except Exception:
            pass
        scheduler.add_job(notify_unsubmitted_daily_reports, CronTrigger(hour=_deadline["hour"], minute=_deadline["minute"], timezone="Asia/Jakarta"), id="notify_daily_report")
        scheduler.add_job(auto_weekly_ai_reports, CronTrigger(day_of_week="fri", hour=12, minute=0, timezone="Asia/Jakarta"))
        scheduler.add_job(auto_monthly_ai_reports, CronTrigger(day=27, hour=12, minute=0, timezone="Asia/Jakarta"))
        scheduler.start()


@app.on_event("shutdown")
async def on_shutdown():
    if scheduler:
        scheduler.shutdown(wait=False)


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket, token: str = Query(None)):
    if not token:
        await websocket.close(code=4001)
        return
    try:
        payload = decode_token(token)
        if not payload.get("sub"):
            await websocket.close(code=4001)
            return
    except Exception:
        await websocket.close(code=4001)
        return
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


def verify_default_admin(username: str, password: str) -> Optional[dict]:
    if username == "admin" and password == "password":
        return {
            "username": "admin",
            "full_name": "Studio Admin",
            "email": "admin@magsika.local",
            "role": "admin",
            "status": "active",
            "hashed_password": hash_password("password"),
        }
    return None


async def authenticate_user(username: str, password: str) -> Optional[dict]:
    # Default admin always works regardless of DB state
    default_user = verify_default_admin(username, password)
    if default_user:
        return default_user

    try:
        user = await db.users.find_one({"username": username})
        if user and verify_password(password, user.get("hashed_password", "")):
            return user
    except Exception:
        pass

    return None


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    payload = decode_token(token)
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    # Fast path: default admin never touches the database
    if username == "admin":
        return {"username": DEFAULT_USER["username"], "full_name": DEFAULT_USER["full_name"], "email": DEFAULT_USER["email"], "role": DEFAULT_USER["role"], "status": DEFAULT_USER["status"]}
    try:
        user = await db.users.find_one({"username": username})
    except Exception:
        user = None
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    raw_role = user.get("role", "talent")
    is_superadmin = raw_role == "superadmin"
    return {"username": user["username"], "full_name": user["full_name"], "email": user["email"], "role": "admin" if is_superadmin else raw_role, "is_superadmin": is_superadmin, "status": user.get("status", "active")}


@app.post("/auth/login")
async def login(req: LoginRequest):
    from datetime import timedelta
    user = await authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Username atau password salah")
    if user.get("status") == "pending":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Akun menunggu persetujuan admin")
    token = create_access_token({"sub": user["username"]}, expires_delta=timedelta(days=365))
    return {"access_token": token, "token_type": "bearer", "user": {"username": user["username"], "full_name": user["full_name"], "email": user["email"], "role": user.get("role", "talent"), "status": user.get("status", "active")}}


@app.get("/auth/me")
async def auth_me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}


@app.get("/orders")
async def list_orders(current_user: dict = Depends(get_current_user)):
    try:
        records = await db.orders.find().to_list(200)
        return {"orders": [format_order(record) for record in records]}
    except Exception:
        return {"orders": mock_orders}


@app.post("/orders")
async def create_order(order: OrderCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "pm"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    payload = order.dict()
    payload["created_at"] = datetime.now(timezone.utc).isoformat()
    try:
        result = await db.orders.insert_one(payload)
        result_order = format_order({**payload, "_id": result.inserted_id})
    except Exception:
        result_order = format_order({**payload, "id": f"mock-{len(mock_orders) + 1}"})
    await manager.broadcast({"type": "orders_updated"})
    return {"order": result_order}


@app.get("/orders/{order_id}")
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    object_id = to_object_id(order_id)
    try:
        record = await db.orders.find_one({"_id": object_id})
    except Exception:
        record = None
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return {"order": format_order(record)}


@app.patch("/orders/{order_id}")
async def update_order(order_id: str, order: OrderUpdate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "pm"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    payload = {k: v for k, v in order.dict(exclude_unset=True).items()}
    if not payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")
    if payload.get("status") == "Done" and not payload.get("completed_at"):
        payload["completed_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    object_id = to_object_id(order_id)
    try:
        await db.orders.update_one({"_id": object_id}, {"$set": payload})
        updated = await db.orders.find_one({"_id": object_id})
    except Exception:
        updated = None
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    await manager.broadcast({"type": "orders_updated"})
    return {"order": format_order(updated)}


@app.delete("/orders/{order_id}")
async def delete_order(order_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "pm"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    object_id = to_object_id(order_id)
    try:
        result = await db.orders.delete_one({"_id": object_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete order")
    await manager.broadcast({"type": "orders_updated"})
    return {"deleted": True}


@app.get("/freelance/artists")
async def list_freelance_artists(current_user: dict = Depends(get_current_user)):
    try:
        records = await db.freelance_artists.find().to_list(100)
        return {"artists": [format_freelance_artist(r) for r in records]}
    except Exception:
        return {"artists": []}


@app.post("/freelance/artists")
async def create_freelance_artist(artist: FreelanceArtistCreate, current_user: dict = Depends(get_current_user)):
    payload = artist.dict()
    try:
        result = await db.freelance_artists.insert_one(payload)
        return {"artist": format_freelance_artist({**payload, "_id": result.inserted_id})}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/freelance/artists/{artist_id}")
async def update_freelance_artist(artist_id: str, artist: FreelanceArtistUpdate, current_user: dict = Depends(get_current_user)):
    payload = {k: v for k, v in artist.dict().items() if v is not None}
    object_id = to_object_id(artist_id)
    try:
        await db.freelance_artists.update_one({"_id": object_id}, {"$set": payload})
        updated = await db.freelance_artists.find_one({"_id": object_id})
        return {"artist": format_freelance_artist(updated)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/freelance/artists/{artist_id}")
async def delete_freelance_artist(artist_id: str, current_user: dict = Depends(get_current_user)):
    object_id = to_object_id(artist_id)
    try:
        await db.freelance_artists.delete_one({"_id": object_id})
        await db.freelance_projects.delete_many({"artist_id": artist_id})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"deleted": True}


@app.get("/freelance/projects")
async def list_freelance_projects(artist_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    try:
        query = {"artist_id": artist_id} if artist_id else {}
        records = await db.freelance_projects.find(query).to_list(200)
        return {"projects": [format_freelance_project(r) for r in records]}
    except Exception:
        return {"projects": []}


@app.post("/freelance/projects")
async def create_freelance_project(project: FreelanceProjectCreate, current_user: dict = Depends(get_current_user)):
    payload = project.dict()
    payload["created_at"] = datetime.now(timezone.utc).isoformat()
    try:
        result = await db.freelance_projects.insert_one(payload)
        return {"project": format_freelance_project({**payload, "_id": result.inserted_id})}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/freelance/projects/{project_id}")
async def update_freelance_project(project_id: str, project: FreelanceProjectUpdate, current_user: dict = Depends(get_current_user)):
    payload = {k: v for k, v in project.dict().items() if v is not None}
    object_id = to_object_id(project_id)
    try:
        await db.freelance_projects.update_one({"_id": object_id}, {"$set": payload})
        updated = await db.freelance_projects.find_one({"_id": object_id})
        return {"project": format_freelance_project(updated)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/freelance/projects/{project_id}")
async def delete_freelance_project(project_id: str, current_user: dict = Depends(get_current_user)):
    object_id = to_object_id(project_id)
    try:
        await db.freelance_projects.delete_one({"_id": object_id})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"deleted": True}


@app.get("/tasks")
async def list_tasks(date: Optional[str] = None, month: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    try:
        query = {}
        if date:
            query["date"] = date
        elif month:
            query["date"] = {"$regex": f"^{month}"}
        records = await db.tasks.find(query).to_list(2000)
        return {"tasks": [format_task(record) for record in records]}
    except Exception:
        return {"tasks": []}


@app.post("/tasks")
async def create_task(task: TaskCreate, current_user: dict = Depends(get_current_user)):
    payload = task.dict()
    try:
        result = await db.tasks.insert_one(payload)
        result_task = format_task({**payload, "_id": result.inserted_id})
    except Exception:
        result_task = {**payload, "id": f"task-mock-{datetime.now(timezone.utc).timestamp()}"}
    # Auto-sync assignee into order.artists
    oid = payload.get("order_id", "").strip()
    assignee = payload.get("assignee", "").strip()
    if oid and assignee:
        try:
            await db.orders.update_one({"_id": ObjectId(oid)}, {"$addToSet": {"artists": assignee}})
        except Exception:
            pass
    await manager.broadcast({"type": "tasks_updated"})
    return {"task": result_task}


@app.patch("/tasks/{task_id}")
async def update_task(task_id: str, task: TaskUpdate, current_user: dict = Depends(get_current_user)):
    payload = task.dict(exclude_unset=True)
    if not payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")
    object_id = to_object_id(task_id)
    try:
        await db.tasks.update_one({"_id": object_id}, {"$set": payload})
        updated = await db.tasks.find_one({"_id": object_id})
    except Exception:
        updated = None
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    # Auto-sync assignee into order.artists
    oid = (updated.get("order_id") or "").strip()
    assignee = (updated.get("assignee") or "").strip()
    if oid and assignee:
        try:
            await db.orders.update_one({"_id": ObjectId(oid)}, {"$addToSet": {"artists": assignee}})
        except Exception:
            pass

    new_status = payload.get("status")
    # Talent kirim ke review → buat notifikasi + broadcast alarm
    if new_status == "menunggu_review":
        try:
            await db.notifications.insert_one({
                "type": "review_request",
                "task_id": task_id,
                "task_title": updated.get("title", ""),
                "assignee": updated.get("assignee", ""),
                "order_id": updated.get("order_id"),
                "notes": updated.get("notes", ""),
                "date": updated.get("date", ""),
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception:
            pass
        await manager.broadcast({
            "type": "task_alert",
            "task_title": updated.get("title", ""),
            "assignee": updated.get("assignee", ""),
        })
        await send_fcm(updated.get("title", ""), updated.get("assignee", ""))
    # Keluar dari review (approved/rejected) → tandai notifikasi terkait sebagai dibaca
    elif new_status in ["done", "in progress", "failed"]:
        try:
            await db.notifications.update_many(
                {"task_id": task_id, "read": False},
                {"$set": {"read": True}},
            )
        except Exception:
            pass

    await manager.broadcast({"type": "tasks_updated"})
    return {"task": format_task(updated)}


@app.delete("/tasks/{task_id}")
async def delete_task(task_id: str, current_user: dict = Depends(get_current_user)):
    object_id = to_object_id(task_id)
    try:
        result = await db.tasks.delete_one({"_id": object_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete task")
    await manager.broadcast({"type": "tasks_updated"})
    return {"deleted": True}


class AutoGenerateRequest(BaseModel):
    date: Optional[str] = None


@app.post("/tasks/auto-generate")
async def manual_auto_generate(req: AutoGenerateRequest = None, current_user: dict = Depends(get_current_user)):
    target = req.date if req else None
    result = await auto_generate_daily_tasks(target)
    return result


@app.get("/tasks/contributions")
async def tasks_order_contributions(order_id: str, current_user: dict = Depends(get_current_user)):
    """Kontribusi aktual per artist untuk satu order berdasarkan task yang dikerjakan (lintas hari)."""
    try:
        records = await db.tasks.find({"order_id": order_id}).to_list(500)
    except Exception:
        records = []
    amap: Dict[str, Any] = {}
    for t in records:
        a = t.get("assignee", "?")
        if a not in amap:
            amap[a] = {"tasks": 0, "done": 0, "time": 0, "type": t.get("assignee_type", "tim")}
        amap[a]["tasks"] += 1
        if t.get("status") == "done":
            amap[a]["done"] += 1
        amap[a]["time"] += t.get("time_elapsed", 0) or 0
    total_done = sum(v["done"] for v in amap.values())
    total_time = sum(v["time"] for v in amap.values())
    total_tasks = sum(v["tasks"] for v in amap.values())
    contribs = []
    for name, stats in amap.items():
        if total_tasks > 0:
            pct = round(stats["tasks"] / total_tasks * 100)
        elif total_time > 0:
            pct = round(stats["time"] / total_time * 100)
        else:
            pct = 0
        contribs.append({"name": name, "type": stats["type"], "tasks": stats["tasks"], "done": stats["done"], "time": stats["time"], "percent": pct})
    contribs.sort(key=lambda x: x["tasks"], reverse=True)
    return {"contributions": contribs, "total_time": total_time, "total_tasks": total_tasks, "total_done": total_done}


@app.get("/tasks/order-total")
async def tasks_order_total(order_id: str, current_user: dict = Depends(get_current_user)):
    """Total akumulasi time_elapsed semua task dengan order_id yang sama (lintas hari)."""
    try:
        pipeline = [
            {"$match": {"order_id": order_id}},
            {"$group": {"_id": None, "total": {"$sum": "$time_elapsed"}}}
        ]
        result = await db.tasks.aggregate(pipeline).to_list(1)
        total = result[0]["total"] if result else 0
        return {"total_seconds": int(total)}
    except Exception:
        return {"total_seconds": 0}


@app.get("/tasks/summary")
async def tasks_summary(month: Optional[str] = None, from_date: Optional[str] = None, to_date: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Agregasi task: per-artist dan per-order. Supports month prefix or from_date/to_date range."""
    try:
        if from_date and to_date:
            query = {"date": {"$gte": from_date, "$lte": to_date}}
        elif month:
            query = {"date": {"$regex": f"^{month}"}}
        else:
            query = {}
        records = await db.tasks.find(query).to_list(2000)
    except Exception:
        records = []
    artist_map: Dict[str, Any] = {}
    order_map: Dict[str, Any] = {}
    for t in records:
        a = t.get("assignee", "?")
        if a not in artist_map:
            artist_map[a] = {"tasks": 0, "done": 0, "failed": 0, "in_progress": 0, "pending": 0, "time": 0, "assignee_type": t.get("assignee_type", "tim")}
        artist_map[a]["tasks"] += 1
        st = t.get("status", "pending")
        if st == "done":        artist_map[a]["done"] += 1
        elif st == "failed":    artist_map[a]["failed"] += 1
        elif st == "in progress": artist_map[a]["in_progress"] += 1
        else:                   artist_map[a]["pending"] += 1
        artist_map[a]["time"] += t.get("time_elapsed", 0) or 0
        oid = t.get("order_id")
        if oid:
            if oid not in order_map:
                order_map[oid] = {"tasks": 0, "done": 0, "failed": 0, "time": 0, "assignees": [],
                                   "tasks_by_assignee": {}, "done_by_assignee": {}, "time_by_assignee": {}}
            order_map[oid]["tasks"] += 1
            if st == "done":   order_map[oid]["done"] += 1
            if st == "failed": order_map[oid]["failed"] += 1
            order_map[oid]["time"] += t.get("time_elapsed", 0) or 0
            if a not in order_map[oid]["assignees"]:
                order_map[oid]["assignees"].append(a)
            order_map[oid]["tasks_by_assignee"][a] = order_map[oid]["tasks_by_assignee"].get(a, 0) + 1
            if st == "done":
                order_map[oid]["done_by_assignee"][a] = order_map[oid]["done_by_assignee"].get(a, 0) + 1
            order_map[oid]["time_by_assignee"][a] = order_map[oid]["time_by_assignee"].get(a, 0) + (t.get("time_elapsed", 0) or 0)
    return {
        "artists": [{"name": k, **v} for k, v in artist_map.items()],
        "orders": [{"order_id": k, **v} for k, v in order_map.items()],
        "total_tasks": len(records),
        "total_time": sum(t.get("time_elapsed", 0) or 0 for t in records),
    }


@app.get("/chat-entries")
async def list_chat_entries(month: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    try:
        query = {"date": {"$regex": f"^{month}"}} if month else {}
        records = await db.chat_entries.find(query).sort("date", 1).to_list(1000)
        return {"entries": [format_chat_entry(r) for r in records]}
    except Exception:
        return {"entries": []}


@app.post("/chat-entries")
async def create_chat_entry(entry: ChatEntryCreate, current_user: dict = Depends(get_current_user)):
    payload = entry.dict()
    try:
        result = await db.chat_entries.insert_one(payload)
        return {"entry": format_chat_entry({**payload, "_id": result.inserted_id})}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/chat-entries/{entry_id}")
async def update_chat_entry(entry_id: str, entry: ChatEntryUpdate, current_user: dict = Depends(get_current_user)):
    payload = {k: v for k, v in entry.dict().items() if v is not None}
    if not payload:
        raise HTTPException(status_code=400, detail="No update data")
    object_id = to_object_id(entry_id)
    try:
        await db.chat_entries.update_one({"_id": object_id}, {"$set": payload})
        updated = await db.chat_entries.find_one({"_id": object_id})
        return {"entry": format_chat_entry(updated)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/chat-entries/{entry_id}")
async def delete_chat_entry(entry_id: str, current_user: dict = Depends(get_current_user)):
    object_id = to_object_id(entry_id)
    try:
        await db.chat_entries.delete_one({"_id": object_id})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"deleted": True}


@app.get("/dashboard")
async def dashboard(current_user: dict = Depends(get_current_user)):
    try:
        orders = await db.orders.find().to_list(500)
    except Exception:
        orders = mock_orders
    revenue = sum(item.get("total", 0) for item in orders)
    done = [item for item in orders if item.get("status") == "done"]
    return {
        "summary": {"orders": len(orders), "done": len(done), "pending": len(orders) - len(done), "revenue": revenue},
        "recent": [format_order(item) for item in orders[-5:]],
        "user": current_user,
    }


@app.get("/performance")
async def performance(current_user: dict = Depends(get_current_user)):
    try:
        orders = await db.orders.find().to_list(500)
    except Exception:
        orders = mock_orders
    revenue = sum(item.get("total", 0) for item in orders)
    return {
        "completed": len([item for item in orders if item.get("status") == "done"]),
        "total": len(orders),
        "revenue": revenue,
        "average": round(revenue / len(orders), 2) if orders else 0,
    }


# ─── User Registration & Management ──────────────────────────────────────────

def format_user(record: dict) -> dict:
    return {
        "id": str(record.get("_id")) if record.get("_id") else record.get("id", ""),
        "username": record.get("username", ""),
        "full_name": record.get("full_name", ""),
        "email": record.get("email", ""),
        "role": record.get("role", "talent"),
        "status": record.get("status", "pending"),
        "avatar_url": record.get("avatar_url"),
        "created_at": record.get("created_at"),
        "phone": record.get("phone", ""),
        "telegram": record.get("telegram", ""),
        "gender": record.get("gender", ""),
        "birthdate": record.get("birthdate", ""),
        "birthplace": record.get("birthplace", ""),
        "position": record.get("position", ""),
        "address": record.get("address", ""),
        "bank_account": record.get("bank_account", ""),
    }


class RegisterRequest(BaseModel):
    username: str
    full_name: str
    email: EmailStr
    password: str


class InviteUserRequest(BaseModel):
    username: str
    full_name: str
    email: EmailStr
    role: str = "talent"
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None
    status: Optional[str] = None
    phone: Optional[str] = None
    telegram: Optional[str] = None
    gender: Optional[str] = None
    birthdate: Optional[str] = None
    birthplace: Optional[str] = None
    position: Optional[str] = None
    address: Optional[str] = None
    bank_account: Optional[str] = None


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    telegram: Optional[str] = None
    gender: Optional[str] = None
    birthdate: Optional[str] = None
    birthplace: Optional[str] = None
    position: Optional[str] = None
    address: Optional[str] = None
    bank_account: Optional[str] = None


class EmailWhitelistUpdate(BaseModel):
    emails: List[str]


@app.post("/auth/register")
async def register(req: RegisterRequest):
    try:
        whitelist_doc = await db.settings.find_one({"key": "email_whitelist"})
        whitelist = whitelist_doc.get("emails", []) if whitelist_doc else []
        if whitelist and req.email not in whitelist:
            raise HTTPException(status_code=403, detail="Email tidak ada dalam whitelist")
        existing = await db.users.find_one({"$or": [{"username": req.username}, {"email": req.email}]})
        if existing:
            raise HTTPException(status_code=400, detail="Username atau email sudah digunakan")
        user_doc = {
            "username": req.username,
            "full_name": req.full_name,
            "email": req.email,
            "hashed_password": hash_password(req.password),
            "role": "talent",
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user_doc)
        return {"message": "Pendaftaran berhasil. Menunggu persetujuan admin."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/users")
async def list_users(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        records = await db.users.find().sort("created_at", 1).to_list(200)
        return {"users": [format_user(r) for r in records]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/users/invite")
async def invite_user(req: InviteUserRequest, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        existing = await db.users.find_one({"$or": [{"username": req.username}, {"email": req.email}]})
        if existing:
            raise HTTPException(status_code=400, detail="Username atau email sudah digunakan")
        user_doc = {
            "username": req.username,
            "full_name": req.full_name,
            "email": req.email,
            "hashed_password": hash_password(req.password),
            "role": req.role,
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        result = await db.users.insert_one(user_doc)
        return {"user": format_user({**user_doc, "_id": result.inserted_id})}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/users/me")
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    username = current_user.get("username")
    if not username:
        raise HTTPException(status_code=400, detail="Cannot determine user")
    try:
        record = await db.users.find_one({"username": username})
        if not record:
            return {"user": {
                "id": "", "username": username,
                "full_name": current_user.get("full_name", ""),
                "email": current_user.get("email", ""),
                "role": current_user.get("role", "talent"),
                "status": "active",
                "phone": "", "telegram": "", "gender": "", "birthdate": "",
                "birthplace": "", "position": "", "address": "", "bank_account": "",
            }}
        return {"user": format_user(record)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/users/me")
async def update_my_profile(data: UserProfileUpdate, current_user: dict = Depends(get_current_user)):
    username = current_user.get("username")
    if not username or username == "admin":
        raise HTTPException(status_code=403, detail="Akun ini tidak bisa diperbarui via endpoint ini")
    payload: dict = {}
    # Non-admin users cannot change their full_name (it is used as the data key across collections)
    allowed_fields = ["phone", "telegram", "gender", "birthdate", "birthplace", "position", "address", "bank_account"]
    if current_user.get("role") == "admin":
        allowed_fields = ["full_name"] + allowed_fields
    for field in allowed_fields:
        val = getattr(data, field, None)
        if val is not None:
            payload[field] = val
    if not payload:
        raise HTTPException(status_code=400, detail="No update data")
    try:
        await db.users.update_one({"username": username}, {"$set": payload})
        updated = await db.users.find_one({"username": username})
        return {"user": format_user(updated)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/users/{user_id}")
async def update_user(user_id: str, data: UserUpdate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    payload: dict = {}
    if data.full_name is not None:
        payload["full_name"] = data.full_name
    if data.role is not None:
        payload["role"] = data.role
    if data.status is not None:
        payload["status"] = data.status
    if data.password:
        payload["hashed_password"] = hash_password(data.password)
    if not payload:
        raise HTTPException(status_code=400, detail="No update data")
    object_id = to_object_id(user_id)
    try:
        await db.users.update_one({"_id": object_id}, {"$set": payload})
        updated = await db.users.find_one({"_id": object_id})
        return {"user": format_user(updated)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    object_id = to_object_id(user_id)
    try:
        result = await db.users.delete_one({"_id": object_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"deleted": True}


# ─── Email Whitelist ──────────────────────────────────────────────────────────

@app.get("/settings/email-whitelist")
async def get_email_whitelist(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        doc = await db.settings.find_one({"key": "email_whitelist"})
        return {"emails": doc.get("emails", []) if doc else []}
    except Exception:
        return {"emails": []}


@app.post("/settings/email-whitelist")
async def update_email_whitelist(data: EmailWhitelistUpdate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        await db.settings.update_one(
            {"key": "email_whitelist"},
            {"$set": {"key": "email_whitelist", "emails": data.emails}},
            upsert=True,
        )
        return {"emails": data.emails}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Telegram Settings ────────────────────────────────────────────────────────

class TelegramSettingsUpdate(BaseModel):
    bot_token: str = ""
    chat_id: str = ""

@app.get("/settings/telegram")
async def get_telegram_settings(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        doc = await db.settings.find_one({"key": "telegram"})
        if doc:
            return {"bot_token": doc.get("bot_token", ""), "chat_id": doc.get("chat_id", "")}
        return {"bot_token": "", "chat_id": ""}
    except Exception:
        return {"bot_token": "", "chat_id": ""}

@app.post("/settings/telegram")
async def update_telegram_settings(data: TelegramSettingsUpdate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        await db.settings.update_one(
            {"key": "telegram"},
            {"$set": {"key": "telegram", "bot_token": data.bot_token, "chat_id": data.chat_id}},
            upsert=True,
        )
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Bank Info Settings ───────────────────────────────────────────────────────

class BankInfoUpdate(BaseModel):
    nama: str = ""
    bank: str = ""
    rekening: str = ""

@app.get("/settings/bank-info")
async def get_bank_info(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "pm"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        doc = await db.settings.find_one({"key": "bank_info"})
        if doc:
            return {"nama": doc.get("nama", ""), "bank": doc.get("bank", ""), "rekening": doc.get("rekening", "")}
        return {"nama": "", "bank": "", "rekening": ""}
    except Exception:
        return {"nama": "", "bank": "", "rekening": ""}

@app.post("/settings/bank-info")
async def update_bank_info(data: BankInfoUpdate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "pm"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        await db.settings.update_one(
            {"key": "bank_info"},
            {"$set": {"key": "bank_info", "nama": data.nama, "bank": data.bank, "rekening": data.rekening}},
            upsert=True,
        )
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Daily Report Deadline Settings ─────────────────────────────────────────

class DeadlineUpdate(BaseModel):
    hour: int
    minute: int

@app.get("/settings/daily-report-deadline")
async def get_daily_report_deadline(current_user: dict = Depends(get_current_user)):
    try:
        doc = await db.settings.find_one({"key": "daily_report_deadline"})
        if doc:
            return {"hour": doc.get("hour", 16), "minute": doc.get("minute", 30)}
        return {"hour": 16, "minute": 30}
    except Exception:
        return {"hour": 16, "minute": 30}

@app.put("/settings/daily-report-deadline")
async def update_daily_report_deadline(data: DeadlineUpdate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    if not (0 <= data.hour <= 23 and 0 <= data.minute <= 59):
        raise HTTPException(status_code=400, detail="Waktu tidak valid")
    try:
        await db.settings.update_one(
            {"key": "daily_report_deadline"},
            {"$set": {"key": "daily_report_deadline", "hour": data.hour, "minute": data.minute}},
            upsert=True,
        )
        # Reschedule the notification job
        if scheduler:
            try:
                scheduler.reschedule_job("notify_daily_report", trigger=CronTrigger(hour=data.hour, minute=data.minute, timezone="Asia/Jakarta"))
            except Exception:
                pass
        return {"ok": True, "hour": data.hour, "minute": data.minute}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Telegram Send ────────────────────────────────────────────────────────────

class TelegramSendBody(BaseModel):
    message: str

@app.post("/telegram/send")
async def send_telegram_message(body: TelegramSendBody, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "pm"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        doc = await db.settings.find_one({"key": "telegram"})
        bot_token = doc.get("bot_token", "") if doc else ""
        chat_id = doc.get("chat_id", "") if doc else ""
        if not bot_token or not chat_id:
            raise HTTPException(status_code=400, detail="Telegram belum dikonfigurasi. Silakan isi Bot Token & Chat ID di Settings.")
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={"chat_id": chat_id, "text": body.message, "parse_mode": "HTML"},
                timeout=10,
            )
        result = resp.json()
        if not result.get("ok"):
            raise HTTPException(status_code=500, detail=f"Telegram error: {result.get('description', 'Unknown')}")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Announcements ────────────────────────────────────────────────────────────

def format_announcement(record: dict) -> dict:
    return {
        "id": str(record.get("_id")) if record.get("_id") else record.get("id", ""),
        "title": record.get("title", ""),
        "content": record.get("content", ""),
        "author": record.get("author", "Admin"),
        "created_at": record.get("created_at", ""),
        "updated_at": record.get("updated_at"),
        "pinned": record.get("pinned", False),
    }


class AnnouncementCreate(BaseModel):
    title: str
    content: str
    pinned: bool = False


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    pinned: Optional[bool] = None


@app.get("/announcements")
async def list_announcements(current_user: dict = Depends(get_current_user)):
    try:
        records = await db.announcements.find().sort("created_at", -1).to_list(100)
        return {"announcements": [format_announcement(r) for r in records]}
    except Exception:
        return {"announcements": []}


@app.post("/announcements")
async def create_announcement(data: AnnouncementCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    doc = {
        "title": data.title,
        "content": data.content,
        "pinned": data.pinned,
        "author": current_user.get("full_name", "Admin"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.announcements.insert_one(doc)
    await manager.broadcast({"type": "announcements_updated"})
    _asyncio.get_event_loop().create_task(send_fcm_all(
        "📢 Pengumuman Baru", data.title, {"type": "announcement"}
    ))
    return {"announcement": format_announcement({**doc, "_id": result.inserted_id})}


@app.patch("/announcements/{ann_id}")
async def update_announcement(ann_id: str, data: AnnouncementUpdate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    payload = {k: v for k, v in data.dict(exclude_unset=True).items()}
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    object_id = to_object_id(ann_id)
    try:
        await db.announcements.update_one({"_id": object_id}, {"$set": payload})
        updated = await db.announcements.find_one({"_id": object_id})
        await manager.broadcast({"type": "announcements_updated"})
        return {"announcement": format_announcement(updated)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/announcements/{ann_id}")
async def delete_announcement(ann_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    object_id = to_object_id(ann_id)
    try:
        await db.announcements.delete_one({"_id": object_id})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    await manager.broadcast({"type": "announcements_updated"})
    return {"deleted": True}


# ─── Schedule ─────────────────────────────────────────────────────────────────

def format_schedule_event(record: dict) -> dict:
    return {
        "id": str(record.get("_id")) if record.get("_id") else record.get("id", ""),
        "title": record.get("title", ""),
        "description": record.get("description", ""),
        "date": record.get("date", ""),
        "end_date": record.get("end_date"),
        "time": record.get("time"),
        "color": record.get("color", "violet"),
        "author": record.get("author", "Admin"),
        "created_at": record.get("created_at", ""),
    }


class ScheduleEventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    date: str
    end_date: Optional[str] = None
    time: Optional[str] = None
    color: str = "violet"


class ScheduleEventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    end_date: Optional[str] = None
    time: Optional[str] = None
    color: Optional[str] = None


@app.get("/schedule")
async def list_schedule(current_user: dict = Depends(get_current_user)):
    try:
        records = await db.schedule.find().sort("date", 1).to_list(200)
        return {"events": [format_schedule_event(r) for r in records]}
    except Exception:
        return {"events": []}


@app.post("/schedule")
async def create_schedule_event(data: ScheduleEventCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    doc = {
        **data.dict(),
        "author": current_user.get("full_name", "Admin"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.schedule.insert_one(doc)
    await manager.broadcast({"type": "schedule_updated"})
    _asyncio.get_event_loop().create_task(send_fcm_all(
        "📅 Event Baru", f"{data.title} — {data.date}", {"type": "schedule_event"}
    ))
    return {"event": format_schedule_event({**doc, "_id": result.inserted_id})}


@app.patch("/schedule/{event_id}")
async def update_schedule_event(event_id: str, data: ScheduleEventUpdate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    payload = {k: v for k, v in data.dict(exclude_unset=True).items()}
    if not payload:
        raise HTTPException(status_code=400, detail="No update data")
    object_id = to_object_id(event_id)
    try:
        await db.schedule.update_one({"_id": object_id}, {"$set": payload})
        updated = await db.schedule.find_one({"_id": object_id})
        await manager.broadcast({"type": "schedule_updated"})
        return {"event": format_schedule_event(updated)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/schedule/{event_id}")
async def delete_schedule_event(event_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    object_id = to_object_id(event_id)
    try:
        await db.schedule.delete_one({"_id": object_id})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    await manager.broadcast({"type": "schedule_updated"})
    return {"deleted": True}


# ─── Location Tracking ───────────────────────────────────────────────────────

class LocationUpdate(BaseModel):
    lat: float
    lng: float
    accuracy: Optional[float] = None

@app.post("/location/update")
async def update_location(req: LocationUpdate, current_user: dict = Depends(get_current_user)):
    username = current_user.get("username")
    await db.locations.update_one(
        {"username": username},
        {"$set": {
            "username": username,
            "full_name": current_user.get("full_name", username),
            "lat": req.lat,
            "lng": req.lng,
            "accuracy": req.accuracy,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"ok": True}

@app.get("/location/team")
async def get_team_locations(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Superadmin only")
    docs = await db.locations.find().to_list(200)
    return [
        {
            "username": d["username"],
            "full_name": d.get("full_name", d["username"]),
            "lat": d["lat"],
            "lng": d["lng"],
            "accuracy": d.get("accuracy"),
            "updated_at": d.get("updated_at"),
        }
        for d in docs
    ]


# ─── FCM Token ───────────────────────────────────────────────────────────────

class FCMTokenRequest(BaseModel):
    token: str

@app.post("/fcm/token")
async def register_fcm_token(req: FCMTokenRequest, current_user: dict = Depends(get_current_user)):
    username = current_user.get("username", "unknown")
    print(f"[FCM] Token register request from {username}, token={req.token[:30]}...")
    try:
        await db.fcm_tokens.update_one(
            {"token": req.token},
            {"$set": {"token": req.token, "username": username, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
        print(f"[FCM] Token saved to DB for {username}")
    except Exception as e:
        print(f"[FCM] Token save error: {e}")
    return {"ok": True}


async def send_fcm(task_title: str, assignee: str):
    if not FCM_AVAILABLE:
        return
    try:
        tokens_docs = await db.fcm_tokens.find().to_list(500)
        tokens = [d["token"] for d in tokens_docs if d.get("token")]
        if not tokens:
            print("[FCM] No tokens found")
            return
        body = f"{assignee}: {task_title}" if assignee else task_title
        success = 0
        for token in tokens:
            try:
                msg = fb_messaging.Message(
                    notification=fb_messaging.Notification(
                        title="⚠️ Task Menunggu Review!",
                        body=body,
                    ),
                    android=fb_messaging.AndroidConfig(
                        priority="high",
                        notification=fb_messaging.AndroidNotification(
                            channel_id="magsika-alerts",
                            sound="default",
                            default_sound=True,
                            default_vibrate_timings=False,
                            vibrate_timings_millis=[0, 800, 200, 800, 200, 800],
                        ),
                    ),
                    data={"type": "task_alert", "task_title": task_title, "assignee": assignee},
                    token=token,
                )
                fb_messaging.send(msg)
                success += 1
            except Exception as e:
                print(f"[FCM] Token error: {e}")
        print(f"[FCM] Sent {success}/{len(tokens)}")
    except Exception as e:
        print(f"[FCM] Send error: {e}")


async def send_fcm_to_username(username: str, title: str, body: str, data: dict = None):
    if not FCM_AVAILABLE or not username:
        return
    if data is None:
        data = {}
    try:
        token_doc = await db.fcm_tokens.find_one({"username": username})
        if not token_doc or not token_doc.get("token"):
            return
        msg = fb_messaging.Message(
            notification=fb_messaging.Notification(title=title, body=body),
            android=fb_messaging.AndroidConfig(
                priority="high",
                notification=fb_messaging.AndroidNotification(channel_id="magsika-alerts", sound="default"),
            ),
            data={k: str(v) for k, v in data.items()},
            token=token_doc["token"],
        )
        fb_messaging.send(msg)
    except Exception as e:
        print(f"[FCM] send_to_username error: {e}")


async def send_fcm_all(title: str, body: str, data: dict = None):
    if not FCM_AVAILABLE:
        return
    if data is None:
        data = {}
    try:
        token_docs = await db.fcm_tokens.find().to_list(500)
        tokens = [d["token"] for d in token_docs if d.get("token")]
        if not tokens:
            return
        for token in tokens:
            try:
                msg = fb_messaging.Message(
                    notification=fb_messaging.Notification(title=title, body=body),
                    android=fb_messaging.AndroidConfig(
                        priority="high",
                        notification=fb_messaging.AndroidNotification(channel_id="magsika-alerts", sound="default"),
                    ),
                    data={k: str(v) for k, v in data.items()},
                    token=token,
                )
                fb_messaging.send(msg)
            except Exception:
                pass
    except Exception as e:
        print(f"[FCM] send_all error: {e}")


async def _fcm_by_full_name(full_name: str, title: str, body: str, data: dict = None):
    """Send FCM to a user identified by full_name (looks up username first)."""
    if not FCM_AVAILABLE or not full_name:
        return
    try:
        user_doc = await db.users.find_one({"full_name": full_name})
        if user_doc:
            await send_fcm_to_username(user_doc.get("username", ""), title, body, data or {})
    except Exception:
        pass


# ─── Notifications ────────────────────────────────────────────────────────────

def format_notification(record: dict) -> dict:
    return {
        "id": str(record.get("_id")) if record.get("_id") else record.get("id", ""),
        "type": record.get("type", "review_request"),
        "task_id": record.get("task_id", ""),
        "task_title": record.get("task_title", ""),
        "assignee": record.get("assignee", ""),
        "order_id": record.get("order_id"),
        "notes": record.get("notes", ""),
        "date": record.get("date", ""),
        "read": record.get("read", False),
        "review_result": record.get("review_result"),
        "reviewed_by": record.get("reviewed_by", ""),
        "created_at": record.get("created_at", ""),
    }


@app.get("/notifications/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "pm"]:
        return {"count": 0}
    try:
        count = await db.notifications.count_documents({"read": False})
        return {"count": count}
    except Exception:
        return {"count": 0}


@app.get("/notifications")
async def list_notifications(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "pm"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        records = await db.notifications.find().sort("created_at", -1).to_list(200)
        unread = sum(1 for r in records if not r.get("read", False))
        return {
            "notifications": [format_notification(r) for r in records],
            "unread_count": unread,
        }
    except Exception:
        return {"notifications": [], "unread_count": 0}


@app.patch("/notifications/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "pm"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        await db.notifications.update_many({"read": False}, {"$set": {"read": True}})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"ok": True}


class NotifReadBody(BaseModel):
    result: Optional[str] = None

@app.patch("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, body: NotifReadBody = NotifReadBody(), current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "pm"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    object_id = to_object_id(notif_id)
    update = {"read": True}
    if body.result:
        update["review_result"] = body.result
        update["reviewed_by"] = current_user.get("full_name", current_user.get("username", ""))
    try:
        await db.notifications.update_one({"_id": object_id}, {"$set": update})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"ok": True}


# ─── User Notifications (all roles, filtered by recipient_name) ───────────────

@app.get("/my-notifications/unread-count")
async def my_notif_unread_count(current_user: dict = Depends(get_current_user)):
    name = current_user.get("full_name", "")
    try:
        count = await db.user_notifications.count_documents({"recipient_name": name, "read": False})
        return {"count": count}
    except Exception:
        return {"count": 0}


@app.get("/my-notifications")
async def my_notif_list(current_user: dict = Depends(get_current_user)):
    name = current_user.get("full_name", "")
    try:
        records = await db.user_notifications.find({"recipient_name": name}).sort("created_at", -1).to_list(100)
        return {"notifications": [
            {"id": str(r["_id"]), "recipient_name": r.get("recipient_name", ""),
             "message": r.get("message", ""), "period": r.get("period", ""),
             "date_key": r.get("date_key", ""), "read": r.get("read", False),
             "created_at": r.get("created_at", "")}
            for r in records
        ]}
    except Exception:
        return {"notifications": []}


@app.patch("/my-notifications/read-all")
async def my_notif_read_all(current_user: dict = Depends(get_current_user)):
    name = current_user.get("full_name", "")
    try:
        await db.user_notifications.update_many({"recipient_name": name, "read": False}, {"$set": {"read": True}})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"ok": True}


@app.patch("/my-notifications/{notif_id}/read")
async def my_notif_read_one(notif_id: str, current_user: dict = Depends(get_current_user)):
    object_id = to_object_id(notif_id)
    try:
        await db.user_notifications.update_one({"_id": object_id}, {"$set": {"read": True}})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"ok": True}


# ─── Unified Unread Counts ───────────────────────────────────────────────────

@app.get("/unread-counts")
async def get_unread_counts(current_user: dict = Depends(get_current_user)):
    username = current_user.get("username", "")
    role = current_user.get("role", "")
    full_name = current_user.get("full_name", "")

    reads = {}
    async for r in db.user_reads.find({"username": username}):
        reads[r.get("category", "")] = r.get("last_read_at", "")

    ann_count = 0
    ann_after = reads.get("announcements", "")
    if ann_after:
        try:
            ann_count = await db.announcements.count_documents({"created_at": {"$gt": ann_after}})
        except Exception:
            pass

    sched_count = 0
    sched_after = reads.get("schedule", "")
    if sched_after:
        try:
            sched_count = await db.schedule.count_documents({"created_at": {"$gt": sched_after}})
        except Exception:
            pass

    notif_count = 0
    if role in ["admin", "pm"]:
        try:
            notif_count = await db.notifications.count_documents({"read": False})
        except Exception:
            pass
    elif role == "talent" and full_name:
        try:
            notif_count = await db.user_notifications.count_documents({"recipient_name": full_name, "read": False})
        except Exception:
            pass

    return {"announcements": ann_count, "schedule": sched_count, "notifications": notif_count}


@app.patch("/mark-read/{category}")
async def mark_category_read(category: str, current_user: dict = Depends(get_current_user)):
    if category not in ["announcements", "schedule"]:
        raise HTTPException(status_code=400, detail="Invalid category")
    username = current_user.get("username", "")
    now = datetime.now(timezone.utc).isoformat()
    try:
        await db.user_reads.update_one(
            {"username": username, "category": category},
            {"$set": {"last_read_at": now}},
            upsert=True,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"ok": True}


# ─── Strategic Plans ──────────────────────────────────────────────────────────

@app.get("/strategic-plan/{plan_type}")
async def get_strategic_plan(plan_type: str, current_user: dict = Depends(get_current_user)):
    if plan_type not in ["teknis", "market"]:
        raise HTTPException(status_code=400, detail="Invalid plan type")
    try:
        doc = await db.strategic_plans.find_one({"type": plan_type})
        if not doc:
            return {"plan": None}
        return {"plan": {
            "type": doc["type"],
            "sections": doc.get("sections", []),
            "updated_at": doc.get("updated_at", ""),
            "updated_by": doc.get("updated_by", ""),
        }}
    except Exception:
        return {"plan": None}


@app.put("/strategic-plan/{plan_type}")
async def save_strategic_plan(plan_type: str, data: dict, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    if plan_type not in ["teknis", "market"]:
        raise HTTPException(status_code=400, detail="Invalid plan type")
    try:
        await db.strategic_plans.update_one(
            {"type": plan_type},
            {"$set": {
                "type": plan_type,
                "sections": data.get("sections", []),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": current_user.get("full_name", ""),
            }},
            upsert=True,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"ok": True}


# ─── Seed Team ────────────────────────────────────────────────────────────────

@app.post("/admin/seed-team")
async def seed_team(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    team = [
        {"username": "ivo",     "full_name": "Ivo Febrian",  "email": "ivo@magsikastudio.com",    "role": "admin"},
        {"username": "novita",  "full_name": "Novitabita",   "email": "novita@magsikastudio.com", "role": "admin"},
        {"username": "kevin",   "full_name": "Kevin Yanto",  "email": "kevin@magsikastudio.com",  "role": "pm"},
        {"username": "andre",   "full_name": "Andre Kopeng", "email": "andre@magsikastudio.com",  "role": "talent"},
        {"username": "hadziq",  "full_name": "Hadziqkls7",   "email": "hadziq@magsikastudio.com", "role": "talent"},
        {"username": "quin",    "full_name": "Quin King",    "email": "quin@magsikastudio.com",   "role": "talent"},
    ]
    password = "Magsika!"
    created, updated, skipped = [], [], []
    for member in team:
        existing = await db.users.find_one({"username": member["username"]})
        if existing:
            await db.users.update_one(
                {"username": member["username"]},
                {"$set": {**member, "hashed_password": hash_password(password), "status": "active"}}
            )
            updated.append(member["username"])
            continue
        await db.users.insert_one({
            **member,
            "hashed_password": hash_password(password),
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        created.append(member["username"])
    return {"created": created, "updated": updated, "skipped": skipped}


# ─── Earnings Weekly Tracking ─────────────────────────────────────────────────

class EarningsWeeklyEntry(BaseModel):
    year: int
    month: int
    account: str
    week: int
    fiverr: float = 0
    etsy: float = 0
    upwork: float = 0
    vgen: float = 0
    komunitas: float = 0
    lain_lain: float = 0


class EarningsTarget(BaseModel):
    year: int
    month: int
    account: str
    target: float = 0


@app.get("/earnings/weekly")
async def get_earnings_weekly(year: int, month: int, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "pm"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        records = await db.earnings_weekly.find({"year": year, "month": month}).to_list(100)
        return {"entries": [
            {
                "year": r["year"], "month": r["month"], "account": r["account"],
                "week": r["week"], "fiverr": r.get("fiverr", 0), "etsy": r.get("etsy", 0),
                "upwork": r.get("upwork", 0), "vgen": r.get("vgen", 0),
                "komunitas": r.get("komunitas", 0), "lain_lain": r.get("lain_lain", 0),
            }
            for r in records
        ]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/earnings/weekly")
async def upsert_earnings_weekly(data: EarningsWeeklyEntry, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "pm"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        await db.earnings_weekly.update_one(
            {"year": data.year, "month": data.month, "account": data.account, "week": data.week},
            {"$set": {
                "year": data.year, "month": data.month, "account": data.account, "week": data.week,
                "fiverr": data.fiverr, "etsy": data.etsy, "upwork": data.upwork,
                "vgen": data.vgen, "komunitas": data.komunitas, "lain_lain": data.lain_lain,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/earnings/targets")
async def get_earnings_targets(year: int, month: int, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "pm"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        records = await db.earnings_targets.find({"year": year, "month": month}).to_list(20)
        return {"targets": [
            {"year": r["year"], "month": r["month"], "account": r["account"], "target": r.get("target", 0)}
            for r in records
        ]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/earnings/targets")
async def upsert_earnings_target(data: EarningsTarget, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "pm"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        await db.earnings_targets.update_one(
            {"year": data.year, "month": data.month, "account": data.account},
            {"$set": {"year": data.year, "month": data.month, "account": data.account, "target": data.target}},
            upsert=True,
        )
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Admin: Clear All Data ────────────────────────────────────────────────────

@app.delete("/admin/clear-all-data")
async def clear_all_data(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    collections = [
        "orders", "tasks", "chat_entries",
        "freelance_artists", "freelance_projects",
        "notifications", "announcements", "strategic_plans",
        "schedule_events", "earnings_weekly", "earnings_targets",
    ]
    deleted = {}
    for col in collections:
        try:
            result = await db[col].delete_many({})
            deleted[col] = result.deleted_count
        except Exception as e:
            deleted[col] = f"error: {e}"
    return {"deleted": deleted}


# ─── AI Reports ──────────────────────────────────────────────────────────────

import asyncio as _asyncio

def _current_date_key(period: str, month: str = "") -> str:
    from datetime import timedelta
    now_wib = datetime.now(timezone.utc) + timedelta(hours=7)
    if period == "daily":
        return now_wib.strftime("%Y-%m-%d")
    elif period == "weekly":
        iso = now_wib.isocalendar()
        return f"{iso[0]}-W{iso[1]:02d}"
    else:
        return month or now_wib.strftime("%Y-%m")

def _fmt_report(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "type": doc.get("type"),
        "target": doc.get("target"),
        "period": doc.get("period"),
        "date_key": doc.get("date_key"),
        "content": doc.get("content", ""),
        "is_auto": doc.get("is_auto", False),
        "generated_by": doc.get("generated_by", ""),
        "created_at": doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", ""),
    }

async def _fetch_member_data(name: str, period: str, month: str):
    from datetime import timedelta
    now_wib = datetime.now(timezone.utc) + timedelta(hours=7)
    today_str = now_wib.strftime("%Y-%m-%d")
    week_ago_str = (now_wib - timedelta(days=6)).strftime("%Y-%m-%d")
    if period == "daily":
        tasks = await db.tasks.find({"assignee": name, "date": {"$regex": f"^{today_str}"}}).to_list(300)
        all_orders = await db.orders.find({"artists": name}).to_list(200)
        period_orders = [o for o in all_orders if (o.get("order_date") or o.get("created_at", "")[:10] or "") == today_str]
        period_label = f"Hari ini ({today_str})"
    elif period == "weekly":
        tasks = await db.tasks.find({"assignee": name, "date": {"$gte": week_ago_str, "$lte": today_str}}).to_list(500)
        all_orders = await db.orders.find({"artists": name}).to_list(200)
        period_orders = [o for o in all_orders if week_ago_str <= (o.get("order_date") or o.get("created_at", "")[:10] or "") <= today_str]
        period_label = f"Minggu ini ({week_ago_str} s.d. {today_str})"
    else:
        tasks = await db.tasks.find({"assignee": name, "date": {"$regex": f"^{month}"}}).to_list(300)
        all_orders = await db.orders.find({"artists": name}).to_list(100)
        period_orders = [o for o in all_orders if (o.get("order_date") or o.get("created_at", "")[:10] or "").startswith(month)]
        period_label = f"Bulan {month}"
    return tasks, period_orders, period_label

def _member_prompt(name: str, tasks: list, period_orders: list, period_label: str) -> str:
    done = sum(1 for t in tasks if t.get("status") == "done")
    failed = sum(1 for t in tasks if t.get("status") == "failed")
    in_progress = sum(1 for t in tasks if t.get("status") == "in progress")
    in_revision = sum(1 for t in tasks if t.get("status") == "in_revision")
    total_time = sum(t.get("time_elapsed", 0) for t in tasks)
    project_names = ", ".join([o.get("project", "") for o in period_orders[:5] if o.get("project")])
    return (
        "Anda adalah analis performa profesional untuk Magsika Studio, sebuah studio kreatif 3D/2D. "
        "Tugas Anda adalah menulis evaluasi performa yang OBJEKTIF dan BERBASIS DATA — bukan untuk menyemangati atau memanjakan anggota tim. "
        "Jangan beri pujian yang tidak didukung data. Jika performa baik, cukup nyatakan fakta. Jika ada kekurangan, ungkapkan dengan jelas dan langsung.\n\n"
        f"Data Performa: {name} | Periode: {period_label}\n"
        f"- Total task: {len(tasks)} (selesai: {done}, gagal: {failed}, sedang berjalan: {in_progress}, revisi: {in_revision})\n"
        f"- Akumulasi waktu kerja: {total_time // 3600} jam {(total_time % 3600) // 60} menit\n"
        f"- Jumlah order dikerjakan: {len(period_orders)}\n"
        f"- Project yang dikerjakan: {project_names or 'belum ada data'}\n\n"
        "Jangan tulis baris header laporan, nama anggota tim, atau periode di awal output. "
        "Mulai langsung dengan section pertama berikut.\n\n"
        "Tulis laporan dengan struktur berikut (gunakan persis heading ini):\n\n"
        "**Ringkasan Eksekutif**\n"
        "Gambaran umum kinerja secara keseluruhan (2-3 kalimat berbasis angka, bukan kesan umum).\n\n"
        "**Analisis Kinerja**\n"
        "Evaluasi pencapaian berdasarkan data. Sebutkan angka secara eksplisit. Hindari generalisasi positif tanpa dasar.\n\n"
        "**Area yang Perlu Ditingkatkan**\n"
        "Identifikasi kelemahan atau hambatan secara spesifik. Jangan tulis 'Tidak ada catatan khusus' jika ada task gagal atau revisi.\n\n"
        "**Rekomendasi**\n"
        "1-2 tindakan konkret dan terukur untuk periode berikutnya. Rekomendasi harus relevan dengan data di atas.\n\n"
        "Gunakan bahasa Indonesia yang formal. Maksimal 220 kata. Tidak perlu kalimat penutup yang memotivasi."
    )

async def _fetch_overall_data(period: str, month: str):
    from datetime import timedelta
    now_wib = datetime.now(timezone.utc) + timedelta(hours=7)
    today_str = now_wib.strftime("%Y-%m-%d")
    week_ago_str = (now_wib - timedelta(days=6)).strftime("%Y-%m-%d")
    all_orders_db = await db.orders.find().to_list(500)
    if period == "daily":
        period_orders = [o for o in all_orders_db if (o.get("order_date") or o.get("created_at", "")[:10] or "") == today_str]
        tasks = await db.tasks.find({"date": {"$regex": f"^{today_str}"}}).to_list(1000)
        period_label = f"Hari ini ({today_str})"
    elif period == "weekly":
        period_orders = [o for o in all_orders_db if week_ago_str <= (o.get("order_date") or o.get("created_at", "")[:10] or "") <= today_str]
        tasks = await db.tasks.find({"date": {"$gte": week_ago_str, "$lte": today_str}}).to_list(1000)
        period_label = f"Minggu ini ({week_ago_str} s.d. {today_str})"
    else:
        period_orders = [o for o in all_orders_db if (o.get("order_date") or o.get("created_at", "")[:10] or "").startswith(month)]
        tasks = await db.tasks.find({"date": {"$regex": f"^{month}"}}).to_list(1000)
        period_label = f"Bulan {month}"
    return tasks, period_orders, period_label

def _overall_prompt(tasks: list, period_orders: list, period_label: str) -> str:
    done_orders = sum(1 for o in period_orders if (o.get("status") or "").lower() == "done")
    active_orders = sum(1 for o in period_orders if (o.get("status") or "").lower() not in ["done", "cancel"])
    total_revenue = sum(o.get("total", 0) for o in period_orders)
    done_tasks = sum(1 for t in tasks if t.get("status") == "done")
    failed_tasks = sum(1 for t in tasks if t.get("status") == "failed")
    artist_map: dict = {}
    for t in tasks:
        a = t.get("assignee", "")
        if not a:
            continue
        if a not in artist_map:
            artist_map[a] = {"tasks": 0, "done": 0, "time": 0}
        artist_map[a]["tasks"] += 1
        artist_map[a]["time"] += t.get("time_elapsed", 0)
        if t.get("status") == "done":
            artist_map[a]["done"] += 1
    artist_lines = "\n".join([
        f"- {a}: {v['done']}/{v['tasks']} task, {v['time']//3600}j kerja"
        for a, v in sorted(artist_map.items(), key=lambda x: -x[1]["done"])
    ])
    return (
        "Anda adalah analis manajemen senior untuk Magsika Studio (studio kreatif 3D/2D). "
        "Tulis laporan performa tim yang OBJEKTIF untuk pimpinan studio — berbasis data, tidak memanjakan, tidak memberi pujian tanpa dasar angka. "
        "Jika ada anggota yang kinerjanya rendah, sebutkan secara eksplisit. Jika target tidak tercapai, nyatakan dengan jelas.\n\n"
        f"Data Tim — Periode: {period_label}\n"
        f"- Order: {len(period_orders)} masuk, {done_orders} selesai, {active_orders} aktif\n"
        f"- Estimasi Revenue: Rp {total_revenue:,.0f}\n"
        f"- Task: {len(tasks)} total, {done_tasks} selesai, {failed_tasks} gagal\n\n"
        f"Rincian per Anggota Tim:\n{artist_lines or 'Belum ada data'}\n\n"
        "Tulis laporan dengan struktur berikut (gunakan persis heading ini):\n\n"
        "**Ringkasan Eksekutif**\n"
        "Kondisi objektif tim pada periode ini berdasarkan angka (2-3 kalimat).\n\n"
        "**Pencapaian Tim**\n"
        "Fakta pencapaian yang didukung data. Bukan pujian umum — sebutkan siapa, berapa, apa.\n\n"
        "**Analisis Per Anggota**\n"
        "Evaluasi kontribusi masing-masing berdasarkan data. Sebutkan yang perlu perhatian khusus.\n\n"
        "**Area Perhatian**\n"
        "Risiko, hambatan, atau anggota yang kinerjanya di bawah rata-rata.\n\n"
        "**Rekomendasi Strategis**\n"
        "2-3 tindakan konkret untuk periode berikutnya. Harus spesifik dan terukur.\n\n"
        "Gunakan bahasa Indonesia yang formal. Maksimal 300 kata. Tidak perlu kalimat penutup yang memotivasi."
    )

# ── GET saved member report ───────────────────────────────────────────────────
@app.get("/ai/reports/member")
async def get_member_report(name: str, period: str = "monthly", month: str = "", current_user: dict = Depends(get_current_user)):
    role = current_user.get("role")
    if role not in ["admin", "pm"] and current_user.get("full_name") != name:
        raise HTTPException(status_code=403, detail="Forbidden")
    date_key = _current_date_key(period, month)
    docs = await db.ai_reports.find({"type": "member", "target": name, "period": period, "date_key": date_key}).sort("created_at", -1).limit(1).to_list(1)
    doc = docs[0] if docs else None
    return {"report": _fmt_report(doc) if doc else None}

# ── POST generate + save member report (admin only) ───────────────────────────
@app.post("/ai/reports/member/generate")
async def generate_member_report(name: str, period: str = "monthly", month: str = "", current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Hanya admin yang dapat membuat laporan AI.")
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI tidak dikonfigurasi.")
    try:
        tasks, period_orders, period_label = await _fetch_member_data(name, period, month)
        prompt = _member_prompt(name, tasks, period_orders, period_label)
        text = await _asyncio.get_event_loop().run_in_executor(None, _call_ai, prompt, 900)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")
    date_key = _current_date_key(period, month)
    now = datetime.now(timezone.utc).isoformat()
    doc = {"type": "member", "target": name, "period": period, "date_key": date_key,
           "content": text, "is_auto": False, "generated_by": current_user.get("username", "admin"),
           "created_at": now, "updated_at": now}
    await db.ai_reports.insert_one(doc)
    _period_id = {"daily": "harian", "weekly": "mingguan", "monthly": "bulanan"}
    try:
        _notif_msg = f"Laporan performa {_period_id.get(period, period)} Anda telah diperbarui oleh admin."
        await db.user_notifications.insert_one({
            "recipient_name": name, "period": period, "date_key": date_key, "read": False,
            "message": _notif_msg,
            "created_at": now,
        })
        _asyncio.get_event_loop().create_task(_fcm_by_full_name(
            name, "📊 Laporan Performa", _notif_msg, {"type": "performance_report"}
        ))
    except Exception:
        pass
    return {"report": _fmt_report(doc)}

# ── GET saved overall report ──────────────────────────────────────────────────
@app.get("/ai/reports/overall")
async def get_overall_report(period: str = "monthly", month: str = "", current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "pm"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    date_key = _current_date_key(period, month)
    docs = await db.ai_reports.find({"type": "overall", "period": period, "date_key": date_key}).sort("created_at", -1).limit(1).to_list(1)
    doc = docs[0] if docs else None
    return {"report": _fmt_report(doc) if doc else None}

# ── POST generate + save overall report (admin only) ─────────────────────────
@app.post("/ai/reports/overall/generate")
async def generate_overall_report(period: str = "monthly", month: str = "", current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Hanya admin yang dapat membuat laporan AI.")
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI tidak dikonfigurasi.")
    try:
        tasks, period_orders, period_label = await _fetch_overall_data(period, month)
        prompt = _overall_prompt(tasks, period_orders, period_label)
        text = await _asyncio.get_event_loop().run_in_executor(None, _call_ai, prompt, 1100)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")
    date_key = _current_date_key(period, month)
    now = datetime.now(timezone.utc).isoformat()
    doc = {"type": "overall", "target": "overall", "period": period, "date_key": date_key,
           "content": text, "is_auto": False, "generated_by": current_user.get("username", "admin"),
           "created_at": now, "updated_at": now}
    await db.ai_reports.insert_one(doc)
    return {"report": _fmt_report(doc)}

# ── PUT edit report content (admin only) ─────────────────────────────────────
class UpdateReportBody(BaseModel):
    content: str

@app.put("/ai/reports/{report_id}")
async def update_ai_report(report_id: str, body: UpdateReportBody, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Hanya admin yang dapat mengedit laporan.")
    now = datetime.now(timezone.utc).isoformat()
    result = await db.ai_reports.find_one_and_update(
        {"_id": ObjectId(report_id)},
        {"$set": {"content": body.content, "updated_at": now}},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan.")
    return {"report": _fmt_report(result)}

# ── DELETE report (admin only) ────────────────────────────────────────────────
@app.delete("/ai/reports/{report_id}")
async def delete_ai_report(report_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Hanya admin yang dapat menghapus laporan.")
    result = await db.ai_reports.delete_one({"_id": ObjectId(report_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan.")
    return {"ok": True}

# ── GET report history ───────────────────────────────────────────────────────
@app.get("/ai/reports/history")
async def get_report_history(
    type: str = "overall",
    target: Optional[str] = None,
    period: Optional[str] = None,
    limit: int = 30,
    current_user: dict = Depends(get_current_user),
):
    role = current_user.get("role")
    query: Dict[str, Any] = {"type": type}
    if type == "member":
        if not target:
            target = current_user.get("full_name", "")
        if role not in ["admin", "pm"] and current_user.get("full_name") != target:
            raise HTTPException(status_code=403, detail="Forbidden")
        query["target"] = target
    if period:
        query["period"] = period
    docs = await db.ai_reports.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    return {"reports": [_fmt_report(d) for d in docs]}

# ── AI prompt with daily report context ──────────────────────────────────────
def _member_prompt_with_daily_report(name: str, tasks: list, period_orders: list, period_label: str, daily_report: dict) -> str:
    done = sum(1 for t in tasks if t.get("status") == "done")
    failed = sum(1 for t in tasks if t.get("status") == "failed")
    in_progress = sum(1 for t in tasks if t.get("status") == "in progress")
    in_revision = sum(1 for t in tasks if t.get("status") == "in_revision")
    total_time = sum(t.get("time_elapsed", 0) for t in tasks)
    project_names = ", ".join([o.get("project", "") for o in period_orders[:5] if o.get("project")])
    dr_lines = ""
    if daily_report.get("work_done"):
        dr_lines += f"- Pekerjaan dilaporkan: {daily_report['work_done']}\n"
    if daily_report.get("feelings"):
        dr_lines += f"- Kondisi/perasaan: {daily_report['feelings']}\n"
    if daily_report.get("obstacles"):
        dr_lines += f"- Kendala: {daily_report['obstacles']}\n"
    if daily_report.get("notes"):
        dr_lines += f"- Catatan: {daily_report['notes']}\n"
    return (
        "Anda adalah analis performa profesional untuk Magsika Studio, sebuah studio kreatif 3D/2D. "
        "Tugas Anda adalah menulis evaluasi performa yang OBJEKTIF dan BERBASIS DATA — bukan untuk menyemangati atau memanjakan anggota tim. "
        "Jangan beri pujian yang tidak didukung data. Jika ada kekurangan atau kendala, ungkapkan dengan jelas dan langsung.\n\n"
        f"Data Performa: {name} | Periode: {period_label}\n"
        f"- Total task: {len(tasks)} (selesai: {done}, gagal: {failed}, sedang berjalan: {in_progress}, revisi: {in_revision})\n"
        f"- Akumulasi waktu kerja: {total_time // 3600} jam {(total_time % 3600) // 60} menit\n"
        f"- Jumlah order dikerjakan: {len(period_orders)}\n"
        f"- Project yang dikerjakan: {project_names or 'belum ada data'}\n\n"
        + (f"Laporan Harian dari {name}:\n{dr_lines}\n" if dr_lines else "")
        + "Jangan tulis baris header laporan, nama anggota tim, atau periode di awal output. "
        "Mulai langsung dengan section pertama berikut.\n\n"
        "Tulis laporan dengan struktur berikut (gunakan persis heading ini):\n\n"
        "**Ringkasan Eksekutif**\n"
        "Gambaran kinerja hari ini berdasarkan angka dan laporan harian (2-3 kalimat, bukan kesan umum).\n\n"
        "**Analisis Kinerja**\n"
        "Evaluasi pencapaian berdasarkan data dan laporan. Sebutkan angka secara eksplisit. Jika ada kendala yang dilaporkan, analisis dampaknya terhadap produktivitas.\n\n"
        "**Area yang Perlu Ditingkatkan**\n"
        "Identifikasi kelemahan atau hambatan secara spesifik dari data dan laporan harian. Jangan tulis 'Tidak ada catatan khusus' jika ada kendala yang dilaporkan atau task gagal.\n\n"
        "**Rekomendasi**\n"
        "1-2 tindakan konkret untuk hari berikutnya. Harus relevan dengan kendala atau kekurangan yang ditemukan.\n\n"
        "Gunakan bahasa Indonesia yang formal. Maksimal 250 kata. Tidak perlu kalimat penutup yang memotivasi."
    )

# ── Trigger AI after daily report submission ──────────────────────────────────
async def _generate_daily_ai_after_report(full_name: str, daily_report_doc: dict):
    if not ANTHROPIC_API_KEY:
        return
    from datetime import timedelta
    now_wib = datetime.now(timezone.utc) + timedelta(hours=7)
    date_key = now_wib.strftime("%Y-%m-%d")
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        tasks, period_orders, period_label = await _fetch_member_data(full_name, "daily", "")
        prompt = _member_prompt_with_daily_report(full_name, tasks, period_orders, period_label, daily_report_doc)
        text = await _asyncio.get_event_loop().run_in_executor(None, _call_ai, prompt, 950)
        await db.ai_reports.replace_one(
            {"type": "member", "target": full_name, "period": "daily", "date_key": date_key},
            {"type": "member", "target": full_name, "period": "daily", "date_key": date_key,
             "content": text, "is_auto": True, "generated_by": "system",
             "created_at": now_iso, "updated_at": now_iso},
            upsert=True
        )
        try:
            msg = "Laporan analisis performa harian Anda telah tersedia."
            await db.user_notifications.insert_one({
                "recipient_name": full_name, "period": "daily", "date_key": date_key, "read": False,
                "message": msg, "created_at": now_iso,
            })
            _asyncio.get_event_loop().create_task(_fcm_by_full_name(
                full_name, "📊 Laporan Performa Harian", msg, {"type": "performance_report"}
            ))
        except Exception:
            pass
    except Exception:
        pass

# ── Auto-generate daily overall report at 17:00 WIB ──────────────────────────
# Member daily AI reports are now triggered when the user submits their daily report
async def auto_daily_ai_reports():
    if not ANTHROPIC_API_KEY:
        return
    from datetime import timedelta
    now_wib = datetime.now(timezone.utc) + timedelta(hours=7)
    date_key = now_wib.strftime("%Y-%m-%d")
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        existing_overall = await db.ai_reports.find_one({"type": "overall", "period": "daily", "date_key": date_key})
        if not existing_overall:
            tasks, period_orders, period_label = await _fetch_overall_data("daily", "")
            prompt = _overall_prompt(tasks, period_orders, period_label)
            text = await _asyncio.get_event_loop().run_in_executor(None, _call_ai, prompt, 1100)
            await db.ai_reports.replace_one(
                {"type": "overall", "period": "daily", "date_key": date_key},
                {"type": "overall", "target": "overall", "period": "daily", "date_key": date_key,
                 "content": text, "is_auto": True, "generated_by": "system",
                 "created_at": now_iso, "updated_at": now_iso},
                upsert=True
            )
    except Exception:
        pass

# ── Auto-generate weekly AI reports — every Friday 12:00 WIB ─────────────────
async def auto_weekly_ai_reports():
    if not ANTHROPIC_API_KEY:
        return
    from datetime import timedelta
    now_wib = datetime.now(timezone.utc) + timedelta(hours=7)
    date_key = now_wib.strftime("%Y-%m-%d")
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        tasks_week = await db.tasks.find({"date": {"$gte": (now_wib - timedelta(days=6)).strftime("%Y-%m-%d"), "$lte": date_key}}).to_list(2000)
        artist_names = list({t.get("assignee") for t in tasks_week if t.get("assignee")})
        for name in artist_names:
            existing = await db.ai_reports.find_one({"type": "member", "target": name, "period": "weekly", "date_key": date_key})
            if existing:
                continue
            try:
                tasks, period_orders, period_label = await _fetch_member_data(name, "weekly", "")
                prompt = _member_prompt(name, tasks, period_orders, period_label)
                text = await _asyncio.get_event_loop().run_in_executor(None, _call_ai, prompt, 900)
                await db.ai_reports.replace_one(
                    {"type": "member", "target": name, "period": "weekly", "date_key": date_key},
                    {"type": "member", "target": name, "period": "weekly", "date_key": date_key,
                     "content": text, "is_auto": True, "generated_by": "system",
                     "created_at": now_iso, "updated_at": now_iso},
                    upsert=True
                )
                try:
                    _asyncio.get_event_loop().create_task(_fcm_by_full_name(
                        name, "📊 Laporan Mingguan", "Laporan analisis performa mingguan Anda telah tersedia.", {"type": "performance_report"}
                    ))
                except Exception:
                    pass
            except Exception:
                pass
        existing_overall = await db.ai_reports.find_one({"type": "overall", "period": "weekly", "date_key": date_key})
        if not existing_overall:
            try:
                tasks, period_orders, period_label = await _fetch_overall_data("weekly", "")
                prompt = _overall_prompt(tasks, period_orders, period_label)
                text = await _asyncio.get_event_loop().run_in_executor(None, _call_ai, prompt, 1100)
                await db.ai_reports.replace_one(
                    {"type": "overall", "period": "weekly", "date_key": date_key},
                    {"type": "overall", "target": "overall", "period": "weekly", "date_key": date_key,
                     "content": text, "is_auto": True, "generated_by": "system",
                     "created_at": now_iso, "updated_at": now_iso},
                    upsert=True
                )
            except Exception:
                pass
    except Exception:
        pass

# ── Auto-generate monthly AI reports — every 27th at 12:00 WIB ───────────────
async def auto_monthly_ai_reports():
    if not ANTHROPIC_API_KEY:
        return
    from datetime import timedelta
    now_wib = datetime.now(timezone.utc) + timedelta(hours=7)
    month = now_wib.strftime("%Y-%m")
    date_key = now_wib.strftime("%Y-%m-%d")
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        tasks_month = await db.tasks.find({"date": {"$regex": f"^{month}"}}).to_list(2000)
        artist_names = list({t.get("assignee") for t in tasks_month if t.get("assignee")})
        for name in artist_names:
            existing = await db.ai_reports.find_one({"type": "member", "target": name, "period": "monthly", "date_key": month})
            if existing:
                continue
            try:
                tasks, period_orders, period_label = await _fetch_member_data(name, "monthly", month)
                prompt = _member_prompt(name, tasks, period_orders, period_label)
                text = await _asyncio.get_event_loop().run_in_executor(None, _call_ai, prompt, 900)
                await db.ai_reports.replace_one(
                    {"type": "member", "target": name, "period": "monthly", "date_key": month},
                    {"type": "member", "target": name, "period": "monthly", "date_key": month,
                     "content": text, "is_auto": True, "generated_by": "system",
                     "created_at": now_iso, "updated_at": now_iso},
                    upsert=True
                )
                try:
                    _asyncio.get_event_loop().create_task(_fcm_by_full_name(
                        name, "📊 Laporan Bulanan", f"Laporan analisis performa bulanan {month} Anda telah tersedia.", {"type": "performance_report"}
                    ))
                except Exception:
                    pass
            except Exception:
                pass
        existing_overall = await db.ai_reports.find_one({"type": "overall", "period": "monthly", "date_key": month})
        if not existing_overall:
            try:
                tasks, period_orders, period_label = await _fetch_overall_data("monthly", month)
                prompt = _overall_prompt(tasks, period_orders, period_label)
                text = await _asyncio.get_event_loop().run_in_executor(None, _call_ai, prompt, 1100)
                await db.ai_reports.replace_one(
                    {"type": "overall", "period": "monthly", "date_key": month},
                    {"type": "overall", "target": "overall", "period": "monthly", "date_key": month,
                     "content": text, "is_auto": True, "generated_by": "system",
                     "created_at": now_iso, "updated_at": now_iso},
                    upsert=True
                )
            except Exception:
                pass
    except Exception:
        pass

@app.get("/ai/insight/member")
async def ai_member_insight(name: str, month: str, period: str = "monthly", current_user: dict = Depends(get_current_user)):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI tidak dikonfigurasi. Set ANTHROPIC_API_KEY di environment.")

    from datetime import timedelta
    now_wib = datetime.now(timezone.utc) + timedelta(hours=7)
    today_str = now_wib.strftime("%Y-%m-%d")
    week_ago_str = (now_wib - timedelta(days=6)).strftime("%Y-%m-%d")

    try:
        if period == "daily":
            tasks = await db.tasks.find({"assignee": name, "date": {"$regex": f"^{today_str}"}}).to_list(300)
            all_orders = await db.orders.find({"artists": name}).to_list(200)
            period_orders = [o for o in all_orders if (o.get("order_date") or o.get("created_at", "")[:10] or "") == today_str]
            period_label = f"Hari ini ({today_str})"
        elif period == "weekly":
            tasks = await db.tasks.find({"assignee": name, "date": {"$gte": week_ago_str, "$lte": today_str}}).to_list(500)
            all_orders = await db.orders.find({"artists": name}).to_list(200)
            period_orders = [o for o in all_orders if week_ago_str <= (o.get("order_date") or o.get("created_at", "")[:10] or "") <= today_str]
            period_label = f"Minggu ini ({week_ago_str} s.d. {today_str})"
        else:
            tasks = await db.tasks.find({"assignee": name, "date": {"$regex": f"^{month}"}}).to_list(300)
            all_orders = await db.orders.find({"artists": name}).to_list(100)
            period_orders = [o for o in all_orders if (o.get("order_date") or o.get("created_at", "")[:10] or "").startswith(month)]
            period_label = f"Bulan {month}"
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    done = sum(1 for t in tasks if t.get("status") == "done")
    failed = sum(1 for t in tasks if t.get("status") == "failed")
    in_progress = sum(1 for t in tasks if t.get("status") == "in progress")
    in_revision = sum(1 for t in tasks if t.get("status") == "in_revision")
    total_time = sum(t.get("time_elapsed", 0) for t in tasks)
    hours = total_time // 3600
    minutes = (total_time % 3600) // 60
    project_names = ", ".join([o.get("project", "") for o in period_orders[:5] if o.get("project")])

    prompt = (
        "Anda adalah analis performa profesional untuk Magsika Studio, sebuah studio kreatif 3D/2D. "
        "Tulis laporan analisis performa anggota tim dalam bahasa Indonesia yang formal, terstruktur, dan berbasis data.\n\n"
        f"Data Performa: {name} | Periode: {period_label}\n"
        f"- Total task: {len(tasks)} (selesai: {done}, gagal: {failed}, sedang berjalan: {in_progress}, revisi: {in_revision})\n"
        f"- Akumulasi waktu kerja: {hours} jam {minutes} menit\n"
        f"- Jumlah order dikerjakan: {len(period_orders)}\n"
        f"- Project yang dikerjakan: {project_names or 'belum ada data'}\n\n"
        "Tulis laporan dengan struktur berikut (gunakan persis heading ini):\n\n"
        "**Ringkasan Eksekutif**\n"
        "Gambaran umum kinerja secara keseluruhan (2-3 kalimat).\n\n"
        "**Analisis Kinerja**\n"
        "Evaluasi pencapaian berdasarkan data yang tersedia.\n\n"
        "**Area yang Perlu Ditingkatkan**\n"
        "Identifikasi kelemahan atau hambatan berdasarkan data (tulis 'Tidak ada catatan khusus' jika kinerja baik).\n\n"
        "**Rekomendasi**\n"
        "1-2 rekomendasi konkret dan terukur untuk periode berikutnya.\n\n"
        "Gunakan bahasa Indonesia yang formal dan profesional. Maksimal 220 kata."
    )
    try:
        text = await _asyncio.get_event_loop().run_in_executor(None, _call_ai, prompt, 900)
        return {"insight": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")


@app.get("/ai/insight/overall")
async def ai_overall_insight(month: str, period: str = "monthly", current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "pm"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI tidak dikonfigurasi. Set ANTHROPIC_API_KEY di environment.")

    from datetime import timedelta
    now_wib = datetime.now(timezone.utc) + timedelta(hours=7)
    today_str = now_wib.strftime("%Y-%m-%d")
    week_ago_str = (now_wib - timedelta(days=6)).strftime("%Y-%m-%d")

    try:
        all_orders_db = await db.orders.find().to_list(500)
        if period == "daily":
            period_orders = [o for o in all_orders_db if (o.get("order_date") or o.get("created_at", "")[:10] or "") == today_str]
            tasks = await db.tasks.find({"date": {"$regex": f"^{today_str}"}}).to_list(1000)
            period_label = f"Hari ini ({today_str})"
        elif period == "weekly":
            period_orders = [o for o in all_orders_db if week_ago_str <= (o.get("order_date") or o.get("created_at", "")[:10] or "") <= today_str]
            tasks = await db.tasks.find({"date": {"$gte": week_ago_str, "$lte": today_str}}).to_list(1000)
            period_label = f"Minggu ini ({week_ago_str} s.d. {today_str})"
        else:
            period_orders = [o for o in all_orders_db if (o.get("order_date") or o.get("created_at", "")[:10] or "").startswith(month)]
            tasks = await db.tasks.find({"date": {"$regex": f"^{month}"}}).to_list(1000)
            period_label = f"Bulan {month}"
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    done_orders = sum(1 for o in period_orders if (o.get("status") or "").lower() == "done")
    active_orders = sum(1 for o in period_orders if (o.get("status") or "").lower() not in ["done", "cancel"])
    total_revenue = sum(o.get("total", 0) for o in period_orders)
    done_tasks = sum(1 for t in tasks if t.get("status") == "done")
    failed_tasks = sum(1 for t in tasks if t.get("status") == "failed")

    artist_map: dict = {}
    for t in tasks:
        a = t.get("assignee", "")
        if not a:
            continue
        if a not in artist_map:
            artist_map[a] = {"tasks": 0, "done": 0, "time": 0}
        artist_map[a]["tasks"] += 1
        artist_map[a]["time"] += t.get("time_elapsed", 0)
        if t.get("status") == "done":
            artist_map[a]["done"] += 1

    artist_lines = "\n".join([
        f"- {a}: {v['done']}/{v['tasks']} task, {v['time']//3600}j kerja"
        for a, v in sorted(artist_map.items(), key=lambda x: -x[1]["done"])
    ])

    prompt = (
        "Anda adalah analis manajemen senior untuk Magsika Studio (studio kreatif 3D/2D). "
        "Tulis laporan analisis performa tim dalam bahasa Indonesia yang formal dan komprehensif untuk pimpinan studio.\n\n"
        f"Data Tim — Periode: {period_label}\n"
        f"- Order: {len(period_orders)} masuk, {done_orders} selesai, {active_orders} aktif\n"
        f"- Estimasi Revenue: Rp {total_revenue:,.0f}\n"
        f"- Task: {len(tasks)} total, {done_tasks} selesai, {failed_tasks} gagal\n\n"
        f"Rincian per Anggota Tim:\n{artist_lines or 'Belum ada data'}\n\n"
        "Tulis laporan dengan struktur berikut (gunakan persis heading ini):\n\n"
        "**Ringkasan Eksekutif**\n"
        "Kondisi umum tim pada periode ini (2-3 kalimat).\n\n"
        "**Pencapaian Tim**\n"
        "Highlight kinerja terbaik dan pencapaian signifikan.\n\n"
        "**Analisis Per Anggota**\n"
        "Evaluasi singkat kontribusi masing-masing anggota berdasarkan data.\n\n"
        "**Area Perhatian**\n"
        "Risiko atau tantangan yang perlu diantisipasi.\n\n"
        "**Rekomendasi Strategis**\n"
        "2-3 rekomendasi konkret untuk periode berikutnya.\n\n"
        "Gunakan bahasa Indonesia yang formal dan profesional. Maksimal 300 kata."
    )
    try:
        text = await _asyncio.get_event_loop().run_in_executor(None, _call_ai, prompt, 1100)
        return {"insight": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")


# ── Daily Reports ─────────────────────────────────────────────────────────────

class DailyReportBody(BaseModel):
    work_done: str = ""
    feelings: str = ""
    obstacles: str = ""
    notes: str = ""

def _validate_daily_report(body) -> None:
    MIN = 100
    errors = []
    if len(body.work_done.strip()) < MIN:
        errors.append(f"Pekerjaan minimal {MIN} karakter (saat ini {len(body.work_done.strip())})")
    if len(body.obstacles.strip()) < MIN:
        errors.append(f"Kendala minimal {MIN} karakter (saat ini {len(body.obstacles.strip())})")
    if len(body.notes.strip()) < MIN:
        errors.append(f"Note minimal {MIN} karakter (saat ini {len(body.notes.strip())})")
    if not body.feelings.strip():
        errors.append("Perasaan harus dipilih")
    if errors:
        raise HTTPException(status_code=422, detail="; ".join(errors))

def _fmt_daily_report(doc: dict) -> dict:
    d = {k: v for k, v in doc.items() if k != "_id"}
    d["id"] = str(doc["_id"])
    return d

@app.post("/daily-reports")
async def submit_daily_report(body: DailyReportBody, current_user: dict = Depends(get_current_user)):
    _validate_daily_report(body)
    from datetime import timedelta
    now_wib = datetime.now(timezone.utc) + timedelta(hours=7)
    date_key = now_wib.strftime("%Y-%m-%d")
    now_iso = datetime.now(timezone.utc).isoformat()
    username = current_user.get("username", "")
    full_name = current_user.get("full_name", username)
    doc = {
        "username": username,
        "full_name": full_name,
        "date": date_key,
        "work_done": body.work_done,
        "feelings": body.feelings,
        "obstacles": body.obstacles,
        "notes": body.notes,
        "updated_at": now_iso,
    }
    existing = await db.daily_reports.find_one({"username": username, "date": date_key})
    if existing:
        await db.daily_reports.update_one({"_id": existing["_id"]}, {"$set": doc})
        doc["created_at"] = existing.get("created_at", now_iso)
        result = await db.daily_reports.find_one({"_id": existing["_id"]})
    else:
        doc["created_at"] = now_iso
        ins = await db.daily_reports.insert_one(doc)
        result = await db.daily_reports.find_one({"_id": ins.inserted_id})
    # Trigger AI daily report generation in background using the report content
    _asyncio.get_event_loop().create_task(_generate_daily_ai_after_report(full_name, doc))
    return {"report": _fmt_daily_report(result)}

@app.get("/daily-reports/today-status")
async def get_today_daily_status(current_user: dict = Depends(get_current_user)):
    from datetime import timedelta
    now_wib = datetime.now(timezone.utc) + timedelta(hours=7)
    date_key = now_wib.strftime("%Y-%m-%d")
    username = current_user.get("username", "")
    doc = await db.daily_reports.find_one({"username": username, "date": date_key})
    return {"submitted": doc is not None, "date": date_key}

@app.get("/daily-reports")
async def list_daily_reports(
    date: Optional[str] = None,
    talent_name: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    role = current_user.get("role")
    query: Dict[str, Any] = {}
    if role == "talent":
        query["username"] = current_user.get("username", "")
    else:
        if talent_name:
            query["full_name"] = talent_name
    if date:
        query["date"] = date
    docs = await db.daily_reports.find(query).sort("date", -1).limit(100).to_list(100)
    return {"reports": [_fmt_daily_report(d) for d in docs]}

class UpdateDailyReportBody(BaseModel):
    work_done: str = ""
    feelings: str = ""
    obstacles: str = ""
    notes: str = ""

@app.put("/daily-reports/{report_id}")
async def update_daily_report(report_id: str, body: UpdateDailyReportBody, current_user: dict = Depends(get_current_user)):
    from bson import ObjectId
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid report ID")
    doc = await db.daily_reports.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Report tidak ditemukan")
    role = current_user.get("role")
    username = current_user.get("username", "")
    if role not in ["admin", "pm"] and doc.get("username") != username:
        raise HTTPException(status_code=403, detail="Forbidden")
    _validate_daily_report(body)
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.daily_reports.update_one({"_id": oid}, {"$set": {
        "work_done": body.work_done, "feelings": body.feelings,
        "obstacles": body.obstacles, "notes": body.notes, "updated_at": now_iso,
    }})
    result = await db.daily_reports.find_one({"_id": oid})
    return {"report": _fmt_daily_report(result)}

@app.delete("/daily-reports/{report_id}")
async def delete_daily_report(report_id: str, current_user: dict = Depends(get_current_user)):
    from bson import ObjectId
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid report ID")
    doc = await db.daily_reports.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Report tidak ditemukan")
    role = current_user.get("role")
    username = current_user.get("username", "")
    if role not in ["admin", "pm"] and doc.get("username") != username:
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.daily_reports.delete_one({"_id": oid})
    return {"ok": True}

async def notify_unsubmitted_daily_reports():
    from datetime import timedelta
    now_wib = datetime.now(timezone.utc) + timedelta(hours=7)
    date_key = now_wib.strftime("%Y-%m-%d")
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        talent_users = await db.users.find({"role": "talent"}).to_list(200)
        for u in talent_users:
            username = u.get("username", "")
            full_name = u.get("full_name", username)
            submitted = await db.daily_reports.find_one({"username": username, "date": date_key})
            if not submitted:
                try:
                    await db.user_notifications.insert_one({
                        "username": username,
                        "title": "⚠️ Daily Report Belum Disubmit",
                        "message": f"Kamu belum mengisi daily report hari ini ({date_key}). Isi sebelum pukul 17.00 WIB.",
                        "type": "daily_report_reminder",
                        "is_read": False,
                        "created_at": now_iso,
                    })
                except Exception:
                    pass
                try:
                    _asyncio.get_event_loop().create_task(_fcm_by_full_name(
                        full_name,
                        "📋 Daily Report Belum Diisi",
                        "Kamu belum mengisi daily report hari ini. Isi sekarang!",
                        {"type": "daily_report_reminder"},
                    ))
                except Exception:
                    pass
    except Exception:
        pass
