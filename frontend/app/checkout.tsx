import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "@/src/api";
import { Button, Field, Header, Screen, money } from "@/src/components/ui";
import { useTheme } from "@/src/theme";
import type { StoreOrderResult, StoreProduct } from "@/src/types";

export default function Checkout() {
  const { cart: cartParam } = useLocalSearchParams<{ cart?: string }>();
  const router = useRouter(); const { colors } = useTheme();
  const cart = useMemo<Record<string, number>>(() => { try { return JSON.parse(cartParam ?? "{}"); } catch { return {}; } }, [cartParam]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false); const [result, setResult] = useState<StoreOrderResult | null>(null); const [copied, setCopied] = useState(false);
  const load = useCallback(async () => { try { setError(""); setProducts(await api.listStoreProducts()); } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível carregar o checkout."); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const items = products.filter((item) => cart[item.id]).map((item) => ({ product: item, qty: cart[item.id] }));
  const total = items.reduce((sum, item) => sum + item.product.sale_price * item.qty, 0);
  const confirm = async () => { if (!name.trim() || !phone.trim()) return setError("Informe seu nome e telefone para finalizar."); if (items.length === 0) return setError("Seu carrinho está vazio."); setSaving(true); setError(""); try { setResult(await api.createStoreOrder({ client_name: name.trim(), client_phone: phone.trim(), items: items.map((item) => ({ product_id: item.product.id, quantity: item.qty })) })); } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível registrar o pedido."); } finally { setSaving(false); } };
  const copyPix = async () => { if (!result?.pix_key) return; await Clipboard.setStringAsync(result.pix_key); setCopied(true); };

  if (result) return <Screen><View style={styles.successCenter}>
    <View style={[styles.successIcon, { backgroundColor: `${colors.success}1A` }]}><Ionicons name="checkmark-circle" size={46} color={colors.success} /></View>
    <Text style={[styles.successTitle, { color: colors.onSurface }]}>Pedido registrado!</Text>
    <Text testID="order-total" style={[styles.successTotal, { color: colors.brandPrimary }]}>{money(result.total)}</Text>
    {result.pix_key ? <View style={[styles.payBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      <Text style={[styles.payLabel, { color: colors.muted }]}>CHAVE PIX DA LOJA</Text>
      <Text testID="pix-key" style={[styles.pixKey, { color: colors.onSurface }]}>{result.pix_key}</Text>
      <Pressable testID="pix-copy" accessibilityRole="button" onPress={copyPix} style={[styles.pixCopy, { backgroundColor: colors.brandSecondary }]}><Ionicons name={copied ? "checkmark" : "copy-outline"} size={16} color={colors.brandPrimary} /><Text style={[styles.pixCopyText, { color: colors.brandPrimary }]}>{copied ? "Chave copiada!" : "Copiar chave Pix"}</Text></Pressable>
      <Text style={[styles.payHint, { color: colors.muted }]}>Faça o Pix e apresente o comprovante na retirada do produto.</Text>
    </View> : null}
    <View style={styles.successActions}><Button testID="checkout-done" label="Voltar para a loja" onPress={() => router.replace("/shop")} icon="bag" /></View>
  </View></Screen>;

  return <Screen><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
    <Header title="Finalizar compra" subtitle="Revise o pedido e pague com Pix." />
    {loading ? <ActivityIndicator color={colors.brandPrimary} style={styles.loader} /> : <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={[styles.summaryCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.onSurface }]}>Seu pedido</Text>
        {items.length === 0 ? <Text style={[styles.emptyCart, { color: colors.muted }]}>Carrinho vazio. Volte e adicione produtos.</Text> : items.map((item) => <View key={item.product.id} style={styles.itemRow}><Text style={[styles.itemName, { color: colors.onSurface }]}>{item.qty}× {item.product.name}</Text><Text style={[styles.itemPrice, { color: colors.onSurface }]}>{money(item.product.sale_price * item.qty)}</Text></View>)}
        <View style={[styles.totalRow, { borderTopColor: colors.divider }]}><Text style={[styles.totalLabel, { color: colors.muted }]}>Total</Text><Text testID="checkout-total" style={[styles.totalValue, { color: colors.onSurface }]}>{money(total)}</Text></View>
      </View>
      <Field testID="checkout-name" label="Seu nome *" value={name} onChangeText={setName} placeholder="Nome completo" />
      <Field testID="checkout-phone" label="Seu telefone *" value={phone} onChangeText={setPhone} placeholder="(00) 00000-0000" keyboardType="phone-pad" />
      <View style={[styles.pixInfo, { backgroundColor: colors.brandSecondary }]}><Ionicons name="flash" size={18} color={colors.brandPrimary} /><Text style={[styles.pixInfoText, { color: colors.onBrandSecondary }]}>Pagamento via Pix: a chave da loja aparece após confirmar o pedido.</Text></View>
      {error ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
      <Button testID="checkout-confirm" label="Gerar pedido e ver chave Pix" onPress={confirm} loading={saving} icon="flash" />
    </ScrollView>}
  </KeyboardAvoidingView></Screen>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, loader: { marginTop: 40 }, scroll: { paddingBottom: 20 }, summaryCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 18 }, section: { fontSize: 16, fontWeight: "800", marginBottom: 10 }, emptyCart: { fontSize: 13, lineHeight: 18 }, itemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, gap: 12 }, itemName: { fontSize: 14, flex: 1 }, itemPrice: { fontSize: 14, fontWeight: "700" }, totalRow: { borderTopWidth: 1, marginTop: 10, paddingTop: 12, flexDirection: "row", justifyContent: "space-between" }, totalLabel: { fontSize: 13, fontWeight: "700" }, totalValue: { fontSize: 18, fontWeight: "900" }, pixInfo: { borderRadius: 12, padding: 14, flexDirection: "row", gap: 9, alignItems: "center", marginBottom: 16 }, pixInfoText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: "600" }, error: { fontSize: 13, marginBottom: 12 }, successCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }, successIcon: { width: 88, height: 88, borderRadius: 28, alignItems: "center", justifyContent: "center" }, successTitle: { fontSize: 22, fontWeight: "900" }, successTotal: { fontSize: 26, fontWeight: "900" }, payBox: { alignSelf: "stretch", borderWidth: 1, borderRadius: 16, padding: 18, alignItems: "center", gap: 10, marginTop: 6 }, payLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1 }, pixKey: { fontSize: 22, fontWeight: "900", letterSpacing: 0.5 }, pixCopy: { minHeight: 42, borderRadius: 10, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 6 }, pixCopyText: { fontSize: 13, fontWeight: "800" }, payHint: { fontSize: 12, textAlign: "center", lineHeight: 17 }, successActions: { alignSelf: "stretch", marginTop: 10 } });
