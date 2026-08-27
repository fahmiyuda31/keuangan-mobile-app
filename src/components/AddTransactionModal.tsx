import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Modal, Input, Button } from '@/components/ui';
import { useTransactionStore, useCategoryStore } from '@/store';
import { Transaction } from '@/database/models';
import { useTheme, Theme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import {
  parseTransactionWithAI,
  parseReceiptWithAI,
  ParsedTransaction,
} from '@/services/aiService';
import { generateId } from '@/utils';

const AI_CATEGORY_MAP: Record<string, string> = {
  Food: 'Makanan',
  Transport: 'Transportasi',
  Entertainment: 'Hiburan',
  Utilities: 'Utilitas',
  Health: 'Kesehatan',
  Education: 'Pendidikan',
  Shopping: 'Belanja',
  Salary: 'Gaji',
  Other: 'Lainnya',
};

interface AddTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  editing?: Transaction | null;
}

export default function AddTransactionModal({
  visible,
  onClose,
  editing = null,
}: AddTransactionModalProps) {
  const { addTransaction, updateTransaction, findDuplicate } = useTransactionStore();
  const { categories } = useCategoryStore();
  const colors = useTheme();
  const t = useT();
  const styles = createStyles(colors);

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [date, setDate] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [aiInput, setAiInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const resetForm = () => {
    setAmount('');
    setDescription('');
    setCategory('');
    setType('expense');
    setDate(new Date());
    setNotes('');
    setAiInput('');
  };

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setAmount(editing.amount.toString());
      setDescription(editing.description);
      setCategory(editing.category);
      setType(editing.type);
      setDate(editing.date);
      setNotes(editing.notes ?? '');
      setAiInput('');
    } else {
      resetForm();
    }
  }, [visible, editing]);

  const applyParsed = (parsed: ParsedTransaction) => {
    setAmount(parsed.amount.toString());
    setDescription(parsed.description);
    setType(parsed.type);
    const mappedName = AI_CATEGORY_MAP[parsed.category] ?? parsed.category;
    const localMatch = categories.find((c) => c.name === mappedName && c.type === parsed.type);
    setCategory(localMatch ? localMatch.name : mappedName);
  };

  const handleSave = () => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert(t('error'), t('validAmount'));
      return;
    }
    if (!description.trim()) {
      Alert.alert(t('error'), t('validDescription'));
      return;
    }
    if (!category) {
      Alert.alert(t('error'), t('validCategory'));
      return;
    }

    const now = new Date();
    const trimmedNotes = notes.trim() || undefined;
    const trimmedDescription = description.trim();

    const save = () => {
      if (editing) {
        updateTransaction(editing.id, {
          amount: numericAmount,
          description: trimmedDescription,
          category,
          type,
          date,
          notes: trimmedNotes,
          updatedAt: now,
        });
      } else {
        addTransaction({
          id: generateId(),
          amount: numericAmount,
          description: trimmedDescription,
          category,
          type,
          date,
          notes: trimmedNotes,
          createdAt: now,
          updatedAt: now,
        });
      }
      resetForm();
      onClose();
      Alert.alert(t('success'), t('transactionSaved'));
    };

    if (editing) {
      save();
      return;
    }

    const duplicate = findDuplicate({
      amount: numericAmount,
      description: trimmedDescription,
      date,
      type,
    });

    if (duplicate) {
      Alert.alert(
        t('duplicateTransactionTitle'),
        t('duplicateTransactionMsg').replace('{description}', trimmedDescription),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('duplicateTransactionContinue'),
            onPress: save,
          },
        ]
      );
      return;
    }

    save();
  };

  const handleAiParse = async () => {
    if (!aiInput.trim()) {
      Alert.alert(t('error'), t('aiParsePrompt'));
      return;
    }

    setIsLoading(true);
    try {
      applyParsed(await parseTransactionWithAI(aiInput.trim()));
    } catch (error: any) {
      Alert.alert(t('aiError'), error.message || t('aiParseFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOcr = async (source: 'camera' | 'gallery') => {
    setIsLoading(true);
    try {
      const options: ImagePicker.ImagePickerOptions = { base64: true, quality: 0.7 };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset) return;

      let base64 = asset.base64;
      if (!base64 && asset.uri.startsWith('data:')) {
        base64 = asset.uri.split(',')[1];
      }
      if (!base64) {
        Alert.alert(t('aiError'), t('ocrFailed'));
        return;
      }

      const mimeType = asset.mimeType ?? asset.uri.split(';')[0].split(':')[1] ?? 'image/jpeg';

      applyParsed(await parseReceiptWithAI({ mimeType, base64 }));
      Alert.alert(t('success'), t('ocrParsed'));
    } catch (error: any) {
      Alert.alert(t('aiError'), error.message || t('ocrFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOcrPress = () => {
    Alert.alert(t('ocrReceipt'), '', [
      { text: t('ocrTakePhoto'), onPress: () => handleOcr('camera') },
      { text: t('ocrPickGallery'), onPress: () => handleOcr('gallery') },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  return (
    <Modal visible={visible} onClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{editing ? t('editTitle') : t('addTitle')}</Text>

          <View style={styles.aiSection}>
            <Text style={styles.sectionLabel}>{t('aiAssist')}</Text>
            <Text style={styles.aiHint}>{t('aiAssistHint')}</Text>
            <Input
              placeholder={t('aiInputPlaceholder')}
              value={aiInput}
              onChangeText={setAiInput}
              editable={!isLoading}
            />
            <Button
              title={isLoading ? t('processing') : t('parseWithAi')}
              onPress={handleAiParse}
              disabled={isLoading}
              variant="secondary"
              size="small"
              style={styles.aiButton}
            />
            <Button
              title={isLoading ? t('processing') : t('ocrReceipt')}
              onPress={handleOcrPress}
              disabled={isLoading}
              variant="secondary"
              size="small"
              style={styles.aiButton}
            />
            {isLoading && (
              <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
            )}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>{t('transactionDetail')}</Text>

          <View style={styles.typeToggle}>
            <TouchableOpacity
              style={[styles.typeButton, type === 'expense' && styles.typeButtonActiveExpense]}
              onPress={() => setType('expense')}
            >
              <Text
                style={[styles.typeButtonText, type === 'expense' && styles.typeButtonTextActive]}
              >
                💸 {t('expense')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, type === 'income' && styles.typeButtonActiveIncome]}
              onPress={() => setType('income')}
            >
              <Text
                style={[styles.typeButtonText, type === 'income' && styles.typeButtonTextActive]}
              >
                💰 {t('income')}
              </Text>
            </TouchableOpacity>
          </View>

          <Input
            label={t('amountLabel')}
            placeholder="Contoh: 25000"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />

          <Input
            label={t('descriptionLabel')}
            placeholder={t('descriptionPlaceholder')}
            value={description}
            onChangeText={setDescription}
          />

          <Text style={styles.fieldLabel}>{t('categoryLabel')}</Text>
          <View style={styles.categoryGrid}>
            {categories
              .filter((cat) => cat.type === type)
              .map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryChip, category === cat.name && styles.categoryChipActive]}
                  onPress={() => setCategory(cat.name)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      category === cat.name && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>

          <Text style={styles.fieldLabel}>{t('dateLabel')}</Text>
          {Platform.OS === 'web' ? (
            <Input
              value={date.toISOString().slice(0, 10)}
              onChangeText={(v) => {
                const d = new Date(v);
                if (!isNaN(d.getTime())) setDate(d);
              }}
              placeholder="YYYY-MM-DD"
            />
          ) : (
            <>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateButtonText}>
                  {date.toLocaleDateString('id-ID', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(event, selected) => {
                    setShowDatePicker(false);
                    if (selected) setDate(selected);
                  }}
                />
              )}
            </>
          )}

          <Input
            label={t('notesLabel')}
            placeholder={t('notesPlaceholder')}
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          <View style={styles.actions}>
            <Button title={t('save')} onPress={handleSave} style={styles.saveButton} />
            <Button
              title={t('cancel')}
              onPress={() => {
                resetForm();
                onClose();
              }}
              variant="secondary"
              style={styles.cancelButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: Theme) =>
  StyleSheet.create({
    title: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    aiSection: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    aiHint: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    aiButton: {
      marginTop: 4,
    },
    loader: {
      marginTop: 8,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 16,
    },
    sectionLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    typeToggle: {
      flexDirection: 'row',
      marginBottom: 12,
      gap: 8,
    },
    typeButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    typeButtonActiveExpense: {
      backgroundColor: '#ffe0e0',
      borderColor: colors.danger,
    },
    typeButtonActiveIncome: {
      backgroundColor: '#e0ffe0',
      borderColor: '#44bb44',
    },
    typeButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    typeButtonTextActive: {
      color: colors.text,
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
      marginTop: 8,
      color: colors.text,
    },
    dateButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: colors.chipBg,
      marginBottom: 8,
    },
    dateButtonText: {
      fontSize: 14,
      color: colors.text,
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    categoryChip: {
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.chipBg,
    },
    categoryChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryChipText: {
      fontSize: 13,
      color: colors.text,
    },
    categoryChipTextActive: {
      color: '#fff',
      fontWeight: '600',
    },
    actions: {
      marginTop: 8,
      gap: 8,
    },
    saveButton: {
      marginTop: 4,
    },
    cancelButton: {
      marginTop: 0,
    },
  });
