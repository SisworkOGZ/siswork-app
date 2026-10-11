import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "@/core/services/supabase";

export type PortfolioItem = {
  id: string;
  owner_id: string;
  school_id: string;
  title: string;
  description: string;
  media_url: string | null;
  media_path: string | null;
  project_url: string | null;
  created_at: string;
};

export type ProfileService = {
  id: string;
  sellerId?: string;
  title: string;
  category: string;
  price: number;
  description: string;
  estimatedDays: number;
  isActive: boolean;
};

type PortfolioSectionProps = {
  ownerId: string | null;
  schoolId: string | null;
  createRequest?: number;
};

type PickedMedia = {
  base64: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
  uri: string;
};

const portfolioBucket = "portfolio-media";
const maxPortfolioFileSize = 15 * 1024 * 1024;
const allowedMediaTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
]);

const decodeBase64 = (value: string) => {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Terjadi kesalahan. Silakan coba lagi.";

export function PortfolioSection({
  ownerId,
  schoolId,
  createRequest = 0,
}: PortfolioSectionProps) {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [media, setMedia] = useState<PickedMedia | null>(null);
  const [isRemovingMedia, setIsRemovingMedia] = useState(false);
  const [dismissedCreateRequest, setDismissedCreateRequest] = useState(0);
  const isFormVisible =
    isFormOpen ||
    (createRequest > 0 && dismissedCreateRequest !== createRequest);

  useEffect(() => {
    let isCurrent = true;
    const loadPortfolios = async () => {
      if (!ownerId) {
        setItems([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError("");
      try {
        const { data, error: loadError } = await supabase
          .from("portfolios")
          .select(
            "id, owner_id, school_id, title, description, media_url, media_path, project_url, created_at",
          )
          .eq("owner_id", ownerId)
          .order("created_at", { ascending: false });
        if (loadError) throw loadError;
        if (isCurrent) setItems(data ?? []);
      } catch (loadFailure) {
        if (!isCurrent) return;
        console.error("Gagal memuat karya:", loadFailure);
        setError(`Karya belum dapat dimuat: ${getErrorMessage(loadFailure)}`);
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };

    void loadPortfolios();
    return () => {
      isCurrent = false;
    };
  }, [ownerId]);

  const resetForm = () => {
    setEditingItem(null);
    setTitle("");
    setDescription("");
    setProjectUrl("");
    setMedia(null);
    setIsRemovingMedia(false);
    setError("");
  };

  const openCreateForm = () => {
    resetForm();
    setIsFormOpen(true);
  };
  const closeForm = () => {
    resetForm();
    setIsFormOpen(false);
    setDismissedCreateRequest(createRequest);
  };

  const openEditForm = (item: PortfolioItem) => {
    setEditingItem(item);
    setTitle(item.title);
    setDescription(item.description);
    setProjectUrl(item.project_url ?? "");
    setMedia(null);
    setIsRemovingMedia(false);
    setError("");
    setIsFormOpen(true);
  };

  const pickMedia = async () => {
    setError("");
    try {
      const ImagePicker = await import("expo-image-picker");
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Izin akses galeri diperlukan untuk memilih lampiran karya.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.8,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const mimeType =
        asset.mimeType ??
        (asset.type === "video" ? "video/mp4" : "image/jpeg");
      if (!allowedMediaTypes.has(mimeType)) {
        setError("Format lampiran yang didukung: JPG, PNG, WebP, MP4, atau MOV.");
        return;
      }
      if ((asset.fileSize ?? 0) > maxPortfolioFileSize) {
        setError("Ukuran file maksimal 15 MB.");
        return;
      }
      if (!asset.base64) {
        setError("File tidak dapat dibaca. Silakan pilih file lain.");
        return;
      }
      if (Math.floor((asset.base64.length * 3) / 4) > maxPortfolioFileSize) {
        setError("Ukuran file maksimal 15 MB.");
        return;
      }

      setMedia({
        base64: asset.base64,
        fileName: asset.fileName ?? `portfolio.${mimeType.split("/")[1]}`,
        mimeType,
        fileSize: asset.fileSize,
        uri: asset.uri,
      });
      setIsRemovingMedia(false);
    } catch (pickerError) {
      console.error("Gagal memilih media karya:", pickerError);
      const message = getErrorMessage(pickerError);
      if (
        /cannot find native module|expoimagepicker|exponentimagepicker/i.test(
          message,
        )
      ) {
        setError(
          "Pemilih media belum tersedia di development build ini. Build ulang dan instal development client Android setelah menambahkan expo-image-picker, lalu scan QR Metro lagi.",
        );
        return;
      }
      setError(`Media tidak dapat dipilih: ${message}`);
    }
  };

  const savePortfolio = async () => {
    if (isSaving) return;
    if (!ownerId || !schoolId) {
      setError("Data sekolah belum tersedia. Muat ulang profil lalu coba lagi.");
      return;
    }
    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();
    const normalizedProjectUrl = projectUrl.trim();
    if (normalizedTitle.length < 3 || normalizedTitle.length > 100) {
      setError("Judul karya harus terdiri dari 3–100 karakter.");
      return;
    }
    if (normalizedDescription.length < 10 || normalizedDescription.length > 2000) {
      setError("Deskripsi karya harus terdiri dari 10–2.000 karakter.");
      return;
    }
    if (
      normalizedProjectUrl &&
      !/^https?:\/\/\S+$/i.test(normalizedProjectUrl)
    ) {
      setError("Link proyek harus diawali http:// atau https://.");
      return;
    }

    setIsSaving(true);
    setError("");
    let uploadedPath: string | null = null;
    try {
      let mediaUrl = isRemovingMedia ? null : editingItem?.media_url ?? null;
      let mediaPath = isRemovingMedia ? null : editingItem?.media_path ?? null;
      if (media) {
        const extensions: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
          "video/mp4": "mp4",
          "video/quicktime": "mov",
        };
        const extension = extensions[media.mimeType];
        uploadedPath = `${ownerId}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(portfolioBucket)
          .upload(uploadedPath, decodeBase64(media.base64), {
            contentType: media.mimeType,
            upsert: false,
          });
        if (uploadError) throw uploadError;
        mediaPath = uploadedPath;
        mediaUrl = supabase.storage
          .from(portfolioBucket)
          .getPublicUrl(uploadedPath).data.publicUrl;
      }

      const payload = {
        owner_id: ownerId,
        school_id: schoolId,
        title: normalizedTitle,
        description: normalizedDescription,
        media_url: mediaUrl,
        media_path: mediaPath,
        project_url: normalizedProjectUrl || null,
        updated_at: new Date().toISOString(),
      };
      const request = editingItem
        ? supabase
            .from("portfolios")
            .update(payload)
            .eq("id", editingItem.id)
            .eq("owner_id", ownerId)
            .select(
              "id, owner_id, school_id, title, description, media_url, media_path, project_url, created_at",
            )
            .single()
        : supabase
            .from("portfolios")
            .insert(payload)
            .select(
              "id, owner_id, school_id, title, description, media_url, media_path, project_url, created_at",
            )
            .single();
      const { data, error: saveError } = await request;
      if (saveError) throw saveError;
      if (!data) throw new Error("Server tidak mengembalikan data karya.");

      setItems((current) =>
        editingItem
          ? current.map((item) => (item.id === data.id ? data : item))
          : [data, ...current],
      );
      closeForm();
      resetForm();

      if (
        editingItem?.media_path &&
        mediaPath !== editingItem.media_path
      ) {
        const { error: cleanupError } = await supabase.storage
          .from(portfolioBucket)
          .remove([editingItem.media_path]);
        if (cleanupError) {
          console.error("Gagal menghapus lampiran karya lama:", cleanupError);
          setError(
            "Karya tersimpan, tetapi lampiran lama belum berhasil dihapus.",
          );
        }
      }
    } catch (saveError) {
      console.error("Gagal menyimpan karya:", saveError);
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage
          .from(portfolioBucket)
          .remove([uploadedPath]);
        if (cleanupError) {
          console.error("Gagal membersihkan lampiran karya:", cleanupError);
        }
      }
      setError(`Karya belum berhasil disimpan: ${getErrorMessage(saveError)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const deletePortfolio = (item: PortfolioItem) => {
    Alert.alert("Hapus karya?", `Karya "${item.title}" akan dihapus.`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: () => void confirmDeletePortfolio(item),
      },
    ]);
  };

  const confirmDeletePortfolio = async (item: PortfolioItem) => {
    setIsDeleting(item.id);
    setError("");
    try {
      const { error: deleteError } = await supabase
        .from("portfolios")
        .delete()
        .eq("id", item.id)
        .eq("owner_id", ownerId ?? "");
      if (deleteError) throw deleteError;
      setItems((current) => current.filter((portfolio) => portfolio.id !== item.id));
      if (item.media_path) {
        const { error: storageError } = await supabase.storage
          .from(portfolioBucket)
          .remove([item.media_path]);
        if (storageError) {
          console.error("Karya terhapus tetapi file media gagal dihapus:", storageError);
          setError("Karya terhapus, tetapi file media belum berhasil dihapus.");
        }
      }
    } catch (deleteError) {
      console.error("Gagal menghapus karya:", deleteError);
      setError(`Karya belum berhasil dihapus: ${getErrorMessage(deleteError)}`);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeadingCopy}>
          <Text style={styles.sectionTitle}>Karya</Text>
          <Text style={styles.sectionSubtitle}>{items.length} karya</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={openCreateForm}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>＋ Unggah Karya Baru</Text>
        </TouchableOpacity>
      </View>

      {!!error && !isFormOpen && (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      )}
      {isLoading ? (
        <ActivityIndicator color="#4356C5" style={styles.loading} />
      ) : items.length ? (
        <View style={styles.cardList}>
          {items.map((item) => (
            <View key={item.id} style={styles.portfolioCard}>
              {item.media_url ? (
                <Image source={{ uri: item.media_url }} style={styles.media} />
              ) : (
                <View style={styles.mediaPlaceholder}>
                  <Text style={styles.mediaPlaceholderText}>▧</Text>
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text numberOfLines={3} style={styles.cardDescription}>
                  {item.description}
                </Text>
                {!!item.project_url && (
                  <Text numberOfLines={1} style={styles.projectLink}>
                    {item.project_url}
                  </Text>
                )}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => openEditForm(item)}
                    style={styles.secondaryAction}
                  >
                    <Text style={styles.secondaryActionText}>Edit Karya</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={isDeleting === item.id}
                    onPress={() => deletePortfolio(item)}
                    style={styles.deleteAction}
                  >
                    {isDeleting === item.id ? (
                      <ActivityIndicator color="#B34E5A" size="small" />
                    ) : (
                      <Text style={styles.deleteActionText}>Hapus</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Belum ada karya.</Text>
          <Text style={styles.emptyDescription}>
            Bagikan hasil proyekmu agar portofolio makin menarik.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={openCreateForm}
            style={styles.emptyAction}
          >
            <Text style={styles.emptyActionText}>＋ Unggah Karya Pertama</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={isFormVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isSaving) closeForm();
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBackdrop}
        >
          <View style={styles.formSheet}>
            <View style={styles.formHeader}>
              <View>
                <Text style={styles.formEyebrow}>PORTOFOLIO</Text>
                <Text style={styles.formTitle}>
                  {editingItem ? "Edit karya" : "Unggah karya"}
                </Text>
              </View>
              <TouchableOpacity
                accessibilityLabel="Tutup formulir karya"
                disabled={isSaving}
                onPress={closeForm}
                style={styles.closeButton}
              >
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.formContent}
            >
              <Text style={styles.label}>Judul karya</Text>
              <TextInput
                accessibilityLabel="Judul karya"
                value={title}
                onChangeText={setTitle}
                placeholder="Contoh: Desain identitas acara sekolah"
                maxLength={100}
                style={styles.input}
                placeholderTextColor="#929AAF"
              />
              <Text style={styles.label}>Deskripsi</Text>
              <TextInput
                accessibilityLabel="Deskripsi karya"
                value={description}
                onChangeText={setDescription}
                placeholder="Ceritakan proses, peran, dan hasil karya..."
                multiline
                textAlignVertical="top"
                maxLength={2000}
                style={[styles.input, styles.multilineInput]}
                placeholderTextColor="#929AAF"
              />
              <Text style={styles.label}>Lampiran media / gambar</Text>
              {media ? (
                <View style={styles.selectedMedia}>
                  {media.mimeType.startsWith("image/") ? (
                    <Image source={{ uri: media.uri }} style={styles.media} />
                  ) : (
                    <View style={styles.mediaPlaceholder}>
                      <Text style={styles.mediaPlaceholderText}>▶</Text>
                    </View>
                  )}
                  <Text numberOfLines={1} style={styles.fileName}>
                    {media.fileName}
                  </Text>
                  <TouchableOpacity onPress={() => setMedia(null)}>
                    <Text style={styles.deleteActionText}>Hapus file</Text>
                  </TouchableOpacity>
                </View>
              ) : editingItem?.media_url && !isRemovingMedia ? (
                <View style={styles.selectedMedia}>
                  <Image
                    source={{ uri: editingItem.media_url }}
                    style={styles.media}
                  />
                  <TouchableOpacity
                    onPress={() => setIsRemovingMedia(true)}
                    style={styles.secondaryAction}
                  >
                    <Text style={styles.secondaryActionText}>
                      Ganti / hapus lampiran
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => void pickMedia()}
                  style={styles.mediaPicker}
                >
                  <Text style={styles.mediaPickerIcon}>＋</Text>
                  <Text style={styles.mediaPickerText}>
                    Pilih gambar atau video (maks. 15 MB)
                  </Text>
                </TouchableOpacity>
              )}
              {(media || (editingItem?.media_url && !isRemovingMedia)) && (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => void pickMedia()}
                  style={styles.mediaPickerCompact}
                >
                  <Text style={styles.secondaryActionText}>Pilih file lain</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.label}>Link proyek (GitHub / Figma / YouTube)</Text>
              <TextInput
                accessibilityLabel="Link proyek"
                value={projectUrl}
                onChangeText={setProjectUrl}
                placeholder="https://..."
                autoCapitalize="none"
                keyboardType="url"
                style={styles.input}
                placeholderTextColor="#929AAF"
              />

              {!!error && (
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {error}
                </Text>
              )}
              <TouchableOpacity
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => void savePortfolio()}
                style={[styles.submitButton, isSaving && styles.disabledButton]}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitText}>
                    {editingItem ? "Simpan perubahan" : "Unggah karya"}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

type ServiceSectionProps = {
  services: ProfileService[];
  error: string;
  onAdd: () => void;
  onEdit: (service: ProfileService) => void;
  onToggle: (service: ProfileService) => void;
  onDelete: (service: ProfileService) => void;
};

export function ServiceSection({
  services,
  error,
  onAdd,
  onEdit,
  onToggle,
  onDelete,
}: ServiceSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeadingCopy}>
          <Text style={styles.sectionTitle}>Jasa saya</Text>
          <Text style={styles.sectionSubtitle}>
            {services.length} jasa ditawarkan
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={onAdd}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>
            💼 {services.length ? "Tambah Jasa Baru" : "Buka Jasa Sekarang"}
          </Text>
        </TouchableOpacity>
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      )}
      {services.length ? (
        <View style={styles.cardList}>
          {services.map((service) => (
            <View key={service.id} style={styles.serviceCard}>
              <View style={styles.serviceCardTop}>
                <Text style={styles.categoryTag}>{service.category}</Text>
                <Text
                  style={[
                    styles.statusTag,
                    service.isActive ? styles.statusActive : styles.statusInactive,
                  ]}
                >
                  {service.isActive ? "Aktif" : "Nonaktif"}
                </Text>
              </View>
              <Text style={styles.cardTitle}>{service.title}</Text>
              <Text numberOfLines={2} style={styles.cardDescription}>
                {service.description}
              </Text>
              <View style={styles.serviceMeta}>
                <Text style={styles.servicePrice}>
                  Rp{service.price.toLocaleString("id-ID")}
                </Text>
                <Text style={styles.serviceEta}>
                  Estimasi {service.estimatedDays} hari
                </Text>
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => onToggle(service)}
                  style={styles.secondaryAction}
                >
                  <Text style={styles.secondaryActionText}>
                    {service.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => onEdit(service)}
                  style={styles.secondaryAction}
                >
                  <Text style={styles.secondaryActionText}>Edit Jasa</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => onDelete(service)}
                  style={styles.deleteAction}
                >
                  <Text style={styles.deleteActionText}>Hapus</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Belum ada jasa ditawarkan.</Text>
          <Text style={styles.emptyDescription}>
            Tampilkan keahlianmu agar teman sekolah dapat menemukan jasamu.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onAdd}
            style={styles.emptyAction}
          >
            <Text style={styles.emptyActionText}>＋ Buka Jasa Sekarang</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, marginTop: 20 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionHeadingCopy: { flex: 1 },
  sectionTitle: { color: "#202B42", fontSize: 17, fontWeight: "800" },
  sectionSubtitle: { color: "#8992A5", fontSize: 11, marginTop: 3 },
  addButton: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 11,
    borderRadius: 11,
    backgroundColor: "#E9EDFF",
  },
  addButtonText: { color: "#4356C5", fontSize: 10, fontWeight: "800" },
  cardList: { gap: 11 },
  portfolioCard: {
    overflow: "hidden",
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECEFF5",
  },
  media: {
    width: "100%",
    height: 160,
    backgroundColor: "#F1F3F8",
  },
  mediaPlaceholder: {
    width: "100%",
    height: 112,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F3F8",
  },
  mediaPlaceholderText: { color: "#7683C9", fontSize: 28 },
  cardBody: { padding: 13 },
  cardTitle: { color: "#26324A", fontSize: 14, fontWeight: "800" },
  cardDescription: {
    color: "#798399",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },
  projectLink: { color: "#4356C5", fontSize: 10, marginTop: 7 },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 7,
    marginTop: 11,
  },
  secondaryAction: {
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: "#F1F3F8",
  },
  secondaryActionText: { color: "#53617C", fontSize: 10, fontWeight: "800" },
  deleteAction: {
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: "#FFF0F1",
  },
  deleteActionText: { color: "#B34E5A", fontSize: 10, fontWeight: "800" },
  emptyCard: {
    alignItems: "flex-start",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E9ECF2",
    backgroundColor: "#FFFFFF",
  },
  emptyTitle: { color: "#303B52", fontSize: 13, fontWeight: "800" },
  emptyDescription: {
    color: "#8790A2",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },
  emptyAction: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 13,
    borderRadius: 11,
    backgroundColor: "#E9EDFF",
    marginTop: 12,
  },
  emptyActionText: { color: "#4356C5", fontSize: 10, fontWeight: "800" },
  loading: { paddingVertical: 20 },
  serviceCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECEFF5",
  },
  serviceCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 9,
  },
  categoryTag: { color: "#4356C5", fontSize: 10, fontWeight: "800" },
  statusTag: { fontSize: 9, fontWeight: "800" },
  statusActive: { color: "#26805A" },
  statusInactive: { color: "#8992A5" },
  serviceMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  servicePrice: { color: "#293650", fontSize: 12, fontWeight: "800" },
  serviceEta: { color: "#8790A2", fontSize: 10 },
  errorText: {
    color: "#B34E5A",
    backgroundColor: "#FFF0F1",
    borderRadius: 10,
    padding: 10,
    fontSize: 10,
    lineHeight: 15,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "rgba(25, 33, 53, 0.38)",
  },
  formSheet: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "92%",
    alignSelf: "center",
    backgroundColor: "#F8F9FC",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECF2",
  },
  formEyebrow: {
    color: "#818BA1",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  formTitle: {
    color: "#202B42",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 3,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  closeText: { color: "#748096", fontSize: 25, lineHeight: 27 },
  formContent: { paddingTop: 12, paddingBottom: 12 },
  label: {
    color: "#303B52",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 15,
    marginBottom: 7,
  },
  input: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E9F1",
    backgroundColor: "#FFFFFF",
    color: "#303B52",
    fontSize: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  multilineInput: { minHeight: 100, lineHeight: 18 },
  selectedMedia: { gap: 8 },
  fileName: { color: "#657087", fontSize: 10 },
  mediaPicker: {
    minHeight: 75,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#C9D0E0",
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
  },
  mediaPickerIcon: { color: "#4356C5", fontSize: 20, fontWeight: "800" },
  mediaPickerText: { color: "#657087", fontSize: 10, fontWeight: "700" },
  mediaPickerCompact: { alignSelf: "flex-start", marginTop: 7, padding: 6 },
  submitButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#4356C5",
    marginTop: 20,
  },
  disabledButton: { opacity: 0.65 },
  submitText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
});
