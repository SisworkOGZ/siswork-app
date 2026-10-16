import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { MediaMessagePayload } from "@/core/types/communication";
import { AppColors } from "@/constants/app-theme";

export function ChatMediaCard({ media }: { media: MediaMessagePayload }) {
  const isImage = media.mime_type.startsWith("image/");
  const openMedia = async () => {
    try {
      await Linking.openURL(media.url);
    } catch (error) {
      console.error("Lampiran tidak dapat dibuka:", error);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Buka lampiran ${media.name}`}
      onPress={() => void openMedia()}
      style={styles.card}
    >
      {isImage ? (
        <Image source={{ uri: media.url }} resizeMode="cover" style={styles.image} />
      ) : (
        <View style={styles.fileIcon}>
          <Text style={styles.fileIconText}>↗</Text>
        </View>
      )}
      <Text numberOfLines={1} style={styles.name}>{media.name}</Text>
      <Text style={styles.hint}>{isImage ? "Buka gambar" : "Buka file"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 240,
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  image: { width: "100%", height: 150, backgroundColor: "#EEF0F5" },
  fileIcon: {
    height: 90,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppColors.brandTint,
  },
  fileIconText: { color: AppColors.brand, fontSize: 30, fontWeight: "700" },
  name: { paddingHorizontal: 12, paddingTop: 10, color: AppColors.ink, fontSize: 14, fontWeight: "700" },
  hint: { paddingHorizontal: 12, paddingBottom: 10, paddingTop: 3, color: AppColors.muted, fontSize: 12 },
});
