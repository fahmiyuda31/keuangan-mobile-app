import React, { useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Dimensions,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { PieChart, BarChart } from 'react-native-chart-kit';
import { useTransactionStore, useCategoryStore, useBudgetStore } from '@/store';
import { Card, Button } from '@/components/ui';
import { useTheme, Theme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { expenseByCategory, periodTotals } from '@/utils/aggregate';
import { getPeriodRange, PeriodKey } from '@/utils';
import AddTransactionModal from '@/components/AddTransactionModal';

const PERIOD_OPTIONS: { key: PeriodKey; label: string; buckets: number }[] = [
  { key: 'day', label: 'daily', buckets: 7 },
  { key: 'week', label: 'weekly', buckets: 8 },
  { key: 'month', label: 'monthly', buckets: 6 },
  { key: 'year', label: 'yearly', buckets: 5 },
];

export default function DashboardScreen() {
  const { transactions } = useTransactionStore();
  const { categories } = useCategoryStore();
  const { budgets } = useBudgetStore();
  const colors = useTheme();
  const t = useT();
  const styles = createStyles(colors);
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const rangeTransactions = useMemo(() => {
    const { start, end } = getPeriodRange(period, selectedDate);
    const startTime = start.getTime();
    const endTime = end.getTime();
    return transactions.filter((tx) => {
      const time = new Date(tx.date).getTime();
      return time >= startTime && time <= endTime;
    });
  }, [transactions, period, selectedDate]);

  const summary = useMemo(() => {
    const income = rangeTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = rangeTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    return { totalIncome: income, totalExpense: expense, balance: income - expense };
  }, [rangeTransactions]);

  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5),
    [transactions]
  );

  const chartColors = ['#208AEF', '#ff6b6b', '#ffa502', '#4caf50', '#a55eea', '#17C0EB'];
  const chartData = expenseByCategory(rangeTransactions)
    .slice(0, 6)
    .map((item, index) => ({
      name: item.name,
      population: item.value,
      color: chartColors[index % chartColors.length],
      legendFontColor: colors.textSecondary,
      legendFontSize: 12,
    }));

  const activePeriod = PERIOD_OPTIONS.find((p) => p.key === period) ?? PERIOD_OPTIONS[2];
  const trendData = useMemo(
    () => periodTotals(transactions, period, activePeriod.buckets, selectedDate),
    [transactions, period, activePeriod.buckets, selectedDate]
  );

  const comparison = useMemo(() => {
    const { totalIncome, totalExpense } = summary;
    const max = Math.max(totalIncome, totalExpense, 1);
    const incomePct = Math.round((totalIncome / max) * 100);
    const expensePct = Math.round((totalExpense / max) * 100);
    const expenseOfIncome = totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : null;
    return { max, incomePct, expensePct, expenseOfIncome };
  }, [summary]);

  const barLabels = trendData.map((b) => b.label);
  const barDataset = {
    labels: barLabels,
    datasets: [
      { data: trendData.map((b) => b.income), color: () => colors.success },
      { data: trendData.map((b) => b.expense), color: () => colors.danger },
    ],
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('dashboard')}</Text>
        </View>

        <View style={styles.periodRow}>
          {PERIOD_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[styles.periodChip, period === option.key && styles.periodChipActive]}
              onPress={() => setPeriod(option.key)}
            >
              <Text
                style={[
                  styles.periodChipText,
                  period === option.key && styles.periodChipTextActive,
                ]}
              >
                {t(option.label)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.datePickerRow}>
          <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={styles.datePickerText}>
              {selectedDate.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </TouchableOpacity>
          {Platform.OS === 'web' ? (
            <input
              type="date"
              value={selectedDate.toISOString().split('T')[0]}
              onChange={(e) => {
                const date = new Date(e.target.value);
                if (!isNaN(date.getTime())) setSelectedDate(date);
              }}
              style={{
                padding: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.backgroundElement,
                fontSize: 14,
                color: colors.text,
              }}
            />
          ) : (
            showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) setSelectedDate(date);
                }}
              />
            )
          )}
        </View>

        <LinearGradient
          colors={['#208AEF', '#5FB4FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroLabel}>{t('balance')}</Text>
          <Text style={styles.heroBalance}>Rp {summary.balance.toLocaleString()}</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>{t('income')}</Text>
              <Text style={styles.heroStatValue}>+ Rp {summary.totalIncome.toLocaleString()}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>{t('expense')}</Text>
              <Text style={styles.heroStatValue}>- Rp {summary.totalExpense.toLocaleString()}</Text>
            </View>
          </View>
        </LinearGradient>

        <Card title={`${t('incomeVsExpense')} — ${t(activePeriod.label)}`} style={styles.statsCard}>
          <View style={styles.compareItem}>
            <View style={styles.compareLabelRow}>
              <Text style={styles.summaryLabel}>{t('income')}</Text>
              <Text style={styles.summaryLabel}>{comparison.incomePct}%</Text>
            </View>
            <View style={styles.compareTrack}>
              <View
                style={[
                  styles.compareFill,
                  {
                    width: `${comparison.incomePct}%`,
                    backgroundColor: colors.success,
                  },
                ]}
              />
            </View>
          </View>
          <View style={styles.compareItem}>
            <View style={styles.compareLabelRow}>
              <Text style={styles.summaryLabel}>{t('expense')}</Text>
              <Text style={styles.summaryLabel}>{comparison.expensePct}%</Text>
            </View>
            <View style={styles.compareTrack}>
              <View
                style={[
                  styles.compareFill,
                  {
                    width: `${comparison.expensePct}%`,
                    backgroundColor: colors.danger,
                  },
                ]}
              />
            </View>
          </View>
          {comparison.expenseOfIncome !== null && (
            <Text style={styles.compareRatio}>
              {t('expenseOfIncome').replace('{percent}', comparison.expenseOfIncome.toString())}
            </Text>
          )}
        </Card>

        <Card title={t('quickStats')} style={styles.statsCard}>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{t('transactions')}</Text>
              <Text style={styles.statValue}>{rangeTransactions.length}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{t('categories')}</Text>
              <Text style={styles.statValue}>{categories.length}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{t('activeBudgets')}</Text>
              <Text style={styles.statValue}>{budgets.length}</Text>
            </View>
          </View>
        </Card>

        {chartData.length > 0 && (
          <Card title={`${t('totalExpense')} — ${t(activePeriod.label)}`} style={styles.statsCard}>
            <PieChart
              data={chartData}
              width={Dimensions.get('window').width - 32}
              height={200}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="0"
              chartConfig={{
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                labelColor: () => colors.text,
              }}
            />
          </Card>
        )}

        {trendData.length > 0 && (
          <Card title={t('trend')} style={styles.statsCard}>
            <BarChart
              data={barDataset}
              width={Dimensions.get('window').width - 32}
              height={220}
              fromZero
              yAxisLabel="Rp "
              yAxisSuffix="k"
              chartConfig={{
                backgroundGradientFrom: colors.card,
                backgroundGradientTo: colors.card,
                decimalPlaces: 0,
                color: () => colors.primary,
                labelColor: () => colors.textSecondary,
                propsForLabels: { fontSize: 10 },
              }}
            />
          </Card>
        )}

        {recentTransactions.length > 0 && (
          <Card title={t('recentTransactions')}>
            {recentTransactions.map((transaction) => (
              <View key={transaction.id} style={styles.transactionItem}>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionDescription}>{transaction.description}</Text>
                  <Text style={styles.transactionDate}>
                    {new Date(transaction.date).toLocaleDateString()}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.transactionAmount,
                    {
                      color: transaction.type === 'income' ? colors.success : colors.danger,
                    },
                  ]}
                >
                  {transaction.type === 'income' ? '+' : '-'} Rp{' '}
                  {transaction.amount.toLocaleString()}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {transactions.length === 0 && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('noTransactions')}</Text>
            <Button
              title={t('addTransaction')}
              onPress={() => setShowAddModal(true)}
              style={styles.emptyButton}
            />
          </Card>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={30} color="#ffffff" />
      </TouchableOpacity>

      <AddTransactionModal visible={showAddModal} onClose={() => setShowAddModal(false)} />
    </SafeAreaView>
  );
}

const createStyles = (colors: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.screen,
    },
    content: {
      paddingBottom: 96,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.text,
    },
    periodRow: {
      flexDirection: 'row',
      gap: 8,
      marginHorizontal: 20,
      marginBottom: 8,
    },
    periodChip: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.chipBg,
    },
    periodChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    periodChipText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
    },
    periodChipTextActive: {
      color: '#fff',
      fontWeight: '600',
    },
    datePickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 16,
      marginBottom: 8,
    },
    datePickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.chipBg,
    },
    datePickerText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
    },
    hero: {
      borderRadius: 24,
      marginHorizontal: 16,
      marginTop: 8,
      padding: 20,
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 6,
    },
    heroLabel: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.75)',
    },
    heroBalance: {
      fontSize: 30,
      fontWeight: '700',
      color: '#ffffff',
      marginVertical: 8,
    },
    heroRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 4,
    },
    heroStat: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderRadius: 16,
      padding: 12,
    },
    heroStatLabel: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.7)',
      marginBottom: 4,
    },
    heroStatValue: {
      fontSize: 15,
      fontWeight: '700',
      color: '#ffffff',
    },
    statsCard: {
      marginTop: 12,
    },
    compareItem: {
      marginBottom: 12,
    },
    summaryLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 4,
    },
    compareLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    compareTrack: {
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.chipBg,
      overflow: 'hidden',
    },
    compareFill: {
      height: '100%',
      borderRadius: 5,
    },
    compareRatio: {
      marginTop: 4,
      fontSize: 13,
      color: colors.textMuted,
    },
    fab: {
      position: 'absolute',
      right: 20,
      bottom: 24,
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 8,
    },
    statsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    statItem: {
      alignItems: 'center',
    },
    statLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.primary,
    },
    transactionItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    transactionInfo: {
      flex: 1,
    },
    transactionDescription: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 4,
    },
    transactionDate: {
      fontSize: 12,
      color: colors.textMuted,
    },
    transactionAmount: {
      fontSize: 14,
      fontWeight: '600',
    },
    emptyCard: {
      marginTop: 32,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 32,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 16,
    },
    emptyButton: {
      marginTop: 8,
    },
  });
