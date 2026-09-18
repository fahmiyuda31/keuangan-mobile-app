import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTransactionStore, useCategoryStore } from '@/store';
import { Transaction } from '@/database/models';
import { useTheme, Theme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import AddTransactionModal from '@/components/AddTransactionModal';
import { Input } from '@/components/ui';

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const DAY_MS = 24 * 60 * 60 * 1000;

type ActiveFilter =
  | { kind: 'day'; date: Date }
  | { kind: 'week'; start: Date }
  | { kind: 'month'; month: number; year: number }
  | { kind: 'range'; start: Date; end: Date }
  | null;

type DraftMode = 'range' | 'day' | 'week' | 'month';
type QuickKey = 'today' | 'week' | 'month';

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const weekStartOf = (d: Date) => {
  const day = d.getDay() === 0 ? 7 : d.getDay();
  const start = startOfDay(d);
  start.setDate(start.getDate() - day + 1);
  return start;
};
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
const dateKey = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const toDateInput = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const parseDateInput = (v: string) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
const formatShort = (d: Date) => `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
const formatWeek = (start: Date) => {
  const end = new Date(start.getTime() + 6 * DAY_MS);
  return `${start.getDate()} ${MONTH_NAMES[start.getMonth()]} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
};

function WebDateInput({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const [text, setText] = useState(toDateInput(value));
  const prevKey = useRef(toDateInput(value));
  useEffect(() => {
    const key = toDateInput(value);
    if (key !== prevKey.current) {
      prevKey.current = key;
      setText(key);
    }
  }, [value]);
  return (
    <Input
      value={text}
      onChangeText={(v) => {
        setText(v);
        const d = parseDateInput(v);
        if (d) onChange(d);
      }}
      placeholder="YYYY-MM-DD"
    />
  );
}

export default function TransactionsScreen() {
  const { transactions, removeTransaction, removeTransactions } = useTransactionStore();
  const { categories } = useCategoryStore();
  const colors = useTheme();
  const t = useT();
  const styles = createStyles(colors);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const [draftMode, setDraftMode] = useState<DraftMode>('range');
  const [draftDay, setDraftDay] = useState(new Date());
  const [draftWeekStart, setDraftWeekStart] = useState(weekStartOf(new Date()));
  const [draftMonth, setDraftMonth] = useState(new Date().getMonth());
  const [draftYear, setDraftYear] = useState(new Date().getFullYear());
  const [draftStart, setDraftStart] = useState(new Date());
  const [draftEnd, setDraftEnd] = useState(new Date());
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const categoryName = (name: string) => categories.find((c) => c.name === name)?.name ?? name;

  const years = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    for (const tx of transactions) {
      set.add(new Date(tx.date).getFullYear());
    }
    return [...set].sort((a, b) => b - a);
  }, [transactions]);

  const weekOptions = useMemo(() => {
    const now = new Date();
    const map = new Map<number, Date>();
    const addWeek = (d: Date) => {
      const start = weekStartOf(d);
      map.set(start.getTime(), start);
    };
    addWeek(now);
    for (const tx of transactions) addWeek(new Date(tx.date));
    return [...map.values()].sort((a, b) => b.getTime() - a.getTime());
  }, [transactions]);

  const filtered = useMemo(() => {
    const sorted = [...transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    if (!activeFilter) return sorted;
    return sorted.filter((tx) => {
      const d = new Date(tx.date);
      switch (activeFilter.kind) {
        case 'day':
          return dateKey(d) === dateKey(activeFilter.date);
        case 'week':
          return (
            dateKey(d) >= dateKey(activeFilter.start) &&
            dateKey(d) <= dateKey(new Date(activeFilter.start.getTime() + 6 * DAY_MS))
          );
        case 'month':
          return d.getFullYear() === activeFilter.year && d.getMonth() === activeFilter.month;
        case 'range':
          return (
            dateKey(d) >= dateKey(activeFilter.start) && dateKey(d) <= dateKey(activeFilter.end)
          );
      }
    });
  }, [transactions, activeFilter]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of filtered) {
      if (tx.type === 'income') income += tx.amount;
      else expense += tx.amount;
    }
    const remaining = income - expense;
    const savingsPercent = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
    return { income, expense, remaining, savingsPercent };
  }, [filtered]);

  const openAdd = () => {
    setEditing(null);
    setShowAddModal(true);
  };

  const openEdit = (tx: Transaction) => {
    setEditing(tx);
    setShowAddModal(true);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((tx) => tx.id)));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleDelete = (tx: Transaction) => {
    Alert.alert(
      t('deleteTransactionTitle'),
      t('deleteTransactionMsg').replace('{name}', tx.description),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => removeTransaction(tx.id),
        },
      ]
    );
  };

  const handleDeleteSelected = () => {
    const count = selectedIds.size;
    Alert.alert(
      t('deleteSelectedTitle').replace('{count}', count.toString()),
      t('deleteSelectedMsg').replace('{count}', count.toString()),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('deleteSelected'),
          style: 'destructive',
          onPress: () => {
            removeTransactions([...selectedIds]);
            exitSelectMode();
          },
        },
      ]
    );
  };

  const selectedCount = selectedIds.size;

  const toggleQuick = (key: QuickKey) => {
    const now = new Date();
    if (key === 'today') {
      setActiveFilter((prev) =>
        prev && prev.kind === 'day' && isSameDay(prev.date, now) ? null : { kind: 'day', date: now }
      );
    } else if (key === 'week') {
      const start = weekStartOf(now);
      setActiveFilter((prev) =>
        prev && prev.kind === 'week' && prev.start.getTime() === start.getTime()
          ? null
          : { kind: 'week', start }
      );
    } else {
      const m = now.getMonth();
      const y = now.getFullYear();
      setActiveFilter((prev) =>
        prev && prev.kind === 'month' && prev.month === m && prev.year === y
          ? null
          : { kind: 'month', month: m, year: y }
      );
    }
  };

  const isQuickActive = (key: QuickKey) => {
    if (!activeFilter) return false;
    const now = new Date();
    if (key === 'today') return activeFilter.kind === 'day' && isSameDay(activeFilter.date, now);
    if (key === 'week') {
      return (
        activeFilter.kind === 'week' && activeFilter.start.getTime() === weekStartOf(now).getTime()
      );
    }
    return (
      activeFilter.kind === 'month' &&
      activeFilter.month === now.getMonth() &&
      activeFilter.year === now.getFullYear()
    );
  };

  const openFilterModal = () => {
    const now = new Date();
    setDraftMode('range');
    setDraftStart(new Date(now.getFullYear(), now.getMonth(), 1));
    setDraftEnd(now);
    setDraftDay(now);
    setDraftWeekStart(weekStartOf(now));
    setDraftMonth(now.getMonth());
    setDraftYear(now.getFullYear());

    if (activeFilter) {
      if (activeFilter.kind === 'day') {
        setDraftMode('day');
        setDraftDay(activeFilter.date);
      } else if (activeFilter.kind === 'week') {
        setDraftMode('week');
        setDraftWeekStart(activeFilter.start);
      } else if (activeFilter.kind === 'month') {
        setDraftMode('month');
        setDraftMonth(activeFilter.month);
        setDraftYear(activeFilter.year);
      } else {
        setDraftMode('range');
        setDraftStart(activeFilter.start);
        setDraftEnd(activeFilter.end);
      }
    }
    setShowFilterModal(true);
  };

  const applyDraft = () => {
    if (draftMode === 'day') {
      setActiveFilter({ kind: 'day', date: draftDay });
    } else if (draftMode === 'week') {
      setActiveFilter({ kind: 'week', start: draftWeekStart });
    } else if (draftMode === 'month') {
      setActiveFilter({ kind: 'month', month: draftMonth, year: draftYear });
    } else {
      let start = startOfDay(draftStart);
      let end = startOfDay(draftEnd);
      if (end.getTime() < start.getTime()) [start, end] = [end, start];
      setActiveFilter({ kind: 'range', start, end });
    }
    setShowFilterModal(false);
  };

  const clearFilter = () => {
    setActiveFilter(null);
    setShowFilterModal(false);
  };

  const filterLabel = () => {
    if (!activeFilter) return t('allTransactions');
    switch (activeFilter.kind) {
      case 'day':
        return formatShort(activeFilter.date);
      case 'week':
        return isSameDay(activeFilter.start, weekStartOf(new Date()))
          ? `${t('thisWeek')} · ${formatWeek(activeFilter.start)}`
          : formatWeek(activeFilter.start);
      case 'month':
        return `${MONTH_NAMES[activeFilter.month]} ${activeFilter.year}`;
      case 'range':
        return `${formatShort(activeFilter.start)} – ${formatShort(activeFilter.end)}`;
    }
  };

  const formatCurrency = (amount: number) =>
    `Rp ${amount.toLocaleString('id-ID')}`;

  const formatDate = (d: Date) =>
    `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;

  const generateExportText = (format: 'table' | 'text' | 'json') => {
    const label = filterLabel();
    const header = `Transaksi: ${label}\nTotal: Pemasukan ${formatCurrency(totals.income)} | Pengeluaran ${formatCurrency(totals.expense)} | Sisa ${formatCurrency(totals.remaining)} (${totals.savingsPercent}%)\n`;

    if (format === 'json') {
      const data = filtered.map((tx) => ({
        tanggal: new Date(tx.date).toISOString().split('T')[0],
        deskripsi: tx.description,
        kategori: tx.category,
        tipe: tx.type === 'income' ? 'pemasukan' : 'pengeluaran',
        jumlah: tx.amount,
        catatan: tx.notes || '',
      }));
      return JSON.stringify(data, null, 2);
    }

    if (format === 'table') {
      let rows = '| Tanggal | Deskripsi | Kategori | Tipe | Jumlah |\n';
      rows += '|---------|-----------|----------|------|--------|\n';
      for (const tx of filtered) {
        const date = formatDate(new Date(tx.date));
        const type = tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
        const amount = formatCurrency(tx.amount);
        rows += `| ${date} | ${tx.description} | ${tx.category} | ${type} | ${amount} |\n`;
      }
      return header + '\n' + rows;
    }

    let rows = '';
    for (const tx of filtered) {
      const date = formatDate(new Date(tx.date));
      const type = tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
      const amount = formatCurrency(tx.amount);
      const note = tx.notes ? ` (${tx.notes})` : '';
      rows += `- [${type}] ${tx.description} (${tx.category}): ${amount} | ${date}${note}\n`;
    }
    return header + '\n' + rows;
  };

  const handleCopy = async (format: 'table' | 'text' | 'json') => {
    try {
      const text = generateExportText(format);
      await Clipboard.setStringAsync(text);
      Alert.alert(t('success'), t('exportCopied'));
    } catch {
      Alert.alert(t('error'), t('exportCopyFailed'));
    }
    setShowExportModal(false);
  };

  const renderDatePicker = (
    value: Date,
    onChange: (d: Date) => void,
    visible: boolean,
    hide: () => void,
    show: () => void
  ) => (
    <>
      {Platform.OS === 'web' ? (
        <WebDateInput value={value} onChange={onChange} />
      ) : (
        <>
          <TouchableOpacity style={styles.dateButton} onPress={show}>
            <Text style={styles.dateButtonText}>{formatShort(value)}</Text>
          </TouchableOpacity>
          {visible && (
            <DateTimePicker
              value={value}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(event, selected) => {
                hide();
                if (selected) onChange(selected);
              }}
            />
          )}
        </>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('transactions')}</Text>
        <View style={styles.headerRight}>
          {selectMode ? (
            <TouchableOpacity style={styles.headerIconBtn} onPress={exitSelectMode}>
              <Ionicons name="close-circle-outline" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => setSelectMode(true)}>
              <Ionicons name="checkmark-circle-outline" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setShowExportModal(true)}>
            <Ionicons name="copy-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={openAdd}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addButtonText}>{t('add')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.filterBar} onPress={openFilterModal}>
        <Text style={styles.filterLabel}>{filterLabel()}</Text>
        <Text style={styles.filterChevron}>▼</Text>
      </TouchableOpacity>

      <View style={styles.quickFilterBar}>
        {(
          [
            { key: 'today', label: t('today') },
            { key: 'week', label: t('thisWeek') },
            { key: 'month', label: t('thisMonth') },
          ] as const
        ).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.quickFilterItem, isQuickActive(key) && styles.quickFilterItemActive]}
            onPress={() => toggleQuick(key)}
          >
            <Text
              style={[styles.quickFilterText, isQuickActive(key) && styles.quickFilterTextActive]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.totalBar}>
        <View style={styles.totalItem}>
          <Text style={[styles.totalLabel, { color: colors.success }]}>{t('income')}</Text>
          <Text style={[styles.totalValue, { color: colors.success }]}>
            + Rp {totals.income.toLocaleString('id-ID')}
          </Text>
        </View>
        <View style={styles.totalItem}>
          <Text style={[styles.totalLabel, { color: colors.danger }]}>{t('expense')}</Text>
          <Text style={[styles.totalValue, { color: colors.danger }]}>
            - Rp {totals.expense.toLocaleString('id-ID')}
          </Text>
        </View>
        <View style={styles.totalItem}>
          <Text style={[styles.totalLabel, { color: colors.primary }]}>{t('savings')}</Text>
          <Text
            style={[
              styles.totalValue,
              { color: totals.remaining >= 0 ? colors.success : colors.danger },
            ]}
          >
            {totals.remaining >= 0 ? '+' : '-'} Rp{' '}
            {Math.abs(totals.remaining).toLocaleString('id-ID')}
          </Text>
        </View>
        <View style={styles.totalItem}>
          <Text style={[styles.totalLabel, { color: colors.textMuted }]}>
            {t('savingsPercent')}
          </Text>
          <Text
            style={[
              styles.totalValue,
              { color: totals.savingsPercent >= 0 ? colors.success : colors.danger },
            ]}
          >
            {totals.savingsPercent}%
          </Text>
        </View>
      </View>

      {selectMode && filtered.length > 0 && (
        <View style={styles.selectBar}>
          <TouchableOpacity onPress={toggleSelectAll}>
            <Text style={styles.selectAllText}>
              {selectedCount === filtered.length ? t('deselectAll') : t('selectAll')}
            </Text>
          </TouchableOpacity>
          {selectedCount > 0 && (
            <TouchableOpacity onPress={handleDeleteSelected}>
              <Text style={styles.deleteSelectedText}>
                {t('deleteSelected')} ({selectedCount})
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>{t('emptyTransactions')}</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            {selectMode && (
              <TouchableOpacity onPress={() => toggleSelect(item.id)} style={styles.checkbox}>
                <View
                  style={[styles.checkboxBox, selectedIds.has(item.id) && styles.checkboxChecked]}
                >
                  {selectedIds.has(item.id) && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>
            )}
            <View style={styles.rowInfo}>
              <Text style={styles.rowName}>{item.description}</Text>
              <Text style={styles.rowSub}>
                {categoryName(item.category)} · {new Date(item.date).toLocaleDateString('id-ID')}
              </Text>
            </View>
            <Text
              style={[
                styles.rowAmount,
                { color: item.type === 'income' ? colors.success : colors.danger },
              ]}
            >
              {item.type === 'income' ? '+' : '-'} Rp {item.amount.toLocaleString()}
            </Text>
            {!selectMode && (
              <View style={styles.rowActions}>
                <TouchableOpacity onPress={() => openEdit(item)}>
                  <Text style={styles.editText}>{t('edit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)}>
                  <Text style={styles.deleteText}>{t('delete')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      />

      <AddTransactionModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        editing={editing}
      />

      <Modal visible={showFilterModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowFilterModal(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('filterTransactions')}</Text>

            <View style={styles.modeTabs}>
              {(
                [
                  { key: 'range', label: t('range') },
                  { key: 'day', label: t('day') },
                  { key: 'week', label: t('week') },
                  { key: 'month', label: t('month') },
                ] as const
              ).map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.modeTab, draftMode === key && styles.modeTabActive]}
                  onPress={() => setDraftMode(key)}
                >
                  <Text style={[styles.modeTabText, draftMode === key && styles.modeTabTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {draftMode === 'range' && (
              <View style={styles.modeBody}>
                <Text style={styles.fieldLabel}>{t('startDate')}</Text>
                {renderDatePicker(
                  draftStart,
                  setDraftStart,
                  showStartPicker,
                  () => setShowStartPicker(false),
                  () => setShowStartPicker(true)
                )}
                <Text style={styles.fieldLabel}>{t('endDate')}</Text>
                {renderDatePicker(
                  draftEnd,
                  setDraftEnd,
                  showEndPicker,
                  () => setShowEndPicker(false),
                  () => setShowEndPicker(true)
                )}
              </View>
            )}

            {draftMode === 'day' && (
              <View style={styles.modeBody}>
                {renderDatePicker(
                  draftDay,
                  setDraftDay,
                  showDayPicker,
                  () => setShowDayPicker(false),
                  () => setShowDayPicker(true)
                )}
              </View>
            )}

            {draftMode === 'week' && (
              <FlatList
                data={weekOptions}
                keyExtractor={(item) => String(item.getTime())}
                style={styles.modeList}
                contentContainerStyle={styles.modeListContent}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.weekItem,
                      draftWeekStart.getTime() === item.getTime() && styles.weekItemActive,
                    ]}
                    onPress={() => setDraftWeekStart(item)}
                  >
                    <Text
                      style={[
                        styles.weekText,
                        draftWeekStart.getTime() === item.getTime() && styles.weekTextActive,
                      ]}
                    >
                      {isSameDay(item, weekStartOf(new Date()))
                        ? `${t('thisWeek')} · ${formatWeek(item)}`
                        : formatWeek(item)}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}

            {draftMode === 'month' && (
              <View style={styles.modeBody}>
                <FlatList
                  data={[...years].sort((a, b) => a - b)}
                  keyExtractor={(item) => String(item)}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.yearList}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.yearItem, draftYear === item && styles.yearItemActive]}
                      onPress={() => setDraftYear(item)}
                    >
                      <Text style={[styles.yearText, draftYear === item && styles.yearTextActive]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
                <FlatList
                  data={MONTH_NAMES.map((name, idx) => ({ name, idx }))}
                  keyExtractor={(item) => String(item.idx)}
                  style={styles.modeList}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.modeListContent}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.monthItem, draftMonth === item.idx && styles.monthItemActive]}
                      onPress={() => setDraftMonth(item.idx)}
                    >
                      <Text
                        style={[
                          styles.monthText,
                          draftMonth === item.idx && styles.monthTextActive,
                        ]}
                      >
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={clearFilter} style={styles.modalClearButton}>
                <Text style={styles.modalClearText}>{t('clearFilter')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={applyDraft} style={styles.modalApplyButton}>
                <Text style={styles.modalApplyText}>{t('apply')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showExportModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowExportModal(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('exportFormat')}</Text>

            <TouchableOpacity
              style={styles.exportOption}
              onPress={() => handleCopy('table')}
            >
              <Text style={styles.exportOptionTitle}>{t('exportTable')}</Text>
              <Text style={styles.exportOptionDesc}>
                Format tabel markdown, cocok untuk paste ke AI
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exportOption}
              onPress={() => handleCopy('text')}
            >
              <Text style={styles.exportOptionTitle}>{t('exportText')}</Text>
              <Text style={styles.exportOptionDesc}>
                Format list terstruktur dengan bullet points
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exportOption}
              onPress={() => handleCopy('json')}
            >
              <Text style={styles.exportOptionTitle}>{t('exportJson')}</Text>
              <Text style={styles.exportOptionDesc}>
                Format JSON untuk AI yang lebih advanced
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowExportModal(false)}
                style={styles.modalClearButton}
              >
                <Text style={styles.modalClearText}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.screen,
    },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.text,
      flexShrink: 1,
    },
    headerIconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.backgroundElement,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      gap: 4,
    },
    addButtonText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
    },
    filterBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 10,
      backgroundColor: colors.backgroundElement,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    filterLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    filterChevron: {
      fontSize: 12,
      color: colors.textMuted,
      marginLeft: 8,
    },
    quickFilterBar: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingVertical: 8,
      gap: 8,
      backgroundColor: colors.backgroundElement,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    quickFilterItem: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    quickFilterItemActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    quickFilterText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    quickFilterTextActive: {
      color: '#fff',
    },
    totalBar: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
    },
    totalItem: {
      flex: 1,
      alignItems: 'center',
    },
    totalLabel: {
      fontSize: 11,
      fontWeight: '600',
      marginBottom: 2,
    },
    totalValue: {
      fontSize: 13,
      fontWeight: '700',
    },
    selectBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 8,
      backgroundColor: colors.backgroundElement,
    },
    selectAllText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '600',
    },
    deleteSelectedText: {
      fontSize: 13,
      color: colors.danger,
      fontWeight: '600',
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    emptyText: {
      textAlign: 'center',
      color: colors.textMuted,
      marginTop: 32,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
    },
    checkbox: {
      marginRight: 10,
    },
    checkboxBox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkmark: {
      color: '#fff',
      fontSize: 13,
      fontWeight: 'bold',
    },
    rowInfo: {
      flex: 1,
      marginRight: 8,
    },
    rowName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    rowSub: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    rowAmount: {
      fontSize: 13,
      fontWeight: '600',
    },
    rowActions: {
      marginLeft: 12,
      flexDirection: 'row',
      gap: 12,
    },
    editText: {
      color: colors.primary,
      fontSize: 13,
    },
    deleteText: {
      color: colors.danger,
      fontSize: 13,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      width: '100%',
      maxHeight: '80%',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    modeTabs: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 16,
    },
    modeTab: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundElement,
      alignItems: 'center',
    },
    modeTabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    modeTabText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    modeTabTextActive: {
      color: '#fff',
    },
    modeBody: {
      flexGrow: 0,
    },
    modeList: {
      maxHeight: 260,
      flexGrow: 0,
    },
    modeListContent: {
      paddingVertical: 8,
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginTop: 8,
      marginBottom: 4,
    },
    dateButton: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundElement,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginBottom: 8,
    },
    dateButtonText: {
      fontSize: 14,
      color: colors.text,
    },
    yearList: {
      paddingBottom: 12,
    },
    yearItem: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundElement,
      marginRight: 8,
    },
    yearItemActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    yearText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    yearTextActive: {
      color: '#fff',
    },
    weekItem: {
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    weekItemActive: {
      backgroundColor: colors.backgroundElement,
    },
    weekText: {
      fontSize: 15,
      color: colors.text,
    },
    weekTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    monthItem: {
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    monthItemActive: {
      backgroundColor: colors.backgroundElement,
    },
    monthText: {
      fontSize: 15,
      color: colors.text,
    },
    monthTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 16,
      gap: 12,
    },
    modalClearButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    modalClearText: {
      color: colors.text,
      fontWeight: '600',
    },
    modalApplyButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    modalApplyText: {
      color: '#fff',
      fontWeight: '600',
    },
    exportOption: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    exportOptionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    exportOptionDesc: {
      fontSize: 12,
      color: colors.textMuted,
    },
  });
