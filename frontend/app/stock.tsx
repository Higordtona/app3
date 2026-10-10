import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "@/src/api";
import { Button, Header, Screen, money } from "@/src/components/ui";
import { useTheme } from "@/src/theme";
import type { Product } from "@/src/types";

export default function Stock() {
  const { colors } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState(""); const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => { try { setError(""); setProducts(await api.listProducts()); } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível carregar o estoque."); } finally { setLoading(false); setRefreshing(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const adjust = async (product: Product, delta: number) => { setBusy(`${product.id}:${delta}`); setActionError(""); try { const updated = await api.adjustStock(product.id, { delta }); setProducts((current) => current.map((item) => item.id === product.id ? updated : item)); } catch (err) { setActionError(err instanceof Error ? err.message : "Não foi possível ajustar o estoque."); } finally { setBusy(""); } };
  const lowStock = products.filter((item) => item.stock_qty <= 0 || (item.min_stock > 0 && item.stock_qty <= item.min_stock));
  const totalUnits = products.reduce((sum, item) => sum + item.stock_qty, 0);
  const invested = products.reduce((sum, item) => sum + item.cost_price * item.stock_qty, 0);
  return <Screen><Header title="Estoque" subtitle="Entradas, saídas e alertas de reposição." />
    {loading ? <ActivityIndicator color={colors.brandPrimary} style={styles.loader} /> : error ? <View style={[styles.empty, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Ionicons name="cloud-offline-outline" size={34} color={colors.error} /><Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Não foi possível carregar</Text><Text style={[styles.emptyText, { color: colors.muted }]}>{error}</Text><View style={styles.retry}><Button testID="stock-retry" label="Tentar novamente" secondary onPress={() => { setLoading(true); load(); }} /></View></View> : <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      <View style={[styles.summary, { backgroundColor: colors.surfaceInverse }]}><View><Text style={[styles.summaryLabel, { color: colors.onSurfaceInverse }]}>ITENS EM ESTOQUE</Text><Text testID="stock-total-units" style={[styles.summaryValue, { color: colors.onSurfaceInverse }]}>{totalUnits}</Text></View><View style={styles.summaryRight}><Text style={[styles.summaryMini, { color: colors.onSurfaceInverse }]}>Valor investido</Text><Text testID="stock-invested" style={[styles.summaryProfit, { color: colors.onSurfaceInverse }]}>{money(invested)}</Text></View></View>
      {lowStock.length > 0 ? <View testID="stock-low-alert" style={[styles.alertBox, { backgroundColor: `${colors.warning}26` }]}><Ionicons name="warning" size={18} color={colors.onWarning} /><Text style={[styles.alertText, { color: colors.onWarning }]}>{lowStock.length} {lowStock.length === 1 ? "produto precisa" : "produtos precisam"} de reposição.</Text></View> : null}
      {actionError ? <Text accessibilityLiveRegion="polite" style={[styles.errorText, { color: colors.error }]}>{actionError}</Text> : null}
      {products.length === 0 ? <View style={[styles.empty, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Ionicons name="cube-outline" size={34} color={colors.muted} /><Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Estoque vazio</Text><Text style={[styles.emptyText, { color: colors.muted }]}>Cadastre produtos para controlar as quantidades aqui.</Text></View> : products.map((product) => <View key={product.id} testID={`stock-row-${product.id}`} style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        <View style={styles.rowInfo}><Text style={[styles.rowName, { color: colors.onSurface }]} numberOfLines={1}>{product.name}</Text><Text style={[styles.rowMeta, { color: colors.muted }]} numberOfLines={1}>{product.category}{product.min_stock > 0 ? ` • mín. ${product.min_stock}` : ""}</Text></View>
        <View style={styles.stepper}>
          <Pressable testID={`stock-minus-${product.id}`} accessibilityRole="button" onPress={() => adjust(product, -1)} disabled={busy !== "" || product.stock_qty <= 0} style={[styles.stepBtn, { backgroundColor: colors.surfaceTertiary, opacity: busy !== "" || product.stock_qty <= 0 ? 0.4 : 1 }]}><Ionicons name="remove" size={18} color={colors.onSurfaceTertiary} /></Pressable>
          {busy === `${product.id}:1` || busy === `${product.id}:-1` ? <ActivityIndicator size="small" color={colors.brandPrimary} style={styles.qtyLoader} /> : <Text testID={`stock-qty-${product.id}`} style={[styles.qty, { color: product.stock_qty <= 0 ? colors.error : colors.onSurface }]}>{product.stock_qty}</Text>}
          <Pressable testID={`stock-plus-${product.id}`} accessibilityRole="button" onPress={() => adjust(product, 1)} disabled={busy !== ""} style={[styles.stepBtn, { backgroundColor: colors.brandPrimary, opacity: busy !== "" ? 0.4 : 1 }]}><Ionicons name="add" size={18} color={colors.onBrandPrimary} /></Pressable>
        </View>
      </View>)}
    </ScrollView>}
  </Screen>;
}

const styles = StyleSheet.create({ loader: { marginTop: 40 }, summary: { minHeight: 96, borderRadius: 18, padding: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }, summaryLabel: { opacity: 0.75, fontSize: 11, fontWeight: "800", letterSpacing: 1 }, summaryValue: { fontSize: 28, fontWeight: "900", marginTop: 6 }, summaryRight: { alignItems: "flex-end", gap: 4 }, summaryMini: { opacity: 0.75, fontSize: 12 }, summaryProfit: { fontSize: 18, fontWeight: "800" }, alertBox: { borderRadius: 12, padding: 13, flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 14 }, alertText: { flex: 1, fontSize: 13, fontWeight: "700" }, errorText: { fontSize: 13, marginBottom: 12 }, empty: { alignItems: "center", padding: 30, borderRadius: 16, borderWidth: 1, marginTop: 4 }, retry: { marginTop: 16, width: "100%" }, emptyTitle: { fontSize: 16, fontWeight: "800", marginTop: 12 }, emptyText: { fontSize: 13, textAlign: "center", lineHeight: 18, marginTop: 5 }, row: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 9, flexDirection: "row", alignItems: "center", gap: 10 }, rowInfo: { flex: 1 }, rowName: { fontSize: 15, fontWeight: "800" }, rowMeta: { fontSize: 12, marginTop: 3 }, stepper: { flexDirection: "row", alignItems: "center", gap: 10 }, stepBtn: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" }, qty: { minWidth: 34, textAlign: "center", fontSize: 17, fontWeight: "900" }, qtyLoader: { minWidth: 34 } });
