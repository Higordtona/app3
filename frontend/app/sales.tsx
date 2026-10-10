import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "@/src/api";
import { Button, Header, Screen, money } from "@/src/components/ui";
import { useTheme } from "@/src/theme";
import type { Sale } from "@/src/types";

export default function Sales() {
  const router = useRouter();
  const { colors } = useTheme();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState(""); const [busy, setBusy] = useState("");
  const load = useCallback(async () => { try { setError(""); setSales(await api.listSales()); } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível carregar as vendas."); } finally { setLoading(false); setRefreshing(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const confirmPayment = async (sale: Sale) => { setBusy(sale.id); try { const updated = await api.markSalePaid(sale.id); setSales((current) => current.map((item) => item.id === sale.id ? updated : item)); } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível confirmar o pagamento."); } finally { setBusy(""); } };
  const revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
  const profit = sales.reduce((sum, sale) => sum + sale.profit, 0);
  return <Screen><Header title="Vendas" subtitle="Histórico de vendas da loja." />
    <View style={[styles.summary, { backgroundColor: colors.brandPrimary }]}><View><Text style={[styles.summaryLabel, { color: colors.onBrandPrimary }]}>TOTAL VENDIDO</Text><Text testID="sales-revenue" style={[styles.summaryValue, { color: colors.onBrandPrimary }]}>{money(revenue)}</Text></View><View style={styles.summaryRight}><Text style={[styles.summaryMini, { color: colors.onBrandPrimary }]}>Lucro</Text><Text testID="sales-profit" style={[styles.summaryProfit, { color: colors.onBrandPrimary }]}>{money(profit)}</Text><Text style={[styles.summaryMini, { color: colors.onBrandPrimary }]}>{sales.length} {sales.length === 1 ? "venda" : "vendas"}</Text></View></View>
    <Button testID="sale-new" label="Nova venda" icon="add" onPress={() => router.push("/new-sale")} />
    {loading ? <ActivityIndicator color={colors.brandPrimary} style={styles.loader} /> : error ? <View style={[styles.empty, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Ionicons name="cloud-offline-outline" size={34} color={colors.error} /><Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Não foi possível carregar</Text><Text style={[styles.emptyText, { color: colors.muted }]}>{error}</Text><View style={styles.retry}><Button testID="sales-retry" label="Tentar novamente" secondary onPress={() => { setLoading(true); load(); }} /></View></View> : <ScrollView style={styles.list} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      {sales.length === 0 ? <View style={[styles.empty, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Ionicons name="cart-outline" size={34} color={colors.muted} /><Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Nenhuma venda registrada</Text><Text style={[styles.emptyText, { color: colors.muted }]}>Registre a primeira venda para acompanhar o faturamento.</Text></View> : sales.map((sale) => {
        const pending = sale.payment_status === "Aguardando pagamento";
        return <View key={sale.id} testID={`sale-item-${sale.id}`} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <View style={styles.cardTop}><View style={styles.cardInfo}><Text style={[styles.date, { color: colors.onSurface }]}>{new Date(sale.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</Text><Text style={[styles.items, { color: colors.muted }]} numberOfLines={2}>{sale.channel === "loja" && sale.client_name ? `${sale.client_name} • ` : ""}{sale.items.map((item) => `${item.quantity}× ${item.product_name}`).join(" · ")}</Text></View><View style={styles.chips}><View style={[styles.payChip, { backgroundColor: colors.brandSecondary }]}><Text style={[styles.payText, { color: colors.onBrandSecondary }]}>{sale.payment_method}</Text></View>{sale.channel === "loja" ? <View style={[styles.payChip, { backgroundColor: colors.brandTertiary }]}><Text style={[styles.payText, { color: colors.onBrandTertiary }]}>Loja</Text></View> : null}</View></View>
          <View style={[styles.cardBottom, { borderTopColor: colors.divider }]}>
            <View testID={`sale-status-${sale.id}`} style={[styles.statusChip, { backgroundColor: pending ? `${colors.warning}33` : `${colors.success}1A` }]}><View style={[styles.statusDot, { backgroundColor: pending ? colors.warning : colors.success }]} /><Text style={[styles.statusText, { color: pending ? colors.onWarning : colors.success }]}>{sale.payment_status ?? "Pago"}</Text></View>
            <Text style={[styles.profitText, { color: colors.success }]} numberOfLines={1}>Lucro {money(sale.profit)}</Text>
            <Text style={[styles.total, { color: colors.onSurface }]}>{money(sale.total)}</Text>
          </View>
          {pending ? <View style={styles.confirmWrap}><Button testID={`sale-pay-${sale.id}`} label="Confirmar pagamento" secondary loading={busy === sale.id} onPress={() => confirmPayment(sale)} /></View> : null}
        </View>;
      })}
    </ScrollView>}
  </Screen>;
}

const styles = StyleSheet.create({ summary: { minHeight: 110, borderRadius: 18, padding: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }, summaryLabel: { opacity: 0.8, fontSize: 11, fontWeight: "800", letterSpacing: 1 }, summaryValue: { fontSize: 26, fontWeight: "900", marginTop: 8 }, summaryRight: { alignItems: "flex-end", gap: 4 }, summaryMini: { opacity: 0.78, fontSize: 12 }, summaryProfit: { fontSize: 18, fontWeight: "800" }, loader: { marginTop: 40 }, list: { flex: 1, marginTop: 16 }, empty: { alignItems: "center", padding: 30, borderRadius: 16, borderWidth: 1, marginTop: 4 }, retry: { marginTop: 16, width: "100%" }, emptyTitle: { fontSize: 16, fontWeight: "800", marginTop: 12 }, emptyText: { fontSize: 13, textAlign: "center", lineHeight: 18, marginTop: 5 }, card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 10 }, cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }, cardInfo: { flex: 1 }, date: { fontSize: 14, fontWeight: "800" }, items: { fontSize: 12, lineHeight: 17, marginTop: 5 }, chips: { alignItems: "flex-end", gap: 6 }, payChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }, payText: { fontSize: 11, fontWeight: "800" }, cardBottom: { borderTopWidth: 1, marginTop: 12, paddingTop: 12, flexDirection: "row", alignItems: "center", gap: 8 }, statusChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }, statusDot: { width: 6, height: 6, borderRadius: 99 }, statusText: { fontSize: 11, fontWeight: "800" }, profitText: { flex: 1, fontSize: 12, fontWeight: "800", textAlign: "center" }, total: { fontSize: 16, fontWeight: "900" }, confirmWrap: { marginTop: 12 } });
