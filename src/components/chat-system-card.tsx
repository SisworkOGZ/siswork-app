import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { InvoicePayload } from "@/core/types/communication";

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
    borderColor: "#DDE3F3",
    backgroundColor: "#FFFFFF",
    gap: 8,
  },
  eyebrow: { color: "#64748B", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  title: { color: "#172033", fontSize: 15, fontWeight: "700" },
  description: { color: "#64748B", fontSize: 12, lineHeight: 18 },
  amount: { color: "#4356C5", fontSize: 18, fontWeight: "800" },
  revisions: { color: "#64748B", fontSize: 11 },
  button: {
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#4356C5",
  },
  pressed: { opacity: 0.8 },
  buttonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
});
