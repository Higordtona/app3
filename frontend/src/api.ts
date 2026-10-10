import Constants from "expo-constants";
import { Platform } from "react-native";
import { storage } from "./utils/storage";
import type { Cashflow, Expense, Message, Product, Sale, ServiceOrder, Status, StoreOrderResult, StoreProduct } from "./types";

const configuredBackendUrl = Constants.expoConfig?.extra?.backendUrl ?? process.env.EXPO_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
const baseUrl = `${configuredBackendUrl}/api`;
export const publicUrl = configuredBackendUrl;

const ADMIN_TOKEN_KEY = "admin_session";

async function adminToken(): Promise<string> {
  return (await storage.secureGet(ADMIN_TOKEN_KEY, "")) ?? "";
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await adminToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["X-Admin-Token"] = token;
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail ?? "Não foi possível concluir a solicitação.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  // Autenticação do painel (PIN da equipe → token temporário)
  unlockAdmin: async (pin: string): Promise<void> => {
    const response = await fetch(`${baseUrl}/admin/unlock`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.detail ?? (response.status === 429 ? "Muitas tentativas. Aguarde alguns minutos." : "PIN inválido."));
    }
    const data = await response.json();
    await storage.secureSet(ADMIN_TOKEN_KEY, data.token);
  },
  lockAdmin: async () => {
    try { await request<void>("/admin/logout", { method: "POST" }); } catch { /* sessão já inválida */ }
    await storage.secureRemove(ADMIN_TOKEN_KEY);
  },
  hasAdminSession: async () => Boolean(await adminToken()),
  // Ordens de serviço
  listOrders: () => request<ServiceOrder[]>("/orders"),
  createOrder: (payload: Record<string, unknown>) => request<ServiceOrder>("/orders", { method: "POST", body: JSON.stringify(payload) }),
  getOrder: (id: string) => request<ServiceOrder>(`/orders/${id}`),
  updateOrder: (id: string, payload: { status?: Status; checklist?: unknown[]; notes?: string; labor_cost?: number; parts_cost?: number; total_price?: number }) => request<ServiceOrder>(`/orders/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  addPhoto: (id: string, payload: { category: string; url: string }) => request<ServiceOrder>(`/orders/${id}/photos`, { method: "POST", body: JSON.stringify(payload) }),
  // Upload de foto para o Object Storage (via backend). O corpo multipart muda
  // por plataforma: web precisa de Blob real; nativo usa { uri, name, type }.
  // Nunca definir Content-Type manualmente — o runtime adiciona o boundary.
  uploadImage: async (uri: string): Promise<{ path: string; url: string }> => {
    const form = new FormData();
    const name = uri.split("/").pop() ?? "foto.jpg";
    if (Platform.OS === "web") {
      const blob = await (await fetch(uri)).blob();
      form.append("file", blob, name);
    } else {
      form.append("file", { uri, name, type: "image/jpeg" } as unknown as Blob);
    }
    const token = await adminToken();
    const headers: Record<string, string> = {};
    if (token) headers["X-Admin-Token"] = token;
    const response = await fetch(`${baseUrl}/upload`, { method: "POST", body: form, headers });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.detail ?? "Não foi possível enviar a foto.");
    }
    return response.json() as Promise<{ path: string; url: string }>;
  },
  fileUrl: (path: string) => `${baseUrl}/files/${path}`,
  getTracking: (code: string) => request<ServiceOrder>(`/tracking/${code.trim()}`),
  listMessages: (id: string) => request<Message[]>(`/orders/${id}/messages`),
  sendMessage: (id: string, payload: { sender: "Técnico" | "Cliente"; text: string }) => request<Message>(`/orders/${id}/messages`, { method: "POST", body: JSON.stringify(payload) }),
  // Produtos, estoque e vendas (equipe)
  listProducts: () => request<Product[]>("/products"),
  createProduct: (payload: Record<string, unknown>) => request<Product>("/products", { method: "POST", body: JSON.stringify(payload) }),
  getProduct: (id: string) => request<Product>(`/products/${id}`),
  updateProduct: (id: string, payload: Record<string, unknown>) => request<Product>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  adjustStock: (id: string, payload: { delta: number; note?: string }) => request<Product>(`/products/${id}/stock`, { method: "POST", body: JSON.stringify(payload) }),
  listSales: () => request<Sale[]>("/sales"),
  createSale: (payload: { items: { product_id: string; quantity: number }[]; payment_method: string }) => request<Sale>("/sales", { method: "POST", body: JSON.stringify(payload) }),
  markSalePaid: (id: string) => request<Sale>(`/sales/${id}`, { method: "PATCH", body: JSON.stringify({ payment_status: "Pago" }) }),
  // Caixa (despesas mensais e fluxo de caixa)
  listExpenses: (month: string) => request<Expense[]>(`/expenses?month=${month}`),
  createExpense: (payload: { description: string; category: string; amount: number; month: string }) => request<Expense>("/expenses", { method: "POST", body: JSON.stringify(payload) }),
  deleteExpense: (id: string) => request<void>(`/expenses/${id}`, { method: "DELETE" }),
  getCashflow: (month: string) => request<Cashflow>(`/cashflow?month=${month}`),
  // Loja do cliente (público, pagamento via Pix)
  listStoreProducts: () => request<StoreProduct[]>("/store/products"),
  createStoreOrder: (payload: { client_name: string; client_phone: string; items: { product_id: string; quantity: number }[] }) => request<StoreOrderResult>("/store/orders", { method: "POST", body: JSON.stringify({ ...payload, payment_method: "Pix" }) }),
};
