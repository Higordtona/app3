import Constants from "expo-constants";
import type { Message, ServiceOrder, Status } from "./types";

const baseUrl = `${Constants.expoConfig?.extra?.backendUrl ?? process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail ?? "Não foi possível concluir a solicitação.");
  }
  return response.json() as Promise<T>;
}

export const api = {
  listOrders: () => request<ServiceOrder[]>("/orders"),
  createOrder: (payload: Record<string, unknown>) => request<ServiceOrder>("/orders", { method: "POST", body: JSON.stringify(payload) }),
  getOrder: (id: string) => request<ServiceOrder>(`/orders/${id}`),
  updateOrder: (id: string, payload: { status?: Status; checklist?: unknown[]; notes?: string; labor_cost?: number; parts_cost?: number; total_price?: number }) => request<ServiceOrder>(`/orders/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  addPhoto: (id: string, payload: { category: string; data: string }) => request<ServiceOrder>(`/orders/${id}/photos`, { method: "POST", body: JSON.stringify(payload) }),
  getTracking: (code: string) => request<ServiceOrder>(`/tracking/${code.trim().toUpperCase()}`),
  listMessages: (id: string) => request<Message[]>(`/orders/${id}/messages`),
  sendMessage: (id: string, payload: { sender: "Técnico" | "Cliente"; text: string }) => request<Message>(`/orders/${id}/messages`, { method: "POST", body: JSON.stringify(payload) }),
  registerToken: (token: string, role: "technician" | "client", tracking_code?: string) => request<{ registered: boolean }>("/device-tokens", { method: "POST", body: JSON.stringify({ token, role, tracking_code }) }),
};