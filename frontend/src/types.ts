export type Status = "Recebido" | "Em análise" | "Em reparo" | "Pronto" | "Entregue";
export type PhotoCategory = "intake" | "repair" | "delivery";

export type ChecklistItem = { label: string; checked: boolean };
export type PhotoItem = { id: string; category: PhotoCategory; data: string; created_at: string };

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