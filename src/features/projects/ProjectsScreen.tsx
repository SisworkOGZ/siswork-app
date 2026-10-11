import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
  loadMyProjects,
  requestProjectRevision,
  submitProjectDelivery,
} from "@/core/services/projects";
import { supabase } from "@/core/services/supabase";
import type { ProjectRow, ProjectStatus } from "@/core/types/communication";

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
        Pantau pekerjaan dan kirim hasil langsung di sini.
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
        <ActivityIndicator color="#4356C5" style={styles.loading} />
      ) : visibleProjects.length ? (
        visibleProjects.map((project) => {
          const isSeller = project.seller_id === userId;
          const isBusy = busyProjectId === project.id;
          return (
            <View key={project.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardStatus}>
                  {segments.find((item) => item.status === project.status)?.label}
                </Text>
                <Text style={styles.amount}>
                  Rp{Number(project.amount).toLocaleString("id-ID")}
                </Text>
              </View>
              <Text style={styles.projectTitle}>{project.title}</Text>
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
                <Text numberOfLines={2} style={styles.delivery}>
                  Hasil kerja: {project.delivery_url}
                </Text>
              )}

              {project.status !== "completed" && isSeller && (
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

              {project.status === "revision" && !isSeller && (
                <View style={styles.actionGroup}>
                  <TextInput
                    accessibilityLabel="Permintaan revisi"
                    editable={!isBusy}
                    multiline
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
                  <Pressable
                    disabled={isBusy}
                    onPress={() =>
                      void runProjectAction(project.id, () =>
                        requestProjectRevision(
                          project.id,
                          revisionNotes[project.id] ?? "",
                        ),
                      )
                    }
                    style={[styles.secondaryButton, isBusy && styles.disabled]}
                  >
                    <Text style={styles.secondaryButtonText}>Minta Revisi</Text>
                  </Pressable>
                  {!!project.delivery_url && (
                    <Pressable
                      disabled={isBusy}
                      onPress={() =>
                        void runProjectAction(project.id, () =>
                          completeProject(project.id),
                        )
                      }
                      style={[styles.primaryButton, isBusy && styles.disabled]}
                    >
                      <Text style={styles.primaryButtonText}>
                        Tandai Selesai
                      </Text>
                    </Pressable>
                  )}
                </View>
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
  container: { paddingHorizontal: 20, gap: 14, backgroundColor: "#F7F8FC", flexGrow: 1 },
  eyebrow: { color: "#667085", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: "#172033", fontSize: 30, fontWeight: "800" },
  subtitle: { color: "#667085", fontSize: 14, lineHeight: 21, marginTop: -8 },
  segmentBar: { flexDirection: "row", padding: 4, borderRadius: 15, backgroundColor: "#E9ECF5", marginTop: 6 },
  segment: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 12 },
  segmentActive: { backgroundColor: "#FFFFFF", shadowColor: "#172033", shadowOpacity: 0.08, shadowRadius: 5, elevation: 2 },
  segmentText: { color: "#667085", fontSize: 11, fontWeight: "700" },
  segmentTextActive: { color: "#4356C5" },
  error: { padding: 12, borderRadius: 12, color: "#A12A38", backgroundColor: "#FDECEF", fontSize: 13 },
  loading: { marginTop: 40 },
  card: { padding: 17, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8EAF2", gap: 11 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardStatus: { color: "#4356C5", backgroundColor: "#EEF0FF", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, fontSize: 10, fontWeight: "800" },
  amount: { color: "#172033", fontSize: 13, fontWeight: "800" },
  projectTitle: { color: "#172033", fontSize: 17, fontWeight: "800" },
  description: { color: "#667085", fontSize: 13, lineHeight: 19 },
  revisionCard: { padding: 12, borderRadius: 13, backgroundColor: "#FFF7E8", gap: 4 },
  revisionTitle: { color: "#9A5B00", fontSize: 11, fontWeight: "800" },
  revisionText: { color: "#6E4A1D", fontSize: 13, lineHeight: 19 },
  delivery: { color: "#4356C5", fontSize: 12, lineHeight: 18 },
  actionGroup: { gap: 9, marginTop: 3 },
  input: { minHeight: 46, paddingHorizontal: 13, borderWidth: 1, borderColor: "#DDE2EE", borderRadius: 12, color: "#172033", fontSize: 13 },
  multilineInput: { minHeight: 78, paddingTop: 12, textAlignVertical: "top" },
  primaryButton: { alignItems: "center", paddingVertical: 13, borderRadius: 12, backgroundColor: "#4356C5" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  secondaryButton: { alignItems: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: "#EEF0FF" },
  secondaryButtonText: { color: "#4356C5", fontSize: 12, fontWeight: "800" },
  disabled: { opacity: 0.55 },
  emptyCard: { alignItems: "center", paddingHorizontal: 24, paddingVertical: 34, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8EAF2", gap: 8, marginTop: 4 },
  emptyIcon: { color: "#4356C5", fontSize: 30 },
  emptyTitle: { color: "#172033", fontSize: 16, fontWeight: "800" },
  emptyText: { color: "#667085", fontSize: 13, lineHeight: 19, textAlign: "center" },
});
