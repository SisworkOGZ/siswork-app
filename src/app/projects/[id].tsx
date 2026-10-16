import { useCallback, useEffect, useState } from "react";
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
import * as WebBrowser from "expo-web-browser";
import { loadProjectById, payProjectWithMidtrans } from "@/core/services/projects";
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
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setError("");
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!data.user) throw new Error("Silakan login untuk melihat proyek.");
      setUserId(data.user.id);
      const item = await loadProjectById(id);
      if (!item) {
        setError("Proyek tidak ditemukan atau Anda tidak memiliki akses.");
      } else {
        setProject(item);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Detail proyek tidak dapat dimuat.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const task = setTimeout(() => void load(), 0);
    return () => clearTimeout(task);
  }, [load]);

  const payProject = async () => {
    if (!project) return;
    setIsPaying(true);
    setError("");
    try {
      const { redirectUrl } = await payProjectWithMidtrans(project.id);
      await WebBrowser.openBrowserAsync(redirectUrl);
      await load();
    } catch (payError) {
      console.error("Gagal memulai pembayaran proyek:", payError);
      setError(
        payError instanceof Error
          ? `Pembayaran belum dapat dimulai: ${payError.message}`
          : "Pembayaran belum dapat dimulai. Silakan coba lagi.",
      );
    } finally {
      setIsPaying(false);
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

  const isSeller = project?.seller_id === userId;
  const isPaid = project?.payment_status === "paid";
  const isPending = project?.payment_status === "pending";
  const canPay =
    !isSeller &&
    project &&
    project.status !== "completed" &&
    project.payment_status !== "not_required" &&
    project.payment_status !== "paid" &&
    project.payment_status !== "refunded";

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: Math.max(insets.top, 18), paddingBottom: 40 },
      ]}
    >
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>‹  Kembali</Text>
        </Pressable>
        {project && (
          <Pressable onPress={() => void load()} style={styles.refreshButton}>
            <Text style={styles.refreshText}>Segarkan</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={AppColors.brand} style={styles.loading} />
      ) : project ? (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>DETAIL PROYEK</Text>
          <Text style={styles.title}>{project.title}</Text>
          <Text style={styles.role}>
            {isSeller ? "Kamu sebagai seller" : "Kamu sebagai buyer"}
          </Text>

          <View style={styles.badgesRow}>
            <Text style={styles.status}>
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

            {project.payment_status !== "not_required" && (
              <View
                style={[
                  styles.paymentBadge,
                  isPaid && styles.paymentBadgePaid,
                  project.payment_status === "failed" && styles.paymentBadgeFailed,
                ]}
              >
                <Text
                  style={[
                    styles.paymentBadgeText,
                    isPaid && styles.paymentBadgePaidText,
                    project.payment_status === "failed" && styles.paymentBadgeFailedText,
                  ]}
                >
                  {isPaid
                    ? "Lunas · Saldo ditahan"
                    : isPending
                      ? "Menunggu pembayaran"
                      : project.payment_status === "refunded"
                        ? "Dikembalikan"
                        : project.payment_status === "failed"
                          ? "Pembayaran gagal"
                          : "Belum dibayar"}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.amount}>
            Rp{Number(project.amount).toLocaleString("id-ID")}
          </Text>

          {canPay && (
            <View style={styles.paymentActionSection}>
              <Text style={styles.paymentActionNotice}>
                Pembayaran dilakukan aman melalui payment gateway Midtrans. Saldo
                akan ditahan dan baru diteruskan ke seller setelah Anda menerima
                dan menyetujui hasil kerja.
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={isPaying}
                onPress={() => void payProject()}
                style={[styles.payButton, isPaying && styles.disabled]}
              >
                {isPaying ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.payButtonText}>
                    {isPending
                      ? "Lanjutkan Pembayaran (Midtrans)"
                      : "Bayar via Midtrans"}
                  </Text>
                )}
              </Pressable>
            </View>
          )}

          {isSeller && !isPaid && project.payment_status !== "not_required" && (
            <View style={styles.sellerNotice}>
              <Text style={styles.sellerNoticeText}>
                Menunggu pembayaran dari buyer via Midtrans. Anda dapat
                mengerjakan proyek, namun pengiriman hasil kerja baru dapat
                dilakukan setelah pembayaran terverifikasi.
              </Text>
            </View>
          )}

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
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 16,
    backgroundColor: AppColors.canvas,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: { paddingVertical: 8 },
  backText: { color: AppColors.brand, fontSize: 14, fontWeight: "700" },
  refreshButton: { paddingVertical: 8, paddingHorizontal: 12 },
  refreshText: { color: AppColors.brand, fontSize: 13, fontWeight: "700" },
  loading: { marginTop: 50 },
  card: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    padding: 22,
    borderRadius: 22,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
    gap: 13,
  },
  eyebrow: {
    color: "#667085",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: { color: "#172033", fontSize: 24, fontWeight: "800" },
  role: { color: AppColors.muted, fontSize: 13, fontWeight: "600" },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  status: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: AppColors.brandTint,
    color: AppColors.brand,
    fontSize: 12,
    fontWeight: "800",
  },
  paymentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: "#F0F4FF",
  },
  paymentBadgeText: {
    color: "#2C4075",
    fontSize: 12,
    fontWeight: "800",
  },
  paymentBadgePaid: {
    backgroundColor: "#E2F4EC",
  },
  paymentBadgePaidText: {
    color: "#0F766E",
  },
  paymentBadgeFailed: {
    backgroundColor: "#FDECEF",
  },
  paymentBadgeFailedText: {
    color: "#A12A38",
  },
  amount: { color: "#172033", fontSize: 22, fontWeight: "800" },
  paymentActionSection: {
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  paymentActionNotice: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 19,
  },
  payButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: AppColors.brand,
  },
  payButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  sellerNotice: {
    padding: 13,
    borderRadius: 14,
    backgroundColor: "#FFF7E8",
  },
  sellerNoticeText: {
    color: "#9A5B00",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  revisionAllowance: {
    color: AppColors.brand,
    fontSize: 13,
    fontWeight: "700",
  },
  description: { color: "#667085", fontSize: 14, lineHeight: 21 },
  revision: {
    padding: 13,
    borderRadius: 14,
    backgroundColor: "#FFF7E8",
    gap: 5,
  },
  revisionLabel: { color: "#9A5B00", fontSize: 12, fontWeight: "800" },
  extraRevisionNotice: {
    padding: 13,
    borderRadius: 14,
    backgroundColor: "#FFF7E8",
    color: "#9A5B00",
    fontSize: 14,
    lineHeight: 20,
  },
  delivery: { color: AppColors.brand, fontSize: 14, lineHeight: 21, fontWeight: "700" },
  disabled: { opacity: 0.6 },
  error: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#FDECEF",
    color: "#A12A38",
    fontSize: 14,
  },
});

