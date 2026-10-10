from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone
import requests


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Data models intentionally use string IDs so Mongo's ObjectId never crosses the API boundary.
class ChecklistItem(BaseModel):
    label: str
    checked: bool = False

class PhotoItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: Literal["intake", "repair", "delivery"]
    data: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ServiceOrderCreate(BaseModel):
    client_name: str
    client_email: Optional[str] = ""
    client_phone: str
    device_type: Literal["Celular", "Notebook"]
    device_model: str
    defect_description: str
    checklist: List[ChecklistItem] = []
    labor_cost: float = 0
    parts_cost: float = 0
    total_price: float = 0
    technician_name: str = "Equipe TecFlow"

class ServiceOrderUpdate(BaseModel):
    status: Optional[Literal["Recebido", "Em análise", "Em reparo", "Pronto", "Entregue"]] = None
    checklist: Optional[List[ChecklistItem]] = None
    notes: Optional[str] = None
    labor_cost: Optional[float] = None
    parts_cost: Optional[float] = None
    total_price: Optional[float] = None

class ServiceOrder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    tracking_code: str
    client_name: str
    client_email: str = ""
    client_phone: str
    device_type: str
    device_model: str
    defect_description: str
    checklist: List[ChecklistItem] = []
    photos: List[PhotoItem] = []
    labor_cost: float = 0
    parts_cost: float = 0
    total_price: float = 0
    profit: float = 0
    notes: str = ""
    status: str = "Recebido"
    technician_name: str = "Equipe TecFlow"
    created_at: str
    updated_at: str

class MessageCreate(BaseModel):
    sender: Literal["Técnico", "Cliente"]
    text: str

class Message(BaseModel):
    id: str
    sender: str
    text: str
    sent_at: str

class DeviceTokenCreate(BaseModel):
    token: str
    role: Literal["technician", "client"]
    tracking_code: Optional[str] = None

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

async def get_order(order_id: str) -> dict:
    order = await db.service_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Ordem de serviço não encontrada")
    return order

async def send_push(tokens: List[str], title: str, body: str):
    if not tokens:
        return
    payload = [{"to": token, "sound": "default", "title": title, "body": body} for token in tokens]
    try:
        requests.post("https://exp.host/--/api/v2/push/send", json=payload, timeout=5)
    except requests.RequestException:
        logger.warning("Push notification could not be delivered")

@api_router.get("/")
async def root():
    return {"message": "TecFlow OS API", "status": "online"}

@api_router.get("/orders", response_model=List[ServiceOrder])
async def list_orders():
    orders = await db.service_orders.find({}, {"_id": 0}).sort("updated_at", -1).to_list(100)
    return orders

@api_router.post("/orders", response_model=ServiceOrder)
async def create_order(input: ServiceOrderCreate):
    created = now_iso()
    order = {
        "id": str(uuid.uuid4()),
        "tracking_code": f"TF-{uuid.uuid4().hex[:6].upper()}",
        **input.model_dump(),
        "photos": [],
        "profit": round(input.total_price - input.parts_cost, 2),
        "notes": "",
        "status": "Recebido",
        "created_at": created,
        "updated_at": created,
    }
    response_order = {key: value for key, value in order.items()}
    await db.service_orders.insert_one(order)
    return response_order

@api_router.get("/orders/{order_id}", response_model=ServiceOrder)
async def read_order(order_id: str):
    return await get_order(order_id)

@api_router.patch("/orders/{order_id}", response_model=ServiceOrder)
async def update_order(order_id: str, input: ServiceOrderUpdate):
    current = await get_order(order_id)
    changes = {key: value for key, value in input.model_dump().items() if value is not None}
    if "checklist" in changes:
        changes["checklist"] = [item.model_dump() for item in input.checklist or []]
    labor = changes.get("labor_cost", current.get("labor_cost", 0))
    parts = changes.get("parts_cost", current.get("parts_cost", 0))
    total = changes.get("total_price", current.get("total_price", 0))
    changes["profit"] = round(total - parts, 2)
    changes["updated_at"] = now_iso()
    await db.service_orders.update_one({"id": order_id}, {"$set": changes})
    updated = await get_order(order_id)
    if input.status and input.status != current.get("status"):
        tokens = await db.device_tokens.find({"tracking_code": current.get("tracking_code")}, {"_id": 0, "token": 1}).to_list(100)
        await send_push([item["token"] for item in tokens], "Atualização da sua OS", f"Status: {input.status}")
    return updated

@api_router.post("/orders/{order_id}/photos", response_model=ServiceOrder)
async def add_photo(order_id: str, photo: PhotoItem):
    await get_order(order_id)
    await db.service_orders.update_one({"id": order_id}, {"$push": {"photos": photo.model_dump()}, "$set": {"updated_at": now_iso()}})
    return await get_order(order_id)

@api_router.get("/tracking/{tracking_code}", response_model=ServiceOrder)
async def public_tracking(tracking_code: str):
    order = await db.service_orders.find_one({"tracking_code": tracking_code.upper()}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Código de acompanhamento inválido")
    order["profit"] = 0
    order["parts_cost"] = 0
    return order

@api_router.get("/orders/{order_id}/messages", response_model=List[Message])
async def list_messages(order_id: str):
    await get_order(order_id)
    return await db.messages.find({"order_id": order_id}, {"_id": 0, "order_id": 0}).sort("sent_at", 1).to_list(200)

@api_router.post("/orders/{order_id}/messages", response_model=Message)
async def add_message(order_id: str, input: MessageCreate):
    await get_order(order_id)
    message = {"id": str(uuid.uuid4()), "order_id": order_id, **input.model_dump(), "sent_at": now_iso()}
    await db.messages.insert_one(message)
    return {key: value for key, value in message.items() if key != "order_id"}

@api_router.post("/device-tokens")
async def register_device_token(input: DeviceTokenCreate):
    await db.device_tokens.update_one({"token": input.token}, {"$set": input.model_dump()}, upsert=True)
    return {"registered": True}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
