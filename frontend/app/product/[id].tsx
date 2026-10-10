import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "@/src/api";
import { Button, Field, Header, Screen, money } from "@/src/components/ui";
import { useTheme } from "@/src/theme";
import { parseMoney } from "../new-product";

export default function EditProduct() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter(); const { colors } = useTheme();
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const [name, setName] = useState(""); const [sku, setSku] = useState(""); const [category, setCategory] = useState(""); const [cost, setCost] = useState(""); const [price, setPrice] = useState(""); const [minStock, setMinStock] = useState(""); const [stockQty, setStockQty] = useState(0);
  const format = (value: number) => String(value).replace(".", ",");
  const load = useCallback(async () => { if (!id) return; try { setError(""); const product = await api.getProduct(String(id)); setName(product.name); setSku(product.sku); setCategory(product.category); setCost(format(product.cost_price)); setPrice(format(product.sale_price)); setMinStock(String(product.min_stock || "")); setStockQty(product.stock_qty); } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível carregar o produto."); } finally { setLoading(false); } }, [id]);
  useEffect(() => { load(); }, [load]);
  const margin = parseMoney(price) - parseMoney(cost);
  const save = async () => { if (!name.trim()) return setError("Informe o nome do produto."); setSaving(true); setError(""); try { await api.updateProduct(String(id), { name: name.trim(), sku: sku.trim(), category: category.trim() || "Geral", cost_price: parseMoney(cost), sale_price: parseMoney(price), min_stock: parseInt(minStock) || 0 }); router.replace("/products"); } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar as alterações."); } finally { setSaving(false); } };
  if (loading) return <Screen><ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 100 }} /></Screen>;
  return <Screen><Header title="Editar produto" subtitle="Atualize os dados do cadastro." /><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
    {error && !name ? <View style={[styles.loadError, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Text style={{ color: colors.error }}>{error}</Text><View style={styles.retry}><Button testID="product-retry" label="Tentar novamente" secondary onPress={() => { setLoading(true); load(); }} /></View></View> : <>
    <View testID="product-stock-info" style={[styles.stockInfo, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><View style={[styles.stockIcon, { backgroundColor: colors.brandSecondary }]}><Ionicons name="cube" size={18} color={colors.brandPrimary} /></View><View style={styles.stockInfoText}><Text style={[styles.stockInfoValue, { color: colors.onSurface }]}>{stockQty} unidades em estoque</Text><Text style={[styles.stockInfoHint, { color: colors.muted }]}>Entradas e saídas são ajustadas na tela Estoque.</Text></View></View>
    <Field testID="product-name" label="Nome do produto *" value={name} onChangeText={setName} placeholder="Ex.: Tela iPhone 13" />
    <Field testID="product-sku" label="Código / SKU" value={sku} onChangeText={setSku} placeholder="Ex.: TEL-IP13" autoCapitalize="characters" />
    <Field testID="product-category" label="Categoria" value={category} onChangeText={setCategory} placeholder="Ex.: Telas, Baterias, Acessórios" />
    <View style={styles.row}><View style={styles.half}><Field testID="product-cost" label="Preço de custo" value={cost} onChangeText={setCost} placeholder="0,00" keyboardType="numeric" /></View><View style={styles.half}><Field testID="product-price" label="Preço de venda" value={price} onChangeText={setPrice} placeholder="0,00" keyboardType="numeric" /></View></View>
    <Field testID="product-min-stock" label="Estoque mínimo (alerta)" value={minStock} onChangeText={setMinStock} placeholder="0" keyboardType="numeric" />
    <View testID="product-margin" style={[styles.marginBox, { backgroundColor: margin >= 0 ? colors.brandSecondary : `${colors.error}1A` }]}><Ionicons name={margin >= 0 ? "trending-up-outline" : "trending-down-outline"} size={18} color={margin >= 0 ? colors.brandPrimary : colors.error} /><Text style={[styles.marginText, { color: margin >= 0 ? colors.onBrandSecondary : colors.error }]}>Lucro por unidade: {money(margin)}</Text></View>
    {error ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
    <Button testID="product-save" label="Salvar alterações" onPress={save} loading={saving} icon="checkmark" /></>}
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({ scroll: { paddingBottom: 20 }, row: { flexDirection: "row", gap: 12 }, half: { flex: 1 }, stockInfo: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 }, stockIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" }, stockInfoText: { flex: 1 }, stockInfoValue: { fontSize: 15, fontWeight: "800" }, stockInfoHint: { fontSize: 12, marginTop: 3 }, marginBox: { borderRadius: 12, padding: 14, flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 18 }, marginText: { flex: 1, fontSize: 14, fontWeight: "800" }, error: { fontSize: 13, marginBottom: 14 }, loadError: { borderWidth: 1, borderRadius: 14, padding: 18 }, retry: { marginTop: 14 } });
