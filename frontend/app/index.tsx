import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/src/components/ui";
import { useTheme } from "@/src/theme";

export default function Index() {
  const router = useRouter();
  const { colors } = useTheme();
  return <Screen>
    <View style={styles.hero}><Image testID="app-logo" source={require("../assets/images/icon.png")} style={styles.logo} contentFit="cover" /><Text style={[styles.brand, { color: colors.onSurface }]}>Hdtech</Text><Text style={[styles.tagline, { color: colors.muted }]}>Assistência técnica e acessórios.</Text></View>
    <View style={styles.cards}>
      <Pressable testID="home-shop" onPress={() => router.push("/shop")} style={({ pressed }) => [styles.cardHighlight, { backgroundColor: colors.brandPrimary, opacity: pressed ? 0.85 : 1 }]}>
        <View style={[styles.cardIcon, { backgroundColor: colors.brandTertiary }]}><Ionicons name="bag" size={22} color={colors.onBrandTertiary} /></View>
        <View style={styles.cardText}><Text style={[styles.cardTitle, { color: colors.onBrandPrimary }]}>Loja de acessórios</Text><Text style={[styles.cardBodyLight, { color: colors.onBrandPrimary }]}>Películas, capinhas, fones e mais</Text></View>
        <Ionicons name="chevron-forward" size={20} color={colors.onBrandPrimary} />
      </Pressable>
      <Pressable testID="home-tracking" onPress={() => router.push("/client")} style={({ pressed }) => [styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.75 : 1 }]}>
        <View style={[styles.cardIcon, { backgroundColor: colors.brandSecondary }]}><Ionicons name="search" size={22} color={colors.brandPrimary} /></View>
        <View style={styles.cardText}><Text style={[styles.cardTitle, { color: colors.onSurface }]}>Acompanhar meu reparo</Text><Text style={[styles.cardBody, { color: colors.muted }]}>Veja o status da sua OS pelo código</Text></View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>
    </View>
    <Pressable testID="home-staff" onPress={() => router.push("/unlock")} style={styles.staff}><Ionicons name="lock-closed-outline" size={14} color={colors.muted} /><Text style={[styles.staffText, { color: colors.muted }]}>Acesso da equipe</Text></Pressable>
  </Screen>;
}

const styles = StyleSheet.create({ hero: { alignItems: "center", paddingTop: 64, paddingBottom: 64 }, logo: { width: 72, height: 72, borderRadius: 20, marginBottom: 18 }, brand: { fontSize: 32, fontWeight: "900", letterSpacing: -1 }, tagline: { fontSize: 15, marginTop: 6 }, cards: { gap: 12 }, card: { minHeight: 92, borderWidth: 1, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center" }, cardHighlight: { minHeight: 100, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center" }, cardIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 14 }, cardText: { flex: 1 }, cardTitle: { fontSize: 16, fontWeight: "800", marginBottom: 5 }, cardBody: { fontSize: 13 }, cardBodyLight: { fontSize: 13, opacity: 0.85 }, staff: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginTop: "auto", paddingTop: 32, minHeight: 44 }, staffText: { fontSize: 12, fontWeight: "600" } });
