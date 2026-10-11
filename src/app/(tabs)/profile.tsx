import { useLocalSearchParams } from "expo-router";
import SisworkDashboard from "@/components/skill-exchange-dashboard";

export default function ProfileTab() {
  const { action, actionId } = useLocalSearchParams<{
    action?: string;
    actionId?: string;
  }>();

  return (
    <SisworkDashboard
      initialTab="Profil"
      hideTabBar
      externalAction={
        action === "portfolio" || action === "service" ? action : undefined
      }
      externalActionId={actionId}
    />
  );
}
