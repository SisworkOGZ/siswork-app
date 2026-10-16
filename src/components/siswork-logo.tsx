import { useFonts, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type SisworkSymbolProps = {
  size?: number;
  style?: StyleProp<ViewStyle>;
};

type SisworkLogoProps = {
  size?: number;
  showWordmark?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SisworkSymbol({ size = 40, style }: SisworkSymbolProps) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Siswork"
      style={[{ width: size, height: size }, style]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 64 64">
        <Path
          d="M18 6h32c4.42 0 8 3.58 8 8v9H34l-8 8H8V16c0-5.52 4.48-10 10-10Z"
          fill="#2563EB"
        />
        <Path
          d="M46 58H14c-4.42 0-8-3.58-8-8v-9h24l8-8h18v17c0 5.52-4.48 10-10 10Z"
          fill="#38A5F5"
        />
      </Svg>
    </View>
  );
}

export function SisworkLogo({ size = 40, showWordmark = true, style }: SisworkLogoProps) {
  const [fontsLoaded, fontError] = useFonts({ PlusJakartaSans_800ExtraBold });

  if (fontError) {
    throw fontError;
  }

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Siswork"
      style={[styles.logo, { height: size }, style]}
    >
      <SisworkSymbol size={size} />
      {showWordmark && (
        <Text
          style={[
            styles.wordmark,
            {
              fontSize: size * 0.5,
              lineHeight: size * 0.64,
              marginLeft: size * 0.22,
              fontFamily: fontsLoaded ? 'PlusJakartaSans_800ExtraBold' : undefined,
            },
          ]}
        >
          Siswork
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  wordmark: {
    color: '#153F83',
    fontWeight: '800',
    includeFontPadding: false,
  },
});
