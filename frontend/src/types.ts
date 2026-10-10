export type Status = "Recebido" | "Em análise" | "Em reparo" | "Pronto" | "Entregue";
export type PhotoCategory = "intake" | "repair" | "delivery";

export type ChecklistItem = { label: string; checked: boolean };
// `url` = caminho no Object Storage (fotos novas); `data` = base64 legado (fotos antigas).
export type PhotoItem = { id: string; category: PhotoCategory; url?: string; data?: string; created_at: string };

export type ServiceOrder = {
  id: string;
  tracking_code: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  device_type: string;
  device_model: string;
  defect_description: string;
  checklist: ChecklistItem[];
  photos: PhotoItem[];
  labor_cost: number;
  parts_cost: number;
  total_price: number;
  profit: number;
  notes: string;
  status: Status;
  technician_name: string;
  created_at: string;
  updated_at: string;
};

export type Message = { id: string; sender: "Técnico" | "Cliente"; text: string; sent_at: string };

export type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  cost_price: number;
  sale_price: number;
  stock_qty: number;
  min_stock: number;
  created_at: string;
  updated_at: string;
};

export type SaleItem = { product_id: string; product_name: string; quantity: number; unit_price: number; cost_price: number };
export type Sale = { id: string; items: SaleItem[]; total: number; cost_total: number; profit: number; payment_method: string; channel?: string; client_name?: string; client_phone?: string; payment_status?: string; created_at: string };

export type Expense = { id: string; description: string; category: string; amount: number; month: string; created_at: string };
export type Cashflow = { month: string; sales_total: number; sales_profit: number; sales_count: number; orders_revenue: number; expenses_total: number; balance: number };
export type StoreProduct = { id: string; name: string; category: string; sale_price: number; stock_qty: number };
export type StoreOrderResult = { sale_id: string; total: number; payment_method: string; pix_key?: string };
