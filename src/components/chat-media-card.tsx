import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { MediaMessagePayload } from "@/core/types/communication";

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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3E7F0",
  },
  image: { width: "100%", height: 150, backgroundColor: "#EEF0F5" },
  fileIcon: {
    height: 90,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF0FF",
  },
  fileIconText: { color: "#4356C5", fontSize: 30, fontWeight: "700" },
  name: { paddingHorizontal: 12, paddingTop: 10, color: "#172033", fontSize: 12, fontWeight: "700" },
  hint: { paddingHorizontal: 12, paddingBottom: 10, paddingTop: 3, color: "#667085", fontSize: 10 },
});
