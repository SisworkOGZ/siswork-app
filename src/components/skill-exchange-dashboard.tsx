import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/core/services/supabase";
import { useTabBarVisibility } from "@/components/tab-bar-visibility";
import { ChatSystemCard } from "@/components/chat-system-card";
import { ChatMediaCard } from "@/components/chat-media-card";
import {
  ServiceSection,
  PortfolioSection,
  type ProfileService,
} from "@/components/profile-sections";
import {
  findProfileByName,
  getOrCreateDirectConversation,
  loadConversationMessages,
  loadMyConversations,
  markConversationRead,
  createProjectInvoice,
  sendConversationMedia,
  sendConversationMessage,
  type ChatConversation,
} from "@/core/services/chat";

type Tab = "Beranda" | "Chat" | "Cari" | "Pesanan Saya" | "Profil";
type ExternalAction = "portfolio" | "service";
type Range = "Semua" | "Online" | "Lokal";
type SettingsDetail = "privacy" | "help" | "about";
type WalletProvider = "DANA" | "OVO" | "GoPay" | "ShopeePay";
type Service = {
  id: string;
  sellerId?: string;
  title: string;
  category: string;
  talent: string;
  initials: string;
  school: string;
  price: number;
  rating: string;
  reviews: number;
  range: Exclude<Range, "Semua">;
  location: string;
  color: string;
  symbol: string;
  description: string;
  estimatedDays: number;
  isActive: boolean;
};
type StudentProfile = {
  id: string;
  schoolId: string;
  full_name: string;
  nisn: string;
  school: string;
  gradeLevel: string;
  major: string;
  isVerified: boolean;
  isSeller: boolean;
  bio: string;
  sellerCategory: string | null;
};

const categories = ["Semua", "Desain", "Website", "Video", "Menulis", "Tutor"];
const serviceCategories = ["Desain", "Website", "Video", "Menulis", "Tutor"];
const services: Service[] = [
  {
    id: "design",
    title: "Desain poster acara sekolah",
    category: "Desain",
    talent: "Nafilah Linanti",
    initials: "NL",
    school: "SMK Negeri 1 Wanayasa",
    price: 25000,
    rating: "4.9",
    reviews: 18,
    range: "Online",
    location: "Wanayasa",
    color: "#EEEAFE",
    symbol: "✳",
    description:
      "Poster digital siap cetak untuk acara sekolah, organisasi, dan kebutuhan promosi. Termasuk dua kali revisi.",
    estimatedDays: 3,
    isActive: true,
  },
  {
    id: "web",
    title: "Bikin website profil sederhana",
    category: "Website",
    talent: "Arrazy Kusuma Putra Pradita",
    initials: "AK",
    school: "SMK Negeri 1 Wanayasa",
    price: 75000,
    rating: "5.0",
    reviews: 12,
    range: "Online",
    location: "Wanayasa",
    color: "#E2F4EC",
    symbol: "⌘",
    description:
      "Website profil atau portofolio responsif untuk tugas, ekstrakurikuler, dan usaha kecil.",
    estimatedDays: 7,
    isActive: true,
  },
  {
    id: "video",
    title: "Edit video konten pendek",
    category: "Video",
    talent: "Vika Diah Febriyanti",
    initials: "VD",
    school: "SMK Negeri 1 Wanayasa",
    price: 30000,
    rating: "4.8",
    reviews: 9,
    range: "Lokal",
    location: "Purwakarta",
    color: "#FFF0E3",
    symbol: "▶",
    description:
      "Editing video Reels, TikTok, atau dokumentasi kegiatan. Bisa diskusi langsung di area Purwakarta.",
    estimatedDays: 4,
    isActive: true,
  },
  {
    id: "tutor",
    title: "Bimbingan matematika SMP",
    category: "Tutor",
    talent: "Irmatiana Asti",
    initials: "IA",
    school: "SMK Negeri 1 Wanayasa",
    price: 20000,
    rating: "4.9",
    reviews: 15,
    range: "Lokal",
    location: "Wanayasa",
    color: "#E6F1FF",
    symbol: "∑",
    description:
      "Belajar privat santai untuk memahami konsep dan latihan soal matematika SMP.",
    estimatedDays: 1,
    isActive: true,
  },
  {
    id: "writing",
    title: "Rapikan dokumen dan presentasi",
    category: "Menulis",
    talent: "Nafilah Linanti",
    initials: "NL",
    school: "SMK Negeri 1 Wanayasa",
    price: 15000,
    rating: "4.7",
    reviews: 7,
    range: "Online",
    location: "Wanayasa",
    color: "#FCE8F0",
    symbol: "▤",
    description:
      "Bantu merapikan dokumen tugas atau membuat presentasi yang rapi dan mudah dipahami.",
    estimatedDays: 2,
    isActive: true,
  },
];
const requests = [
  {
    title: "Butuh desain logo untuk ekskul",
    category: "Desain",
    budget: "Rp30–50 ribu",
    time: "2 jam lalu",
  },
  {
    title: "Cari tutor Fisika kelas 10",
    category: "Tutor",
    budget: "Bisa diskusi",
    time: "5 jam lalu",
  },
];

const rupiah = (value: number) => `Rp${value.toLocaleString("id-ID")}`;

export default function SisworkDashboard({
  initialTab = "Beranda",
  hideTabBar = false,
  externalAction,
  externalActionId,
}: {
  initialTab?: Tab;
  hideTabBar?: boolean;
  externalAction?: ExternalAction;
  externalActionId?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [category, setCategory] = useState("Semua");
  const [range, setRange] = useState<Range>("Semua");
  const [query, setQuery] = useState("");
  const [publishedServices, setPublishedServices] = useState<Service[]>([]);
  const [serviceLoadError, setServiceLoadError] = useState("");
  const [isSavingService, setIsSavingService] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [showSellerOnboarding, setShowSellerOnboarding] = useState(false);
  const [isSavingSellerOnboarding, setIsSavingSellerOnboarding] =
    useState(false);
  const [sellerOnboardingError, setSellerOnboardingError] = useState("");
  const [sellerBio, setSellerBio] = useState("");
  const [sellerCategory, setSellerCategory] = useState("Desain");
  const [walletProvider, setWalletProvider] =
    useState<WalletProvider>("DANA");
  const [walletNumber, setWalletNumber] = useState("");
  const [serviceFormError, setServiceFormError] = useState("");
  const [serviceTitle, setServiceTitle] = useState("");
  const [serviceCategory, setServiceCategory] = useState("Desain");
  const [serviceDescription, setServiceDescription] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [serviceRange, setServiceRange] =
    useState<Exclude<Range, "Semua">>("Online");
  const [serviceLocation, setServiceLocation] = useState("");
  const [serviceEstimatedDays, setServiceEstimatedDays] = useState("3");
  const [serviceBeingEdited, setServiceBeingEdited] = useState<Service | null>(
    null,
  );
  const [serviceMutationError, setServiceMutationError] = useState("");
  const [portfolioCreateRequest, setPortfolioCreateRequest] = useState(0);
  const handledExternalActionId = useRef<string | undefined>(undefined);
  const allServices = useMemo(() => {
    const publishedIds = new Set(publishedServices.map((service) => service.id));
    return [...publishedServices, ...services.filter((service) => !publishedIds.has(service.id))];
  }, [publishedServices]);
  const [saved, setSaved] = useState<string[]>([]);
  const [detail, setDetail] = useState<Service | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDetail, setSettingsDetail] = useState<SettingsDetail | null>(
    null,
  );
  const [profileError, setProfileError] = useState("");
  const [orderSegment, setOrderSegment] = useState<"Dipesan" | "Penjualan">(
    "Dipesan",
  );
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [chatUserId, setChatUserId] = useState<string | null>(null);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [invoiceTitle, setInvoiceTitle] = useState("");
  const [invoiceDescription, setInvoiceDescription] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceRevisionLimit, setInvoiceRevisionLimit] = useState("3");
  const [invoiceError, setInvoiceError] = useState("");
  const [isSendingMedia, setIsSendingMedia] = useState(false);
  const [isStartingConversation, setIsStartingConversation] = useState(false);
  const [chatError, setChatError] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [chatSearch, setChatSearch] = useState("");
  const [chatFilter, setChatFilter] = useState<"Semua" | "Belum dibaca">(
    "Semua",
  );
  const [draftMessage, setDraftMessage] = useState("");
  const insets = useSafeAreaInsets();
  const { setTabBarHidden } = useTabBarVisibility();

  const logout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    setLogoutError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setProfile(null);
      setSellerBio("");
      setWalletNumber("");
      setConversations([]);
      setChatUserId(null);
      setSelectedConversationId(null);
      setSaved([]);
      setPublishedServices([]);
      setDetail(null);
      setTab("Beranda");
      setShowLogoutConfirmation(false);
      setShowSettings(false);
      router.replace("/auth/screens/LoginScreen");
    } catch (error) {
      console.error("Gagal keluar dari akun:", error);
      setLogoutError(
        error instanceof Error
          ? `Akun belum berhasil dikeluarkan: ${error.message}`
          : "Akun belum berhasil dikeluarkan. Silakan coba lagi.",
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  useEffect(() => {
    let isCurrent = true;
    const loadServices = async () => {
      setServiceLoadError("");
      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) {
          if (isCurrent) setPublishedServices([]);
          return;
        }

        const { data: viewer, error: viewerError } = await supabase
          .from("profiles")
          .select("school_id")
          .eq("id", authData.user.id)
          .maybeSingle();
        if (viewerError) throw viewerError;
        if (!viewer) {
          if (isCurrent) setPublishedServices([]);
          return;
        }

        const { data: schoolSellers, error: schoolSellersError } =
          await supabase
            .from("profiles")
            .select("id")
            .eq("school_id", viewer.school_id)
            .eq("is_seller", true);
        if (schoolSellersError) throw schoolSellersError;
        const sellerIds = (schoolSellers ?? []).map((seller) => seller.id);
        if (!sellerIds.length) {
          if (isCurrent) setPublishedServices([]);
          return;
        }

        const { data, error } = await supabase
          .from("services")
          .select(
            "id, seller_id, title, category, description, price, service_range, location, thumbnail_url, estimated_days, is_active",
          )
          .in("seller_id", sellerIds)
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (!data?.length) {
          if (isCurrent) setPublishedServices([]);
          return;
        }

        const { data: sellers, error: sellersError } = await supabase
          .from("profiles")
          .select("id, full_name, school:schools(name)")
          .in("id", sellerIds);
        if (sellersError) throw sellersError;
        const sellersById = new Map(
          (sellers ?? []).map((seller) => [seller.id, seller]),
        );
        const colors: Record<string, { color: string; symbol: string }> = {
          Desain: { color: "#EEEAFE", symbol: "✳" },
          Website: { color: "#E2F4EC", symbol: "⌘" },
          Video: { color: "#FFF0E3", symbol: "▶" },
          Menulis: { color: "#FCE8F0", symbol: "▤" },
          Tutor: { color: "#E6F1FF", symbol: "∑" },
        };
        const loadedServices = data.map((item): Service => {
          const seller = sellersById.get(item.seller_id);
          const decoration = colors[item.category] ?? colors.Desain;
          const talent = String(seller?.full_name ?? "Seller Siswork");
          return {
            id: item.id,
            sellerId: item.seller_id,
            title: item.title,
            category: item.category,
            talent,
            initials:
              talent
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part: string) => part.charAt(0).toUpperCase())
                .join("") || "?",
            school: seller?.school?.[0]?.name ?? "",
            price: item.price,
            rating: "Baru",
            reviews: 0,
            range: item.service_range,
            location: item.location ?? "",
            ...decoration,
            description: item.description,
            estimatedDays: item.estimated_days,
            isActive: item.is_active,
          };
        });
        if (isCurrent) setPublishedServices(loadedServices);
      } catch (error) {
        if (!isCurrent) return;
        console.error("Gagal memuat daftar jasa:", error);
        setServiceLoadError(
          error instanceof Error
            ? `Daftar jasa terbaru tidak dapat dimuat: ${error.message}`
            : "Daftar jasa terbaru tidak dapat dimuat.",
        );
      }
    };

    void loadServices();
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;
    const loadProfile = async () => {
      setIsLoadingProfile(true);
      setProfileError("");

      try {
        const { data: userData, error: userError } =
          await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userData.user) {
          if (isCurrent) setProfileError("Silakan login untuk melihat profil.");
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select(
            "full_name, nisn, school_id, grade_level, major, is_verified, is_seller, bio, seller_category, school:schools(name)",
          )
          .eq("id", userData.user.id)
          .maybeSingle();

        if (error) throw error;
        if (!isCurrent) return;

        if (!data) {
          setProfile(null);
          setProfileError(
            "Profil belum tersedia. Silakan login ulang agar registrasi siswa terselesaikan.",
          );
          return;
        }

        const loadedProfile: StudentProfile = {
          id: userData.user.id,
          schoolId: data.school_id,
          full_name: data.full_name ?? "",
          nisn: data.nisn ?? "",
          school: data.school?.[0]?.name ?? "",
          gradeLevel: data.grade_level ?? "",
          major: data.major ?? "",
          isVerified: data.is_verified === true,
          isSeller: data.is_seller === true,
          bio: data.bio ?? "",
          sellerCategory: data.seller_category ?? null,
        };
        setProfile(loadedProfile);
        if (
          externalAction &&
          externalActionId &&
          handledExternalActionId.current !== externalActionId
        ) {
          handledExternalActionId.current = externalActionId;
          if (externalAction === "portfolio") {
            setPortfolioCreateRequest((current) => current + 1);
          } else if (loadedProfile.isSeller) {
            setServiceBeingEdited(null);
            setServiceTitle("");
            setServiceCategory(loadedProfile.sellerCategory ?? "Desain");
            setServiceDescription("");
            setServicePrice("");
            setServiceRange("Online");
            setServiceLocation("");
            setServiceEstimatedDays("3");
            setServiceFormError("");
            setShowServiceForm(true);
          } else {
            setSellerBio(loadedProfile.bio);
            setSellerCategory(loadedProfile.sellerCategory ?? "Desain");
            setSellerOnboardingError("");
            setShowSellerOnboarding(true);
          }
        }
      } catch (error) {
        if (!isCurrent) return;
        console.error("Gagal memuat profil:", error);
        setProfileError(
          error instanceof Error
            ? `Profil tidak dapat dimuat: ${error.message}`
            : "Profil tidak dapat dimuat. Silakan coba lagi.",
        );
      } finally {
        if (isCurrent) setIsLoadingProfile(false);
      }
    };

    void loadProfile();
    return () => {
      isCurrent = false;
    };
  }, [externalAction, externalActionId]);

  useEffect(() => {
    if (tab !== "Chat") return;

    let isCurrent = true;
    const loadChats = async () => {
      setIsLoadingChats(true);
      setChatError("");
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!data.user) {
          if (!isCurrent) return;
          setChatUserId(null);
          setConversations([]);
          setChatError("Silakan login untuk melihat percakapan.");
          return;
        }

        const items = await loadMyConversations(data.user.id);
        if (!isCurrent) return;
        setChatUserId(data.user.id);
        setConversations(items);
      } catch (error) {
        if (!isCurrent) return;
        console.error("Gagal memuat percakapan:", error);
        setChatError(
          error instanceof Error
            ? `Percakapan tidak dapat dimuat: ${error.message}`
            : "Percakapan tidak dapat dimuat. Silakan coba lagi.",
        );
      } finally {
        if (isCurrent) setIsLoadingChats(false);
      }
    };

    void loadChats();
    return () => {
      isCurrent = false;
    };
  }, [tab]);

  useEffect(() => {
    if (!selectedConversationId || !chatUserId) return;
    const conversationId = selectedConversationId;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (change) => {
          if (change.new.sender_id === chatUserId) return;
          void loadConversationMessages(conversationId, chatUserId)
            .then(async (messages) => {
              setConversations((current) =>
                current.map((conversation) =>
                  conversation.id === conversationId
                    ? {
                        ...conversation,
                        messages,
                        unreadCount: 0,
                        lastMessagePreview:
                          change.new.message_type === "image" ||
                          change.new.message_type === "file"
                            ? `Lampiran: ${change.new.message_text}`
                            : change.new.message_text,
                        lastMessageIsMine: false,
                      }
                    : conversation,
                ),
              );
              await markConversationRead(conversationId);
            })
            .catch((error: unknown) => {
              console.error("Gagal menyinkronkan pesan realtime:", error);
              setChatError("Pesan baru tidak dapat dimuat. Coba buka ulang chat.");
            });
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(`Realtime chat status: ${status}`);
          setChatError("Koneksi chat realtime terputus. Periksa jaringan Anda.");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chatUserId, selectedConversationId]);

  const filteredServices = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("id-ID");
    return allServices.filter((service) => {
      const matchesCategory =
        category === "Semua" || service.category === category;
      const matchesRange = range === "Semua" || service.range === range;
      const searchable =
        `${service.title} ${service.category} ${service.talent} ${service.location}`.toLocaleLowerCase(
          "id-ID",
        );
      return (
        service.isActive !== false &&
        matchesCategory &&
        matchesRange &&
        (!term || searchable.includes(term))
      );
    });
  }, [allServices, category, query, range]);

  const toggleSaved = (id: string) =>
    setSaved((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  const demoNotice = (title: string) =>
    Alert.alert(
      title,
      "Fitur ini masih berupa rancangan UI dan akan dihubungkan pada tahap backend.",
    );
  const prepareServiceForm = (
    initialCategory = "Desain",
    service: Service | null = null,
  ) => {
    setServiceBeingEdited(service);
    setServiceTitle(service?.title ?? "");
    setServiceCategory(service?.category ?? initialCategory);
    setServiceDescription(service?.description ?? "");
    setServicePrice(service?.price.toString() ?? "");
    setServiceRange(service?.range ?? "Online");
    setServiceLocation(service?.location ?? "");
    setServiceEstimatedDays(String(service?.estimatedDays ?? 3));
    setServiceFormError("");
    setShowServiceForm(true);
  };
  const openServiceForm = () => {
    if (!profile) {
      setTab("Profil");
      if (!isLoadingProfile) {
        Alert.alert(
          "Profil belum siap",
          "Profil belum tersedia. Coba muat ulang halaman atau login kembali.",
        );
      }
      return;
    }
    if (!profile.isSeller) {
      setSellerBio(profile.bio);
      setSellerCategory(profile.sellerCategory ?? "Desain");
      setSellerOnboardingError("");
      setShowSellerOnboarding(true);
      return;
    }
    prepareServiceForm(profile.sellerCategory ?? "Desain");
  };
  const completeSellerOnboarding = async () => {
    if (!profile || isSavingSellerOnboarding) return;

    const normalizedBio = sellerBio.trim();
    const normalizedWalletNumber = walletNumber.replace(/\D/g, "");
    if (normalizedBio.length < 20 || normalizedBio.length > 500) {
      setSellerOnboardingError(
        "Bio keahlian harus terdiri dari 20 sampai 500 karakter.",
      );
      return;
    }
    if (!serviceCategories.includes(sellerCategory)) {
      setSellerOnboardingError("Pilih kategori keahlian utama.");
      return;
    }
    if (!/^\d{8,20}$/.test(normalizedWalletNumber)) {
      setSellerOnboardingError(
        "Nomor e-wallet harus terdiri dari 8 sampai 20 digit.",
      );
      return;
    }

    setIsSavingSellerOnboarding(true);
    setSellerOnboardingError("");
    try {
      const { data, error } = await supabase.rpc("complete_seller_onboarding", {
        p_bio: normalizedBio,
        p_category: sellerCategory,
        p_wallet_provider: walletProvider,
        p_wallet_number: normalizedWalletNumber,
      });
      if (error) throw error;
      const updated = Array.isArray(data) ? data[0] : data;
      if (!updated?.is_seller) {
        throw new Error("Server belum mengaktifkan profil seller.");
      }

      setProfile((current) =>
        current
          ? {
              ...current,
              isSeller: true,
              bio: updated.bio ?? normalizedBio,
              sellerCategory:
                updated.seller_category ?? sellerCategory,
            }
          : current,
      );
      setShowSellerOnboarding(false);
      prepareServiceForm(sellerCategory);
    } catch (error) {
      console.error("Gagal menyelesaikan onboarding seller:", error);
      setSellerOnboardingError(
        error instanceof Error
          ? `Profil seller belum berhasil disimpan: ${error.message}`
          : "Profil seller belum berhasil disimpan. Silakan coba lagi.",
      );
    } finally {
      setIsSavingSellerOnboarding(false);
    }
  };
  const saveService = async () => {
    if (isSavingService) return;

    const title = serviceTitle.trim();
    const description = serviceDescription.trim();
    const price = Number(servicePrice.replace(/\D/g, ""));
    const location = serviceLocation.trim();
    const estimatedDays = Number(serviceEstimatedDays.replace(/\D/g, ""));

    if (title.length < 3 || title.length > 100) {
      setServiceFormError("Judul jasa harus terdiri dari 3–100 karakter.");
      return;
    }
    if (!serviceCategories.includes(serviceCategory)) {
      setServiceFormError("Pilih kategori jasa yang tersedia.");
      return;
    }
    if (description.length < 10 || description.length > 2000) {
      setServiceFormError("Deskripsi jasa harus terdiri dari 10–2.000 karakter.");
      return;
    }
    if (!Number.isSafeInteger(price) || price <= 0) {
      setServiceFormError("Masukkan harga berupa angka yang lebih besar dari 0.");
      return;
    }
    if (!Number.isSafeInteger(estimatedDays) || estimatedDays < 1 || estimatedDays > 365) {
      setServiceFormError("Estimasi pengerjaan harus 1–365 hari.");
      return;
    }
    if (serviceRange === "Lokal" && !location) {
      setServiceFormError("Lokasi wajib diisi untuk jasa lokal.");
      return;
    }
    if (!profile?.id || !profile.isSeller) {
      setServiceFormError(
        "Lengkapi onboarding seller sebelum menerbitkan jasa.",
      );
      return;
    }

    setIsSavingService(true);
    setServiceFormError("");
    try {
      const servicePayload = {
        seller_id: profile.id,
        title,
        category: serviceCategory,
        description,
        price,
        estimated_days: estimatedDays,
        service_range: serviceRange,
        location: serviceRange === "Lokal" ? location : null,
        is_active: serviceBeingEdited?.isActive ?? true,
      };
      const serviceQuery = serviceBeingEdited
        ? supabase
            .from("services")
            .update(servicePayload)
            .eq("id", serviceBeingEdited.id)
            .eq("seller_id", profile.id)
            .select(
              "id, seller_id, title, category, description, price, service_range, location, thumbnail_url, estimated_days, is_active",
            )
            .single()
        : supabase
            .from("services")
            .insert(servicePayload)
            .select(
              "id, seller_id, title, category, description, price, service_range, location, thumbnail_url, estimated_days, is_active",
            )
            .single();
      const { data, error } = await serviceQuery;
      if (error) throw error;
      if (!data) throw new Error("Server tidak mengembalikan data jasa.");

      const decoration: Record<string, { color: string; symbol: string }> = {
        Desain: { color: "#EEEAFE", symbol: "✳" },
        Website: { color: "#E2F4EC", symbol: "⌘" },
        Video: { color: "#FFF0E3", symbol: "▶" },
        Menulis: { color: "#FCE8F0", symbol: "▤" },
        Tutor: { color: "#E6F1FF", symbol: "∑" },
      };
      const createdService: Service = {
        id: data.id,
        sellerId: profile.id,
        title: data.title,
        category: data.category,
        talent: profile.full_name,
        initials:
          profile.full_name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join("") || "?",
        school: profile.school,
        price: data.price,
        rating: "Baru",
        reviews: 0,
        range: data.service_range,
        location: data.location ?? "",
        ...decoration[data.category],
        description: data.description,
        estimatedDays: data.estimated_days,
        isActive: data.is_active,
      };

      setPublishedServices((current) => [
        createdService,
        ...current.filter((item) => item.id !== createdService.id),
      ]);
      setShowServiceForm(false);
      setServiceBeingEdited(null);
      setServiceEstimatedDays("3");
      Alert.alert(
        serviceBeingEdited ? "Jasa berhasil diperbarui" : "Jasa berhasil diterbitkan",
        serviceBeingEdited
          ? "Perubahan jasa sudah tersimpan."
          : "Jasamu sekarang tampil di katalog.",
      );
    } catch (error) {
      console.error("Gagal menerbitkan jasa:", error);
      setServiceFormError(
        error instanceof Error
          ? `Jasa tidak dapat disimpan: ${error.message}`
          : "Jasa tidak dapat disimpan. Silakan coba lagi.",
      );
    } finally {
      setIsSavingService(false);
    }
  };
  const updateServiceStatus = async (service: ProfileService) => {
    setServiceMutationError("");
    try {
      const nextStatus = !service.isActive;
      const { data, error } = await supabase
        .from("services")
        .update({ is_active: nextStatus })
        .eq("id", service.id)
        .eq("seller_id", profile?.id ?? "")
        .select("id, is_active")
        .single();
      if (error) throw error;
      if (!data) throw new Error("Server tidak mengembalikan status jasa.");
      setPublishedServices((current) =>
        current.map((item) =>
          item.id === data.id ? { ...item, isActive: data.is_active } : item,
        ),
      );
    } catch (error) {
      console.error("Gagal mengubah status jasa:", error);
      setServiceMutationError(
        error instanceof Error
          ? `Status jasa tidak dapat diubah: ${error.message}`
          : "Status jasa tidak dapat diubah. Silakan coba lagi.",
      );
    }
  };
  const deleteService = (service: ProfileService) => {
    Alert.alert("Hapus jasa?", `Jasa "${service.title}" akan dihapus.`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: () => void confirmDeleteService(service),
      },
    ]);
  };
  const confirmDeleteService = async (service: ProfileService) => {
    setServiceMutationError("");
    try {
      const { data, error } = await supabase
        .from("services")
        .delete()
        .eq("id", service.id)
        .eq("seller_id", profile?.id ?? "")
        .select("id")
        .single();
      if (error) throw error;
      if (!data) throw new Error("Server tidak mengonfirmasi penghapusan jasa.");
      setPublishedServices((current) =>
        current.filter((item) => item.id !== service.id),
      );
    } catch (error) {
      console.error("Gagal menghapus jasa:", error);
      setServiceMutationError(
        error instanceof Error
          ? `Jasa tidak dapat dihapus: ${error.message}`
          : "Jasa tidak dapat dihapus. Silakan coba lagi.",
      );
    }
  };
  const openConversation = async (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setDraftMessage("");
    setIsLoadingMessages(true);
    setChatError("");
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, unreadCount: 0 }
          : conversation,
      ),
    );
    try {
      let userId = chatUserId;
      if (!userId) {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!data.user) throw new Error("Silakan login kembali.");
        userId = data.user.id;
        setChatUserId(userId);
      }

      const messages = await loadConversationMessages(conversationId, userId);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, messages }
            : conversation,
        ),
      );
      await markConversationRead(conversationId);
    } catch (error) {
      console.error("Gagal membuka percakapan:", error);
      setChatError(
        error instanceof Error
          ? `Pesan tidak dapat dimuat: ${error.message}`
          : "Pesan tidak dapat dimuat. Silakan coba lagi.",
      );
    } finally {
      setIsLoadingMessages(false);
    }
  };
  const startConversation = async (service: Service) => {
    if (isStartingConversation) return;

    setIsStartingConversation(true);
    setChatError("");
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!data.user) throw new Error("Silakan login untuk memulai chat.");

      const peerId =
        service.sellerId ??
        (await findProfileByName(service.talent)).id;
      if (peerId === data.user.id) {
        throw new Error(
          "Kamu tidak bisa memulai percakapan dengan akun sendiri.",
        );
      }

      const conversationId = await getOrCreateDirectConversation(
        peerId,
        service.title,
      );
      const [items, messages] = await Promise.all([
        loadMyConversations(data.user.id),
        loadConversationMessages(conversationId, data.user.id),
      ]);
      await markConversationRead(conversationId);

      setChatUserId(data.user.id);
      setConversations(
        items.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, unreadCount: 0, messages }
            : conversation,
        ),
      );
      setSelectedConversationId(conversationId);
      setDetail(null);
      setTab("Chat");
    } catch (error) {
      console.error("Gagal memulai percakapan:", error);
      Alert.alert(
        "Chat belum dapat dibuka",
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat membuka percakapan. Silakan coba lagi.",
      );
    } finally {
      setIsStartingConversation(false);
    }
  };
  const sendChatMessage = async () => {
    const text = draftMessage.trim();
    if (
      !text ||
      !selectedConversationId ||
      !chatUserId ||
      isSendingMessage
    ) {
      return;
    }

    setIsSendingMessage(true);
    setChatError("");
    try {
      const message = await sendConversationMessage(
        selectedConversationId,
        chatUserId,
        text,
      );
      setConversations((current) =>
        current
          .map((conversation) =>
            conversation.id === selectedConversationId
              ? {
                  ...conversation,
                  updatedAt: message.time,
                  unreadCount: 0,
                  lastMessagePreview: message.text,
                  lastMessageIsMine: true,
                  messages: [...conversation.messages, message],
                }
              : conversation,
          )
          .sort((first, second) =>
            first.id === selectedConversationId
              ? -1
              : second.id === selectedConversationId
                ? 1
                : 0,
          ),
      );
      setDraftMessage("");
    } catch (error) {
      console.error("Gagal mengirim pesan:", error);
      setChatError(
          error instanceof Error
            ? `Pesan tidak terkirim: ${error.message}`
            : "Pesan tidak terkirim. Silakan coba lagi.",
      );
    } finally {
      setIsSendingMessage(false);
    }
  };
  const submitProjectInvoice = async () => {
    const conversationId = selectedConversationId;
    if (!conversationId || !chatUserId || isCreatingInvoice) return;

    const normalizedAmount = invoiceAmount.replace(/[^\d]/g, "");
    const amount = normalizedAmount ? Number(normalizedAmount) : Number.NaN;
    setIsCreatingInvoice(true);
    setInvoiceError("");
    try {
      await createProjectInvoice(
        conversationId,
        invoiceTitle,
        invoiceDescription,
        amount,
        invoiceRevisionLimit.trim()
          ? Number(invoiceRevisionLimit)
          : Number.NaN,
      );
      const messages = await loadConversationMessages(conversationId, chatUserId);
      const latestMessage = messages[messages.length - 1];
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                updatedAt: latestMessage?.time ?? conversation.updatedAt,
                lastMessagePreview: latestMessage?.text ?? "Invoice proyek",
                lastMessageIsMine: true,
                unreadCount: 0,
                messages,
              }
            : conversation,
        ),
      );
      setInvoiceTitle("");
      setInvoiceDescription("");
      setInvoiceAmount("");
      setInvoiceRevisionLimit("3");
      setShowInvoiceForm(false);
    } catch (error) {
      console.error("Gagal membuat invoice proyek:", error);
      setInvoiceError(
        error instanceof Error
          ? error.message
          : "Invoice tidak dapat dibuat. Silakan coba lagi.",
      );
    } finally {
      setIsCreatingInvoice(false);
    }
  };
  const sendChatAttachment = async () => {
    if (!selectedConversationId || !chatUserId || isSendingMedia) return;
    setChatError("");
    try {
      let file: {
        uri: string;
        name: string;
        mimeType?: string | null;
        size?: number;
      };
      try {
        const DocumentPicker = await import("expo-document-picker");
        const result = await DocumentPicker.getDocumentAsync({
          type: ["image/*", "video/*", "application/pdf"],
          copyToCacheDirectory: true,
          multiple: false,
        });
        if (result.canceled) return;
        file = result.assets[0];
      } catch (pickerError) {
        const errorMessage =
          pickerError instanceof Error ? pickerError.message : "";
        if (!/ExpoDocumentPicker|document.?picker|native module/i.test(errorMessage)) {
          throw pickerError;
        }
        console.warn(
          "expo-document-picker tidak tersedia di APK; menggunakan pemilih gambar/video.",
          pickerError,
        );
        const ImagePicker = await import("expo-image-picker");
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images", "videos"],
          quality: 0.85,
        });
        if (result.canceled) return;
        const asset = result.assets[0];
        file = {
          uri: asset.uri,
          name:
            asset.fileName ??
            `lampiran-${Date.now()}.${asset.mimeType?.split("/")[1] ?? "jpg"}`,
          mimeType:
            asset.mimeType ??
            (asset.type === "video" ? "video/mp4" : "image/jpeg"),
          size: asset.fileSize,
        };
        setChatError(
          "Pemilih file belum tersedia pada APK ini; gambar/video tetap bisa dikirim. Pasang ulang development build terbaru untuk mengirim PDF.",
        );
      }
      if (file.size && file.size > 15 * 1024 * 1024) {
        throw new Error("Lampiran maksimal berukuran 15 MB.");
      }
      setIsSendingMedia(true);
      const message = await sendConversationMedia(
        selectedConversationId,
        chatUserId,
        {
          uri: file.uri,
          name: file.name,
          mimeType: file.mimeType ?? "application/octet-stream",
          size: file.size,
        },
      );
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversationId
            ? {
                ...conversation,
                lastMessagePreview: `Lampiran: ${file.name}`,
                lastMessageIsMine: true,
                unreadCount: 0,
                messages: [...conversation.messages, message],
              }
            : conversation,
        ),
      );
    } catch (error) {
      console.error("Gagal mengirim lampiran:", error);
      setChatError(
        error instanceof Error
          ? `Lampiran tidak terkirim: ${error.message}`
          : "Lampiran tidak terkirim. Silakan coba lagi.",
      );
    } finally {
      setIsSendingMedia(false);
    }
  };

  const categoryFilters = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
    >
      {categories.map((item) => (
        <TouchableOpacity
          key={item}
          onPress={() => setCategory(item)}
          style={[styles.chip, category === item && styles.chipActive]}
        >
          <Text
            style={[
              styles.chipText,
              category === item && styles.chipTextActive,
            ]}
          >
            {item}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const reachFilters = () => (
    <View style={styles.reachFilters}>
      {(["Semua", "Online", "Lokal"] as const).map((item) => (
        <TouchableOpacity
          key={item}
          onPress={() => setRange(item)}
          style={[styles.reachChip, range === item && styles.reachChipActive]}
        >
          <Text
            style={[
              styles.reachChipText,
              range === item && styles.reachChipTextActive,
            ]}
          >
            {item === "Lokal"
              ? "⌖  Lokal"
              : item === "Online"
                ? "◎  Online"
                : "Semua"}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const serviceCard = (service: Service) => (
    <TouchableOpacity
      key={service.id}
      activeOpacity={0.9}
      style={styles.serviceCard}
      onPress={() => setDetail(service)}
    >
      <View style={[styles.serviceArtwork, { backgroundColor: service.color }]}>
        <Text style={styles.serviceSymbol}>{service.symbol}</Text>
        <View style={styles.serviceCategory}>
          <Text style={styles.serviceCategoryText}>{service.category}</Text>
        </View>
        <TouchableOpacity
          style={styles.saveButton}
          accessibilityLabel="Simpan jasa"
          onPress={(event) => {
            event.stopPropagation();
            toggleSaved(service.id);
          }}
        >
          <Text
            style={[
              styles.saveIcon,
              saved.includes(service.id) && styles.saveIconActive,
            ]}
          >
            {saved.includes(service.id) ? "♥" : "♡"}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.serviceInfo}>
        <Text numberOfLines={2} style={styles.serviceTitle}>
          {service.title}
        </Text>
        <View style={styles.talentRow}>
          <View
            style={[styles.avatarSmall, { backgroundColor: service.color }]}
          >
            <Text style={styles.avatarInitials}>{service.initials}</Text>
          </View>
          <View style={styles.talentDetails}>
            <Text numberOfLines={1} style={styles.talentName}>
              {service.talent}
            </Text>
            <Text numberOfLines={1} style={styles.school}>
              {service.school}
            </Text>
          </View>
          <Text style={styles.rating}>
            {service.reviews > 0 ? `★ ${service.rating}` : "✦ Baru"}
          </Text>
        </View>
        <View style={styles.serviceFooter}>
          <Text style={styles.price}>
            {rupiah(service.price)}
            <Text style={styles.priceNote}> / mulai</Text>
          </Text>
          <Text style={styles.rangeText}>
            {service.range === "Online" ? "◎ Online" : `⌖ ${service.location}`}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const sectionHeading = (
    title: string,
    subtitle?: string,
    action?: string,
    onAction?: () => void,
  ) => (
    <View style={styles.sectionHeading}>
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {action ? (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.link}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const homeContent = () => (
    <>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.brand}>
            <Text style={styles.brandBadge}>S</Text>
            <Text style={styles.brandAccent}>iswork</Text>
          </Text>
          <Text style={styles.brandTagline}>Ruang kolaborasi pelajar</Text>
        </View>
        <TouchableOpacity
          style={styles.notification}
          onPress={() => demoNotice("Notifikasi")}
          accessibilityLabel="Notifikasi"
        >
          <Text style={styles.notificationIcon}>♧</Text>
          <View style={styles.notificationDot} />
        </TouchableOpacity>
      </View>
      <View style={styles.welcome}>
        <Text style={styles.greeting}>Halo, Pelajar! 👋</Text>
        <Text style={styles.welcomeSubtitle}>
          Temukan keahlian hebat dari teman sekolahmu.
        </Text>
      </View>
      <SearchBox
        value={query}
        onChange={setQuery}
        onFocus={() => setTab("Cari")}
        placeholder="Cari jasa, keahlian, atau talent..."
      />
      <View style={styles.hero}>
        <View style={styles.heroOrb} />
        <Text style={styles.heroEyebrow}>PUNYA KEAHLIAN?</Text>
        <Text style={styles.heroTitle}>Karyamu bisa jadi peluang.</Text>
        <Text style={styles.heroDescription}>
          Bagikan skill, bangun portofolio, dan mulai dari sini.
        </Text>
        <TouchableOpacity
          style={styles.heroButton}
          onPress={openServiceForm}
        >
          <Text style={styles.heroButtonText}>Tawarkan jasamu →</Text>
        </TouchableOpacity>
        <Text style={styles.heroDecoration}>✳</Text>
      </View>
      {sectionHeading("Jelajahi kategori", "Cari skill yang kamu butuhkan")}
      {categoryFilters()}
      {sectionHeading(
        "Talent pilihan",
        "Karya terbaik dari teman pelajar",
        "Lihat semua",
        () => setTab("Cari"),
      )}
      {reachFilters()}
      {!!serviceLoadError && (
        <Text accessibilityRole="alert" style={styles.serviceLoadError}>
          {serviceLoadError}
        </Text>
      )}
      {filteredServices.length ? (
        <View style={styles.serviceList}>
          {filteredServices.slice(0, 3).map(serviceCard)}
        </View>
      ) : (
        <EmptyState text="Belum ada jasa yang cocok. Coba filter lainnya." />
      )}
      {sectionHeading(
        "Request board",
        "Kebutuhan jasa dari komunitas",
        "+ Buat",
        () => demoNotice("Buat request"),
      )}
      {requests.map((request) => (
        <TouchableOpacity
          key={request.title}
          style={styles.requestCard}
          onPress={() => demoNotice("Kirim penawaran")}
        >
          <View style={styles.requestIcon}>
            <Text style={styles.requestIconText}>↗</Text>
          </View>
          <View style={styles.requestDetails}>
            <Text style={styles.requestTitle}>{request.title}</Text>
            <Text style={styles.requestMeta}>
              {request.category} · {request.time}
            </Text>
            <Text style={styles.requestBudget}>{request.budget}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      ))}
      <Text style={styles.demoNote}>Pratinjau UI · data contoh</Text>
    </>
  );

  const searchContent = () => (
    <>
      <Text style={styles.eyebrow}>TEMUKAN TALENT</Text>
      <Text style={styles.pageTitle}>Cari jasa</Text>
      <Text style={styles.pageSubtitle}>
        Pilih keahlian yang sesuai kebutuhanmu.
      </Text>
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Contoh: desain poster"
      />
      <Text style={styles.filterLabel}>Kategori</Text>
      {categoryFilters()}
      <Text style={styles.filterLabel}>Jangkauan layanan</Text>
      {reachFilters()}
      <Text style={styles.resultCount}>
        {filteredServices.length} jasa ditemukan
      </Text>
      {!!serviceLoadError && (
        <Text accessibilityRole="alert" style={styles.serviceLoadError}>
          {serviceLoadError}
        </Text>
      )}
      {filteredServices.length ? (
        <View style={styles.serviceList}>
          {filteredServices.map(serviceCard)}
        </View>
      ) : (
        <EmptyState text="Jasa belum ditemukan. Ubah kata kunci atau filter." />
      )}
    </>
  );

  const profileContent = () => (
    <>
      <View style={styles.profileHeading}>
        <View>
          <Text style={styles.eyebrow}>AKUN PELAJAR</Text>
          <Text style={styles.pageTitle}>Profil saya</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Buka pengaturan"
          style={styles.settingsButton}
          onPress={() => setShowSettings(true)}
        >
          <Text style={styles.settingsButtonIcon}>⚙</Text>
          <Text style={styles.settingsButtonText}>Pengaturan</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.profileCard}>
        {isLoadingProfile ? (
          <Text style={styles.profileBio}>Memuat data profil...</Text>
        ) : (
          <>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileInitial}>
                {profile?.full_name.trim().charAt(0).toUpperCase() || "?"}
              </Text>
              {profile?.isVerified && (
                <View style={styles.verified}>
                  <Text style={styles.verifiedText}>✓</Text>
                </View>
              )}
            </View>
            <Text style={styles.profileName}>
              {profile?.full_name || "Nama belum tersedia"}
            </Text>
            <Text style={styles.profileSchool}>
              {[profile?.gradeLevel, profile?.school]
                .filter(Boolean)
                .join(" · ") || "Sekolah belum tersedia"}
            </Text>
            {!!profile?.major && (
              <Text style={styles.profileSchool}>Jurusan {profile.major}</Text>
            )}
            {!!profile?.nisn && (
              <Text style={styles.profileSchool}>NISN {profile.nisn}</Text>
            )}
            <Text style={styles.profileBio}>
              {profileError ||
                profile?.bio ||
                "Tambahkan keahlian, karya, dan pengalaman agar klien lebih mengenalmu."}
            </Text>
          </>
        )}
      </View>
      {profile?.isSeller && (
        <View style={styles.sellerBalanceCard}>
          <View style={styles.sellerBalanceIcon}>
            <Text style={styles.sellerBalanceIconText}>Rp</Text>
          </View>
          <View style={styles.sellerBalanceInfo}>
            <Text style={styles.sellerBalanceLabel}>Saldo seller</Text>
            <Text style={styles.sellerBalanceAmount}>{rupiah(0)}</Text>
            <Text style={styles.sellerBalanceCaption}>
              Saldo dari pesanan yang telah selesai
            </Text>
          </View>
          <Text style={styles.sellerBalanceArrow}>›</Text>
        </View>
      )}
      <PortfolioSection
        ownerId={profile?.id ?? null}
        schoolId={profile?.schoolId ?? null}
        createRequest={portfolioCreateRequest}
      />
      <ServiceSection
        services={allServices
          .filter((item) => Boolean(profile?.id) && item.sellerId === profile?.id)
          .map((item) => ({
            id: item.id,
            sellerId: item.sellerId,
            title: item.title,
            category: item.category,
            price: item.price,
            description: item.description,
            estimatedDays: item.estimatedDays,
            isActive: item.isActive,
          }))}
        error={serviceMutationError || serviceLoadError}
        onAdd={openServiceForm}
        onEdit={(service) => {
          const fullService = allServices.find((item) => item.id === service.id);
          if (fullService) prepareServiceForm(fullService.category, fullService);
        }}
        onToggle={(service) => void updateServiceStatus(service)}
        onDelete={deleteService}
      />
      {sectionHeading("Jasa tersimpan", `${saved.length} jasa disimpan`)}
      {saved.length ? (
        <View style={styles.serviceList}>
          {allServices
            .filter((item) => saved.includes(item.id))
            .map(serviceCard)}
        </View>
      ) : (
        <Text style={styles.savedEmpty}>
          Simpan jasa favorit dari katalog untuk menemukannya kembali.
        </Text>
      )}
    </>
  );

  const ordersContent = () => (
    <>
      <View style={styles.profileHeading}>
        <View>
          <Text style={styles.eyebrow}>AKTIVITAS</Text>
          <Text style={styles.pageTitle}>Pesanan Saya</Text>
        </View>
      </View>
      <View style={styles.orderSegmentControl}>
        {(["Dipesan", "Penjualan"] as const).map((segment) => (
          <TouchableOpacity
            key={segment}
            accessibilityRole="tab"
            accessibilityState={{ selected: orderSegment === segment }}
            onPress={() => setOrderSegment(segment)}
            style={[
              styles.orderSegment,
              orderSegment === segment && styles.orderSegmentActive,
            ]}
          >
            <Text
              style={[
                styles.orderSegmentText,
                orderSegment === segment && styles.orderSegmentTextActive,
              ]}
            >
              {segment}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.orderEmptyCard}>
        <Text style={styles.orderGlyph}>◷</Text>
        <Text style={styles.orderEmptyTitle}>
          {orderSegment === "Dipesan"
            ? "Belum ada jasa yang dipesan"
            : "Belum ada pesanan masuk"}
        </Text>
        <Text style={styles.orderEmptyDescription}>
          {orderSegment === "Dipesan"
            ? "Pesanan yang kamu buat akan muncul di sini."
            : "Saat klien memesan jasamu, detail pesanan akan muncul di sini."}
        </Text>
        {orderSegment === "Dipesan" && (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setTab("Cari")}
            style={styles.orderBrowseButton}
          >
            <Text style={styles.orderBrowseButtonText}>Cari jasa</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );

  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedConversationId,
  );
  useEffect(() => {
    setTabBarHidden(tab === "Chat" && selectedConversation !== undefined);
  }, [selectedConversation, setTabBarHidden, tab]);

  const chatContent = () => {
    if (selectedConversation) {
      return (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={[
            styles.chatThreadScreen,
            {
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: Math.max(insets.bottom, 10),
            },
          ]}
        >
          <View style={styles.chatThreadHeader}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Kembali ke daftar chat"
              onPress={() => {
                setSelectedConversationId(null);
                setDraftMessage("");
              }}
              style={styles.chatBackButton}
            >
              <Text style={styles.chatBackIcon}>‹</Text>
            </TouchableOpacity>
            <View
              style={[
                styles.chatAvatar,
                { backgroundColor: selectedConversation.color },
              ]}
            >
              <Text style={styles.chatAvatarText}>
                {selectedConversation.initials}
              </Text>
            </View>
            <View style={styles.chatContact}>
              <Text numberOfLines={1} style={styles.chatContactName}>
                {selectedConversation.name}
              </Text>
              <Text style={styles.chatOnline}>Percakapan Siswork</Text>
            </View>
            <TouchableOpacity
              accessibilityLabel="Info percakapan"
              onPress={() =>
                Alert.alert("Tentang jasa", selectedConversation.service)
              }
              style={styles.chatMoreButton}
            >
              <Text style={styles.chatMoreIcon}>···</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chatServiceBanner}>
            <View style={styles.chatServiceCopy}>
              <Text style={styles.chatServiceEyebrow}>MEMBAHAS JASA</Text>
              <Text numberOfLines={1} style={styles.chatServiceName}>
                {selectedConversation.service}
              </Text>
            </View>
            {selectedConversation.isSeller ? (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => {
                  setInvoiceError("");
                  setInvoiceRevisionLimit("3");
                  setShowInvoiceForm(true);
                }}
                style={styles.chatInvoiceButton}
              >
                <Text style={styles.chatInvoiceButtonText}>＋ Invoice</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.chatPreviewTag}>CHAT LANGSUNG</Text>
            )}
          </View>
          {!!chatError && (
            <Text accessibilityRole="alert" style={styles.chatError}>
              {chatError}
            </Text>
          )}
          <ScrollView
            style={styles.chatMessageScroll}
            contentContainerStyle={styles.chatMessages}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {isLoadingMessages ? (
              <ActivityIndicator color="#4356C5" style={styles.chatLoading} />
            ) : selectedConversation.messages.length ? (
              selectedConversation.messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.chatMessageRow,
                    message.isMine && styles.chatMessageRowMine,
                  ]}
                >
                  {message.type === "invoice" &&
                  message.payload &&
                  "project_id" in message.payload ? (
                    <ChatSystemCard invoice={message.payload} />
                  ) : (message.type === "image" || message.type === "file") &&
                    message.payload &&
                    "url" in message.payload ? (
                    <ChatMediaCard media={message.payload} />
                  ) : (
                    <View
                      style={[
                        styles.chatBubble,
                        message.isMine
                          ? styles.chatBubbleMine
                          : styles.chatBubbleTheirs,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chatMessageText,
                          message.isMine && styles.chatMessageTextMine,
                        ]}
                      >
                        {message.text}
                      </Text>
                      <Text
                        style={[
                          styles.chatMessageTime,
                          message.isMine && styles.chatMessageTimeMine,
                        ]}
                      >
                        {message.time}
                        {message.isMine ? "  ✓✓" : ""}
                      </Text>
                    </View>
                  )}
                </View>
              ))
            ) : (
              <View style={styles.chatFirstMessage}>
                <Text style={styles.chatFirstMessageIcon}>✳</Text>
                <Text style={styles.chatFirstMessageTitle}>
                  Mulai percakapan
                </Text>
                <Text style={styles.chatFirstMessageText}>
                  Tanyakan detail jasa atau ceritakan kebutuhanmu.
                </Text>
              </View>
            )}
          </ScrollView>
          <View style={styles.chatComposer}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Lampirkan gambar atau file"
              disabled={isSendingMedia}
              onPress={() => void sendChatAttachment()}
              style={styles.chatAttachButton}
            >
              {isSendingMedia ? (
                <ActivityIndicator color="#4356C5" size="small" />
              ) : (
                <Text style={styles.chatAttachIcon}>＋</Text>
              )}
            </TouchableOpacity>
            <TextInput
              accessibilityLabel="Tulis pesan"
              value={draftMessage}
              onChangeText={setDraftMessage}
              onSubmitEditing={sendChatMessage}
              submitBehavior="submit"
              placeholder="Tulis pesan..."
              placeholderTextColor="#9AA3B2"
              returnKeyType="send"
              multiline
              maxLength={4000}
              style={styles.chatInput}
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Kirim pesan"
              disabled={!draftMessage.trim() || isSendingMessage}
              onPress={sendChatMessage}
              style={[
                styles.chatSendButton,
                (!draftMessage.trim() || isSendingMessage) &&
                  styles.chatSendButtonDisabled,
              ]}
            >
              {isSendingMessage ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.chatSendIcon}>➤</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      );
    }

    const normalizedSearch = chatSearch.trim().toLocaleLowerCase("id-ID");
    const visibleConversations = conversations.filter((conversation) => {
      const matchesSearch = `${conversation.name} ${conversation.service}`
        .toLocaleLowerCase("id-ID")
        .includes(normalizedSearch);
      return (
        matchesSearch &&
        (chatFilter === "Semua" || conversation.unreadCount > 0)
      );
    });

    return (
      <>
        <View style={styles.chatPageHeading}>
          <View>
            <Text style={styles.eyebrow}>RUANG OBROLAN</Text>
            <Text style={styles.pageTitle}>Chat</Text>
            <Text style={styles.pageSubtitle}>
              Lanjutkan obrolan seputar jasa dan pesananmu.
            </Text>
          </View>
          <TouchableOpacity
            accessibilityLabel="Buat pesan baru"
            onPress={() => {
              setTab("Cari");
              setSelectedConversationId(null);
            }}
            style={styles.chatNewButton}
          >
            <Text style={styles.chatNewButtonText}>＋</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.chatPreviewNotice}>
          <Text style={styles.chatPreviewNoticeText}>
            Satu ruang chat dipakai bersama untuk setiap pasangan profil.
          </Text>
        </View>
        {!!chatError && (
          <Text accessibilityRole="alert" style={styles.chatError}>
            {chatError}
          </Text>
        )}
        <View style={styles.chatSearchBox}>
          <Text style={styles.chatSearchIcon}>⌕</Text>
          <TextInput
            accessibilityLabel="Cari percakapan"
            value={chatSearch}
            onChangeText={setChatSearch}
            placeholder="Cari nama atau jasa..."
            placeholderTextColor="#929AAF"
            style={styles.chatSearchInput}
          />
          {!!chatSearch && (
            <TouchableOpacity
              accessibilityLabel="Hapus pencarian"
              onPress={() => setChatSearch("")}
            >
              <Text style={styles.chatSearchClear}>×</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.chatFilterRow}>
          {(["Semua", "Belum dibaca"] as const).map((filter) => (
            <TouchableOpacity
              key={filter}
              onPress={() => setChatFilter(filter)}
              style={[
                styles.chatFilterChip,
                chatFilter === filter && styles.chatFilterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.chatFilterText,
                  chatFilter === filter && styles.chatFilterTextActive,
                ]}
              >
                {filter}
                {filter === "Belum dibaca" &&
                conversations.some((item) => item.unreadCount > 0)
                  ? `  ${conversations.filter((item) => item.unreadCount > 0).length}`
                  : ""}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.chatConversationList}>
          {isLoadingChats ? (
            <ActivityIndicator color="#4356C5" style={styles.chatLoading} />
          ) : visibleConversations.length ? (
            visibleConversations.map((conversation) => (
              <TouchableOpacity
                key={conversation.id}
                activeOpacity={0.75}
                onPress={() => openConversation(conversation.id)}
                style={styles.chatConversation}
              >
                <View
                  style={[
                    styles.chatListAvatar,
                    { backgroundColor: conversation.color },
                  ]}
                >
                  <Text style={styles.chatAvatarText}>
                    {conversation.initials}
                  </Text>
                </View>
                <View style={styles.chatConversationContent}>
                  <View style={styles.chatConversationTop}>
                    <Text numberOfLines={1} style={styles.chatConversationName}>
                      {conversation.name}
                    </Text>
                    <Text style={styles.chatConversationTime}>
                      {conversation.updatedAt}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={styles.chatConversationService}
                  >
                    {conversation.service}
                  </Text>
                  <View style={styles.chatConversationBottom}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.chatConversationPreview,
                        conversation.unreadCount > 0 &&
                          styles.chatConversationPreviewUnread,
                      ]}
                    >
                      {conversation.lastMessageIsMine ? "Kamu: " : ""}
                      {conversation.lastMessagePreview}
                    </Text>
                    {conversation.unreadCount > 0 && (
                      <View style={styles.chatUnreadBadge}>
                        <Text style={styles.chatUnreadText}>
                          {conversation.unreadCount}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.chatEmptyState}>
              <Text style={styles.chatEmptyIcon}>▱</Text>
              <Text style={styles.chatEmptyTitle}>
                {chatFilter === "Belum dibaca"
                  ? "Semua sudah terbaca"
                  : "Percakapan tidak ditemukan"}
              </Text>
              <Text style={styles.chatEmptyText}>
                {chatFilter === "Belum dibaca"
                  ? "Pesan baru akan muncul di sini."
                  : "Coba kata kunci lain atau mulai chat dari halaman Cari."}
              </Text>
              {chatFilter === "Semua" && (
                <TouchableOpacity
                  onPress={() => setTab("Cari")}
                  style={styles.chatBrowseButton}
                >
                  <Text style={styles.chatBrowseButtonText}>Cari jasa</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </>
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F8FC" />
      {tab === "Chat" && selectedConversation ? (
        chatContent()
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top, 14),
              paddingBottom: hideTabBar ? 132 : 24,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {tab === "Beranda"
              ? homeContent()
              : tab === "Chat"
                ? chatContent()
                : tab === "Pesanan Saya"
                  ? ordersContent()
                : tab === "Cari"
                  ? searchContent()
                  : profileContent()}
          </View>
        </ScrollView>
      )}
      {!hideTabBar && !(tab === "Chat" && selectedConversation) && (
        <View
          style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}
        >
          {(["Beranda", "Chat", "Pesanan Saya", "Profil"] as const).map((item) => {
            const active = tab === item;
            const icon =
              item === "Beranda"
                ? "⌂"
                : item === "Chat"
                  ? "▱"
                  : item === "Pesanan Saya"
                    ? "◷"
                    : "○";
            return (
              <TouchableOpacity
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={item}
                onPress={() => setTab(item)}
                style={styles.tabButton}
              >
                <View
                  style={[
                    styles.tabIconWrap,
                    active && styles.tabIconWrapActive,
                  ]}
                >
                  <Text
                    style={[styles.tabIcon, active && styles.tabIconActive]}
                  >
                    {icon}
                  </Text>
                  {item === "Chat" &&
                    conversations.some(
                      (conversation) => conversation.unreadCount > 0,
                    ) && <View style={styles.tabUnreadDot} />}
                </View>
                <Text
                  style={[styles.tabLabel, active && styles.tabLabelActive]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Modal
        visible={showSellerOnboarding}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isSavingSellerOnboarding) setShowSellerOnboarding(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBackdrop}
        >
          <View
            style={[
              styles.serviceFormSheet,
              { paddingBottom: Math.max(insets.bottom, 18) },
            ]}
          >
            <View style={styles.serviceFormHeader}>
              <View>
                <Text style={styles.eyebrow}>LANGKAH PERTAMA</Text>
                <Text style={styles.serviceFormTitle}>Mulai berjualan</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Tutup onboarding seller"
                disabled={isSavingSellerOnboarding}
                onPress={() => setShowSellerOnboarding(false)}
                style={styles.serviceFormCloseButton}
              >
                <Text style={styles.serviceFormClose}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.serviceFormContent}
            >
              <Text style={styles.serviceFormIntro}>
                Ceritakan keahlianmu dan tambahkan tujuan pencairan agar kamu
                bisa langsung menerbitkan jasa pertamamu.
              </Text>

              <Text style={styles.formLabel}>Bio keahlian</Text>
              <TextInput
                accessibilityLabel="Bio keahlian"
                value={sellerBio}
                onChangeText={setSellerBio}
                placeholder="Ceritakan pengalaman, keahlian, atau hal yang bisa kamu bantu..."
                placeholderTextColor="#929AAF"
                multiline
                textAlignVertical="top"
                maxLength={500}
                style={[styles.formInput, styles.formDescriptionInput]}
              />
              <Text style={styles.formHint}>
                {sellerBio.trim().length}/500 karakter · minimal 20
              </Text>

              <Text style={styles.formLabel}>Kategori keahlian utama</Text>
              <View style={styles.formChoiceRow}>
                {serviceCategories.map((item) => (
                  <TouchableOpacity
                    key={item}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sellerCategory === item }}
                    onPress={() => setSellerCategory(item)}
                    style={[
                      styles.formChoice,
                      sellerCategory === item && styles.formChoiceActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.formChoiceText,
                        sellerCategory === item && styles.formChoiceTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>E-wallet untuk pencairan</Text>
              <View style={styles.formChoiceRow}>
                {(["DANA", "OVO", "GoPay", "ShopeePay"] as const).map(
                  (provider) => (
                    <TouchableOpacity
                      key={provider}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: walletProvider === provider,
                      }}
                      onPress={() => setWalletProvider(provider)}
                      style={[
                        styles.formChoice,
                        walletProvider === provider && styles.formChoiceActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.formChoiceText,
                          walletProvider === provider &&
                            styles.formChoiceTextActive,
                        ]}
                      >
                        {provider}
                      </Text>
                    </TouchableOpacity>
                  ),
                )}
              </View>
              <TextInput
                accessibilityLabel="Nomor e-wallet"
                value={walletNumber}
                onChangeText={(value) =>
                  setWalletNumber(value.replace(/\D/g, "").slice(0, 20))
                }
                placeholder="Nomor HP terdaftar di e-wallet"
                placeholderTextColor="#929AAF"
                keyboardType="number-pad"
                maxLength={20}
                style={styles.formInput}
              />
              <Text style={styles.formHint}>
                Nomor e-wallet hanya dapat dilihat oleh pemilik akun.
              </Text>

              {!!sellerOnboardingError && (
                <Text accessibilityRole="alert" style={styles.serviceFormError}>
                  {sellerOnboardingError}
                </Text>
              )}
              <TouchableOpacity
                accessibilityRole="button"
                disabled={isSavingSellerOnboarding}
                onPress={() => void completeSellerOnboarding()}
                style={[
                  styles.sellerOnboardingSubmit,
                  isSavingSellerOnboarding &&
                    styles.serviceFormSubmitDisabled,
                ]}
              >
                {isSavingSellerOnboarding ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.serviceFormSubmitText}>
                    Simpan & buat jasa pertama
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showInvoiceForm}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isCreatingInvoice) setShowInvoiceForm(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBackdrop}
        >
          <View
            style={[
              styles.serviceFormSheet,
              { paddingBottom: Math.max(insets.bottom, 18) },
            ]}
          >
            <View style={styles.serviceFormHeader}>
              <View>
                <Text style={styles.eyebrow}>MULAI PROYEK</Text>
                <Text style={styles.serviceFormTitle}>Buat invoice</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Tutup formulir invoice"
                disabled={isCreatingInvoice}
                onPress={() => setShowInvoiceForm(false)}
                style={styles.serviceFormCloseButton}
              >
                <Text style={styles.serviceFormClose}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.serviceFormContent}
            >
              <Text style={styles.formLabel}>Judul proyek</Text>
              <TextInput
                accessibilityLabel="Judul proyek"
                editable={!isCreatingInvoice}
                maxLength={200}
                onChangeText={setInvoiceTitle}
                placeholder="Contoh: Desain poster acara"
                placeholderTextColor="#929AAF"
                style={styles.formInput}
                value={invoiceTitle}
              />
              <Text style={styles.formLabel}>Deskripsi (opsional)</Text>
              <TextInput
                accessibilityLabel="Deskripsi proyek"
                editable={!isCreatingInvoice}
                maxLength={1000}
                multiline
                onChangeText={setInvoiceDescription}
                placeholder="Rincian pekerjaan dan hasil yang disepakati"
                placeholderTextColor="#929AAF"
                style={[styles.formInput, styles.formDescriptionInput]}
                textAlignVertical="top"
                value={invoiceDescription}
              />
              <Text style={styles.formLabel}>Jumlah (Rupiah)</Text>
              <TextInput
                accessibilityLabel="Jumlah invoice dalam rupiah"
                editable={!isCreatingInvoice}
                keyboardType="number-pad"
                onChangeText={(value) =>
                  setInvoiceAmount(value.replace(/[^\d]/g, ""))
                }
                placeholder="Contoh: 50000"
                placeholderTextColor="#929AAF"
                style={styles.formInput}
                value={invoiceAmount}
              />
              <Text style={styles.formLabel}>Batas revisi gratis</Text>
              <TextInput
                accessibilityLabel="Batas revisi gratis"
                editable={!isCreatingInvoice}
                keyboardType="number-pad"
                maxLength={2}
                onChangeText={(value) =>
                  setInvoiceRevisionLimit(value.replace(/[^\d]/g, ""))
                }
                placeholder="3"
                placeholderTextColor="#929AAF"
                style={styles.formInput}
                value={invoiceRevisionLimit}
              />
              <Text style={styles.formHint}>
                Maksimal 20 kali. Revisi setelah batas ini perlu disepakati
                dan dibayar langsung kepada seller sebelum dibuka.
              </Text>
              {!!invoiceError && (
                <Text accessibilityRole="alert" style={styles.serviceFormError}>
                  {invoiceError}
                </Text>
              )}
              <TouchableOpacity
                accessibilityRole="button"
                disabled={isCreatingInvoice}
                onPress={() => void submitProjectInvoice()}
                style={[
                  styles.sellerOnboardingSubmit,
                  isCreatingInvoice && styles.serviceFormSubmitDisabled,
                ]}
              >
                {isCreatingInvoice ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.serviceFormSubmitText}>
                    Buat proyek & kirim invoice
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={detail !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDetail(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.detailSheet,
              { paddingBottom: Math.max(insets.bottom, 22) },
            ]}
          >
            <View style={styles.sheetHandle} />
            {detail ? (
              <>
                <View
                  style={[
                    styles.detailArtwork,
                    { backgroundColor: detail.color },
                  ]}
                >
                  <Text style={styles.detailSymbol}>{detail.symbol}</Text>
                  <Text style={styles.detailCategory}>{detail.category}</Text>
                </View>
                <View style={styles.detailTitleRow}>
                  <Text style={styles.detailTitle}>{detail.title}</Text>
                  <TouchableOpacity onPress={() => setDetail(null)}>
                    <Text style={styles.close}>×</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.talentRow}>
                  <View
                    style={[
                      styles.avatarSmall,
                      { backgroundColor: detail.color },
                    ]}
                  >
                    <Text style={styles.avatarInitials}>{detail.initials}</Text>
                  </View>
                  <View style={styles.talentDetails}>
                    <Text style={styles.talentName}>{detail.talent}</Text>
                    <Text style={styles.school}>{detail.school}</Text>
                  </View>
                  <Text style={styles.rating}>★ {detail.rating}</Text>
                </View>
                <Text style={styles.detailSectionTitle}>Tentang jasa</Text>
                <Text style={styles.detailDescription}>
                  {detail.description}
                </Text>
                <View style={styles.detailMeta}>
                  <Text style={styles.rangeText}>
                    {detail.reviews > 0
                      ? `★ ${detail.rating} · ${detail.reviews} ulasan`
                      : "Jasa baru · Belum ada ulasan"}
                  </Text>
                  <Text style={styles.rangeText}>
                    {detail.range === "Online"
                      ? "◎ Online"
                      : `⌖ ${detail.location}`}
                  </Text>
                </View>
                <View style={styles.detailFooter}>
                  <View>
                    <Text style={styles.startingLabel}>HARGA MULAI</Text>
                    <Text style={styles.detailPrice}>
                      {rupiah(detail.price)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.chatButton}
                    onPress={() => startConversation(detail)}
                  >
                    <Text style={styles.chatText}>Chat talent</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showServiceForm}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isSavingService) setShowServiceForm(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBackdrop}
        >
          <View
            style={[
              styles.serviceFormSheet,
              { paddingBottom: Math.max(insets.bottom, 18) },
            ]}
          >
            <View style={styles.serviceFormHeader}>
              <View>
                <Text style={styles.eyebrow}>TOKO JASAMU</Text>
                <Text style={styles.serviceFormTitle}>
                  {serviceBeingEdited ? "Edit jasa" : "Tambah jasa"}
                </Text>
              </View>
              <TouchableOpacity
                accessibilityLabel="Tutup formulir"
                disabled={isSavingService}
                onPress={() => setShowServiceForm(false)}
                style={styles.serviceFormCloseButton}
              >
                <Text style={styles.serviceFormClose}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.serviceFormContent}
            >
              <Text style={styles.serviceFormIntro}>
                Jelaskan jasamu dengan jelas agar calon pembeli tahu apa yang
                akan mereka dapatkan.
              </Text>

              <Text style={styles.formLabel}>Judul jasa</Text>
              <TextInput
                accessibilityLabel="Judul jasa"
                value={serviceTitle}
                onChangeText={setServiceTitle}
                placeholder="Contoh: Desain poster acara"
                placeholderTextColor="#929AAF"
                maxLength={100}
                style={styles.formInput}
              />
              <Text style={styles.formHint}>
                {serviceTitle.trim().length}/100 karakter
              </Text>

              <Text style={styles.formLabel}>Kategori</Text>
              <View style={styles.formChoiceRow}>
                {serviceCategories.map((item) => (
                  <TouchableOpacity
                    key={item}
                    onPress={() => setServiceCategory(item)}
                    style={[
                      styles.formChoice,
                      serviceCategory === item && styles.formChoiceActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.formChoiceText,
                        serviceCategory === item &&
                          styles.formChoiceTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Deskripsi jasa</Text>
              <TextInput
                accessibilityLabel="Deskripsi jasa"
                value={serviceDescription}
                onChangeText={setServiceDescription}
                placeholder="Ceritakan detail layanan, hasil yang didapat, dan ketentuannya..."
                placeholderTextColor="#929AAF"
                multiline
                textAlignVertical="top"
                maxLength={2000}
                style={[styles.formInput, styles.formDescriptionInput]}
              />
              <Text style={styles.formHint}>
                {serviceDescription.trim().length}/2.000 karakter
              </Text>

              <Text style={styles.formLabel}>Harga mulai</Text>
              <View style={styles.formPriceInput}>
                <Text style={styles.formPricePrefix}>Rp</Text>
                <TextInput
                  accessibilityLabel="Harga mulai"
                  value={servicePrice}
                  onChangeText={(value) =>
                    setServicePrice(value.replace(/\D/g, ""))
                  }
                  placeholder="25.000"
                  placeholderTextColor="#929AAF"
                  keyboardType="number-pad"
                  maxLength={9}
                  style={styles.formPriceTextInput}
                />
              </View>

              <Text style={styles.formLabel}>Estimasi waktu pengerjaan (hari)</Text>
              <TextInput
                accessibilityLabel="Estimasi waktu pengerjaan"
                value={serviceEstimatedDays}
                onChangeText={(value) =>
                  setServiceEstimatedDays(value.replace(/\D/g, "").slice(0, 3))
                }
                placeholder="3"
                placeholderTextColor="#929AAF"
                keyboardType="number-pad"
                maxLength={3}
                style={styles.formInput}
              />

              {!!serviceFormError && (
                <Text accessibilityRole="alert" style={styles.serviceFormError}>
                  {serviceFormError}
                </Text>
              )}
              <View style={styles.serviceFormActions}>
                <TouchableOpacity
                  disabled={isSavingService}
                  onPress={() => setShowServiceForm(false)}
                  style={styles.serviceFormCancel}
                >
                  <Text style={styles.serviceFormCancelText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={isSavingService}
                  onPress={() => void saveService()}
                  style={[
                    styles.serviceFormSubmit,
                    isSavingService && styles.serviceFormSubmitDisabled,
                  ]}
                >
                  {isSavingService ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.serviceFormSubmitText}>
                      {serviceBeingEdited ? "Simpan perubahan" : "Terbitkan jasa"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={showSettings}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!showLogoutConfirmation) setShowSettings(false);
        }}
      >
        <View style={styles.settingsModalBackdrop}>
          <View
            style={[
              styles.settingsSheet,
              { paddingBottom: Math.max(insets.bottom, 18) },
            ]}
          >
            <View style={styles.settingsHeader}>
              <View>
                <Text style={styles.eyebrow}>PREFERENSI AKUN</Text>
                <Text style={styles.settingsTitle}>Pengaturan</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Tutup pengaturan"
                onPress={() => setShowSettings(false)}
                style={styles.settingsCloseButton}
              >
                <Text style={styles.settingsCloseText}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.settingsContent}
            >
              <Text style={styles.settingsSectionLabel}>AKUN</Text>
              <View style={styles.settingsAccountCard}>
                <View style={styles.settingsAvatar}>
                  <Text style={styles.settingsAvatarText}>
                    {profile?.full_name.trim().charAt(0).toUpperCase() || "?"}
                  </Text>
                </View>
                <View style={styles.settingsAccountInfo}>
                  <Text style={styles.settingsAccountName}>
                    {profile?.full_name || "Nama belum tersedia"}
                  </Text>
                  <Text style={styles.settingsAccountMeta}>
                    {profile?.school || "Sekolah belum tersedia"}
                  </Text>
                </View>
              </View>

              <Text style={styles.settingsSectionLabel}>INFORMASI</Text>
              <SettingsRow
                icon="◇"
                title="Privasi & keamanan"
                description="Informasi penggunaan dan keamanan akun"
                onPress={() => setSettingsDetail("privacy")}
              />
              <SettingsRow
                icon="?"
                title="Bantuan"
                description="Panduan singkat menggunakan Siswork"
                onPress={() => setSettingsDetail("help")}
              />
              <SettingsRow
                icon="i"
                title="Tentang Siswork"
                description="Versi aplikasi dan informasi produk"
                onPress={() => setSettingsDetail("about")}
              />

              <Text style={styles.settingsSectionLabel}>SESI</Text>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={isLoggingOut}
                onPress={() => {
                  setLogoutError("");
                  setShowLogoutConfirmation(true);
                }}
                style={styles.settingsLogoutRow}
              >
                <View style={styles.settingsLogoutIcon}>
                  <Text style={styles.settingsLogoutGlyph}>↪</Text>
                </View>
                <View style={styles.settingsRowText}>
                  <Text style={styles.settingsLogoutTitle}>Keluar dari akun</Text>
                  <Text style={styles.settingsRowDescription}>
                    Akhiri sesi pada perangkat ini
                  </Text>
                </View>
                <Text style={styles.settingsChevron}>›</Text>
              </TouchableOpacity>
              {!!logoutError && (
                <Text accessibilityRole="alert" style={styles.settingsError}>
                  {logoutError}
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={settingsDetail !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsDetail(null)}
      >
        <View style={styles.logoutModalBackdrop}>
          <View style={styles.settingsDetailCard}>
            <Text style={styles.settingsDetailTitle}>
              {settingsDetail === "privacy"
                ? "Privasi & keamanan"
                : settingsDetail === "help"
                  ? "Bantuan"
                  : "Tentang Siswork"}
            </Text>
            <Text style={styles.settingsDetailText}>
              {settingsDetail === "privacy"
                ? "Data profil dan percakapan digunakan untuk menjalankan layanan Siswork. Percakapan hanya dapat diakses oleh pesertanya. Gunakan Keluar dari akun untuk mengakhiri sesi pada perangkat ini."
                : settingsDetail === "help"
                ? "Cari jasa yang kamu butuhkan, gunakan Chat untuk menghubungi pelajar lain, dan buka Pesanan Saya untuk melihat pesanan. Jika ingin menjual jasa, pilih Mulai Berjualan dari Profil."
                  : "Siswork membantu pelajar menemukan jasa dan menawarkan keahlian dalam satu komunitas. Versi aplikasi 1.0.0."}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setSettingsDetail(null)}
              style={styles.settingsDetailButton}
            >
              <Text style={styles.settingsDetailButtonText}>Mengerti</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showLogoutConfirmation}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isLoggingOut) setShowLogoutConfirmation(false);
        }}
      >
        <View style={styles.logoutModalBackdrop}>
          <View style={styles.logoutDialog}>
            <Text style={styles.logoutDialogTitle}>Keluar dari akun?</Text>
            <Text style={styles.logoutDialogMessage}>
              Kamu perlu login kembali untuk mengakses profil dan percakapan.
            </Text>
            <View style={styles.logoutDialogActions}>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={isLoggingOut}
                onPress={() => setShowLogoutConfirmation(false)}
                style={styles.logoutCancelButton}
              >
                <Text style={styles.logoutCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={isLoggingOut}
                onPress={() => void logout()}
                style={styles.logoutConfirmButton}
              >
                {isLoggingOut ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.logoutConfirmText}>Keluar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SettingsRow({
  icon,
  title,
  description,
  onPress,
}: {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={styles.settingsRow}
    >
      <View style={styles.settingsRowIcon}>
        <Text style={styles.settingsRowGlyph}>{icon}</Text>
      </View>
      <View style={styles.settingsRowText}>
        <Text style={styles.settingsRowTitle}>{title}</Text>
        <Text style={styles.settingsRowDescription}>{description}</Text>
      </View>
      <Text style={styles.settingsChevron}>›</Text>
    </TouchableOpacity>
  );
}

function SearchBox({
  value,
  onChange,
  onFocus,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  placeholder: string;
}) {
  return (
    <View style={styles.searchBox}>
      <Text style={styles.searchGlyph}>⌕</Text>
      <TextInput
        accessibilityLabel="Cari jasa atau talent"
        value={value}
        onChangeText={onChange}
        onFocus={onFocus}
        placeholder={placeholder}
        placeholderTextColor="#929AAF"
        returnKeyType="search"
        style={styles.searchInput}
      />
      {value ? (
        <TouchableOpacity onPress={() => onChange("")}>
          <Text style={styles.clearSearch}>×</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyGlyph}>⌕</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F8FC" },
  scrollContent: { alignItems: "center" },
  content: { width: "100%", maxWidth: 560, paddingHorizontal: 20 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    color: "#202B42",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  brandBadge: {
    color: "#FFFFFF",
    backgroundColor: "#4356C5",
    overflow: "hidden",
    borderRadius: 7,
    paddingHorizontal: 6,
  },
  brandAccent: { color: "#4356C5" },
  brandTagline: { color: "#8992A5", fontSize: 9, marginTop: 4 },
  notification: {
    position: "relative",
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECEFF5",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationIcon: { color: "#38445C", fontSize: 21 },
  notificationDot: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ED8978",
  },
  welcome: { marginTop: 23 },
  greeting: {
    color: "#202B42",
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  welcomeSubtitle: { color: "#7F899E", fontSize: 11, marginTop: 5 },
  searchBox: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingHorizontal: 13,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECEFF5",
  },
  searchGlyph: { color: "#7C87A0", fontSize: 23, marginRight: 8 },
  searchInput: { flex: 1, color: "#253149", fontSize: 11, paddingVertical: 0 },
  clearSearch: { color: "#7D879A", fontSize: 22 },
  hero: {
    minHeight: 184,
    padding: 18,
    marginTop: 16,
    borderRadius: 22,
    backgroundColor: "#354BB6",
    overflow: "hidden",
  },
  heroOrb: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    right: -55,
    top: -66,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  heroEyebrow: {
    color: "#D2DAFF",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  heroTitle: {
    width: "78%",
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 27,
    marginTop: 10,
  },
  heroDescription: { color: "#DFE4FF", fontSize: 10, marginTop: 6 },
  heroButton: {
    alignSelf: "flex-start",
    marginTop: 13,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  heroButtonText: { color: "#354BB6", fontSize: 10, fontWeight: "800" },
  heroDecoration: {
    position: "absolute",
    right: 17,
    bottom: 16,
    color: "#E5E9FF",
    fontSize: 32,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 23,
    marginBottom: 11,
  },
  sectionTitle: { color: "#27324A", fontSize: 15, fontWeight: "800" },
  sectionSubtitle: { color: "#939BAD", fontSize: 9, marginTop: 4 },
  link: { color: "#4356C5", fontSize: 10, fontWeight: "800" },
  chips: { gap: 7, paddingBottom: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9ECF3",
  },
  chipActive: { backgroundColor: "#4356C5", borderColor: "#4356C5" },
  chipText: { color: "#6E788D", fontSize: 9, fontWeight: "700" },
  chipTextActive: { color: "#FFFFFF" },
  reachFilters: { flexDirection: "row", gap: 7, marginBottom: 10 },
  reachChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECEFF5",
  },
  reachChipActive: { backgroundColor: "#E9EDFF", borderColor: "#DCE2FF" },
  reachChipText: { color: "#7F899B", fontSize: 9, fontWeight: "700" },
  reachChipTextActive: { color: "#4356C5" },
  serviceList: { gap: 11 },
  serviceCard: {
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#EDF0F5",
  },
  serviceArtwork: {
    height: 112,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  serviceSymbol: { color: "#4A57A7", fontSize: 44, fontWeight: "300" },
  serviceCategory: {
    position: "absolute",
    left: 11,
    top: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.88)",
  },
  serviceCategoryText: { color: "#4254B2", fontSize: 8, fontWeight: "800" },
  saveButton: {
    position: "absolute",
    right: 9,
    top: 8,
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  saveIcon: { color: "#66718A", fontSize: 17 },
  saveIconActive: { color: "#E66E7C" },
  serviceInfo: { padding: 12 },
  serviceTitle: {
    color: "#29344B",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  talentRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  avatarSmall: {
    width: 31,
    height: 31,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { color: "#4356B2", fontSize: 8, fontWeight: "800" },
  talentDetails: { flex: 1, marginLeft: 8 },
  talentName: { color: "#4B566C", fontSize: 9, fontWeight: "700" },
  school: { color: "#9AA2B1", fontSize: 7, marginTop: 3 },
  rating: { color: "#D39433", fontSize: 9, fontWeight: "800" },
  serviceFooter: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: "#F0F1F5",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  price: { color: "#27324A", fontSize: 12, fontWeight: "800" },
  priceNote: { color: "#9AA2B1", fontSize: 8, fontWeight: "500" },
  rangeText: { color: "#818B9E", fontSize: 9 },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 11,
    borderRadius: 15,
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EDF0F5",
  },
  requestIcon: {
    width: 37,
    height: 37,
    borderRadius: 12,
    backgroundColor: "#FFF2E7",
    alignItems: "center",
    justifyContent: "center",
  },
  requestIconText: { color: "#D58B42", fontSize: 17, fontWeight: "700" },
  requestDetails: { flex: 1, marginLeft: 9 },
  requestTitle: { color: "#303B52", fontSize: 9, fontWeight: "800" },
  requestMeta: { color: "#929BAD", fontSize: 8, marginTop: 4 },
  requestBudget: {
    color: "#485CC0",
    fontSize: 9,
    fontWeight: "700",
    marginTop: 4,
  },
  chevron: { color: "#9AA3B4", fontSize: 22 },
  demoNote: {
    color: "#ADB4C1",
    fontSize: 8,
    textAlign: "center",
    marginVertical: 10,
  },
  eyebrow: {
    color: "#818BA0",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 7,
  },
  pageTitle: {
    color: "#202B42",
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  pageSubtitle: { color: "#838DA1", fontSize: 10, marginTop: 5 },
  filterLabel: {
    color: "#303B52",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 21,
    marginBottom: 9,
  },
  resultCount: {
    color: "#818A9E",
    fontSize: 9,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 10,
  },
  serviceLoadError: {
    color: "#B34E5A",
    backgroundColor: "#FFF0F1",
    borderRadius: 10,
    padding: 11,
    fontSize: 10,
    lineHeight: 15,
    marginBottom: 10,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    marginTop: 9,
  },
  emptyGlyph: { color: "#9CA6B8", fontSize: 28 },
  emptyText: {
    color: "#838DA1",
    textAlign: "center",
    fontSize: 10,
    lineHeight: 16,
    marginTop: 8,
  },
  chatPageHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  chatNewButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#4356C5",
    alignItems: "center",
    justifyContent: "center",
  },
  chatNewButtonText: { color: "#FFFFFF", fontSize: 25, lineHeight: 28 },
  chatPreviewNotice: {
    backgroundColor: "#F0F2FF",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  chatPreviewNoticeText: {
    color: "#6875B8",
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
  },
  chatError: {
    color: "#B34E5A",
    backgroundColor: "#FFF0F1",
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 10,
    lineHeight: 15,
    marginBottom: 10,
  },
  chatLoading: { padding: 24 },
  chatSearchBox: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECEFF5",
  },
  chatSearchIcon: { color: "#7C87A0", fontSize: 21, marginRight: 8 },
  chatSearchInput: {
    flex: 1,
    color: "#253149",
    fontSize: 13,
    paddingVertical: 0,
  },
  chatSearchClear: { color: "#7D879A", fontSize: 21 },
  chatFilterRow: { flexDirection: "row", gap: 8, marginTop: 13 },
  chatFilterChip: {
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 9,
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9ECF3",
  },
  chatFilterChipActive: {
    backgroundColor: "#4356C5",
    borderColor: "#4356C5",
  },
  chatFilterText: { color: "#6E788D", fontSize: 11, fontWeight: "700" },
  chatFilterTextActive: { color: "#FFFFFF" },
  chatConversationList: {
    marginTop: 7,
    borderRadius: 17,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EDF0F5",
  },
  chatConversation: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F6",
  },
  chatListAvatar: {
    width: 48,
    height: 48,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  chatAvatarText: { color: "#4356B2", fontSize: 12, fontWeight: "800" },
  chatConversationContent: { flex: 1, marginLeft: 11 },
  chatConversationTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 7,
  },
  chatConversationName: {
    flex: 1,
    color: "#303B52",
    fontSize: 13,
    fontWeight: "800",
  },
  chatConversationTime: { color: "#9AA2B1", fontSize: 10 },
  chatConversationService: {
    color: "#788399",
    fontSize: 10,
    marginTop: 3,
  },
  chatConversationBottom: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  chatConversationPreview: { flex: 1, color: "#9AA2B1", fontSize: 10 },
  chatConversationPreviewUnread: {
    color: "#4E5A70",
    fontWeight: "700",
  },
  chatUnreadBadge: {
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: "#4356C5",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  chatUnreadText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800" },
  chatEmptyState: {
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 30,
  },
  chatEmptyIcon: { color: "#9DA7B8", fontSize: 29 },
  chatEmptyTitle: {
    color: "#303B52",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 9,
  },
  chatEmptyText: {
    color: "#8993A6",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 5,
  },
  chatBrowseButton: {
    backgroundColor: "#E9EDFF",
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 8,
    marginTop: 13,
  },
  chatBrowseButtonText: { color: "#4356C5", fontSize: 9, fontWeight: "800" },
  chatThreadScreen: {
    flex: 1,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: 20,
  },
  chatThreadHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECF2",
  },
  chatBackButton: {
    width: 40,
    height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  chatBackIcon: { color: "#4356C5", fontSize: 34, lineHeight: 36 },
  chatAvatar: {
    position: "relative",
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  chatContact: { flex: 1, marginLeft: 10 },
  chatContactName: { color: "#303B52", fontSize: 14, fontWeight: "800" },
  chatOnline: { color: "#8993A6", fontSize: 10, marginTop: 4 },
  chatMoreButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  chatMoreIcon: {
    color: "#758198",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 22,
  },
  chatServiceBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 11,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECEFF5",
  },
  chatInvoiceButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#EEF0FF",
  },
  chatInvoiceButtonText: {
    color: "#4356C5",
    fontSize: 11,
    fontWeight: "800",
  },
  chatServiceCopy: { flex: 1, marginRight: 8 },
  chatServiceEyebrow: {
    color: "#929AAF",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  chatServiceName: {
    color: "#4658B6",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  chatPreviewTag: {
    color: "#6875B8",
    backgroundColor: "#F0F2FF",
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 5,
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  chatMessageScroll: { flex: 1, marginTop: 4 },
  chatMessages: {
    flexGrow: 1,
    justifyContent: "flex-end",
    paddingTop: 14,
    paddingBottom: 12,
  },
  chatDateDivider: {
    alignSelf: "center",
    color: "#8993A6",
    backgroundColor: "#ECEFF5",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginBottom: 17,
  },
  chatMessageRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 10,
  },
  chatMessageRowMine: { justifyContent: "flex-end" },
  chatBubble: {
    maxWidth: "83%",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 7,
    borderRadius: 16,
  },
  chatBubbleMine: {
    backgroundColor: "#4356C5",
    borderBottomRightRadius: 5,
  },
  chatBubbleTheirs: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECEFF5",
    borderBottomLeftRadius: 5,
  },
  chatMessageText: { color: "#465168", fontSize: 14, lineHeight: 21 },
  chatMessageTextMine: { color: "#FFFFFF" },
  chatMessageTime: {
    color: "#9AA2B1",
    fontSize: 9,
    textAlign: "right",
    marginTop: 5,
  },
  chatMessageTimeMine: { color: "#DDE2FF" },
  chatFirstMessage: {
    alignSelf: "center",
    alignItems: "center",
    maxWidth: 260,
    padding: 20,
    marginTop: 12,
    marginBottom: 18,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
  },
  chatFirstMessageIcon: { color: "#4356C5", fontSize: 24 },
  chatFirstMessageTitle: {
    color: "#303B52",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 7,
  },
  chatFirstMessageText: {
    color: "#8993A6",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 5,
  },
  chatComposer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 9,
    padding: 8,
    marginTop: 8,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E9F1",
    shadowColor: "#28385C",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  chatInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    color: "#303B52",
    fontSize: 14,
    paddingHorizontal: 7,
    paddingVertical: 10,
  },
  chatAttachButton: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  chatAttachIcon: { color: "#4356C5", fontSize: 26, fontWeight: "500" },
  chatSendButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#4356C5",
    alignItems: "center",
    justifyContent: "center",
  },
  chatSendButtonDisabled: { backgroundColor: "#BCC4E8" },
  chatSendIcon: { color: "#FFFFFF", fontSize: 15 },
  profileHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 11,
    paddingHorizontal: 11,
    paddingVertical: 9,
    backgroundColor: "#E9EDFF",
  },
  settingsButtonIcon: { color: "#4356C5", fontSize: 15 },
  settingsButtonText: { color: "#4356C5", fontSize: 10, fontWeight: "800" },
  profileCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 19,
    padding: 20,
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#EDF0F5",
  },
  profileAvatar: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: "#E9EDFF",
    alignItems: "center",
    justifyContent: "center",
  },
  profileInitial: { color: "#4356C5", fontSize: 26, fontWeight: "800" },
  verified: {
    position: "absolute",
    right: -2,
    bottom: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#47A985",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  verifiedText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800" },
  profileName: {
    color: "#263149",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 10,
  },
  profileSchool: { color: "#919AAC", fontSize: 9, marginTop: 4 },
  profileRating: {
    color: "#D39433",
    fontSize: 9,
    fontWeight: "800",
    marginTop: 8,
  },
  profileReviews: { color: "#9AA2B1", fontWeight: "500" },
  profileBio: {
    color: "#737E93",
    fontSize: 9,
    lineHeight: 14,
    textAlign: "center",
    marginTop: 10,
  },
  sellerBalanceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4356C5",
    borderRadius: 17,
    padding: 15,
    marginTop: 12,
  },
  sellerBalanceIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  sellerBalanceIconText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  sellerBalanceInfo: { flex: 1, marginLeft: 11 },
  sellerBalanceLabel: {
    color: "#DDE2FF",
    fontSize: 9,
    fontWeight: "700",
  },
  sellerBalanceAmount: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
    marginTop: 2,
  },
  sellerBalanceCaption: {
    color: "#DDE2FF",
    fontSize: 8,
    marginTop: 3,
  },
  sellerBalanceArrow: { color: "#FFFFFF", fontSize: 25, marginLeft: 8 },
  profileActions: { flexDirection: "row", gap: 9, marginTop: 11 },
  profileAction: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EDF0F5",
    borderRadius: 14,
    padding: 11,
    alignItems: "center",
  },
  profileActionIcon: { color: "#4356C5", fontSize: 19 },
  profileActionText: {
    color: "#45516A",
    fontSize: 9,
    fontWeight: "700",
    marginTop: 4,
  },
  orderGlyph: {
    width: 37,
    height: 37,
    lineHeight: 37,
    textAlign: "center",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FFF4E3",
    color: "#C58C3D",
    fontSize: 18,
  },
  orderSegmentControl: {
    flexDirection: "row",
    gap: 5,
    marginTop: 18,
    padding: 4,
    borderRadius: 14,
    backgroundColor: "#ECEFF5",
  },
  orderSegment: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 11,
  },
  orderSegmentActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#263149",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 5,
    elevation: 2,
  },
  orderSegmentText: { color: "#818BA0", fontSize: 11, fontWeight: "700" },
  orderSegmentTextActive: { color: "#4356C5" },
  orderEmptyCard: {
    alignItems: "center",
    marginTop: 13,
    paddingHorizontal: 22,
    paddingVertical: 32,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EDF0F5",
  },
  orderEmptyTitle: {
    marginTop: 12,
    color: "#303B52",
    fontSize: 14,
    fontWeight: "800",
  },
  orderEmptyDescription: {
    marginTop: 6,
    color: "#8993A6",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
  },
  orderBrowseButton: {
    marginTop: 17,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: "#E9EDFF",
  },
  orderBrowseButtonText: { color: "#4356C5", fontSize: 11, fontWeight: "800" },
  savedEmpty: {
    color: "#939BAD",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 13,
    fontSize: 9,
    lineHeight: 14,
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingHorizontal: 8,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#ECEFF4",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  tabIconWrap: {
    position: "relative",
    width: 42,
    height: 29,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconWrapActive: { backgroundColor: "#ECEFFF" },
  tabIcon: { color: "#9CA5B5", fontSize: 21, lineHeight: 24 },
  tabIconActive: { color: "#4356C5" },
  tabUnreadDot: {
    position: "absolute",
    right: 8,
    top: 3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ED8978",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  tabLabel: { color: "#9AA3B2", fontSize: 9, fontWeight: "600" },
  tabLabelActive: { color: "#4356C5", fontWeight: "800" },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(18,25,43,0.42)",
  },
  logoutModalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "rgba(18,25,43,0.42)",
  },
  settingsModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(18,25,43,0.42)",
  },
  settingsSheet: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "92%",
    alignSelf: "center",
    paddingTop: 18,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#F8F9FC",
  },
  settingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECF3",
  },
  settingsTitle: {
    marginTop: 3,
    color: "#202B42",
    fontSize: 23,
    fontWeight: "800",
  },
  settingsCloseButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#ECEFF5",
  },
  settingsCloseText: { color: "#59647A", fontSize: 24, lineHeight: 26 },
  settingsContent: { paddingBottom: 18 },
  settingsSectionLabel: {
    marginTop: 22,
    marginBottom: 9,
    color: "#8B94A7",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  settingsAccountCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
  },
  settingsAvatar: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#E9EDFF",
  },
  settingsAvatarText: { color: "#4356C5", fontSize: 17, fontWeight: "800" },
  settingsAccountInfo: { flex: 1, marginLeft: 11 },
  settingsAccountName: { color: "#253149", fontSize: 13, fontWeight: "800" },
  settingsAccountMeta: { marginTop: 3, color: "#8B94A7", fontSize: 10 },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 66,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
  },
  settingsRowIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#F0F2F8",
  },
  settingsRowGlyph: { color: "#4356C5", fontSize: 17, fontWeight: "700" },
  settingsRowText: { flex: 1, marginLeft: 11 },
  settingsRowTitle: { color: "#253149", fontSize: 12, fontWeight: "700" },
  settingsRowDescription: {
    marginTop: 3,
    color: "#8B94A7",
    fontSize: 10,
    lineHeight: 15,
  },
  settingsChevron: { marginLeft: 10, color: "#A6ADBB", fontSize: 24 },
  settingsError: {
    marginTop: 8,
    color: "#B54747",
    fontSize: 11,
    lineHeight: 16,
  },
  settingsLogoutRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 66,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
  },
  settingsLogoutIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#FFF0EF",
  },
  settingsLogoutGlyph: { color: "#C56868", fontSize: 19, fontWeight: "700" },
  settingsLogoutTitle: { color: "#C56868", fontSize: 12, fontWeight: "800" },
  settingsDetailCard: {
    width: "100%",
    maxWidth: 380,
    padding: 22,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
  },
  settingsDetailTitle: {
    color: "#202B42",
    fontSize: 18,
    fontWeight: "800",
  },
  settingsDetailText: {
    marginTop: 11,
    color: "#667188",
    fontSize: 13,
    lineHeight: 20,
  },
  settingsDetailButton: {
    alignItems: "center",
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#4356C5",
  },
  settingsDetailButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  logoutDialog: {
    width: "100%",
    maxWidth: 380,
    padding: 22,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
  },
  logoutDialogTitle: {
    color: "#202B42",
    fontSize: 18,
    fontWeight: "800",
  },
  logoutDialogMessage: {
    marginTop: 9,
    color: "#7F899E",
    fontSize: 13,
    lineHeight: 19,
  },
  logoutDialogActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 22,
  },
  logoutCancelButton: {
    minWidth: 84,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#F1F3F8",
  },
  logoutCancelText: { color: "#59647A", fontSize: 13, fontWeight: "700" },
  logoutConfirmButton: {
    minWidth: 84,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#C56868",
  },
  logoutConfirmText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  detailSheet: {
    backgroundColor: "#F8F9FC",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 19,
    paddingTop: 10,
  },
  serviceFormSheet: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "92%",
    alignSelf: "center",
    backgroundColor: "#F8F9FC",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  serviceFormHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECF2",
  },
  serviceFormTitle: {
    color: "#202B42",
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  serviceFormCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  serviceFormClose: { color: "#748096", fontSize: 25, lineHeight: 27 },
  serviceFormContent: { paddingTop: 13, paddingBottom: 12 },
  serviceFormIntro: {
    color: "#788399",
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 7,
  },
  formLabel: {
    color: "#303B52",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 15,
    marginBottom: 7,
  },
  formInput: {
    minHeight: 47,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E9F1",
    backgroundColor: "#FFFFFF",
    color: "#303B52",
    fontSize: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  formDescriptionInput: { minHeight: 105, lineHeight: 18 },
  formHint: {
    color: "#9AA2B1",
    fontSize: 9,
    textAlign: "right",
    marginTop: 4,
  },
  formChoiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  formChoice: {
    minHeight: 37,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#E5E9F1",
    backgroundColor: "#FFFFFF",
  },
  formChoiceActive: {
    backgroundColor: "#E9EDFF",
    borderColor: "#CDD5FF",
  },
  formChoiceText: { color: "#6E788D", fontSize: 10, fontWeight: "700" },
  formChoiceTextActive: { color: "#4356C5" },
  formPriceInput: {
    minHeight: 47,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E9F1",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 13,
  },
  formPricePrefix: {
    color: "#66718A",
    fontSize: 12,
    fontWeight: "700",
    marginRight: 9,
  },
  formPriceTextInput: {
    flex: 1,
    color: "#303B52",
    fontSize: 12,
    paddingVertical: 11,
  },
  serviceFormError: {
    color: "#B34E5A",
    backgroundColor: "#FFF0F1",
    borderRadius: 10,
    padding: 10,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 14,
  },
  serviceFormActions: {
    flexDirection: "row",
    gap: 9,
    marginTop: 19,
  },
  serviceFormCancel: {
    minHeight: 47,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E9F1",
  },
  serviceFormCancelText: { color: "#657087", fontSize: 11, fontWeight: "800" },
  serviceFormSubmit: {
    minHeight: 47,
    flex: 1.5,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#4356C5",
  },
  serviceFormSubmitDisabled: { opacity: 0.65 },
  sellerOnboardingSubmit: {
    minHeight: 47,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 18,
    borderRadius: 12,
    backgroundColor: "#4356C5",
  },
  serviceFormSubmitText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  sheetHandle: {
    width: 37,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D5D9E2",
    alignSelf: "center",
    marginBottom: 14,
  },
  detailArtwork: {
    height: 112,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 13,
  },
  detailSymbol: { color: "#4A57A7", fontSize: 41 },
  detailCategory: {
    color: "#4254B2",
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 9,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 9,
    fontWeight: "800",
  },
  detailTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 15,
  },
  detailTitle: {
    flex: 1,
    color: "#263149",
    fontSize: 16,
    fontWeight: "800",
    marginRight: 8,
  },
  close: { color: "#748096", fontSize: 24 },
  detailSectionTitle: {
    color: "#303B52",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 14,
  },
  detailDescription: {
    color: "#737E93",
    fontSize: 10,
    lineHeight: 16,
    marginTop: 5,
  },
  detailMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 13,
  },
  detailFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#E9ECF2",
    marginTop: 14,
    paddingTop: 12,
  },
  startingLabel: {
    color: "#9AA2B1",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  detailPrice: {
    color: "#263149",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 3,
  },
  chatButton: {
    backgroundColor: "#4356C5",
    borderRadius: 12,
    paddingHorizontal: 21,
    paddingVertical: 11,
  },
  chatText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
});
