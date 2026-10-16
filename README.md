## 🛠️ Teknologi yang Digunakan

- **Frontend**: React Native (JavaScript/TypeScript)
- **Backend**: Supabase
- **Navigasi**: React Navigation

## 🚀 Cara Menjalankan Proyek (Setup & Installation)

1. **Clone repositori ini:**
   ```bash
   git clone [https://github.com/ZyyXD1/siswork-app.git](https://github.com/ZyyXD1/siswork-app.git)
   ```

## Komponen Logo Siswork

Komponen `SisworkLogo` tersedia di `src/components/siswork-logo.tsx`. Dependensinya:

- `react-native-svg` untuk simbol vektor yang tajam di semua ukuran.
- `@expo-google-fonts/plus-jakarta-sans` untuk tulisan Plus Jakarta Sans ExtraBold.
- `expo-font` untuk memuat font (sudah menjadi dependensi proyek).

Instal dependensi logo dengan:

```bash
npx expo install react-native-svg @expo-google-fonts/plus-jakarta-sans
```

Contoh penggunaan logo lengkap dan simbol saja:

```tsx
import { SisworkLogo, SisworkSymbol } from '@/components/siswork-logo';

export function BrandMark() {
  return (
    <>
      <SisworkLogo size={40} />
      <SisworkLogo size={32} showWordmark={false} />
      <SisworkSymbol size={48} />
    </>
  );
}
```
