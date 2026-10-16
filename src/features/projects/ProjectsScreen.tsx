import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  completeProject,
  grantExtraProjectRevision,
  loadMyProjects,
  requestProjectRevision,
  submitProjectDelivery,
} from "@/core/services/projects";
import * as Linking from "expo-linking";
import { supabase } from "@/core/services/supabase";
import type { ProjectRow, ProjectStatus } from "@/core/types/communication";
import { AppColors } from "@/constants/app-theme";

const segments: { label: string; status: ProjectStatus }[] = [
  { label: "Dalam Proses", status: "in_progress" },
  { label: "Revisi", status: "revision" },
  { label: "Selesai", status: "completed" },
];

export default function ProjectsScreen() {
  const insets = useSafeAreaInsets();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [userId, setUserId] = useState("");
  const [segment, setSegment] = useState<ProjectStatus>("in_progress");
  const [deliveries, setDeliveries] = useState<Record<string, string>>({});
  const [revisionNotes, setRevisionNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!data.user) throw new Error("Silakan login untuk melihat proyek.");
      setUserId(data.user.id);
      setProjects(await loadMyProjects(data.user.id));
    } catch (loadError) {
      console.error("Gagal memuat proyek:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Proyek tidak dapat dimuat.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(task);
  }, [refresh]);

  const visibleProjects = useMemo(
    () => projects.filter((project) => project.status === segment),
    [projects, segment],
  );

  const runProjectAction = async (
    projectId: string,
    action: () => Promise<ProjectRow>,
  ) => {
    setBusyProjectId(projectId);
    setError("");
    try {
      const updated = await action();
      setProjects((current) =>
        current.map((project) => (project.id === projectId ? updated : project)),
      );
    } catch (actionError) {
      console.error("Gagal memperbarui proyek:", actionError);
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Proyek tidak dapat diperbarui.",
      );
    } finally {
      setBusyProjectId(null);
    }
  };

  const openDelivery = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (openError) {
      console.error("Gagal membuka tautan hasil kerja:", openError);
      Alert.alert(
        "Hasil kerja tidak dapat dibuka",
        openError instanceof Error
          ? openError.message
          : "Periksa koneksi atau minta seller mengirim tautan yang lain.",
      );
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: Math.max(insets.top, 20), paddingBottom: 110 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>RUANG KERJA</Text>
      <Text style={styles.title}>Proyek</Text>
      <Text style={styles.subtitle}>
        Pastikan lingkup dan harga disepakati di Chat. Pembayaran dilakukan di
        luar aplikasi. Revisi di luar batas yang disepakati juga perlu
        disepakati dan dibayar langsung kepada seller.
      </Text>

      <View style={styles.segmentBar}>
        {segments.map((item) => (
          <Pressable
            key={item.status}
            accessibilityRole="tab"
            accessibilityState={{ selected: segment === item.status }}
            onPress={() => setSegment(item.status)}
            style={[styles.segment, segment === item.status && styles.segmentActive]}
          >
            <Text
              style={[
                styles.segmentText,
                segment === item.status && styles.segmentTextActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {loading ? (
        <ActivityIndicator color={AppColors.brand} style={styles.loading} />
      ) : visibleProjects.length ? (
        visibleProjects.map((project) => {
          const isSeller = project.seller_id === userId;
          const isBusy = busyProjectId === project.id;
          return (
            <View key={project.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardStatus}>
                  {project.status === "completed"
                    ? "Selesai"
                    : project.status === "in_progress"
                      ? "Sedang dikerjakan"
                      : project.revision_request
                        ? isSeller
                          ? "Perlu diperbaiki"
                          : "Menunggu revisi"
                        : isSeller
                          ? "Menunggu buyer meninjau"
                          : "Hasil siap ditinjau"}
                </Text>
                <Text style={styles.amount}>
                  Rp{Number(project.amount).toLocaleString("id-ID")}
                </Text>
              </View>
              <Text style={styles.projectTitle}>{project.title}</Text>
              <Text style={styles.role}>
                {isSeller ? "Kamu sebagai seller" : "Kamu sebagai buyer"}
              </Text>
              <Text style={styles.revisionAllowance}>
                Revisi digunakan: {project.revision_count} /{" "}
                {project.revision_limit + project.extra_revisions_granted}
                {" · "}
                {project.extra_revisions_granted} tambahan
              </Text>
              {!!project.description && (
                <Text style={styles.description}>{project.description}</Text>
              )}
              {!!project.revision_request && (
                <View style={styles.revisionCard}>
                  <Text style={styles.revisionTitle}>Permintaan revisi</Text>
                  <Text style={styles.revisionText}>{project.revision_request}</Text>
                </View>
              )}
              {!!project.delivery_url && (
                <View style={styles.deliveryRow}>
                  <Text style={styles.deliveryLabel}>Hasil kerja</Text>
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => {
                      if (project.delivery_url) {
                        void openDelivery(project.delivery_url);
                      }
                    }}
                  >
                    <Text style={styles.delivery}>Buka hasil kerja ↗</Text>
                  </Pressable>
                </View>
              )}

              {project.status !== "completed" &&
                isSeller &&
                (project.status === "in_progress" ||
                  Boolean(project.revision_request)) && (
                <View style={styles.actionGroup}>
                  <TextInput
                    accessibilityLabel="Tautan hasil kerja"
                    autoCapitalize="none"
                    editable={!isBusy}
                    keyboardType="url"
                    onChangeText={(value) =>
                      setDeliveries((current) => ({
                        ...current,
                        [project.id]: value,
                      }))
                    }
                    placeholder="Tempel tautan hasil kerja"
                    placeholderTextColor="#98A2B3"
                    style={styles.input}
                    value={deliveries[project.id] ?? ""}
                  />
                  <Pressable
                    disabled={isBusy}
                    onPress={() =>
                      void runProjectAction(project.id, () =>
                        submitProjectDelivery(
                          project.id,
                          deliveries[project.id] ?? "",
                        ),
                      )
                    }
                    style={[styles.primaryButton, isBusy && styles.disabled]}
                  >
                    <Text style={styles.primaryButtonText}>
                      {isBusy ? "Mengirim..." : "Kirim Hasil Kerja"}
                    </Text>
                  </Pressable>
                </View>
              )}

              {project.status === "revision" &&
                isSeller &&
                !project.revision_request &&
                project.revision_count >=
                  project.revision_limit + project.extra_revisions_granted && (
                  <View style={styles.actionGroup}>
                    <Text style={styles.extraRevisionNotice}>
                      Batas revisi telah digunakan. Setelah biaya tambahan
                      disepakati dan dibayar di luar aplikasi, seller dapat
                      membuka satu revisi tambahan.
                    </Text>
                    <Pressable
                      disabled={isBusy}
                      onPress={() =>
                        Alert.alert(
                          "Buka revisi tambahan?",
                          "Pastikan biaya revisi tambahan sudah disepakati dan dibayar di luar aplikasi.",
                          [
                            { text: "Batal", style: "cancel" },
                            {
                              text: "Sudah disepakati",
                              onPress: () =>
                                void runProjectAction(project.id, async () => {
                                  const extraRevisionsGranted =
                                    await grantExtraProjectRevision(project.id);
                                  return {
                                    ...project,
                                    extra_revisions_granted:
                                      extraRevisionsGranted,
                                    updated_at: new Date().toISOString(),
                                  };
                                }),
                            },
                          ],
                        )
                      }
                      style={[
                        styles.secondaryButton,
                        isBusy && styles.disabled,
                      ]}
                    >
                      <Text style={styles.secondaryButtonText}>
                        {isBusy ? "Memproses..." : "Buka 1 revisi tambahan"}
                      </Text>
                    </Pressable>
                  </View>
                )}

              {project.status === "revision" &&
                !isSeller &&
                !project.revision_request &&
                project.revision_count <
                  project.revision_limit + project.extra_revisions_granted && (
                <View style={styles.actionGroup}>
                  <Text style={styles.reviewTitle}>Tinjau hasil kerja</Text>
                  <Text style={styles.reviewHint}>
                    Cocokkan hasil dengan lingkup yang disepakati. Jika masih
                    ada yang perlu diperbaiki, jelaskan dengan spesifik agar
                    seller dapat menindaklanjutinya.
                  </Text>
                  <Text style={styles.revisionRemaining}>
                    Sisa revisi:{" "}
                    {project.revision_limit +
                      project.extra_revisions_granted -
                      project.revision_count}
                  </Text>
                  <TextInput
                    accessibilityLabel="Permintaan revisi"
                    editable={!isBusy}
                    multiline
                    maxLength={1000}
                    onChangeText={(value) =>
                      setRevisionNotes((current) => ({
                        ...current,
                        [project.id]: value,
                      }))
                    }
                    placeholder="Jelaskan revisi yang dibutuhkan"
                    placeholderTextColor="#98A2B3"
                    style={[styles.input, styles.multilineInput]}
                    value={revisionNotes[project.id] ?? ""}
                  />
                  <Text style={styles.characterCount}>
                    {(revisionNotes[project.id] ?? "").length}/1.000 karakter
                  </Text>
                  <Pressable
                    disabled={
                      isBusy ||
                      (revisionNotes[project.id] ?? "").trim().length < 5
                    }
                    onPress={() =>
                      void runProjectAction(project.id, () =>
                        requestProjectRevision(
                          project.id,
                          revisionNotes[project.id] ?? "",
                        ),
                      )
                    }
                    style={[
                      styles.secondaryButton,
                      (isBusy ||
                        (revisionNotes[project.id] ?? "").trim().length < 5) &&
                        styles.disabled,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>Minta Revisi</Text>
                  </Pressable>
                  {!!project.delivery_url && !project.revision_request && (
                    <Pressable
                      disabled={isBusy}
                      onPress={() =>
                        Alert.alert(
                          "Setujui hasil dan selesaikan proyek?",
                          "Setelah proyek selesai, kamu tidak dapat mengajukan revisi lagi.",
                          [
                            { text: "Periksa lagi", style: "cancel" },
                            {
                              text: "Ya, selesaikan",
                              onPress: () =>
                                void runProjectAction(project.id, () =>
                                  completeProject(project.id),
                                ),
                            },
                          ],
                        )
                      }
                      style={[styles.primaryButton, isBusy && styles.disabled]}
                    >
                      <Text style={styles.primaryButtonText}>
                        Setujui hasil & selesaikan
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
              {project.status === "revision" &&
                !isSeller &&
                project.revision_request && (
                  <Text style={styles.extraRevisionNotice}>
                    Permintaan revisi sudah dikirim. Menunggu seller mengirim
                    hasil yang diperbarui.
                  </Text>
                )}
              {project.status === "revision" &&
                !isSeller &&
                !project.revision_request &&
                project.revision_count >=
                  project.revision_limit + project.extra_revisions_granted && (
                  <Text style={styles.extraRevisionNotice}>
                    Batas revisi yang disepakati telah habis. Permintaan revisi
                    berikutnya dikenakan biaya tambahan. Sepakati dan bayarkan
                    langsung kepada seller; seller perlu membuka revisi
                    tambahan sebelum Anda dapat mengirim permintaan.
                  </Text>
                )}
            </View>
          );
        })
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>▣</Text>
          <Text style={styles.emptyTitle}>Belum ada proyek</Text>
          <Text style={styles.emptyText}>
            Proyek dari transaksi jasa akan muncul di sini.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 14, backgroundColor: AppColors.canvas, flexGrow: 1, alignSelf: "center", width: "100%", maxWidth: 640 },
  eyebrow: { color: "#667085", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: "#172033", fontSize: 30, fontWeight: "800" },
  subtitle: { color: "#667085", fontSize: 14, lineHeight: 21, marginTop: -8 },
  segmentBar: { flexDirection: "row", padding: 4, borderRadius: 15, backgroundColor: "#E9ECF5", marginTop: 6 },
  segment: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 12 },
  segmentActive: { backgroundColor: AppColors.surface, shadowColor: "#172033", shadowOpacity: 0.08, shadowRadius: 5, elevation: 2 },
  segmentText: { color: AppColors.muted, fontSize: 12, fontWeight: "700" },
  segmentTextActive: { color: AppColors.brand },
  error: { padding: 12, borderRadius: 12, color: "#A12A38", backgroundColor: "#FDECEF", fontSize: 13 },
  loading: { marginTop: 40 },
  card: { width: "100%", padding: 18, borderRadius: 20, backgroundColor: AppColors.surface, borderWidth: 1, borderColor: AppColors.border, gap: 12 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardStatus: { color: AppColors.brand, backgroundColor: AppColors.brandTint, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, fontSize: 12, fontWeight: "800" },
  amount: { color: "#172033", fontSize: 13, fontWeight: "800" },
  projectTitle: { color: "#172033", fontSize: 17, fontWeight: "800" },
  role: { color: AppColors.muted, fontSize: 12, fontWeight: "600", marginTop: -8 },
  revisionAllowance: { color: "#667085", fontSize: 12, fontWeight: "600" },
  description: { color: "#667085", fontSize: 13, lineHeight: 19 },
  revisionCard: { padding: 12, borderRadius: 13, backgroundColor: "#FFF7E8", gap: 4 },
  revisionTitle: { color: "#9A5B00", fontSize: 11, fontWeight: "800" },
  revisionText: { color: "#6E4A1D", fontSize: 13, lineHeight: 19 },
  extraRevisionNotice: { color: "#6E4A1D", backgroundColor: "#FFF7E8", padding: 12, borderRadius: 12, fontSize: 12, lineHeight: 18 },
  deliveryRow: { gap: 5 },
  deliveryLabel: { color: AppColors.muted, fontSize: 12, fontWeight: "700" },
  delivery: { color: AppColors.brand, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  actionGroup: { gap: 9, marginTop: 3 },
  reviewTitle: { color: "#172033", fontSize: 15, fontWeight: "800" },
  reviewHint: { color: AppColors.muted, fontSize: 13, lineHeight: 19 },
  revisionRemaining: { color: AppColors.brand, fontSize: 12, fontWeight: "700" },
  characterCount: { color: AppColors.muted, fontSize: 11, textAlign: "right", marginTop: -5 },
  input: { minHeight: 46, paddingHorizontal: 13, borderWidth: 1, borderColor: "#DDE2EE", borderRadius: 12, color: "#172033", fontSize: 13 },
  multilineInput: { minHeight: 78, paddingTop: 12, textAlignVertical: "top" },
  primaryButton: { alignItems: "center", paddingVertical: 14, borderRadius: 12, backgroundColor: AppColors.brand },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  secondaryButton: { alignItems: "center", paddingVertical: 13, borderRadius: 12, backgroundColor: AppColors.brandTint },
  secondaryButtonText: { color: AppColors.brand, fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.55 },
  emptyCard: { width: "100%", alignItems: "center", paddingHorizontal: 24, paddingVertical: 34, borderRadius: 20, backgroundColor: AppColors.surface, borderWidth: 1, borderColor: AppColors.border, gap: 8, marginTop: 4 },
  emptyIcon: { color: AppColors.brand, fontSize: 30 },
  emptyTitle: { color: "#172033", fontSize: 16, fontWeight: "800" },
  emptyText: { color: "#667085", fontSize: 13, lineHeight: 19, textAlign: "center" },
});
