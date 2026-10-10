from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Response, Header, Depends, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timedelta, timezone
import asyncio
import hashlib
import hmac
import secrets
import time
import requests


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Emergent Object Storage (fotos das OS)
# ---------------------------------------------------------------------------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "hdtech"
storage_key: Optional[str] = None


def init_storage() -> str:
    """Idempotent — returns a reusable storage_key."""
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Upload (overwrites silently if path exists). Returns {"path","size","etag"}."""
    global storage_key
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    if resp.status_code == 503:
        # stale storage key — reset, re-init once and retry
        storage_key = None
        key = init_storage()
        resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    if resp.status_code == 402:
        raise HTTPException(status_code=402, detail="Créditos de armazenamento esgotados. Adicione créditos na Emergent.")
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple[bytes, str]:
    """Download. Returns (content_bytes, content_type)."""
    global storage_key
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 503:
        storage_key = None
        key = init_storage()
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------------------------------------------------------------------------
# Painel da equipe protegido por PIN (token temporário no MongoDB)
# ---------------------------------------------------------------------------
ADMIN_PIN = os.environ.get("ADMIN_PIN", "")
STORE_PIX_KEY = os.environ.get("STORE_PIX_KEY", "")
ADMIN_SESSION_HOURS = 12

_attempts: dict = {}
_attempts_lock = asyncio.Lock()


async def check_unlock_throttle(ip: str):
    now = time.time()
    async with _attempts_lock:
        hits = [t for t in _attempts.get(ip, []) if now - t < 900]
        if len(hits) >= 5:
            raise HTTPException(429, "Muitas tentativas. Tente novamente em alguns minutos.")
        hits.append(now)
        _attempts[ip] = hits


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class PinBody(BaseModel):
    pin: str


async def require_admin(request: Request, x_admin_token: Optional[str] = Header(default=None, alias="X-Admin-Token")):
    if not x_admin_token or len(x_admin_token) > 256:
        raise HTTPException(status_code=401, detail="Acesso da equipe necessário")
    session = await db.admin_sessions.find_one({
        "tokenHash": token_hash(x_admin_token),
        "expiresAt": {"$gt": datetime.now(timezone.utc)},
    })
    if not session:
        raise HTTPException(status_code=401, detail="Sessão da equipe expirada")
    return session


# Data models intentionally use string IDs so Mongo's ObjectId never crosses the API boundary.
class ChecklistItem(BaseModel):
    label: str
    checked: bool = False

class PhotoItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: Literal["intake", "repair", "delivery"]
    url: str = ""
    data: str = ""
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
    technician_name: str = "Equipe Hdtech"

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
    technician_name: str = "Equipe Hdtech"
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

# ---------------------------------------------------------------------------
# Produtos, estoque e vendas
# ---------------------------------------------------------------------------
class ProductCreate(BaseModel):
    name: str
    sku: str = ""
    category: str = "Geral"
    cost_price: float = 0
    sale_price: float = 0
    stock_qty: int = 0
    min_stock: int = 0

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    cost_price: Optional[float] = None
    sale_price: Optional[float] = None
    min_stock: Optional[int] = None

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    sku: str = ""
    category: str = "Geral"
    cost_price: float = 0
    sale_price: float = 0
    stock_qty: int = 0
    min_stock: int = 0
    created_at: str
    updated_at: str

class StockAdjust(BaseModel):
    delta: int
    note: str = ""

class SaleItemInput(BaseModel):
    product_id: str
    quantity: int

class SaleCreate(BaseModel):
    items: List[SaleItemInput]
    payment_method: str = "Dinheiro"

class SaleUpdate(BaseModel):
    payment_status: Optional[Literal["Pago", "Aguardando pagamento"]] = None

class SaleItem(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    unit_price: float
    cost_price: float

class Sale(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    items: List[SaleItem]
    total: float
    cost_total: float
    profit: float
    payment_method: str
    channel: str = "balcao"
    client_name: str = ""
    client_phone: str = ""
    payment_status: str = "Pago"
    created_at: str

# ---------------------------------------------------------------------------
# Despesas mensais (Caixa)
# ---------------------------------------------------------------------------
class ExpenseCreate(BaseModel):
    description: str
    category: str = "Geral"
    amount: float
    month: str  # "YYYY-MM"

class Expense(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    description: str
    category: str = "Geral"
    amount: float
    month: str
    created_at: str

# ---------------------------------------------------------------------------
# Loja do cliente (público)
# ---------------------------------------------------------------------------
class StoreOrderCreate(BaseModel):
    client_name: str
    client_phone: str
    items: List[SaleItemInput]
    payment_method: Literal["Pix"] = "Pix"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

async def get_order(order_id: str) -> dict:
    order = await db.service_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Ordem de serviço não encontrada")
    return order


@api_router.get("/")
async def root():
    return {"message": "Hdtech OS API", "status": "online"}

# ---------------------------------------------------------------------------
# Autenticação do painel (PIN da equipe)
# ---------------------------------------------------------------------------
@api_router.post("/admin/unlock")
async def admin_unlock(body: PinBody, request: Request):
    if len(body.pin) != 7 or not body.pin.isdigit():
        raise HTTPException(400, "O PIN deve ter 7 dígitos")
    await check_unlock_throttle(request.client.host if request.client else "unknown")
    if not ADMIN_PIN or not hmac.compare_digest(body.pin, ADMIN_PIN):
        raise HTTPException(401, "PIN inválido")
    raw = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=ADMIN_SESSION_HOURS)
    await db.admin_sessions.insert_one({"tokenHash": token_hash(raw), "createdAt": now_iso(), "expiresAt": expires})
    return {"token": raw, "expiresAt": expires.isoformat()}

@api_router.post("/admin/logout", status_code=204)
async def admin_logout(_: dict = Depends(require_admin), x_admin_token: Optional[str] = Header(default=None, alias="X-Admin-Token")):
    await db.admin_sessions.delete_one({"tokenHash": token_hash(x_admin_token or "")})

# ---------------------------------------------------------------------------
# Ordens de serviço (equipe)
# ---------------------------------------------------------------------------
@api_router.get("/orders", response_model=List[ServiceOrder])
async def list_orders(_: dict = Depends(require_admin)):
    orders = await db.service_orders.find({}, {"_id": 0}).sort("updated_at", -1).to_list(100)
    return orders

@api_router.post("/orders", response_model=ServiceOrder)
async def create_order(input: ServiceOrderCreate, _: dict = Depends(require_admin)):
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
async def read_order(order_id: str, _: dict = Depends(require_admin)):
    return await get_order(order_id)

@api_router.patch("/orders/{order_id}", response_model=ServiceOrder)
async def update_order(order_id: str, input: ServiceOrderUpdate, _: dict = Depends(require_admin)):
    current = await get_order(order_id)
    changes = {key: value for key, value in input.model_dump().items() if value is not None}
    if "checklist" in changes:
        changes["checklist"] = [item.model_dump() for item in input.checklist or []]
    total = changes.get("total_price", current.get("total_price", 0))
    parts = changes.get("parts_cost", current.get("parts_cost", 0))
    changes["profit"] = round(total - parts, 2)
    changes["updated_at"] = now_iso()
    await db.service_orders.update_one({"id": order_id}, {"$set": changes})
    return await get_order(order_id)

@api_router.post("/orders/{order_id}/photos", response_model=ServiceOrder)
async def add_photo(order_id: str, photo: PhotoItem, _: dict = Depends(require_admin)):
    await get_order(order_id)
    await db.service_orders.update_one({"id": order_id}, {"$push": {"photos": photo.model_dump()}, "$set": {"updated_at": now_iso()}})
    return await get_order(order_id)

# ---------------------------------------------------------------------------
# Acompanhamento público do cliente (por código TF-XXXXXX ou id da OS)
# ---------------------------------------------------------------------------
@api_router.get("/tracking/{tracking_code}", response_model=ServiceOrder)
async def public_tracking(tracking_code: str):
    order = await db.service_orders.find_one({"$or": [{"tracking_code": tracking_code.upper()}, {"id": tracking_code}]}, {"_id": 0})
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

# ---------------------------------------------------------------------------
# Uploads de fotos (Object Storage)
# ---------------------------------------------------------------------------
ALLOWED_IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), _: dict = Depends(require_admin)):
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Envie uma imagem válida (JPG, PNG ou WebP).")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Imagem muito grande (máx. 10 MB).")
    path = f"{APP_NAME}/uploads/{uuid.uuid4().hex}.{ALLOWED_IMAGE_TYPES[content_type]}"
    try:
        await run_in_threadpool(put_object, path, data, content_type)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Storage upload failed: {exc}")
        raise HTTPException(status_code=502, detail="Não foi possível salvar a foto agora. Tente novamente.")
    return {"path": path, "url": f"/api/files/{path}"}

@api_router.get("/files/{path:path}")
async def download_file(path: str):
    if not path.startswith(f"{APP_NAME}/"):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    try:
        content, content_type = await run_in_threadpool(get_object, path)
    except Exception:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    return Response(content=content, media_type=content_type)

# ---------------------------------------------------------------------------
# Produtos e estoque (equipe)
# ---------------------------------------------------------------------------
@api_router.post("/products", response_model=Product)
async def create_product(input: ProductCreate, _: dict = Depends(require_admin)):
    created = now_iso()
    product = {"id": str(uuid.uuid4()), **input.model_dump(), "created_at": created, "updated_at": created}
    response_product = {key: value for key, value in product.items()}
    await db.products.insert_one(product)
    return response_product

@api_router.get("/products", response_model=List[Product])
async def list_products(_: dict = Depends(require_admin)):
    return await db.products.find({}, {"_id": 0}).sort("name", 1).to_list(500)

@api_router.get("/products/{product_id}", response_model=Product)
async def read_product(product_id: str, _: dict = Depends(require_admin)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return product

@api_router.patch("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, input: ProductUpdate, _: dict = Depends(require_admin)):
    changes = {key: value for key, value in input.model_dump().items() if value is not None}
    if not changes:
        raise HTTPException(status_code=400, detail="Nada para atualizar.")
    changes["updated_at"] = now_iso()
    result = await db.products.update_one({"id": product_id}, {"$set": changes})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return await read_product(product_id)

@api_router.post("/products/{product_id}/stock", response_model=Product)
async def adjust_stock(product_id: str, input: StockAdjust, _: dict = Depends(require_admin)):
    if input.delta == 0:
        raise HTTPException(status_code=400, detail="Informe uma quantidade diferente de zero.")
    query: dict = {"id": product_id}
    if input.delta < 0:
        query["stock_qty"] = {"$gte": -input.delta}
    product = await db.products.find_one_and_update(query, {"$inc": {"stock_qty": input.delta}, "$set": {"updated_at": now_iso()}}, projection={"_id": 0}, return_document=True)
    if not product:
        exists = await db.products.find_one({"id": product_id}, {"_id": 0})
        if not exists:
            raise HTTPException(status_code=404, detail="Produto não encontrado")
        raise HTTPException(status_code=400, detail="Estoque não pode ficar negativo.")
    return product

# ---------------------------------------------------------------------------
# Vendas (equipe)
# ---------------------------------------------------------------------------
@api_router.post("/sales", response_model=Sale)
async def create_sale(input: SaleCreate, _: dict = Depends(require_admin)):
    if not input.items:
        raise HTTPException(status_code=400, detail="Adicione ao menos um produto à venda.")
    sale = await build_sale(input.items, input.payment_method)
    response_sale = {key: value for key, value in sale.items()}
    await db.sales.insert_one(sale)
    return response_sale

@api_router.get("/sales", response_model=List[Sale])
async def list_sales(_: dict = Depends(require_admin)):
    return await db.sales.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)

@api_router.patch("/sales/{sale_id}", response_model=Sale)
async def update_sale(sale_id: str, input: SaleUpdate, _: dict = Depends(require_admin)):
    changes = {key: value for key, value in input.model_dump().items() if value is not None}
    if not changes:
        raise HTTPException(status_code=400, detail="Nada para atualizar.")
    result = await db.sales.update_one({"id": sale_id}, {"$set": changes})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Venda não encontrada")
    return await db.sales.find_one({"id": sale_id}, {"_id": 0})

async def build_sale(items: List[SaleItemInput], payment_method: str, extra: Optional[dict] = None) -> dict:
    """Valida itens, baixa estoque e monta o documento da venda."""
    sale_items: List[dict] = []
    total = 0.0
    cost_total = 0.0
    for item in items:
        if item.quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantidade inválida.")
        product = await db.products.find_one_and_update(
            {"id": item.product_id, "stock_qty": {"$gte": item.quantity}},
            {"$inc": {"stock_qty": -item.quantity}, "$set": {"updated_at": now_iso()}},
            projection={"_id": 0},
        )
        if not product:
            existing = await db.products.find_one({"id": item.product_id}, {"_id": 0, "name": 1, "stock_qty": 1})
            if not existing:
                raise HTTPException(status_code=404, detail="Produto não encontrado")
            raise HTTPException(status_code=400, detail=f"Estoque insuficiente para {existing['name']} (disponível: {existing['stock_qty']}).")
        sale_items.append({"product_id": product["id"], "product_name": product["name"], "quantity": item.quantity, "unit_price": product["sale_price"], "cost_price": product["cost_price"]})
        total += product["sale_price"] * item.quantity
        cost_total += product["cost_price"] * item.quantity
    sale = {
        "id": str(uuid.uuid4()),
        "items": sale_items,
        "total": round(total, 2),
        "cost_total": round(cost_total, 2),
        "profit": round(total - cost_total, 2),
        "payment_method": payment_method,
        "channel": "balcao",
        "client_name": "",
        "client_phone": "",
        "payment_status": "Pago",
        "created_at": now_iso(),
    }
    if extra:
        sale.update(extra)
    return sale

# ---------------------------------------------------------------------------
# Despesas mensais e fluxo de caixa (equipe)
# ---------------------------------------------------------------------------
@api_router.post("/expenses", response_model=Expense)
async def create_expense(input: ExpenseCreate, _: dict = Depends(require_admin)):
    if not re.fullmatch(r"\d{4}-\d{2}", input.month):
        raise HTTPException(status_code=400, detail="Mês inválido (use AAAA-MM).")
    if input.amount <= 0:
        raise HTTPException(status_code=400, detail="O valor deve ser maior que zero.")
    expense = {"id": str(uuid.uuid4()), **input.model_dump(), "created_at": now_iso()}
    response_expense = {key: value for key, value in expense.items()}
    await db.expenses.insert_one(expense)
    return response_expense

@api_router.get("/expenses", response_model=List[Expense])
async def list_expenses(month: str, _: dict = Depends(require_admin)):
    return await db.expenses.find({"month": month}, {"_id": 0}).sort("created_at", -1).to_list(500)

@api_router.delete("/expenses/{expense_id}", status_code=204)
async def delete_expense(expense_id: str, _: dict = Depends(require_admin)):
    result = await db.expenses.delete_one({"id": expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")

@api_router.get("/cashflow")
async def cashflow(month: str, _: dict = Depends(require_admin)):
    if not re.fullmatch(r"\d{4}-\d{2}", month):
        raise HTTPException(status_code=400, detail="Mês inválido (use AAAA-MM).")
    sales = await db.sales.find({}, {"_id": 0, "total": 1, "profit": 1, "created_at": 1}).to_list(500)
    delivered = await db.service_orders.find({"status": "Entregue"}, {"_id": 0, "total_price": 1, "updated_at": 1}).to_list(500)
    expenses = await db.expenses.find({"month": month}, {"_id": 0, "amount": 1}).to_list(500)
    month_sales = [sale for sale in sales if sale.get("created_at", "")[:7] == month]
    sales_total = round(sum(sale.get("total", 0) for sale in month_sales), 2)
    sales_profit = round(sum(sale.get("profit", 0) for sale in month_sales), 2)
    orders_revenue = round(sum(order.get("total_price", 0) for order in delivered if order.get("updated_at", "")[:7] == month), 2)
    expenses_total = round(sum(expense.get("amount", 0) for expense in expenses), 2)
    return {
        "month": month,
        "sales_total": sales_total,
        "sales_profit": sales_profit,
        "sales_count": len(month_sales),
        "orders_revenue": orders_revenue,
        "expenses_total": expenses_total,
        "balance": round(sales_total + orders_revenue - expenses_total, 2),
    }

# ---------------------------------------------------------------------------
# Loja do cliente (público — sem dados de custo/lucro; pagamento via Pix)
# ---------------------------------------------------------------------------
@api_router.get("/store/products")
async def store_products():
    products = await db.products.find({"stock_qty": {"$gt": 0}, "sale_price": {"$gt": 0}}, {"_id": 0}).sort("name", 1).to_list(500)
    return [{"id": p["id"], "name": p["name"], "category": p.get("category", "Geral"), "sale_price": p.get("sale_price", 0), "stock_qty": p.get("stock_qty", 0)} for p in products]

@api_router.post("/store/orders")
async def create_store_order(input: StoreOrderCreate):
    if not input.items:
        raise HTTPException(status_code=400, detail="Adicione ao menos um produto ao pedido.")
    if not input.client_name.strip() or not input.client_phone.strip():
        raise HTTPException(status_code=400, detail="Informe seu nome e telefone.")
    sale = await build_sale(input.items, input.payment_method, {
        "channel": "loja",
        "client_name": input.client_name.strip(),
        "client_phone": input.client_phone.strip(),
        "payment_status": "Aguardando pagamento",
    })
    await db.sales.insert_one(sale)
    return {"sale_id": sale["id"], "total": sale["total"], "payment_method": "Pix", "pix_key": STORE_PIX_KEY}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_storage():
    try:
        await run_in_threadpool(init_storage)
        logger.info("Object storage ready")
    except Exception as exc:
        logger.warning(f"Object storage init failed (will retry lazily): {exc}")
    try:
        await db.admin_sessions.create_index("expiresAt", expireAfterSeconds=0)
    except Exception as exc:
        logger.warning(f"Admin sessions index failed: {exc}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
