import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "@/src/api";
import { Button, Field, Header, Screen, money } from "@/src/components/ui";
import { useTheme } from "@/src/theme";
import type { Cashflow, Expense } from "@/src/types";

const expenseCategories = ["Aluguel", "Energia", "Pessoal", "Peças", "Internet", "Outros"];

export default function Cashbox() {
  const { colors } = useTheme();
  const [cursor, setCursor] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [flow, setFlow] = useState<Cashflow | null>(null); const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState("");
  const [desc, setDesc] = useState(""); const [amount, setAmount] = useState(""); const [category, setCategory] = useState("Aluguel"); const [saving, setSaving] = useState(false); const [formError, setFormError] = useState("");
  const monthKey = useMemo(() => `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`, [cursor]);
  const monthLabel = useMemo(() => { const label = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return label.charAt(0).toUpperCase() + label.slice(1); }, [cursor]);
  const load = useCallback(async () => { try { setError(""); const [flowData, expenseData] = await Promise.all([api.getCashflow(monthKey), api.listExpenses(monthKey)]); setFlow(flowData); setExpenses(expenseData); } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível carregar o caixa."); } finally { setLoading(false); setRefreshing(false); } }, [monthKey]);
  useEffect(() => { setLoading(true); load(); }, [load]);
  const shiftMonth = (delta: number) => setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  const addExpense = async () => { const value = Number(amount.replace(",", ".")) || 0; if (!desc.trim() || value <= 0) return setFormError("Informe a descrição e um valor maior que zero."); setSaving(true); setFormError(""); try { await api.createExpense({ description: desc.trim(), category, amount: value, month: monthKey }); setDesc(""); setAmount(""); await load(); } catch (err) { setFormError(err instanceof Error ? err.message : "Não foi possível salvar a despesa."); } finally { setSaving(false); } };
  const removeExpense = async (expense: Expense) => { try { await api.deleteExpense(expense.id); setExpenses((current) => current.filter((item) => item.id !== expense.id)); if (flow) setFlow({ ...flow, expenses_total: Math.round((flow.expenses_total - expense.amount) * 100) / 100, balance: Math.round((flow.balance + expense.amount) * 100) / 100 }); } catch { setFormError("Não foi possível excluir a despesa."); } };
  const balance = flow?.balance ?? 0;
  return <Screen><Header title="Caixa" subtitle="Fluxo de caixa e despesas mensais." />
    <View style={styles.monthRow}>
      <Pressable testID="month-prev" accessibilityRole="button" onPress={() => shiftMonth(-1)} style={[styles.monthBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Ionicons name="chevron-back" size={18} color={colors.onSurface} /></Pressable>
      <Text testID="month-label" style={[styles.monthLabel, { color: colors.onSurface }]}>{monthLabel}</Text>
      <Pressable testID="month-next" accessibilityRole="button" onPress={() => shiftMonth(1)} style={[styles.monthBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Ionicons name="chevron-forward" size={18} color={colors.onSurface} /></Pressable>
    </View>
    {loading ? <ActivityIndicator color={colors.brandPrimary} style={styles.loader} /> : error ? <View style={[styles.empty, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Ionicons name="cloud-offline-outline" size={34} color={colors.error} /><Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Não foi possível carregar</Text><Text style={[styles.emptyText, { color: colors.muted }]}>{error}</Text><View style={styles.retry}><Button testID="cashbox-retry" label="Tentar novamente" secondary onPress={() => { setLoading(true); load(); }} /></View></View> : <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      <View style={[styles.balanceCard, { backgroundColor: balance >= 0 ? colors.brandPrimary : colors.error }]}>
        <Text style={[styles.balanceLabel, { color: colors.onBrandPrimary }]}>SALDO DO MÊS</Text>
        <Text testID="cash-balance" style={[styles.balanceValue, { color: colors.onBrandPrimary }]}>{money(balance)}</Text>
        <Text style={[styles.balanceHint, { color: colors.onBrandPrimary }]}>entradas menos despesas</Text>
      </View>
      <View style={styles.flowGrid}>
        {([{ label: "Vendas", value: flow?.sales_total ?? 0, icon: "cart" }, { label: "OS entregues", value: flow?.orders_revenue ?? 0, icon: "construct" }, { label: "Despesas", value: flow?.expenses_total ?? 0, icon: "trending-down" }] as const).map((item) => <View key={item.label} style={[styles.flowCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Ionicons name={item.icon} size={17} color={colors.brandPrimary} /><Text testID={`flow-${item.label === "Vendas" ? "sales" : item.label === "OS entregues" ? "orders" : "expenses"}`} style={[styles.flowValue, { color: colors.onSurface }]}>{money(item.value)}</Text><Text style={[styles.flowLabel, { color: colors.muted }]}>{item.label}</Text></View>)}
      </View>
      <View style={[styles.formCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        <Text style={[styles.formTitle, { color: colors.onSurface }]}>Adicionar despesa</Text>
        <Field testID="expense-desc" label="Descrição" value={desc} onChangeText={setDesc} placeholder="Ex.: Aluguel da loja" />
        <Field testID="expense-amount" label="Valor" value={amount} onChangeText={setAmount} placeholder="0,00" keyboardType="numeric" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>{expenseCategories.map((item) => <Pressable key={item} testID={`expense-cat-${item.toLowerCase()}`} accessibilityRole="button" onPress={() => setCategory(item)} style={[styles.catChip, { backgroundColor: category === item ? colors.brandPrimary : colors.surfaceTertiary, borderColor: category === item ? colors.brandPrimary : colors.border }]}><Text style={[styles.catText, { color: category === item ? colors.onBrandPrimary : colors.onSurfaceTertiary }]}>{item}</Text></Pressable>)}</ScrollView>
        {formError ? <Text accessibilityLiveRegion="polite" style={[styles.formError, { color: colors.error }]}>{formError}</Text> : null}
        <Button testID="expense-add" label="Salvar despesa" onPress={addExpense} loading={saving} icon="add" />
      </View>
      <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Despesas de {monthLabel}</Text>
      {expenses.length === 0 ? <Text style={[styles.emptyList, { color: colors.muted }]}>Nenhuma despesa lançada neste mês.</Text> : expenses.map((expense) => <View key={expense.id} testID={`expense-row-${expense.id}`} style={[styles.expenseRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        <View style={styles.expenseInfo}><Text style={[styles.expenseDesc, { color: colors.onSurface }]} numberOfLines={1}>{expense.description}</Text><Text style={[styles.expenseCat, { color: colors.muted }]}>{expense.category}</Text></View>
        <Text style={[styles.expenseAmount, { color: colors.error }]}>- {money(expense.amount)}</Text>
        <Pressable testID={`expense-delete-${expense.id}`} accessibilityRole="button" onPress={() => removeExpense(expense)} style={styles.deleteBtn}><Ionicons name="trash-outline" size={18} color={colors.error} /></Pressable>
      </View>)}
    </ScrollView>}
  </Screen>;
}

const styles = StyleSheet.create({ monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }, monthBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" }, monthLabel: { fontSize: 17, fontWeight: "800" }, loader: { marginTop: 40 }, empty: { alignItems: "center", padding: 30, borderRadius: 16, borderWidth: 1, marginTop: 4 }, retry: { marginTop: 16, width: "100%" }, emptyTitle: { fontSize: 16, fontWeight: "800", marginTop: 12 }, emptyText: { fontSize: 13, textAlign: "center", lineHeight: 18, marginTop: 5 }, balanceCard: { borderRadius: 18, padding: 20, marginBottom: 12 }, balanceLabel: { opacity: 0.8, fontSize: 11, fontWeight: "800", letterSpacing: 1 }, balanceValue: { fontSize: 30, fontWeight: "900", marginTop: 8 }, balanceHint: { opacity: 0.75, fontSize: 12, marginTop: 3 }, flowGrid: { flexDirection: "row", gap: 10, marginBottom: 16 }, flowCard: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 13, gap: 6 }, flowValue: { fontSize: 15, fontWeight: "900" }, flowLabel: { fontSize: 11, fontWeight: "700" }, formCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 20 }, formTitle: { fontSize: 16, fontWeight: "800", marginBottom: 12 }, catRow: { gap: 8, paddingBottom: 14 }, catChip: { minHeight: 36, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 }, catText: { fontSize: 12, fontWeight: "700" }, formError: { fontSize: 13, marginBottom: 12 }, sectionTitle: { fontSize: 17, fontWeight: "800", marginBottom: 10 }, emptyList: { fontSize: 13, lineHeight: 18 }, expenseRow: { borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 10 }, expenseInfo: { flex: 1 }, expenseDesc: { fontSize: 14, fontWeight: "700" }, expenseCat: { fontSize: 12, marginTop: 2 }, expenseAmount: { fontSize: 14, fontWeight: "800" }, deleteBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" } });
