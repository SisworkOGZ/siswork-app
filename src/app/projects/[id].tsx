import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { loadMyProjects } from "@/core/services/projects";
import { supabase } from "@/core/services/supabase";
import type { ProjectRow } from "@/core/types/communication";

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    const load = async () => {
      try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!data.user) throw new Error("Silakan login untuk melihat proyek.");
        const projects = await loadMyProjects(data.user.id);
        if (current) {
          setProject(projects.find((item) => item.id === id) ?? null);
          if (!projects.some((item) => item.id === id)) {
            setError("Proyek tidak ditemukan atau Anda tidak memiliki akses.");
          }
        }
      } catch (loadError) {
        if (current) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Detail proyek tidak dapat dimuat.",
          );
        }
      } finally {
        if (current) setLoading(false);
      }
    };
    void load();
    return () => {
      current = false;
    };
  }, [id]);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: Math.max(insets.top, 18), paddingBottom: 30 },
      ]}
    >
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>‹  Kembali</Text>
      </Pressable>
      {loading ? (
        <ActivityIndicator color="#4356C5" style={styles.loading} />
      ) : project ? (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>DETAIL PROYEK</Text>
          <Text style={styles.title}>{project.title}</Text>
          <Text style={styles.status}>
            {project.status === "in_progress"
              ? "Dalam Proses"
              : project.status === "revision"
                ? "Dalam Revisi"
                : "Selesai"}
          </Text>
          <Text style={styles.amount}>
            Rp{Number(project.amount).toLocaleString("id-ID")}
          </Text>
          <Text style={styles.revisionAllowance}>
            Revisi digunakan {project.revision_count} dari{" "}
            {project.revision_limit + project.extra_revisions_granted}{" "}
            revisi yang disepakati.
          </Text>
          {project.extra_revisions_granted > 0 && (
            <Text style={styles.description}>
              {project.extra_revisions_granted} revisi tambahan disepakati
              langsung dengan seller.
            </Text>
          )}
          {!!project.description && (
            <Text style={styles.description}>{project.description}</Text>
          )}
          {!!project.revision_request && (
            <View style={styles.revision}>
              <Text style={styles.revisionLabel}>Permintaan revisi</Text>
              <Text style={styles.description}>{project.revision_request}</Text>
            </View>
          )}
          {!!project.delivery_url && (
            <Text style={styles.delivery}>{project.delivery_url}</Text>
          )}
        </View>
      ) : (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {!!error && project && (
        <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 20, gap: 16, backgroundColor: "#F7F8FC" },
  back: { alignSelf: "flex-start", paddingVertical: 8 },
  backText: { color: "#4356C5", fontSize: 14, fontWeight: "700" },
  loading: { marginTop: 50 },
  card: { padding: 20, borderRadius: 22, backgroundColor: "#FFFFFF", gap: 13 },
  eyebrow: { color: "#667085", fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  title: { color: "#172033", fontSize: 24, fontWeight: "800" },
  status: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 18, backgroundColor: "#EEF0FF", color: "#4356C5", fontSize: 11, fontWeight: "800" },
  amount: { color: "#172033", fontSize: 19, fontWeight: "800" },
  revisionAllowance: { color: "#4356C5", fontSize: 13, fontWeight: "700" },
  description: { color: "#667085", fontSize: 14, lineHeight: 21 },
  revision: { padding: 13, borderRadius: 14, backgroundColor: "#FFF7E8", gap: 5 },
  revisionLabel: { color: "#9A5B00", fontSize: 12, fontWeight: "800" },
  delivery: { color: "#4356C5", fontSize: 14, lineHeight: 21 },
  error: { padding: 14, borderRadius: 14, backgroundColor: "#FDECEF", color: "#A12A38", fontSize: 14 },
});
