import React, { useState, useRef } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { isSupabaseConfigured, supabase } from "@/core/services/supabase";
import { saveStudentRegistration } from "@/core/services/student-registration";
import { AppColors } from "@/constants/app-theme";
import { SisworkLogo } from "@/components/siswork-logo";

interface RegisterFormData {
  nisn: string;
  fullName: string;
  school: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

const createEmptyForm = (): RegisterFormData => ({
  nisn: "",
  fullName: "",
  school: "",
  email: "",
  password: "",
  confirmPassword: "",
  acceptTerms: false,
});

export default function RegisterScreen() {
  const router = useRouter();
  const [formData, setFormData] = useState<RegisterFormData>(createEmptyForm);

  const updateFormField = <K extends keyof RegisterFormData>(
    field: K,
    value: RegisterFormData[K],
  ) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
  };

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isValidatingNisn, setIsValidatingNisn] = useState<boolean>(false);
  const [isNisnVerified, setIsNisnVerified] = useState<boolean>(false);
  const nisnRequestId = useRef(0);

  const checkNisn = async (nisn: string, requestId: number) => {
    setIsValidatingNisn(true);
    setErrors((prev) => ({ ...prev, nisn: "" }));

    if (!isSupabaseConfigured) {
      setErrors((prev) => ({
        ...prev,
        nisn: "Konfigurasi Supabase belum valid. Periksa URL dan anon key di file .env, lalu mulai ulang Metro.",
      }));
      setIsNisnVerified(false);
      setIsValidatingNisn(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("validate_student_nisn", {
        p_nisn: nisn,
      });

      if (requestId !== nisnRequestId.current) return;

      if (error) {
        console.error("Gagal memeriksa NISN:", error.message);
        setErrors((prev) => ({
          ...prev,
          nisn: "Terjadi kesalahan saat memeriksa NISN. Silakan coba lagi.",
        }));
        setIsNisnVerified(false);
        return;
      }

      if (!data || typeof data !== "object") {
        setErrors((prev) => ({
          ...prev,
          nisn: "NISN tidak terdaftar di data pokok siswa.",
        }));
        return;
      }

      const student = data as {
        full_name?: unknown;
        school_name?: unknown;
        is_registered?: unknown;
      };

      if (student.is_registered === true) {
        setErrors((prev) => ({
          ...prev,
          nisn: "NISN ini sudah terdaftar. Silakan langsung login.",
        }));
        setIsNisnVerified(false);
        return;
      }

      setFormData((prev) => ({
        ...prev,
        fullName:
          typeof student.full_name === "string" ? student.full_name : "",
        school: typeof student.school_name === "string" ? student.school_name : "",
      }));
      setIsNisnVerified(true);
    } catch (error) {
      if (requestId !== nisnRequestId.current) return;

      console.error("Exception pada checkNisn:", error);
      setErrors((prev) => ({
        ...prev,
        nisn: "NISN tidak dapat diperiksa. Silakan coba lagi.",
      }));
      setIsNisnVerified(false);
    } finally {
      if (requestId === nisnRequestId.current) {
        setIsValidatingNisn(false);
      }
    }
  };

  const handleNisnChange = (value: string) => {
    const nisn = value.replace(/\D/g, "").slice(0, 10);
    const requestId = ++nisnRequestId.current;
    setFormData((previous) => ({
      ...createEmptyForm(),
      nisn,
      fullName: previous.fullName && previous.nisn === nisn ? previous.fullName : "",
      school: previous.school && previous.nisn === nisn ? previous.school : "",
    }));
    setIsNisnVerified(false);
    setIsValidatingNisn(false);
    setErrors((previous) => ({ ...previous, nisn: "" }));

    if (nisn.length === 10) {
      void checkNisn(nisn, requestId);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!isNisnVerified) newErrors.nisn = "Masukkan 10 digit NISN yang valid.";
    if (!formData.email) newErrors.email = "Email wajib diisi.";
    if (formData.password.length < 8)
      newErrors.password = "Password minimal 8 karakter.";
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Konfirmasi password tidak cocok.";
    }
    if (!formData.acceptTerms) {
      newErrors.acceptTerms = "Anda harus menyetujui ketentuan berlaku.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 2. Submit & Inserksi ke Supabase Database
  const handleSubmit = async () => {
    if (!validateForm() || isValidatingNisn) return;

    setIsSubmitting(true);
    try {
      // Step A: Register di Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          data: {
            nisn: formData.nisn,
          },
        },
      });

      if (authError) throw authError;
      const user = authData.user;

      if (!user) throw new Error("Data akun tidak diterima dari server.");

      if (!authData.session) {
        Alert.alert(
          "Konfirmasi Email",
          "Akun berhasil dibuat. Konfirmasi email Anda, lalu login untuk menyelesaikan registrasi.",
        );
        router.replace("/auth/screens/LoginScreen");
        return;
      }

      await saveStudentRegistration(user.id, authData.session, {
        nisn: formData.nisn,
      });
      Alert.alert("Registrasi Berhasil", "Akun Anda siap digunakan.");
      router.replace("/auth/screens/LoginScreen");
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat pendaftaran.";

      if (/rate.?limit|too many requests|429/i.test(message)) {
        Alert.alert(
          "Batas Email Tercapai",
          "Supabase membatasi pengiriman email autentikasi. Tunggu hingga kuota tersedia, atau atur SMTP kustom di Supabase Dashboard > Authentication > SMTP Settings. Jangan mengulang pendaftaran berkali-kali.",
        );
        return;
      }

      Alert.alert(
        "Registrasi Gagal",
        message,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <SisworkLogo size={32} style={styles.brandLogo} />
            <Text style={styles.title}>Registrasi Akun Siswa</Text>
            <Text style={styles.subtitle}>
              Masukkan NISN untuk memverifikasi data siswa.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>1. NISN (10 Digit)</Text>
              <TextInput
                style={styles.input}
                value={formData.nisn}
                onChangeText={handleNisnChange}
                placeholder="Masukkan 10 digit NISN"
                keyboardType="number-pad"
                maxLength={10}
                autoCapitalize="none"
                editable={!isSubmitting}
              />
              {isValidatingNisn && (
                <View style={styles.statusRow}>
                  <ActivityIndicator size="small" color={AppColors.brand} />
                  <Text style={styles.infoText}>Memeriksa NISN...</Text>
                </View>
              )}
              {isNisnVerified && (
                <Text style={styles.successText}>NISN terverifikasi</Text>
              )}
              {!!errors.nisn && (
                <Text style={styles.errorText}>{errors.nisn}</Text>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>2. Nama Lengkap</Text>
              <TextInput
                style={[styles.input, styles.readOnlyInput]}
                value={formData.fullName}
                placeholder="Terisi otomatis"
                editable={false}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>3. Asal Sekolah</Text>
              <TextInput
                style={[styles.input, styles.readOnlyInput]}
                value={formData.school}
                placeholder="Terisi otomatis"
                editable={false}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>4. Email Aktif</Text>
              <TextInput
                style={styles.input}
                value={formData.email}
                onChangeText={(email) => updateFormField("email", email)}
                placeholder="nama@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={isNisnVerified && !isSubmitting}
              />
              {!!errors.email && (
                <Text style={styles.errorText}>{errors.email}</Text>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>5. Password Akun</Text>
              <TextInput
                style={styles.input}
                value={formData.password}
                onChangeText={(password) => updateFormField("password", password)}
                placeholder="Minimal 8 karakter"
                secureTextEntry
                autoCapitalize="none"
                editable={isNisnVerified && !isSubmitting}
              />
              {!!errors.password && (
                <Text style={styles.errorText}>{errors.password}</Text>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Konfirmasi Password</Text>
              <TextInput
                style={styles.input}
                value={formData.confirmPassword}
                onChangeText={(confirmPassword) =>
                  updateFormField("confirmPassword", confirmPassword)
                }
                placeholder="Ulangi password"
                secureTextEntry
                autoCapitalize="none"
                editable={isNisnVerified && !isSubmitting}
              />
              {!!errors.confirmPassword && (
                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
              )}
            </View>

            <View style={styles.termsRow}>
              <Switch
                value={formData.acceptTerms}
                trackColor={{ false: "#D5D9E2", true: AppColors.brand }}
                thumbColor="#FFFFFF"
                accessibilityLabel="Konfirmasi data siswa sudah benar"
                onValueChange={(acceptTerms) =>
                  updateFormField("acceptTerms", acceptTerms)
                }
                disabled={!isNisnVerified || isSubmitting}
              />
              <Text style={styles.termsText}>
                Data di atas sudah benar dan sesuai.
              </Text>
            </View>
            {!!errors.acceptTerms && (
              <Text style={styles.errorText}>{errors.acceptTerms}</Text>
            )}

            <TouchableOpacity
              style={[
                styles.button,
                (isSubmitting || isValidatingNisn || !isNisnVerified) &&
                  styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || isValidatingNisn || !isNisnVerified}
              accessibilityRole="button"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Daftar Sekarang</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.loginLink}
              onPress={() => router.replace("/auth/screens/LoginScreen")}
            >
              <Text style={styles.loginLinkText}>Sudah punya akun? Masuk</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.canvas,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 520,
    padding: 24,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    elevation: 3,
    shadowColor: AppColors.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
  },
  title: {
    marginTop: 4,
    marginBottom: 8,
    color: AppColors.ink,
    fontSize: 26,
    fontWeight: "800",
    textAlign: "left",
  },
  brandLogo: {
    marginBottom: 16,
  },
  subtitle: {
    marginBottom: 24,
    color: AppColors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "left",
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    color: "#333333",
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 12,
    backgroundColor: AppColors.surface,
    color: AppColors.ink,
    fontSize: 16,
  },
  readOnlyInput: {
    backgroundColor: "#EEF2F5",
    color: "#56616D",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  infoText: {
    color: AppColors.brand,
    fontSize: 12,
  },
  successText: {
    marginTop: 8,
    color: "#16803C",
    fontSize: 12,
  },
  errorText: {
    marginTop: 6,
    color: "#DC2626",
    fontSize: 12,
  },
  classOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  classOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
  },
  classOptionSelected: {
    borderColor: AppColors.brand,
    backgroundColor: AppColors.brandTint,
  },
  classOptionText: {
    color: "#4B5563",
    fontSize: 13,
  },
  classOptionTextSelected: {
    color: AppColors.brand,
    fontWeight: "600",
  },
  disabledControl: {
    opacity: 0.5,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  termsText: {
    flex: 1,
    marginLeft: 10,
    color: "#4B5563",
    fontSize: 13,
  },
  button: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: AppColors.brand,
  },
  buttonDisabled: {
    backgroundColor: "#93C5FD",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  loginLink: {
    alignSelf: "center",
    paddingTop: 18,
    paddingBottom: 4,
  },
  loginLinkText: {
    color: AppColors.brand,
    fontSize: 14,
    fontWeight: "600",
  },
});
