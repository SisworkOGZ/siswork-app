import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

// Ambil env variable
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_KEY;
const hasPlaceholderValue = (value: string | undefined) =>
  !value || /placeholder|example|your[-_ ]?(supabase|project|key|anon)/i.test(value);

export const isSupabaseConfigured =
  !hasPlaceholderValue(supabaseUrl) && !hasPlaceholderValue(supabaseAnonKey);

// Gunakan fallback dummy URL jika URL belum terdefinisi saat build/SSR agar client tidak crash
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key",
  {
    auth: {
      // AsyncStorage hanya digunakan di Mobile Native, Web menggunakan default (localStorage)
      storage: Platform.OS !== "web" ? AsyncStorage : undefined,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
