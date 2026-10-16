import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { supabase } from "@/core/services/supabase";
import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { SisworkTabs } from "@/components/custom-tab-bar";
import { AppColors } from "@/constants/app-theme";

export default function TabLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isCurrent) setIsAuthenticated(Boolean(session));
    });

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isCurrent) return;
        if (error) {
          console.error("Gagal memeriksa sesi autentikasi:", error);
          setIsAuthenticated(false);
          return;
        }
        setIsAuthenticated(Boolean(data.session));
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        console.error("Gagal memeriksa sesi autentikasi:", error);
        setIsAuthenticated(false);
      });

    return () => {
      isCurrent = false;
      subscription.unsubscribe();
    };
  }, []);

  if (isAuthenticated === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={AppColors.brand} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth/screens/LoginScreen" />;
  }

  return (
    <>
      <AnimatedSplashOverlay />
      <SisworkTabs />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppColors.canvas,
  },
});
