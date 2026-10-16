import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { InvoicePayload } from "@/core/types/communication";
import { AppColors } from "@/constants/app-theme";

export function ChatSystemCard({ invoice }: { invoice: InvoicePayload }) {
  const router = useRouter();

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>INVOICE PROYEK</Text>
      <Text style={styles.title}>{invoice.title}</Text>
      {!!invoice.description && (
        <Text style={styles.description}>{invoice.description}</Text>
      )}
      <Text style={styles.amount}>
        Rp{invoice.amount.toLocaleString("id-ID")}
      </Text>
      <Text style={styles.paymentNote}>
        Pembayaran disepakati dan dilakukan langsung di luar aplikasi.
      </Text>
      {invoice.revision_limit !== undefined && (
        <Text style={styles.revisions}>
          Termasuk {invoice.revision_limit} revisi gratis
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: "/projects/[id]",
            params: { id: invoice.project_id },
          })
        }
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>Buka Detail Proyek</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 270,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    gap: 8,
  },
  eyebrow: { color: AppColors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  title: { color: AppColors.ink, fontSize: 15, fontWeight: "700" },
  description: { color: AppColors.muted, fontSize: 13, lineHeight: 19 },
  amount: { color: AppColors.brand, fontSize: 18, fontWeight: "800" },
  paymentNote: { color: AppColors.muted, fontSize: 12, lineHeight: 17 },
  revisions: { color: AppColors.muted, fontSize: 12 },
  button: {
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: AppColors.brand,
  },
  pressed: { opacity: 0.8 },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
