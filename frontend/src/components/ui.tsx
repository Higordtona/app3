import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { ReactNode } from "react";
import { useTheme } from "../theme";
import type { Status } from "../types";

export const money = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

export function Screen({ children, scroll = false }: { children: ReactNode; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const content = <View style={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>{children}</View>;
  return <View style={[styles.screen, { backgroundColor: colors.surface }]}>{scroll ? <ScrollView style={styles.scroll}>{content}</ScrollView> : content}</View>;
}

export function Header({ title, subtitle, back = true }: { title: string; subtitle?: string; back?: boolean }) {
  const router = useRouter();
  const { colors } = useTheme();
  return <View style={styles.header}>
    {back ? <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={colors.onSurface} /></Pressable> : null}
    <View style={styles.headerCopy}><Text style={[styles.eyebrow, { color: colors.brandPrimary }]}>HDTECH</Text><Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>{subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}</View>
  </View>;
}

export function Button({ label, onPress, secondary = false, loading = false, icon, testID }: { label: string; onPress: () => void; secondary?: boolean; loading?: boolean; icon?: keyof typeof Ionicons.glyphMap; testID?: string }) {
  const { colors } = useTheme();
  return <Pressable testID={testID} accessibilityRole="button" onPress={onPress} disabled={loading} style={({ pressed }) => [styles.button, { backgroundColor: secondary ? colors.brandSecondary : colors.brandPrimary, opacity: pressed || loading ? 0.75 : 1 }]}>
    {loading ? <ActivityIndicator color={secondary ? colors.onBrandSecondary : colors.onBrandPrimary} /> : <>{icon ? <Ionicons name={icon} size={18} color={secondary ? colors.onBrandSecondary : colors.onBrandPrimary} /> : null}<Text style={[styles.buttonText, { color: secondary ? colors.onBrandSecondary : colors.onBrandPrimary }]}>{label}</Text></>}
  </Pressable>;
}

export function Field({ label, value, onChangeText, placeholder, keyboardType = "default", multiline = false, autoCapitalize = "sentences", testID }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; keyboardType?: "default" | "email-address" | "phone-pad" | "numeric"; multiline?: boolean; autoCapitalize?: "none" | "sentences" | "words" | "characters"; testID?: string }) {
  const { colors } = useTheme();
  return <View style={styles.field}><Text style={[styles.label, { color: colors.onSurfaceSecondary }]}>{label}</Text><TextInput testID={testID} accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted} keyboardType={keyboardType} multiline={multiline} autoCapitalize={autoCapitalize} style={[styles.input, { color: colors.onSurface, borderColor: colors.border, backgroundColor: colors.surfaceSecondary }, multiline && styles.multiline]} /></View>;
}

export function StatusPill({ status }: { status: Status | string }) {
  const { colors } = useTheme();
  const tone = status === "Pronto" || status === "Entregue" ? colors.success : status === "Em reparo" ? colors.brandPrimary : colors.warning;
  return <View style={[styles.pill, { backgroundColor: status === "Em reparo" ? colors.brandSecondary : `${tone}22` }]}><View style={[styles.dot, { backgroundColor: tone }]} /><Text style={[styles.pillText, { color: tone }]}>{status}</Text></View>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { flex: 1, paddingHorizontal: 20 }, scroll: { flex: 1 }, header: { flexDirection: "row", alignItems: "flex-start", minHeight: 72 }, back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: 8 }, headerCopy: { flex: 1 }, eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginBottom: 4 }, title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 }, subtitle: { fontSize: 14, lineHeight: 20, marginTop: 6 }, button: { minHeight: 52, borderRadius: 12, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }, buttonText: { fontSize: 15, fontWeight: "800" }, field: { marginBottom: 16 }, label: { fontSize: 13, fontWeight: "700", marginBottom: 7 }, input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 }, multiline: { minHeight: 96, paddingTop: 12, textAlignVertical: "top" }, pill: { alignSelf: "flex-start", minHeight: 28, borderRadius: 999, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 }, dot: { width: 7, height: 7, borderRadius: 99 }, pillText: { fontSize: 12, fontWeight: "700" },
});