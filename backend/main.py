import os
from datetime import datetime, timezone
from typing import List, Optional

try:
    import certifi
except ImportError:
    certifi = None
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field

from auth import create_access_token, decode_token, oauth2_scheme

load_dotenv()

BACKEND_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "admin_dashboard")
SECRET_KEY = os.getenv("SECRET_KEY", "changeme")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

client_kwargs = {
    "serverSelectionTimeoutMS": 2000,
    "connectTimeoutMS": 2000,
}
if MONGO_URI.startswith("mongodb+") and certifi is not None:
    client_kwargs["tlsCAFile"] = certifi.where()

client = AsyncIOMotorClient(MONGO_URI, **client_kwargs)
db = client[DB_NAME]

mock_orders = [
    {
        "id": "ord-001",
        "client": "PT Magsika",
        "project": "Website Landing Page",
        "status": "done",
        "total": 12500,
        "deadline": "2025-06-22",
        "created_at": "2025-06-10",
        "artists": ["Alice"],
        "platform": "Direct",
        "market": "Magsika",
        "order_id": "FVR-8821",
        "work_type": "Modeling",
        "payment_status": "Lunas",
        "folder_code": "260522-MGSK01-ALICE-WEB",
    },
    {
        "id": "ord-002",
        "client": "Eirene Studio",
        "project": "Brand Identity",
        "status": "in progress",
        "total": 8200,
        "deadline": "2025-06-27",
        "created_at": "2025-06-12",
        "artists": ["Bob"],
        "platform": "Fiverr",
        "market": "Eirene",
        "order_id": "FVR-8822",
        "work_type": "Design",
        "payment_status": "Belum Lunas",
        "folder_code": "260612-EIRE01-BOB-BRAND",
    },
    {
        "id": "ord-003",
        "client": "Lolicharm",
        "project": "Product Catalog",
        "status": "in progress",
        "total": 9400,
        "deadline": "2025-07-02",
        "created_at": "2025-06-15",
        "artists": ["Charlie"],
        "platform": "Direct",
        "market": "Magsika",
        "order_id": "FVR-8823",
        "work_type": "Modeling",
        "payment_status": "Belum Lunas",
        "folder_code": "260615-MGSK01-CHAR-CAT",
    },
    {
        "id": "ord-004",
        "client": "Direct Client",
        "project": "Campaign Assets",
        "status": "done",
        "total": 7200,
        "deadline": "2025-06-18",
        "created_at": "2025-06-07",
        "artists": ["Dana"],
        "platform": "Upwork",
        "market": "Magsika",
        "order_id": "FVR-8824",
        "work_type": "Illustration",
        "payment_status": "Lunas",
        "folder_code": "260607-MGSK01-DANA-CAMP",
    },
    {
        "id": "ord-005",
        "client": "Komunitas LTK",
        "project": "Social Media Kit",
        "status": "pending",
        "total": 4800,
        "deadline": "2025-07-10",
        "created_at": "2025-06-20",
        "artists": ["Alice"],
        "platform": "Fiverr",
        "market": "Eirene",
        "order_id": "FVR-8825",
        "work_type": "Graphics",
        "payment_status": "Belum Lunas",
        "folder_code": "260620-EIRE01-ALICE-SMK",
    },
    {
        "id": "ord-006",
        "client": "Studio Magsika",
        "project": "Ecommerce Design",
        "status": "in progress",
        "total": 15000,
        "deadline": "2025-06-30",
        "created_at": "2025-06-18",
        "artists": ["Bob"],
        "platform": "Direct",
        "market": "Magsika",
        "order_id": "FVR-8826",
        "work_type": "UI/UX",
        "payment_status": "Belum Lunas",
        "folder_code": "260618-MGSK01-BOB-ECOM",
    },
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
        "platform": record.get("platform", "Direct"),
        "market": record.get("market", "Magsika"),
        "order_id": record.get("order_id", ""),
        "work_type": record.get("work_type", "Modeling"),
        "payment_status": record.get("payment_status", "Belum Lunas"),
        "folder_code": record.get("folder_code", ""),
        "marketer": record.get("marketer", ""),
        "notes": record.get("notes", ""),
        "created_at": record.get("created_at"),
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


class OrderCreate(BaseModel):
    project: str
    client: str
    total: float
    status: str = Field(default="Pending")
    deadline: Optional[str] = None
    artists: Optional[List[str]] = []
    platform: Optional[str] = None
    market: Optional[str] = None
    order_id: Optional[str] = None
    work_type: Optional[str] = None
    payment_status: Optional[str] = Field(default="Belum Lunas")
    folder_code: Optional[str] = None
    marketer: Optional[str] = None
    notes: Optional[str] = None


class OrderUpdate(BaseModel):
    project: Optional[str] = None
    client: Optional[str] = None
    total: Optional[float] = None
    status: Optional[str] = None
    deadline: Optional[str] = None
    artists: Optional[List[str]] = None
    platform: Optional[str] = None
    market: Optional[str] = None
    order_id: Optional[str] = None
    work_type: Optional[str] = None
    payment_status: Optional[str] = None
    folder_code: Optional[str] = None
    marketer: Optional[str] = None
    notes: Optional[str] = None


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


class TaskBase(BaseModel):
    title: str
    assignee: str = "Unassigned"
    assignee_type: str = Field(default="tim")
    status: str = Field(default="pending")
    date: Optional[str] = None
    notes: Optional[str] = None
    order_id: Optional[str] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    assignee: Optional[str] = None
    assignee_type: Optional[str] = None
    status: Optional[str] = None
    date: Optional[str] = None
    notes: Optional[str] = None


app = FastAPI(title="Admin Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=BACKEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    try:
        user = await db.users.find_one({"username": username})
        if user and verify_password(password, user.get("hashed_password", "")):
            return user

        if (await db.users.count_documents({})) == 0:
            default_user = verify_default_admin(username, password)
            if default_user:
                await db.users.insert_one(default_user)
                return default_user
    except Exception:
        default_user = verify_default_admin(username, password)
        if default_user:
            return default_user

    return None


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    payload = decode_token(token)
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    try:
        user = await db.users.find_one({"username": username})
    except Exception:
        user = None
    if not user:
        if username == "admin":
            return {"username": DEFAULT_USER["username"], "full_name": DEFAULT_USER["full_name"], "email": DEFAULT_USER["email"], "role": DEFAULT_USER["role"], "status": DEFAULT_USER["status"]}
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return {"username": user["username"], "full_name": user["full_name"], "email": user["email"], "role": user.get("role", "admin"), "status": user.get("status", "active")}


@app.post("/auth/login")
async def login(req: LoginRequest):
    user = await authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token({"sub": user["username"]})
    return {"access_token": token, "token_type": "bearer", "user": {"username": user["username"], "full_name": user["full_name"], "email": user["email"], "role": user.get("role", "admin")}}


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
        return {"order": format_order({**payload, "_id": result.inserted_id})}
    except Exception:
        return {"order": format_order({**payload, "id": f"mock-{len(mock_orders) + 1}"})}


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
    payload = {k: v for k, v in order.dict().items() if v is not None}
    if not payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")
    object_id = to_object_id(order_id)
    try:
        await db.orders.update_one({"_id": object_id}, {"$set": payload})
        updated = await db.orders.find_one({"_id": object_id})
    except Exception:
        updated = None
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
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
async def list_tasks(date: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    try:
        query = {}
        if date:
            query["date"] = date
        records = await db.tasks.find(query).to_list(200)
        return {"tasks": [format_task(record) for record in records]}
    except Exception:
        return {"tasks": []}


@app.post("/tasks")
async def create_task(task: TaskCreate, current_user: dict = Depends(get_current_user)):
    payload = task.dict()
    try:
        result = await db.tasks.insert_one(payload)
        return {"task": format_task({**payload, "_id": result.inserted_id})}
    except Exception:
        return {"task": {**payload, "id": f"task-mock-{datetime.now(timezone.utc).timestamp()}"}}


@app.patch("/tasks/{task_id}")
async def update_task(task_id: str, task: TaskUpdate, current_user: dict = Depends(get_current_user)):
    payload = {k: v for k, v in task.dict().items() if v is not None}
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
