import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "@/core/services/supabase";
import { AppColors } from "@/constants/app-theme";

type WalletEntry = { amount: number };
type PayoutAccount = { provider: string; account_number: string };
type Withdrawal = {
  id: string;
  amount: number;
  provider: string;
  status: "processing" | "completed" | "failed";
  created_at: string;
};

function createIdempotencyKey() {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (value) => {
    const random = Number.parseInt(hex(), 16);
    return (value === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

const withdrawalStatus: Record<Withdrawal["status"], string> = {
  processing: "Diproses",
  completed: "Berhasil",
  failed: "Gagal · saldo dikembalikan",
};

export function SellerWalletSection({ sellerId }: { sellerId: string }) {
  const [balance, setBalance] = useState(0);
  const [account, setAccount] = useState<PayoutAccount | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const [ledgerResult, accountResult, withdrawalResult] = await Promise.all([
        supabase
          .from("seller_wallet_transactions")
          .select("amount")
          .eq("seller_id", sellerId),
        supabase
          .from("seller_payout_accounts")
          .select("provider, account_number")
          .eq("user_id", sellerId)
          .maybeSingle(),
        supabase
          .from("seller_withdrawals")
          .select("id, amount, provider, status, created_at")
          .eq("seller_id", sellerId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      if (ledgerResult.error) throw ledgerResult.error;
      if (accountResult.error) throw accountResult.error;
      if (withdrawalResult.error) throw withdrawalResult.error;

      setBalance(
        (ledgerResult.data ?? []).reduce(
          (total, entry: WalletEntry) => total + Number(entry.amount),
          0,
        ),
      );
      setAccount(accountResult.data);
      setWithdrawals((withdrawalResult.data ?? []) as Withdrawal[]);
    } catch (loadError) {
      console.error("Gagal memuat saldo seller:", loadError);
      setError(
        loadError instanceof Error
          ? `Saldo belum dapat dimuat: ${loadError.message}`
          : "Saldo belum dapat dimuat. Silakan coba lagi.",
      );
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    const task = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(task);
  }, [refresh]);

  const refreshPayoutStatus = async () => {
    setLoading(true);
    setError("");
    try {
      const { error: refreshError } = await supabase.functions.invoke(
        "refresh-wallet-payouts",
        { body: {} },
      );
      if (refreshError) throw refreshError;
      await refresh();
    } catch (refreshError) {
      console.error("Gagal memperbarui status pencairan:", refreshError);
      setError(
        refreshError instanceof Error
          ? `Status penarikan belum dapat diperbarui: ${refreshError.message}`
          : "Status penarikan belum dapat diperbarui.",
      );
      setLoading(false);
    }
  };

  const requestWithdrawal = async () => {
    const requestedAmount = Number(amount.replace(/\D/g, ""));
    if (!Number.isSafeInteger(requestedAmount) || requestedAmount <= 0) {
      setError("Masukkan jumlah penarikan berupa angka di atas nol.");
      return;
    }
    if (requestedAmount > balance) {
      setError("Jumlah penarikan melebihi saldo tersedia.");
      return;
    }

    setIsWithdrawing(true);
    setError("");
    setNotice("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "request-wallet-payout",
        {
          body: {
            amount: requestedAmount,
            idempotencyKey: createIdempotencyKey(),
          },
        },
      );
      if (invokeError) throw invokeError;
      if (!data || typeof data.message !== "string") {
        throw new Error("Server tidak mengonfirmasi permintaan penarikan.");
      }
      setNotice(data.message);
      setAmount("");
      await refresh();
    } catch (withdrawalError) {
      console.error("Gagal meminta penarikan saldo:", withdrawalError);
      setError(
        withdrawalError instanceof Error
          ? `Penarikan belum dapat diproses: ${withdrawalError.message}`
          : "Penarikan belum dapat diproses. Periksa status sebelum mencoba lagi.",
      );
      await refresh();
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Saldo seller</Text>
      <View style={styles.card}>
        {loading ? (
          <ActivityIndicator color={AppColors.brand} />
        ) : (
          <>
            <Text style={styles.balanceLabel}>Saldo tersedia</Text>
            <Text style={styles.balance}>
              Rp{balance.toLocaleString("id-ID")}
            </Text>
            <Text style={styles.holdNote}>
              Penghasilan masuk setelah buyer menyelesaikan proyek. Dana proyek
              yang belum selesai tetap tertahan.
            </Text>

            {account ? (
              <>
                <Text style={styles.account}>
                  Tujuan: {account.provider} · ••••{" "}
                  {account.account_number.slice(-4)}
                </Text>
                <TextInput
                  accessibilityLabel="Jumlah saldo yang ingin ditarik"
                  editable={!isWithdrawing && !loading}
                  keyboardType="number-pad"
                  onChangeText={(value) => setAmount(value.replace(/\D/g, ""))}
                  placeholder="Jumlah penarikan (Rp)"
                  placeholderTextColor={AppColors.subtle}
                  style={styles.input}
                  value={amount}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={isWithdrawing || loading || balance <= 0}
                  onPress={() => void requestWithdrawal()}
                  style={[
                    styles.button,
                    (isWithdrawing || loading || balance <= 0) &&
                      styles.disabled,
                  ]}
                >
                  {isWithdrawing ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>Tarik saldo</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <Text style={styles.holdNote}>
                Tambahkan e-wallet pada pengaturan profil seller untuk menarik
                saldo.
              </Text>
            )}

            {withdrawals.length > 0 && (
              <View style={styles.history}>
                <View style={styles.historyHeading}>
                  <Text style={styles.historyTitle}>Riwayat penarikan</Text>
                  {withdrawals.some((item) => item.status === "processing") && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void refreshPayoutStatus()}
                      style={styles.refreshButton}
                    >
                      <Text style={styles.refreshText}>Perbarui</Text>
                    </Pressable>
                  )}
                </View>
                {withdrawals.map((item) => (
                  <View key={item.id} style={styles.historyRow}>
                    <View style={styles.historyCopy}>
                      <Text style={styles.historyAmount}>
                        Rp{Number(item.amount).toLocaleString("id-ID")} ·{" "}
                        {item.provider}
                      </Text>
                      <Text style={styles.historyDate}>
                        {new Date(item.created_at).toLocaleDateString("id-ID")}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.historyStatus,
                        item.status === "failed" && styles.failed,
                        item.status === "completed" && styles.completed,
                      ]}
                    >
                      {withdrawalStatus[item.status]}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
        {!!notice && <Text style={styles.notice}>{notice}</Text>}
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 22 },
  sectionTitle: {
    marginBottom: 12,
    color: AppColors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  card: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  balanceLabel: { color: AppColors.muted, fontSize: 13 },
  balance: {
    marginTop: 4,
    color: AppColors.ink,
    fontSize: 25,
    fontWeight: "800",
  },
  holdNote: {
    marginTop: 8,
    color: AppColors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  account: {
    marginTop: 16,
    color: AppColors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    marginTop: 12,
    minHeight: 46,
    paddingHorizontal: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    color: AppColors.ink,
    fontSize: 15,
  },
  button: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: AppColors.brand,
  },
  disabled: { opacity: 0.55 },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  history: { marginTop: 20 },
  historyHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  historyTitle: { color: AppColors.ink, fontSize: 14, fontWeight: "700" },
  refreshButton: { paddingHorizontal: 8, paddingVertical: 5 },
  refreshText: { color: AppColors.brand, fontSize: 12, fontWeight: "700" },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
  },
  historyCopy: { flex: 1 },
  historyAmount: { color: AppColors.ink, fontSize: 12, fontWeight: "600" },
  historyDate: { marginTop: 3, color: AppColors.subtle, fontSize: 11 },
  historyStatus: { color: AppColors.muted, fontSize: 11, fontWeight: "700" },
  failed: { color: AppColors.error },
  completed: { color: AppColors.success },
  notice: { marginTop: 12, color: AppColors.success, fontSize: 13 },
  error: { marginTop: 12, color: AppColors.error, fontSize: 13, lineHeight: 18 },
});
