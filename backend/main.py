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
        await db.tasks.update_many(
            {"date": today, "status": {"$in": ["pending", "in progress"]}},
            {"$set": {"status": "failed", "timer_started": None}},
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
                "order_id": order_id_str if order_id_str else None,
                "title": t.get("title"),
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
    today = target_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
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
            existing = await db.tasks.find_one({"order_id": order_id_str, "assignee": artist_name, "date": today})
            if existing:
                skipped += 1
                continue
            # Count existing tasks for this assignee today to set order_num
            count = await db.tasks.count_documents({"assignee": artist_name, "date": today})
            await db.tasks.insert_one({
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
            })
            created += 1
    return {"created": created, "skipped": skipped}


@app.on_event("startup")
async def on_startup():
    if scheduler:
        scheduler.add_job(auto_generate_daily_tasks, CronTrigger(hour=0, minute=0, timezone="Asia/Jakarta"))
        scheduler.add_job(auto_fail_tasks, CronTrigger(hour=23, minute=59, timezone="Asia/Jakarta"))
        scheduler.add_job(carry_forward_tasks, CronTrigger(hour=0, minute=1, timezone="Asia/Jakarta"))
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
    return {"username": user["username"], "full_name": user["full_name"], "email": user["email"], "role": user.get("role", "admin"), "status": user.get("status", "active")}


@app.post("/auth/login")
async def login(req: LoginRequest):
    user = await authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Username atau password salah")
    if user.get("status") == "pending":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Akun menunggu persetujuan admin")
    token = create_access_token({"sub": user["username"]})
    return {"access_token": token, "token_type": "bearer", "user": {"username": user["username"], "full_name": user["full_name"], "email": user["email"], "role": user.get("role", "admin"), "status": user.get("status", "active")}}


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
    total_time = sum(v["time"] for v in amap.values())
    total_tasks = sum(v["tasks"] for v in amap.values())
    contribs = []
    for name, stats in amap.items():
        pct = round(stats["time"] / total_time * 100) if total_time > 0 else (round(stats["tasks"] / total_tasks * 100) if total_tasks > 0 else 0)
        contribs.append({"name": name, "type": stats["type"], "tasks": stats["tasks"], "done": stats["done"], "time": stats["time"], "percent": pct})
    contribs.sort(key=lambda x: x["time"], reverse=True)
    return {"contributions": contribs, "total_time": total_time, "total_tasks": total_tasks}


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
async def tasks_summary(month: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Agregasi task per bulan: per-artist dan per-order."""
    try:
        query = {"date": {"$regex": f"^{month}"}} if month else {}
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
                order_map[oid] = {"tasks": 0, "done": 0, "failed": 0, "time": 0, "assignees": []}
            order_map[oid]["tasks"] += 1
            if st == "done":   order_map[oid]["done"] += 1
            if st == "failed": order_map[oid]["failed"] += 1
            order_map[oid]["time"] += t.get("time_elapsed", 0) or 0
            if a not in order_map[oid]["assignees"]:
                order_map[oid]["assignees"].append(a)
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
                "role": current_user.get("role", "admin"),
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
    for field in ["full_name", "phone", "telegram", "gender", "birthdate", "birthplace", "position", "address", "bank_account"]:
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
                            channel_id="task-alert",
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
    try:
        await db.notifications.update_one({"_id": object_id}, {"$set": update})
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
