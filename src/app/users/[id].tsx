import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/core/services/supabase";
import { AppColors } from "@/constants/app-theme";

type StudentProfile = {
  id: string;
  full_name: string;
  grade_level: string | null;
  major: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_seller: boolean;
  seller_category: string | null;
  school: { name: string }[] | null;
};

type PortfolioItem = {
  id: string;
  title: string;
  description: string;
  media_url: string | null;
  project_url: string | null;
};

type StudentService = {
  id: string;
  title: string;
  category: string;
  description: string;
  price: number;
  service_range: string;
  estimated_days: number;
};

export default function StudentProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [portfolios, setPortfolios] = useState<PortfolioItem[]>([]);
  const [services, setServices] = useState<StudentService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;

    const loadProfile = async () => {
      setLoading(true);
      setError("");
      try {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select(
            "id, full_name, grade_level, major, bio, avatar_url, is_seller, seller_category, school:schools(name)",
          )
          .eq("id", id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!profileData) {
          throw new Error("Profil tidak ditemukan atau tidak tersedia.");
        }

        const [portfolioResult, serviceResult] = await Promise.all([
          supabase
            .from("portfolios")
            .select("id, title, description, media_url, project_url")
            .eq("owner_id", id)
            .order("created_at", { ascending: false }),
          supabase
            .from("services")
            .select(
              "id, title, category, description, price, service_range, estimated_days",
            )
            .eq("seller_id", id)
            .eq("is_active", true)
            .order("created_at", { ascending: false }),
        ]);

        if (portfolioResult.error) throw portfolioResult.error;
        if (serviceResult.error) throw serviceResult.error;

        if (isCurrent) {
          setProfile(profileData as StudentProfile);
          setPortfolios(portfolioResult.data ?? []);
          setServices(serviceResult.data ?? []);
        }
      } catch (loadError) {
        console.error("Gagal memuat profil pelajar:", loadError);
        if (isCurrent) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Profil pelajar tidak dapat dimuat. Silakan coba lagi.",
          );
        }
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    if (id) void loadProfile();

    return () => {
      isCurrent = false;
    };
  }, [id]);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 18),
          paddingBottom: Math.max(insets.bottom, 28),
        },
      ]}
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text style={styles.back}>‹  Kembali</Text>
      </Pressable>

      {loading && id ? (
        <ActivityIndicator color={AppColors.brand} style={styles.loading} />
      ) : !id || error ? (
        <View style={styles.messageCard}>
          <Text accessibilityRole="alert" style={styles.error}>
            {error || "Profil tidak ditemukan."}
          </Text>
        </View>
      ) : profile ? (
        <>
          <View style={styles.profileCard}>
            {profile.avatar_url ? (
              <Image
                accessibilityLabel={`Foto profil ${profile.full_name}`}
                source={{ uri: profile.avatar_url }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>
                  {profile.full_name.trim().charAt(0).toUpperCase() || "?"}
                </Text>
              </View>
            )}
            <Text style={styles.name}>{profile.full_name}</Text>
            <Text style={styles.school}>
              {[profile.grade_level, profile.school?.[0]?.name]
                .filter(Boolean)
                .join(" · ") || "Pelajar Siswork"}
            </Text>
            {!!profile.major && (
              <Text style={styles.meta}>Jurusan {profile.major}</Text>
            )}
            {profile.is_seller && (
              <View style={styles.sellerBadge}>
                <Text style={styles.sellerBadgeText}>
                  {profile.seller_category
                    ? `Talent · ${profile.seller_category}`
                    : "Talent Siswork"}
                </Text>
              </View>
            )}
            <Text style={styles.bio}>
              {profile.bio || "Pelajar ini belum menambahkan deskripsi profil."}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Jasa aktif</Text>
            {services.length ? (
              services.map((service) => (
                <View key={service.id} style={styles.itemCard}>
                  <View style={styles.itemHeading}>
                    <Text style={styles.itemTitle}>{service.title}</Text>
                    <Text style={styles.price}>
                      Rp{Number(service.price).toLocaleString("id-ID")}
                    </Text>
                  </View>
                  <Text style={styles.category}>{service.category}</Text>
                  <Text style={styles.description}>{service.description}</Text>
                  <Text style={styles.meta}>
                    {service.service_range} · Estimasi {service.estimated_days}{" "}
                    hari
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.empty}>Belum ada jasa aktif.</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Portofolio</Text>
            {portfolios.length ? (
              portfolios.map((item) => (
                <View key={item.id} style={styles.itemCard}>
                  {item.media_url ? (
                    <Image
                      accessibilityLabel={`Media karya ${item.title}`}
                      source={{ uri: item.media_url }}
                      style={styles.portfolioMedia}
                      resizeMode="cover"
                    />
                  ) : null}
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.description}>{item.description}</Text>
                  {!!item.project_url && (
                    <Text selectable style={styles.projectUrl}>
                      {item.project_url}
                    </Text>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.empty}>Belum ada karya yang dibagikan.</Text>
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    backgroundColor: AppColors.canvas,
  },
  back: {
    color: AppColors.brand,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 20,
  },
  loading: {
    marginTop: 80,
  },
  profileCard: {
    alignItems: "center",
    padding: 22,
    borderRadius: 20,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  avatar: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 38,
    backgroundColor: AppColors.brandTint,
  },
  avatarImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  avatarInitial: {
    color: AppColors.brand,
    fontSize: 30,
    fontWeight: "800",
  },
  name: {
    marginTop: 14,
    color: AppColors.ink,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  school: {
    marginTop: 5,
    color: AppColors.muted,
    fontSize: 14,
    textAlign: "center",
  },
  meta: {
    marginTop: 5,
    color: AppColors.subtle,
    fontSize: 13,
  },
  sellerBadge: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: AppColors.brandTint,
  },
  sellerBadgeText: {
    color: AppColors.brand,
    fontSize: 12,
    fontWeight: "700",
  },
  bio: {
    marginTop: 16,
    color: AppColors.text,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    marginBottom: 12,
    color: AppColors.ink,
    fontSize: 19,
    fontWeight: "800",
  },
  itemCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  itemHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  itemTitle: {
    flex: 1,
    color: AppColors.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  price: {
    color: AppColors.brand,
    fontSize: 14,
    fontWeight: "800",
  },
  category: {
    marginTop: 6,
    color: AppColors.brand,
    fontSize: 12,
    fontWeight: "700",
  },
  description: {
    marginTop: 8,
    color: AppColors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  portfolioMedia: {
    width: "100%",
    height: 180,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: AppColors.canvas,
  },
  projectUrl: {
    marginTop: 10,
    color: AppColors.brand,
    fontSize: 13,
  },
  empty: {
    color: AppColors.muted,
    fontSize: 14,
  },
  messageCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: AppColors.surface,
  },
  error: {
    color: AppColors.error,
    fontSize: 14,
    lineHeight: 20,
  },
});
