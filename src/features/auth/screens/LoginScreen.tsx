import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "@/core/services/supabase";
import { saveStudentRegistration } from "@/core/services/student-registration";
import { AppColors } from "@/constants/app-theme";
import { SisworkLogo } from "@/components/siswork-logo";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password.trim()) {
      Alert.alert("Form Belum Lengkap", "Silakan isi email dan password Anda.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) throw error;
      if (!data.session || !data.user) {
        throw new Error("Sesi login tidak lengkap. Coba masuk kembali.");
      }

      const nisn = data.user.user_metadata?.nisn;
      if (typeof nisn === "string") {
        await saveStudentRegistration(data.user.id, data.session, { nisn });
      }

      router.replace("/(tabs)");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Email atau password salah.";
      Alert.alert("Login Gagal", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.innerContainer}
      >
        <ScrollView
          contentContainerStyle={styles.authScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.headerContainer}>
              <SisworkLogo size={36} style={styles.brandLogo} />
              <Text style={styles.title}>Selamat Datang</Text>
              <Text style={styles.subtitle}>
                Masuk untuk menemukan dan membagikan keahlian.
              </Text>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  accessibilityLabel="Email"
                  autoComplete="email"
                  style={styles.input}
                  placeholder="Masukkan email Anda"
                  placeholderTextColor="#8992A5"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  accessibilityLabel="Password"
                  autoComplete="current-password"
                  style={styles.input}
                  placeholder="Masukkan password Anda"
                  placeholderTextColor="#8992A5"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!loading}
                  returnKeyType="done"
                  onSubmitEditing={() => void handleLogin()}
                />
              </View>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Masuk</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Belum punya akun? </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => router.push("/auth/screens/RegisterScreen")}
              disabled={loading}
            >
              <Text style={styles.registerText}>Daftar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.canvas,
  },
  innerContainer: {
    flex: 1,
    alignSelf: "center",
    width: "100%",
    maxWidth: 520,
  },
  authScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    padding: 24,
    borderRadius: 22,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowColor: AppColors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  brandLogo: {
    marginBottom: 16,
  },
  headerContainer: {
    marginBottom: 26,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: AppColors.ink,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: AppColors.muted,
  },
  formContainer: {
    marginBottom: 0,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: AppColors.text,
    marginBottom: 8,
  },
  input: {
    minHeight: 52,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: AppColors.ink,
  },
  button: {
    backgroundColor: AppColors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: AppColors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: "#93C5FD",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  footerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 16,
  },
  footerText: {
    fontSize: 14,
    color: AppColors.muted,
  },
  registerText: {
    fontSize: 14,
    fontWeight: "700",
    color: AppColors.brand,
  },
});
