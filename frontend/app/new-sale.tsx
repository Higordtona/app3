import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "@/src/api";
import { Button, Header, Screen, money } from "@/src/components/ui";
import { useTheme } from "@/src/theme";
import type { Product } from "@/src/types";

const paymentMethods = ["Pix", "Dinheiro", "Cartão"] as const;

export default function NewSale() {
  const router = useRouter(); const { colors } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [payment, setPayment] = useState<string>("Pix");
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const load = useCallback(async () => { try { setError(""); setProducts(await api.listProducts()); } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível carregar os produtos."); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const available = products.filter((item) => item.stock_qty > 0);
  const setQty = (product: Product, qty: number) => setCart((current) => { const next = { ...current }; if (qty <= 0) delete next[product.id]; else next[product.id] = Math.min(qty, product.stock_qty); return next; });
  const cartItems = available.filter((item) => cart[item.id]).map((item) => ({ product: item, qty: cart[item.id] }));
  const total = cartItems.reduce((sum, item) => sum + item.product.sale_price * item.qty, 0);
  const profit = cartItems.reduce((sum, item) => sum + (item.product.sale_price - item.product.cost_price) * item.qty, 0);
  const confirm = async () => { if (cartItems.length === 0) return; setSaving(true); setError(""); try { await api.createSale({ items: cartItems.map((item) => ({ product_id: item.product.id, quantity: item.qty })), payment_method: payment }); router.replace("/sales"); } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível registrar a venda."); } finally { setSaving(false); } };
  return <Screen><Header title="Nova venda" subtitle="Toque nos produtos para montar o carrinho." />
    {loading ? <ActivityIndicator color={colors.brandPrimary} style={styles.loader} /> : <>
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        <Text style={[styles.section, { color: colors.onSurface }]}>Pagamento</Text>
        <View style={styles.payRow}>{paymentMethods.map((method) => <Pressable key={method} testID={`pay-${method.toLowerCase()}`} onPress={() => setPayment(method)} style={[styles.payChip, { backgroundColor: payment === method ? colors.brandPrimary : colors.surfaceSecondary, borderColor: payment === method ? colors.brandPrimary : colors.border }]}><Text style={[styles.payText, { color: payment === method ? colors.onBrandPrimary : colors.onSurfaceSecondary }]}>{method}</Text></Pressable>)}</View>
        <Text style={[styles.section, { color: colors.onSurface }]}>Produtos disponíveis</Text>
        {available.length === 0 ? <View style={[styles.empty, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Ionicons name="cube-outline" size={34} color={colors.muted} /><Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Sem produtos em estoque</Text><Text style={[styles.emptyText, { color: colors.muted }]}>Cadastre produtos com estoque para vender.</Text></View> : available.map((product) => {
          const qty = cart[product.id] ?? 0;
          return <View key={product.id} testID={`sale-product-${product.id}`} style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: qty > 0 ? colors.brandPrimary : colors.border }]}>
            <View style={styles.rowInfo}><Text style={[styles.rowName, { color: colors.onSurface }]} numberOfLines={1}>{product.name}</Text><Text style={[styles.rowMeta, { color: colors.muted }]}>{money(product.sale_price)} • {product.stock_qty} un.</Text></View>
            {qty > 0 ? <View style={styles.stepper}>
              <Pressable testID={`sale-minus-${product.id}`} accessibilityRole="button" onPress={() => setQty(product, qty - 1)} style={[styles.stepBtn, { backgroundColor: colors.surfaceTertiary }]}><Ionicons name="remove" size={18} color={colors.onSurfaceTertiary} /></Pressable>
              <Text testID={`sale-qty-${product.id}`} style={[styles.qty, { color: colors.onSurface }]}>{qty}</Text>
              <Pressable testID={`sale-plus-${product.id}`} accessibilityRole="button" onPress={() => setQty(product, qty + 1)} disabled={qty >= product.stock_qty} style={[styles.stepBtn, { backgroundColor: colors.brandPrimary, opacity: qty >= product.stock_qty ? 0.4 : 1 }]}><Ionicons name="add" size={18} color={colors.onBrandPrimary} /></Pressable>
            </View> : <Pressable testID={`sale-add-${product.id}`} accessibilityRole="button" onPress={() => setQty(product, 1)} style={[styles.addBtn, { backgroundColor: colors.brandSecondary }]}><Ionicons name="add" size={16} color={colors.brandPrimary} /><Text style={[styles.addText, { color: colors.brandPrimary }]}>Adicionar</Text></Pressable>}
          </View>;
        })}
      </ScrollView>
      <View style={[styles.cartBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        <View style={styles.cartLine}><Text style={[styles.cartLabel, { color: colors.muted }]}>{cartItems.reduce((sum, item) => sum + item.qty, 0)} itens</Text><Text testID="sale-profit-preview" style={[styles.cartProfit, { color: colors.success }]}>Lucro {money(profit)}</Text><Text testID="sale-total" style={[styles.cartTotal, { color: colors.onSurface }]}>{money(total)}</Text></View>
        {error ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
        <Button testID="sale-confirm" label="Confirmar venda" onPress={confirm} loading={saving} icon="checkmark" />
      </View>
    </>}
  </Screen>;
}

const styles = StyleSheet.create({ loader: { marginTop: 40 }, list: { flex: 1 }, section: { fontSize: 16, fontWeight: "800", marginTop: 4, marginBottom: 10 }, payRow: { flexDirection: "row", gap: 10, marginBottom: 20 }, payChip: { minHeight: 40, borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" }, payText: { fontSize: 13, fontWeight: "800" }, empty: { alignItems: "center", padding: 30, borderRadius: 16, borderWidth: 1, marginTop: 4 }, emptyTitle: { fontSize: 16, fontWeight: "800", marginTop: 12 }, emptyText: { fontSize: 13, textAlign: "center", lineHeight: 18, marginTop: 5 }, row: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 9, flexDirection: "row", alignItems: "center", gap: 10 }, rowInfo: { flex: 1 }, rowName: { fontSize: 15, fontWeight: "800" }, rowMeta: { fontSize: 12, marginTop: 3 }, stepper: { flexDirection: "row", alignItems: "center", gap: 10 }, stepBtn: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" }, qty: { minWidth: 26, textAlign: "center", fontSize: 16, fontWeight: "900" }, addBtn: { minHeight: 44, borderRadius: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 5 }, addText: { fontSize: 13, fontWeight: "800" }, cartBox: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 10 }, cartLine: { flexDirection: "row", alignItems: "center", marginBottom: 12 }, cartLabel: { flex: 1, fontSize: 13, fontWeight: "700" }, cartProfit: { fontSize: 13, fontWeight: "800", marginRight: 12 }, cartTotal: { fontSize: 18, fontWeight: "900" }, error: { fontSize: 13, marginBottom: 12 } });
