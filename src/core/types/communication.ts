export type MessageType = "text" | "image" | "file" | "invoice";

export type InvoicePayload = {
  project_id: string;
  title: string;
  amount: number;
  currency: "IDR";
  revision_limit?: number;
  description?: string;
};

export type MediaMessagePayload = {
  url: string;
  name: string;
  mime_type: string;
  size?: number;
};

export type MessagePayload = InvoicePayload | MediaMessagePayload | null;

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_text: string;
  message_type: MessageType;
  payload: MessagePayload;
  created_at: string;
};

export type ProjectStatus = "in_progress" | "revision" | "completed";
export type ProjectPaymentStatus =
  | "not_required"
  | "unpaid"
  | "pending"
  | "paid"
  | "failed"
  | "refunded";

export type ProjectRow = {
  id: string;
  conversation_id: string;
  school_id: string;
  buyer_id: string;
  seller_id: string;
  title: string;
  description: string | null;
  amount: number;
  status: ProjectStatus;
  payment_status: ProjectPaymentStatus;
  revision_limit: number;
  revision_count: number;
  extra_revisions_granted: number;
  delivery_url: string | null;
  revision_request: string | null;
  created_at: string;
  updated_at: string;
};
