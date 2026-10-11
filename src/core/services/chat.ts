import { supabase } from "@/core/services/supabase";
import type {
  InvoicePayload,
  MediaMessagePayload,
  MessagePayload,
  MessageType,
} from "@/core/types/communication";

export type ChatMessage = {
  id: string;
  text: string;
  time: string;
  isMine: boolean;
  type: MessageType;
  payload: MessagePayload;
};

export type ChatConversation = {
  id: string;
  peerId: string;
  name: string;
  initials: string;
  color: string;
  service: string;
  updatedAt: string;
  unreadCount: number;
  lastMessagePreview: string;
  lastMessageIsMine: boolean;
  messages: ChatMessage[];
};

const avatarColors = ["#EEEAFE", "#E2F4EC", "#FFF0E3", "#E6F1FF", "#FCE8F0"];

const initialsFor = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";

const colorFor = (id: string) => {
  const hash = Array.from(id).reduce(
    (value, character) => value + character.charCodeAt(0),
    0,
  );
  return avatarColors[hash % avatarColors.length];
};

const formatTime = (timestamp: string) =>
  new Date(timestamp).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const parseInvoicePayload = (value: unknown): InvoicePayload | null => {
  if (
    !value ||
    typeof value !== "object" ||
    !("project_id" in value) ||
    typeof value.project_id !== "string" ||
    !("title" in value) ||
    typeof value.title !== "string" ||
    !("amount" in value) ||
    typeof value.amount !== "number"
  ) {
    return null;
  }
  return {
    project_id: value.project_id,
    title: value.title,
    amount: value.amount,
    currency: "IDR",
    ...("description" in value && typeof value.description === "string"
      ? { description: value.description }
      : {}),
  };
};

const parseMediaPayload = (value: unknown): MediaMessagePayload | null => {
  if (
    !value ||
    typeof value !== "object" ||
    !("url" in value) ||
    typeof value.url !== "string" ||
    !("name" in value) ||
    typeof value.name !== "string" ||
    !("mime_type" in value) ||
    typeof value.mime_type !== "string"
  ) {
    return null;
  }
  return {
    url: value.url,
    name: value.name,
    mime_type: value.mime_type,
    ...("size" in value && typeof value.size === "number"
      ? { size: value.size }
      : {}),
  };
};

const missingMessageTypeColumn = (error: { code?: string; message?: string }) =>
  error.code === "42703" &&
  /message_type|payload/.test(error.message ?? "");

const formatConversationTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isToday) return formatTime(timestamp);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return "Kemarin";
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
};

export async function findProfileByName(name: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("full_name", name)
    .limit(2);

  if (error) throw error;
  if (!data?.length) {
    throw new Error("Profil seller belum terdaftar di database.");
  }
  if (data.length > 1) {
    throw new Error(
      "Ada lebih dari satu profil dengan nama ini. Chat belum dibuat agar tidak salah penerima.",
    );
  }
  return data[0];
}

export async function getOrCreateDirectConversation(
  peerId: string,
  serviceTitle: string,
) {
  const { data, error } = await supabase.rpc(
    "get_or_create_direct_conversation",
    {
      p_peer_id: peerId,
      p_service_title: serviceTitle,
    },
  );
  if (error) throw error;
  if (typeof data !== "string" || !data) {
    throw new Error("ID percakapan tidak dikembalikan oleh server.");
  }
  return data;
}

export async function loadMyConversations(
  userId: string,
): Promise<ChatConversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, buyer_id, seller_id, service_title, last_message_preview, last_message_at, last_message_sender_id, buyer_last_read_at, seller_last_read_at, updated_at",
    )
    .order("updated_at", { ascending: false });

  if (error) throw error;
  if (!data?.length) return [];

  const peerIds = data.map((item) =>
    item.buyer_id === userId ? item.seller_id : item.buyer_id,
  );
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", peerIds);

  if (profilesError) throw profilesError;

  const profilesById = new Map(
    (profiles ?? []).map((item) => [item.id, item.full_name ?? "Pelajar"]),
  );

  return data.map((item) => {
    const isBuyer = item.buyer_id === userId;
    const peerId = isBuyer ? item.seller_id : item.buyer_id;
    const name = profilesById.get(peerId) ?? "Pelajar";
    const lastReadAt = isBuyer
      ? item.buyer_last_read_at
      : item.seller_last_read_at;
    const hasUnreadMessage =
      item.last_message_at !== null &&
      item.last_message_sender_id !== userId &&
      (!lastReadAt ||
        new Date(item.last_message_at).getTime() >
          new Date(lastReadAt).getTime());

    return {
      id: item.id,
      peerId,
      name,
      initials: initialsFor(name),
      color: colorFor(peerId),
      service: item.service_title,
      updatedAt: formatConversationTime(item.last_message_at ?? item.updated_at),
      unreadCount: hasUnreadMessage ? 1 : 0,
      lastMessagePreview: item.last_message_preview ?? "Mulai percakapan",
      lastMessageIsMine: item.last_message_sender_id === userId,
      messages: [],
    };
  });
}

export async function loadConversationMessages(
  conversationId: string,
  userId: string,
): Promise<ChatMessage[]> {
  let { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, message_text, message_type, payload, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(100);

  const legacySchema = Boolean(error && missingMessageTypeColumn(error));
  if (legacySchema) {
    console.warn(
      "Skema pesan belum dimigrasikan; chat dibuka dalam mode teks. Terapkan migrasi 20261011103000_add_project_workflow_and_system_messages.sql.",
    );
    const legacyResult = await supabase
      .from("messages")
      .select("id, sender_id, message_text, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(100);
    data = legacyResult.data as typeof data;
    error = legacyResult.error;
  }
  if (error) throw error;
  return Promise.all(
    (data ?? []).reverse().map(async (item) => {
      const messageType = legacySchema
        ? "text"
        : (item as (typeof data extends (infer Row)[] | null ? Row : never) & {
            message_type: MessageType;
            payload: unknown;
          }).message_type;
      const messagePayload = legacySchema
        ? null
        : (item as { payload: unknown }).payload;
      const parsedMedia =
        messageType === "image" || messageType === "file"
          ? parseMediaPayload(messagePayload)
          : null;
      let payload: MessagePayload =
        messageType === "invoice"
          ? parseInvoicePayload(messagePayload)
          : parsedMedia;
      if (parsedMedia) {
        const { data: signedUrl, error: signedUrlError } = await supabase.storage
          .from("chat-media")
          .createSignedUrl(parsedMedia.url, 60 * 60);
        if (signedUrlError) throw signedUrlError;
        payload = { ...parsedMedia, url: signedUrl.signedUrl };
      }
      return {
        id: item.id,
        text: item.message_text,
        time: formatTime(item.created_at),
        isMine: item.sender_id === userId,
        type: messageType,
        payload,
      };
    }),
  );
}

export async function markConversationRead(conversationId: string) {
  const { error } = await supabase.rpc("mark_conversation_read", {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
}

export async function sendConversationMessage(
  conversationId: string,
  senderId: string,
  body: string,
): Promise<ChatMessage> {
  let { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      message_text: body,
      message_type: "text",
    })
    .select("id, sender_id, message_text, message_type, payload, created_at")
    .single();

  let legacySchema = false;
  if (error && missingMessageTypeColumn(error)) {
    legacySchema = true;
    console.warn(
      "Kolom tipe pesan belum tersedia; mengirim pesan teks dengan skema lama. Terapkan migrasi 20261011103000_add_project_workflow_and_system_messages.sql.",
    );
    const legacyResult = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        message_text: body,
      })
      .select("id, sender_id, message_text, created_at")
      .single();
    data = legacyResult.data as typeof data;
    error = legacyResult.error;
  }
  if (error) throw error;
  if (!data) throw new Error("Pesan tidak dikembalikan oleh server.");

  const legacyMessage = data as typeof data & {
    message_type?: MessageType;
    payload?: unknown;
  };
  return {
    id: data.id,
    text: data.message_text,
    time: formatTime(data.created_at),
    isMine: data.sender_id === senderId,
    type: legacySchema ? "text" : (legacyMessage.message_type ?? "text"),
    payload: null,
  };
}

export async function createProjectInvoice(
  conversationId: string,
  title: string,
  description: string,
  amount: number,
): Promise<string> {
  const { data, error } = await supabase.rpc("create_project_invoice", {
    p_conversation_id: conversationId,
    p_title: title.trim(),
    p_description: description.trim(),
    p_amount: amount,
  });
  if (error) {
    throw new Error(`Gagal membuat invoice proyek: ${error.message}`);
  }
  if (typeof data !== "string" || !data) {
    throw new Error("Server tidak mengembalikan ID proyek.");
  }
  return data;
}

export async function sendConversationMedia(
  conversationId: string,
  senderId: string,
  file: { uri: string; name: string; mimeType: string; size?: number },
): Promise<ChatMessage> {
  const response = await fetch(file.uri);
  if (!response.ok) {
    throw new Error("File lampiran tidak dapat dibaca.");
  }
  const fileBody = await response.blob();
  const safeName = file.name.replace(/[^\w.-]/g, "_");
  const objectPath = `${conversationId}/${senderId}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("chat-media")
    .upload(objectPath, fileBody, {
      contentType: file.mimeType,
      upsert: false,
    });
  if (uploadError) {
    throw new Error(`Lampiran gagal diunggah: ${uploadError.message}`);
  }

  const type: MessageType = file.mimeType.startsWith("image/")
    ? "image"
    : "file";
  const payload: MediaMessagePayload = {
    url: objectPath,
    name: file.name,
    mime_type: file.mimeType,
    ...(file.size === undefined ? {} : { size: file.size }),
  };
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      message_text: file.name,
      message_type: type,
      payload,
    })
    .select("id, sender_id, message_text, message_type, payload, created_at")
    .single();
  if (error) {
    const { error: cleanupError } = await supabase.storage
      .from("chat-media")
      .remove([objectPath]);
    if (cleanupError) {
      console.error("Gagal membersihkan lampiran yang tidak terkirim:", cleanupError);
    }
    throw new Error(`Lampiran gagal dikirim: ${error.message}`);
  }
  if (!data) throw new Error("Data lampiran tidak dikembalikan server.");
  const { data: signedUrl, error: signedUrlError } = await supabase.storage
    .from("chat-media")
    .createSignedUrl(objectPath, 60 * 60);
  if (signedUrlError) throw signedUrlError;
  const returnedMedia = parseMediaPayload(data.payload);

  return {
    id: data.id,
    text: data.message_text,
    time: formatTime(data.created_at),
    isMine: data.sender_id === senderId,
    type: data.message_type as MessageType,
    payload: returnedMedia
      ? { ...returnedMedia, url: signedUrl.signedUrl }
      : null,
  };
}
