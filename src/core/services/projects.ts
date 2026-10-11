import { supabase } from "@/core/services/supabase";
import type { ProjectRow, ProjectStatus } from "@/core/types/communication";

const projectColumns =
  "id, conversation_id, school_id, buyer_id, seller_id, title, description, amount, status, delivery_url, revision_request, created_at, updated_at";

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
  if (!/^https?:\/\/\S+$/i.test(url)) {
    throw new Error("Masukkan tautan hasil kerja yang valid.");
  }
  return updateProject(projectId, {
    delivery_url: url,
    revision_request: null,
    status: "revision",
  });
}

export function requestProjectRevision(projectId: string, request: string) {
  const normalizedRequest = request.trim();
  if (normalizedRequest.length < 5 || normalizedRequest.length > 1000) {
    throw new Error("Permintaan revisi harus terdiri dari 5–1.000 karakter.");
  }
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
