import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "@/src/api";
import { Button, Field, Header, Screen, money } from "@/src/components/ui";
import { useTheme } from "@/src/theme";

export const parseMoney = (value: string) => Number(value.replace(",", ".")) || 0;

export default function NewProduct() {
  const router = useRouter(); const { colors } = useTheme();
  const [name, setName] = useState(""); const [sku, setSku] = useState(""); const [category, setCategory] = useState(""); const [cost, setCost] = useState(""); const [price, setPrice] = useState(""); const [stock, setStock] = useState(""); const [minStock, setMinStock] = useState("");
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const margin = parseMoney(price) - parseMoney(cost);
  const save = async () => { if (!name.trim()) return setError("Informe o nome do produto."); setSaving(true); setError(""); try { await api.createProduct({ name: name.trim(), sku: sku.trim(), category: category.trim() || "Geral", cost_price: parseMoney(cost), sale_price: parseMoney(price), stock_qty: parseInt(stock) || 0, min_stock: parseInt(minStock) || 0 }); router.replace("/products"); } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar o produto."); } finally { setSaving(false); } };
  return <Screen><Header title="Novo produto" subtitle="Cadastre peças e acessórios para vender." /><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
    <Field testID="product-name" label="Nome do produto *" value={name} onChangeText={setName} placeholder="Ex.: Tela iPhone 13" />
    <Field testID="product-sku" label="Código / SKU" value={sku} onChangeText={setSku} placeholder="Ex.: TEL-IP13" autoCapitalize="characters" />
    <Field testID="product-category" label="Categoria" value={category} onChangeText={setCategory} placeholder="Ex.: Telas, Baterias, Acessórios" />
    <View style={styles.row}><View style={styles.half}><Field testID="product-cost" label="Preço de custo" value={cost} onChangeText={setCost} placeholder="0,00" keyboardType="numeric" /></View><View style={styles.half}><Field testID="product-price" label="Preço de venda" value={price} onChangeText={setPrice} placeholder="0,00" keyboardType="numeric" /></View></View>
    <View style={styles.row}><View style={styles.half}><Field testID="product-stock" label="Estoque inicial" value={stock} onChangeText={setStock} placeholder="0" keyboardType="numeric" /></View><View style={styles.half}><Field testID="product-min-stock" label="Estoque mínimo" value={minStock} onChangeText={setMinStock} placeholder="0" keyboardType="numeric" /></View></View>
    <View testID="product-margin" style={[styles.marginBox, { backgroundColor: margin >= 0 ? colors.brandSecondary : `${colors.error}1A` }]}><Ionicons name={margin >= 0 ? "trending-up-outline" : "trending-down-outline"} size={18} color={margin >= 0 ? colors.brandPrimary : colors.error} /><Text style={[styles.marginText, { color: margin >= 0 ? colors.onBrandSecondary : colors.error }]}>Lucro por unidade: {money(margin)}</Text></View>
    {error ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
    <Button testID="product-save" label="Salvar produto" onPress={save} loading={saving} icon="checkmark" />
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({ scroll: { paddingBottom: 20 }, row: { flexDirection: "row", gap: 12 }, half: { flex: 1 }, marginBox: { borderRadius: 12, padding: 14, flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 18 }, marginText: { flex: 1, fontSize: 14, fontWeight: "800" }, error: { fontSize: 13, marginBottom: 14 } });
