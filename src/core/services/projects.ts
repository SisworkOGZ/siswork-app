import { supabase } from "@/core/services/supabase";
import type { ProjectRow, ProjectStatus } from "@/core/types/communication";

const projectColumns =
  "id, conversation_id, school_id, buyer_id, seller_id, title, description, amount, status, payment_status, revision_limit, revision_count, extra_revisions_granted, delivery_url, revision_request, created_at, updated_at";

const isValidHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !!url.hostname;
  } catch {
    return false;
  }
};

const normalizeProjectText = (value: string, maxLength: number) => {
  const normalized = value.trim();
  if (normalized.length < 5 || normalized.length > maxLength) {
    throw new Error(`Masukkan teks dengan panjang 5–${maxLength} karakter.`);
  }
  return normalized;
};

export async function loadMyProjects(userId: string): Promise<ProjectRow[]> {
  const { data, error } = await supabase
    .from("projects")
    .select(projectColumns)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Gagal memuat proyek: ${error.message}`);
  return (data ?? []) as ProjectRow[];
}

async function updateProject(
  projectId: string,
  updates: Partial<
    Pick<ProjectRow, "status" | "delivery_url" | "revision_request">
  >,
): Promise<ProjectRow> {
  const { data, error } = await supabase
    .from("projects")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .select(projectColumns)
    .single();

  if (error) throw new Error(`Gagal memperbarui proyek: ${error.message}`);
  return data as ProjectRow;
}

export function submitProjectDelivery(projectId: string, deliveryUrl: string) {
  const url = deliveryUrl.trim();
  if (!isValidHttpUrl(url)) {
    throw new Error("Masukkan tautan hasil kerja yang valid.");
  }
  return updateProject(projectId, {
    delivery_url: url,
    revision_request: null,
    status: "revision",
  });
}

export function requestProjectRevision(projectId: string, request: string) {
  const normalizedRequest = normalizeProjectText(request, 1000);
  return updateProject(projectId, {
    revision_request: normalizedRequest,
    status: "revision",
  });
}

export function completeProject(projectId: string) {
  return updateProject(projectId, {
    status: "completed" satisfies ProjectStatus,
    revision_request: null,
  });
}

export async function grantExtraProjectRevision(
  projectId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc(
    "grant_extra_project_revision",
    { p_project_id: projectId },
  );
  if (error) {
    throw new Error(`Gagal membuka revisi tambahan: ${error.message}`);
  }
  if (typeof data !== "number") {
    throw new Error("Server tidak mengembalikan batas revisi terbaru.");
  }
  return data;
}

export async function loadProjectById(
  projectId: string,
): Promise<ProjectRow | null> {
  const { data, error } = await supabase
    .from("projects")
    .select(projectColumns)
    .eq("id", projectId)
    .maybeSingle();

  if (error) throw new Error(`Gagal memuat proyek: ${error.message}`);
  return data as ProjectRow | null;
}

export async function payProjectWithMidtrans(
  projectId: string,
): Promise<{ redirectUrl: string; paymentId: string }> {
  const { data, error } = await supabase.functions.invoke(
    "create-midtrans-payment",
    { body: { projectId } },
  );
  if (error) {
    let detail = error.message;
    if (
      "context" in error &&
      error.context &&
      typeof (error.context as { json?: () => Promise<unknown> }).json === "function"
    ) {
      try {
        const errorBody = (await (error.context as Response).json()) as {
          error?: string;
          message?: string;
        };
        if (errorBody?.error) detail = errorBody.error;
        else if (errorBody?.message) detail = errorBody.message;
      } catch {
        // Fallback to error.message
      }
    }
    throw new Error(detail || "Gagal membuat pembayaran Midtrans.");
  }
  if (!data || typeof data.redirectUrl !== "string") {
    if (
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof (data as { error: string }).error === "string"
    ) {
      throw new Error((data as { error: string }).error);
    }
    throw new Error("Server tidak mengembalikan tautan pembayaran.");
  }
  return data as { redirectUrl: string; paymentId: string };
}

