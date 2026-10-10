import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/src/components/ui";
import { useTheme } from "@/src/theme";

export default function Index() {
  const router = useRouter();
  const { colors } = useTheme();
  return <Screen>
    <View style={styles.hero}><View style={[styles.logo, { backgroundColor: colors.brandPrimary }]}><Ionicons name="construct" size={28} color={colors.onBrandPrimary} /></View><Text style={[styles.brand, { color: colors.onSurface }]}>TecFlow <Text style={{ color: colors.brandPrimary }}>OS</Text></Text><Text style={[styles.tagline, { color: colors.muted }]}>Cada reparo, sob controle.</Text></View>
    <View style={styles.copy}><Text style={[styles.heading, { color: colors.onSurface }]}>Como você quer entrar?</Text><Text style={[styles.body, { color: colors.muted }]}>Acesse as ferramentas da equipe ou acompanhe uma ordem de serviço pelo link.</Text></View>
    <View style={styles.cards}>
      <Pressable onPress={() => router.push("/tech")} style={({ pressed }) => [styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.75 : 1 }]}><View style={[styles.cardIcon, { backgroundColor: colors.brandSecondary }]}><Ionicons name="briefcase" size={22} color={colors.brandPrimary} /></View><View style={styles.cardText}><Text style={[styles.cardTitle, { color: colors.onSurface }]}>Equipe técnica</Text><Text style={[styles.cardBody, { color: colors.muted }]}>Cadastre e acompanhe reparos</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted} /></Pressable>
      <Pressable onPress={() => router.push("/client")} style={({ pressed }) => [styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.75 : 1 }]}><View style={[styles.cardIcon, { backgroundColor: colors.brandTertiary }]}><Ionicons name="search" size={22} color={colors.onBrandTertiary} /></View><View style={styles.cardText}><Text style={[styles.cardTitle, { color: colors.onSurface }]}>Cliente</Text><Text style={[styles.cardBody, { color: colors.muted }]}>Acompanhe sua ordem pelo código</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted} /></Pressable>
    </View>
    <View style={styles.footer}><Ionicons name="shield-checkmark-outline" size={17} color={colors.success} /><Text style={[styles.footerText, { color: colors.muted }]}>Informações do reparo, sempre transparentes.</Text></View>
  </Screen>;
}

const styles = StyleSheet.create({ hero: { alignItems: "center", paddingTop: 44, paddingBottom: 56 }, logo: { width: 64, height: 64, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 16 }, brand: { fontSize: 30, fontWeight: "900", letterSpacing: -1 }, tagline: { fontSize: 15, marginTop: 6 }, copy: { marginBottom: 22 }, heading: { fontSize: 23, fontWeight: "800", marginBottom: 8 }, body: { fontSize: 15, lineHeight: 22 }, cards: { gap: 12 }, card: { minHeight: 92, borderWidth: 1, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center" }, cardIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 14 }, cardText: { flex: 1 }, cardTitle: { fontSize: 16, fontWeight: "800", marginBottom: 5 }, cardBody: { fontSize: 13 }, footer: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", marginTop: "auto", paddingTop: 32 }, footerText: { fontSize: 12 } });