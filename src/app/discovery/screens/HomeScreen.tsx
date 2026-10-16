import { Redirect } from "expo-router";

export default function LegacyHomeRoute() {
  return <Redirect href="/(tabs)" />;
}
