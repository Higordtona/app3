import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "@/src/api";
import { Button, Header, Screen, money } from "@/src/components/ui";
import { useTheme } from "@/src/theme";
import type { StoreProduct } from "@/src/types";

const categoryIcon = (category: string): keyof typeof Ionicons.glyphMap => { const c = category.toLowerCase(); if (c.includes("pel")) return "shield-half"; if (c.includes("cap")) return "phone-portrait"; if (c.includes("fone") || c.includes("udio")) return "headset"; if (c.includes("cabo") || c.includes("carreg")) return "battery-charging"; return "bag-handle"; };

export default function Shop() {
  const router = useRouter(); const { colors } = useTheme();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState("");
  const load = useCallback(async () => { try { setError(""); setProducts(await api.listStoreProducts()); } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível carregar a loja."); } finally { setLoading(false); setRefreshing(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const setQty = (product: StoreProduct, qty: number) => setCart((current) => { const next = { ...current }; if (qty <= 0) delete next[product.id]; else next[product.id] = Math.min(qty, product.stock_qty); return next; });
  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const cartTotal = products.filter((item) => cart[item.id]).reduce((sum, item) => sum + item.sale_price * cart[item.id], 0);
  return <Screen><Header title="Loja Hdtech" subtitle="Películas, capinhas, fones e acessórios." />
    {loading ? <ActivityIndicator color={colors.brandPrimary} style={styles.loader} /> : error ? <View style={[styles.empty, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Ionicons name="cloud-offline-outline" size={34} color={colors.error} /><Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Não foi possível carregar</Text><Text style={[styles.emptyText, { color: colors.muted }]}>{error}</Text><View style={styles.retry}><Button testID="shop-retry" label="Tentar novamente" secondary onPress={() => { setLoading(true); load(); }} /></View></View> : <>
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {products.length === 0 ? <View style={[styles.empty, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Ionicons name="bag-outline" size={34} color={colors.muted} /><Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Loja em reposição</Text><Text style={[styles.emptyText, { color: colors.muted }]}>Novos acessórios chegam em breve.</Text></View> : products.map((product) => {
          const qty = cart[product.id] ?? 0;
          return <View key={product.id} testID={`shop-product-${product.id}`} style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: qty > 0 ? colors.brandPrimary : colors.border }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.brandSecondary }]}><Ionicons name={categoryIcon(product.category)} size={20} color={colors.brandPrimary} /></View>
            <View style={styles.rowInfo}><Text style={[styles.rowName, { color: colors.onSurface }]} numberOfLines={1}>{product.name}</Text><Text style={[styles.rowMeta, { color: colors.muted }]}>{product.category} • {money(product.sale_price)}</Text></View>
            {qty > 0 ? <View style={styles.stepper}>
              <Pressable testID={`shop-minus-${product.id}`} accessibilityRole="button" onPress={() => setQty(product, qty - 1)} style={[styles.stepBtn, { backgroundColor: colors.surfaceTertiary }]}><Ionicons name="remove" size={18} color={colors.onSurfaceTertiary} /></Pressable>
              <Text testID={`shop-qty-${product.id}`} style={[styles.qty, { color: colors.onSurface }]}>{qty}</Text>
              <Pressable testID={`shop-plus-${product.id}`} accessibilityRole="button" onPress={() => setQty(product, qty + 1)} disabled={qty >= product.stock_qty} style={[styles.stepBtn, { backgroundColor: colors.brandPrimary, opacity: qty >= product.stock_qty ? 0.4 : 1 }]}><Ionicons name="add" size={18} color={colors.onBrandPrimary} /></Pressable>
            </View> : <Pressable testID={`shop-add-${product.id}`} accessibilityRole="button" onPress={() => setQty(product, 1)} style={[styles.addBtn, { backgroundColor: colors.brandSecondary }]}><Ionicons name="add" size={16} color={colors.brandPrimary} /><Text style={[styles.addText, { color: colors.brandPrimary }]}>Adicionar</Text></Pressable>}
          </View>;
        })}
        <View style={styles.listEnd} />
      </ScrollView>
      {cartCount > 0 ? <View style={[styles.cartBar, { backgroundColor: colors.brandPrimary }]}>
        <View style={styles.cartInfo}><Text testID="shop-cart-count" style={[styles.cartCount, { color: colors.onBrandPrimary }]}>{cartCount} {cartCount === 1 ? "item" : "itens"}</Text><Text testID="shop-cart-total" style={[styles.cartTotal, { color: colors.onBrandPrimary }]}>{money(cartTotal)}</Text></View>
        <Pressable testID="shop-checkout" accessibilityRole="button" onPress={() => router.push({ pathname: "/checkout", params: { cart: JSON.stringify(cart) } })} style={[styles.cartButton, { backgroundColor: colors.surface }]}><Text style={[styles.cartButtonText, { color: colors.brandPrimary }]}>Finalizar</Text><Ionicons name="arrow-forward" size={16} color={colors.brandPrimary} /></Pressable>
      </View> : null}
    </>}
  </Screen>;
}

const styles = StyleSheet.create({ loader: { marginTop: 40 }, list: { flex: 1 }, listEnd: { height: 8 }, empty: { alignItems: "center", padding: 30, borderRadius: 16, borderWidth: 1, marginTop: 4 }, retry: { marginTop: 16, width: "100%" }, emptyTitle: { fontSize: 16, fontWeight: "800", marginTop: 12 }, emptyText: { fontSize: 13, textAlign: "center", lineHeight: 18, marginTop: 5 }, row: { borderRadius: 14, borderWidth: 1, padding: 13, marginBottom: 9, flexDirection: "row", alignItems: "center", gap: 11 }, iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" }, rowInfo: { flex: 1 }, rowName: { fontSize: 15, fontWeight: "800" }, rowMeta: { fontSize: 12, marginTop: 3 }, stepper: { flexDirection: "row", alignItems: "center", gap: 10 }, stepBtn: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" }, qty: { minWidth: 26, textAlign: "center", fontSize: 16, fontWeight: "900" }, addBtn: { minHeight: 44, borderRadius: 12, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 5 }, addText: { fontSize: 13, fontWeight: "800" }, cartBar: { borderRadius: 16, padding: 14, marginTop: 10, flexDirection: "row", alignItems: "center" }, cartInfo: { flex: 1 }, cartCount: { fontSize: 12, opacity: 0.85, fontWeight: "700" }, cartTotal: { fontSize: 19, fontWeight: "900", marginTop: 2 }, cartButton: { minHeight: 46, borderRadius: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 6 }, cartButtonText: { fontSize: 14, fontWeight: "800" } });
