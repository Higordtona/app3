import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@/src/api";
import { Button, Header, Screen } from "@/src/components/ui";
import { useTheme } from "@/src/theme";

export default function Unlock() {
  const router = useRouter(); const { colors } = useTheme();
  const [pin, setPin] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const submit = async () => { if (!/^\d{7}$/.test(pin) || busy) return; setBusy(true); setError(""); try { await api.unlockAdmin(pin); router.replace("/tech"); } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível desbloquear."); setPin(""); } finally { setBusy(false); } };
  return <Screen><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
    <Header title="Acesso da equipe" subtitle="Área restrita. Digite o PIN de 7 dígitos." />
    <View style={styles.center}>
      <View style={[styles.lockCircle, { backgroundColor: colors.brandSecondary }]}><Ionicons name="lock-closed" size={30} color={colors.brandPrimary} /></View>
      <TextInput testID="pin-input" accessibilityLabel="PIN da equipe" value={pin} onChangeText={(value) => { setError(""); setPin(value.replace(/\D/g, "").slice(0, 7)); }} keyboardType="number-pad" secureTextEntry maxLength={7} placeholder="•••••••" placeholderTextColor={colors.muted} style={[styles.pin, { color: colors.onSurface, borderColor: error ? colors.error : colors.border, backgroundColor: colors.surfaceSecondary }]} />
      {error ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
      <Button testID="pin-submit" label="Desbloquear painel" onPress={submit} loading={busy} icon="key" />
    </View>
  </KeyboardAvoidingView></Screen>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, center: { flex: 1, gap: 16, justifyContent: "center", marginTop: -72 }, lockCircle: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center", alignSelf: "center" }, pin: { minHeight: 64, borderWidth: 1, borderRadius: 16, textAlign: "center", fontSize: 28, fontWeight: "900", letterSpacing: 14, paddingHorizontal: 16 }, error: { fontSize: 13, textAlign: "center" } });
