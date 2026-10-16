import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { loadMyProjects } from "@/core/services/projects";
import { supabase } from "@/core/services/supabase";
import type { ProjectRow } from "@/core/types/communication";
import { AppColors } from "@/constants/app-theme";

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
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
          setUserId(data.user.id);
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
        { paddingTop: Math.max(insets.top, 18), paddingBottom: 30 },
      ]}
    >
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>‹  Kembali</Text>
      </Pressable>
      {loading ? (
        <ActivityIndicator color={AppColors.brand} style={styles.loading} />
      ) : project ? (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>DETAIL PROYEK</Text>
          <Text style={styles.title}>{project.title}</Text>
          <Text style={styles.role}>
            {project.seller_id === userId
              ? "Kamu sebagai seller"
              : "Kamu sebagai buyer"}
          </Text>
          <Text style={styles.status}>
            {project.status === "completed"
              ? "Selesai"
              : project.status === "in_progress"
                ? "Sedang dikerjakan"
                : project.revision_request
                  ? project.seller_id === userId
                    ? "Perlu diperbaiki"
                    : "Menunggu revisi"
                  : project.seller_id === userId
                    ? "Menunggu buyer meninjau"
                    : "Hasil siap ditinjau"}
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
          {project.status === "revision" &&
            !project.revision_request &&
            project.revision_count >=
              project.revision_limit + project.extra_revisions_granted && (
              <Text style={styles.extraRevisionNotice}>
                Batas revisi yang disepakati telah habis. Revisi berikutnya
                dikenakan biaya tambahan. Sepakati dan bayarkan langsung kepada
                seller sebelum seller membuka revisi tambahan.
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
            <Pressable
              accessibilityRole="link"
              onPress={() => {
                if (project.delivery_url) void openDelivery(project.delivery_url);
              }}
            >
              <Text style={styles.delivery}>Buka hasil kerja ↗</Text>
            </Pressable>
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
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, gap: 16, backgroundColor: AppColors.canvas },
  back: { alignSelf: "flex-start", paddingVertical: 8 },
  backText: { color: AppColors.brand, fontSize: 14, fontWeight: "700" },
  loading: { marginTop: 50 },
  card: { width: "100%", maxWidth: 600, alignSelf: "center", padding: 22, borderRadius: 22, backgroundColor: AppColors.surface, borderWidth: 1, borderColor: AppColors.border, gap: 13 },
  eyebrow: { color: "#667085", fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  title: { color: "#172033", fontSize: 24, fontWeight: "800" },
  role: { color: AppColors.muted, fontSize: 13, fontWeight: "600" },
  status: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 18, backgroundColor: AppColors.brandTint, color: AppColors.brand, fontSize: 12, fontWeight: "800" },
  amount: { color: "#172033", fontSize: 19, fontWeight: "800" },
  revisionAllowance: { color: AppColors.brand, fontSize: 13, fontWeight: "700" },
  description: { color: "#667085", fontSize: 14, lineHeight: 21 },
  revision: { padding: 13, borderRadius: 14, backgroundColor: "#FFF7E8", gap: 5 },
  revisionLabel: { color: "#9A5B00", fontSize: 12, fontWeight: "800" },
  extraRevisionNotice: { padding: 13, borderRadius: 14, backgroundColor: "#FFF7E8", color: "#9A5B00", fontSize: 14, lineHeight: 20 },
  delivery: { color: AppColors.brand, fontSize: 14, lineHeight: 21 },
  error: { padding: 14, borderRadius: 14, backgroundColor: "#FDECEF", color: "#A12A38", fontSize: 14 },
});
