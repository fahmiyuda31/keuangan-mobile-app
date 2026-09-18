import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Input, Button } from '@/components/ui';
import { useCategoryStore } from '@/store';
import { Category } from '@/database/models';
import { useTheme, Theme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { generateId } from '@/utils';

const COLORS = ['#ff6b6b', '#ffa502', '#4caf50', '#208AEF', '#a55eea', '#666666'];
const ICONS = [
  'tag',
  'restaurant',
  'cart',
  'car',
  'flash',
  'medical',
  'school',
  'game-controller',
  'gift',
  'cash',
  'trending-up',
  'ellipsis-horizontal',
];

const ICON_GLYPHS: Record<string, keyof typeof Ionicons.glyphMap> = {
  tag: 'pricetag',
  restaurant: 'restaurant',
  cart: 'cart',
  car: 'car',
  flash: 'flash',
  medical: 'medical',
  school: 'school',
  'game-controller': 'game-controller',
  gift: 'gift',
  cash: 'cash',
  'trending-up': 'trending-up',
  'ellipsis-horizontal': 'ellipsis-horizontal',
};

interface AddCategoryModalProps {
  visible: boolean;
  onClose: () => void;
  editing?: Category | null;
}

export default function AddCategoryModal({
  visible,
  onClose,
  editing = null,
}: AddCategoryModalProps) {
  const { addCategory, updateCategory } = useCategoryStore();
  const colors = useTheme();
  const t = useT();
  const styles = createStyles(colors);
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState(ICONS[0]);

  const resetForm = () => {
    setName('');
    setType('expense');
    setColor(COLORS[0]);
    setIcon(ICONS[0]);
  };

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setName(editing.name);
      setType(editing.type);
      setColor(editing.color);
      setIcon(editing.icon);
    } else {
      resetForm();
    }
  }, [visible, editing]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert(t('error'), t('validCategoryName'));
      return;
    }

    const now = new Date();
    if (editing) {
      updateCategory(editing.id, {
        name: name.trim(),
        color,
        icon,
        type,
        updatedAt: now,
      });
    } else {
      addCategory({
        id: generateId(),
        name: name.trim(),
        color,
        icon,
        type,
        createdAt: now,
        updatedAt: now,
      });
    }

    resetForm();
    onClose();
    Alert.alert(t('success'), t('categorySaved'));
  };

  return (
    <Modal visible={visible} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{editing ? t('categoryEditTitle') : t('categoryAddTitle')}</Text>

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
            <Text style={[styles.typeButtonText, type === 'income' && styles.typeButtonTextActive]}>
              💰 {t('income')}
            </Text>
          </TouchableOpacity>
        </View>

        <Input
          label={t('categoryNameLabel')}
          placeholder={t('categoryNamePlaceholder')}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.fieldLabel}>{t('colorLabel')}</Text>
        <View style={styles.optionRow}>
          {COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.colorDot,
                { backgroundColor: c },
                color === c && styles.colorDotActive,
              ]}
              onPress={() => setColor(c)}
            />
          ))}
        </View>

        <Text style={styles.fieldLabel}>{t('iconLabel')}</Text>
        <View style={styles.iconGrid}>
          {ICONS.map((i) => (
            <TouchableOpacity
              key={i}
              style={[styles.iconChip, icon === i && styles.iconChipActive]}
              onPress={() => setIcon(i)}
            >
              <Ionicons
                name={ICON_GLYPHS[i] ?? 'pricetag'}
                size={16}
                color={icon === i ? '#fff' : colors.text}
              />
            </TouchableOpacity>
          ))}
        </View>

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
    optionRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 8,
    },
    colorDot: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    colorDotActive: {
      borderWidth: 3,
      borderColor: colors.text,
    },
    iconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 8,
    },
    iconChip: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.chipBg,
    },
    iconChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
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
