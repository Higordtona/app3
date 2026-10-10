import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@/src/api";
import { Button, Header, Screen, money } from "@/src/components/ui";
import { useTheme } from "@/src/theme";
import type { Product } from "@/src/types";

export default function Products() {
  const router = useRouter();
  const { colors } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState("");
  const load = useCallback(async () => { try { setError(""); setProducts(await api.listProducts()); } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível carregar os produtos."); } finally { setLoading(false); setRefreshing(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => { const term = search.trim().toLowerCase(); if (!term) return products; return products.filter((item) => item.name.toLowerCase().includes(term) || item.sku.toLowerCase().includes(term) || item.category.toLowerCase().includes(term)); }, [products, search]);
  return <Screen><Header title="Produtos" subtitle="Cadastro e catálogo da loja." />
    <View style={[styles.searchBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Ionicons name="search" size={18} color={colors.muted} /><TextInput testID="product-search" value={search} onChangeText={setSearch} placeholder="Buscar por nome, código ou categoria" placeholderTextColor={colors.muted} style={[styles.searchInput, { color: colors.onSurface }]} /></View>
    <Button testID="product-new" label="Novo produto" icon="add" onPress={() => router.push("/new-product")} />
    {loading ? <ActivityIndicator color={colors.brandPrimary} style={styles.loader} /> : error ? <View style={[styles.empty, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Ionicons name="cloud-offline-outline" size={34} color={colors.error} /><Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Não foi possível carregar</Text><Text style={[styles.emptyText, { color: colors.muted }]}>{error}</Text><View style={styles.retry}><Button testID="products-retry" label="Tentar novamente" secondary onPress={() => { setLoading(true); load(); }} /></View></View> : <ScrollView style={styles.list} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      {filtered.length === 0 ? <View style={[styles.empty, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Ionicons name="pricetags-outline" size={34} color={colors.muted} /><Text style={[styles.emptyTitle, { color: colors.onSurface }]}>{search ? "Nada encontrado" : "Nenhum produto cadastrado"}</Text><Text style={[styles.emptyText, { color: colors.muted }]}>{search ? "Tente outro termo de busca." : "Cadastre o primeiro produto para começar a vender."}</Text></View> : filtered.map((product) => {
        const out = product.stock_qty <= 0; const low = !out && product.min_stock > 0 && product.stock_qty <= product.min_stock;
        return <Pressable key={product.id} testID={`product-item-${product.id}`} onPress={() => router.push({ pathname: "/product/[id]", params: { id: product.id } })} style={({ pressed }) => [styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
          <View style={styles.cardTop}><View style={styles.cardInfo}><Text style={[styles.name, { color: colors.onSurface }]} numberOfLines={1}>{product.name}</Text><Text style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>{[product.sku ? `Cód. ${product.sku}` : "", product.category].filter(Boolean).join(" • ")}</Text></View><Text style={[styles.price, { color: colors.onSurface }]}>{money(product.sale_price)}</Text></View>
          <View style={[styles.cardBottom, { borderTopColor: colors.divider }]}><View style={[styles.stockBadge, { backgroundColor: out ? `${colors.error}1A` : low ? `${colors.warning}33` : colors.surfaceTertiary }]}><Ionicons name={out ? "alert-circle" : "cube-outline"} size={13} color={out ? colors.error : low ? colors.onWarning : colors.muted} /><Text style={[styles.stockText, { color: out ? colors.error : low ? colors.onWarning : colors.muted }]}>{out ? "Sem estoque" : `${product.stock_qty} un.${low ? " • estoque baixo" : ""}`}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.muted} /></View>
        </Pressable>;
      })}
    </ScrollView>}
  </Screen>;
}

const styles = StyleSheet.create({ searchBox: { minHeight: 48, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 10, marginBottom: 14 }, searchInput: { flex: 1, fontSize: 14 }, loader: { marginTop: 40 }, list: { flex: 1, marginTop: 16 }, empty: { alignItems: "center", padding: 30, borderRadius: 16, borderWidth: 1, marginTop: 4 }, retry: { marginTop: 16, width: "100%" }, emptyTitle: { fontSize: 16, fontWeight: "800", marginTop: 12 }, emptyText: { fontSize: 13, textAlign: "center", lineHeight: 18, marginTop: 5 }, card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 10 }, cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, cardInfo: { flex: 1 }, name: { fontSize: 16, fontWeight: "800" }, meta: { fontSize: 12, marginTop: 4 }, price: { fontSize: 16, fontWeight: "900" }, cardBottom: { borderTopWidth: 1, marginTop: 12, paddingTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, stockBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }, stockText: { fontSize: 12, fontWeight: "700" } });
