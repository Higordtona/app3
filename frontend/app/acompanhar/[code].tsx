import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { api } from "@/src/api";
import { Button, Screen } from "@/src/components/ui";
import { useTheme } from "@/src/theme";

// Link público de acompanhamento: /acompanhar/TF-XXXXXX → abre a OS como cliente.
export default function TrackRedirect() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter(); const { colors } = useTheme();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!code) return;
    (async () => {
      try {
        const order = await api.getTracking(String(code));
        router.replace({ pathname: "/order/[id]", params: { id: order.id, role: "client" } });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Código de acompanhamento inválido.");
      }
    })();
  }, [code, router]);
  return <Screen><View style={styles.center}>
    {error ? <>
      <View style={[styles.iconCircle, { backgroundColor: `${colors.error}1A` }]}><Ionicons name="alert-circle" size={30} color={colors.error} /></View>
      <Text style={[styles.title, { color: colors.onSurface }]}>Link inválido</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{error}</Text>
      <View style={styles.action}><Button testID="track-back" label="Voltar ao início" secondary onPress={() => router.replace("/")} /></View>
    </> : <>
      <ActivityIndicator color={colors.brandPrimary} size="large" />
      <Text style={[styles.body, { color: colors.muted }]}>Abrindo seu acompanhamento...</Text>
    </>}
  </View></Screen>;
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }, iconCircle: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center" }, title: { fontSize: 20, fontWeight: "800" }, body: { fontSize: 14, textAlign: "center", lineHeight: 20 }, action: { alignSelf: "stretch", marginTop: 10 } });
