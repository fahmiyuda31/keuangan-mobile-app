import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import {
  useAppStore,
  useTransactionStore,
  useCategoryStore,
  useBudgetStore,
  useModelStore,
} from '@/store';
import { useTheme, Theme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { Card, Button, Input, ModelSelect } from '@/components/ui';
import {
  getGeminiKey,
  setGeminiKey,
  clearGeminiKey,
  getGeminiModel,
  setGeminiModel,
  DEFAULT_GEMINI_MODEL,
} from '@/services/keyService';
import {
  exportTransactionsCsv,
  exportTransactionsPdf,
  exportLocalBackup,
  importLocalBackup,
} from '@/services/exportService';
import {
  getCurrentUser,
  subscribeToAuth,
  signOut,
  backupToCloud,
  fetchCloudData,
  persistRestoredData,
  isFirebaseConfigured,
} from '@/services/firebaseService';
import { mergeCloudIntoLocal } from '@/utils/firebaseSync';
import ImportTransactionsModal from '@/components/ImportTransactionsModal';

const THEME_OPTIONS = ['light', 'dark', 'system'] as const;

export default function SettingsScreen() {
  const { theme, setTheme, language, setLanguage } = useAppStore();
  const { transactions } = useTransactionStore();
  const { categories } = useCategoryStore();
  const { budgets } = useBudgetStore();
  const colors = useTheme();
  const t = useT();
  const styles = createStyles(colors);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState<string>(DEFAULT_GEMINI_MODEL);
  const [saving, setSaving] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ uid: string; email: string | null } | null>(
    null
  );

  const {
    status: modelStatus,
    downloadProgress,
    modelSize,
    aiMode,
    setAiMode,
    backendInfo,
    startDownload,
    cancelDownload,
    deleteModel,
    initStore,
  } = useModelStore();

  useEffect(() => {
    initStore();
    getGeminiKey().then((key) => setApiKey(key || ''));
    getGeminiModel().then(setModel);
    if (Platform.OS === 'web' || !isFirebaseConfigured()) return;
    setCurrentUser(getCurrentUser());
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user ? { uid: user.uid, email: user.email } : null);
    });
    return unsubscribe;
  }, []);

  const handleDownloadModel = async () => {
    try {
      const netState = await NetInfo.fetch();
      if (netState.type === 'cellular') {
        Alert.alert(t('aiCellularWarningTitle'), t('aiCellularWarningMsg'), [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('aiDownloadModel'),
            onPress: () => startDownload(),
          },
        ]);
      } else {
        await startDownload();
      }
    } catch (err: any) {
      Alert.alert(t('error'), err.message || 'Gagal mengunduh model.');
    }
  };

  const handleDeleteModel = () => {
    Alert.alert(t('aiDeleteModelConfirmTitle'), t('aiDeleteModelConfirmMsg'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteModel();
          Alert.alert(t('success'), 'Model berhasil dihapus.');
        },
      },
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const trimmed = apiKey.trim();
      if (trimmed) {
        await setGeminiKey(trimmed);
      } else {
        await clearGeminiKey();
      }
      await setGeminiModel(model);
      setApiKey(trimmed);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    await clearGeminiKey();
    setApiKey('');
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (transactions.length === 0) {
      Alert.alert(t('error'), t('noDataToExport'));
      return;
    }
    try {
      if (format === 'csv') {
        await exportTransactionsCsv(transactions);
      } else {
        await exportTransactionsPdf(transactions);
      }
      Alert.alert(t('success'), t('exportSuccess'));
    } catch (error) {
      console.error('Export failed:', error);
      Alert.alert(t('error'), t('exportFailed'));
    }
  };

  const handleLocalBackup = async () => {
    if (transactions.length === 0 && categories.length === 0 && budgets.length === 0) {
      Alert.alert(t('error'), t('noDataToExport'));
      return;
    }
    try {
      const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        transactions,
        categories,
        budgets,
      };
      await exportLocalBackup(backup);
    } catch (error) {
      console.error('Local backup failed:', error);
      Alert.alert(t('error'), t('exportFailed'));
    }
  };

  const handleLocalRestore = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const backup = await importLocalBackup(result.assets[0].uri);
      const txCount = backup.transactions.length;
      const catCount = backup.categories.length;
      const budgetCount = backup.budgets.length;

      Alert.alert(
        t('restoreConfirmTitle'),
        t('restoreConfirmMsg')
          .replace('{tx}', txCount.toString())
          .replace('{cat}', catCount.toString())
          .replace('{budget}', budgetCount.toString()),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('restore'),
            style: 'destructive',
            onPress: async () => {
              try {
                const { clearTransactions, loadFromDb: loadTx } = useTransactionStore.getState();
                const { clearCategories, loadFromDb: loadCat } = useCategoryStore.getState();
                const { clearBudgets, loadFromDb: loadBud } = useBudgetStore.getState();
                await clearTransactions();
                await clearCategories();
                await clearBudgets();
                for (const tx of backup.transactions) {
                  await useTransactionStore.getState().addTransaction(tx);
                }
                for (const cat of backup.categories) {
                  await useCategoryStore.getState().addCategory(cat);
                }
                for (const budget of backup.budgets) {
                  await useBudgetStore.getState().addBudget(budget);
                }
                await loadTx();
                await loadCat();
                await loadBud();
                Alert.alert(t('success'), t('localRestoreSuccess'));
              } catch (err) {
                console.error('Restore failed:', err);
                Alert.alert(t('error'), t('localRestoreFailed'));
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Restore pick failed:', error);
      Alert.alert(t('error'), t('localRestoreFailed'));
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout failed:', error);
      Alert.alert(t('error'), t('authFailed'));
    }
  };

  const handleBackup = async () => {
    const user = currentUser;
    if (!user) {
      Alert.alert(t('error'), t('authRequired'));
      return;
    }
    setBackupBusy(true);
    try {
      await backupToCloud(user.uid, { transactions, categories, budgets });
      Alert.alert(
        t('success'),
        t('backupSuccess')
          .replace('{count}', transactions.length.toString())
          .replace('{categories}', categories.length.toString())
          .replace('{budgets}', budgets.length.toString())
      );
    } catch (error) {
      console.error('Backup failed:', error);
      Alert.alert(t('error'), t('backupFailed'));
    } finally {
      setBackupBusy(false);
    }
  };

  const handleRestore = async () => {
    const user = currentUser;
    if (!user) {
      Alert.alert(t('error'), t('authRequired'));
      return;
    }
    setRestoreBusy(true);
    try {
      const cloud = await fetchCloudData(user.uid);
      if (
        cloud.transactions.length === 0 &&
        cloud.categories.length === 0 &&
        cloud.budgets.length === 0
      ) {
        Alert.alert(t('error'), t('noCloudData'));
        return;
      }
      const merged = mergeCloudIntoLocal(cloud, { transactions, categories, budgets });
      await persistRestoredData(merged);
      Alert.alert(t('success'), t('restoreSuccess'));
    } catch (error) {
      console.error('Restore failed:', error);
      Alert.alert(t('error'), t('restoreFailed'));
    } finally {
      setRestoreBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('settings')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('appearance')}</Text>
          <Text style={styles.sectionHint}>{t('themeMode')}</Text>
          <View style={styles.optionRow}>
            {THEME_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.optionChip, theme === option && styles.optionChipActive]}
                onPress={() => setTheme(option)}
              >
                <Text
                  style={[styles.optionChipText, theme === option && styles.optionChipTextActive]}
                >
                  {t(option)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>{t('language')}</Text>
          <View style={styles.optionRow}>
            {(['id', 'en'] as const).map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[styles.optionChip, language === lang && styles.optionChipActive]}
                onPress={() => setLanguage(lang)}
              >
                <Text
                  style={[styles.optionChipText, language === lang && styles.optionChipTextActive]}
                >
                  {lang === 'id' ? 'Bahasa Indonesia' : 'English'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* On-Device AI Management */}
        <Card style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="hardware-chip-outline" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { marginLeft: 8 }]}>{t('aiOnDeviceSection')}</Text>
          </View>
          <Text style={styles.sectionHint}>{t('aiOnDeviceHint')}</Text>

          {/* AI Mode Selector */}
          <Text style={styles.subSectionTitle}>{t('aiMode')}</Text>
          <View style={styles.optionRow}>
            {(['auto', 'on-device', 'cloud'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.optionChip, aiMode === mode && styles.optionChipActive]}
                onPress={() => setAiMode(mode)}
              >
                <Text
                  style={[styles.optionChipText, aiMode === mode && styles.optionChipTextActive]}
                >
                  {mode === 'auto'
                    ? t('aiModeAuto')
                    : mode === 'on-device'
                      ? t('aiModeOnDevice')
                      : t('aiModeCloud')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.subSectionHint}>{t('aiModeHint')}</Text>

          {/* Model Status Card */}
          <View
            style={[
              styles.statusBox,
              { backgroundColor: colors.backgroundElement, borderColor: colors.border },
            ]}
          >
            <View style={styles.statusRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        modelStatus === 'ready'
                          ? colors.success || '#4caf50'
                          : modelStatus === 'downloading'
                            ? colors.primary
                            : '#9e9e9e',
                    },
                  ]}
                />
                <Text style={[styles.statusLabel, { color: colors.text }]}>
                  {t('aiModelStatus')}:
                </Text>
              </View>
              <Text
                style={[
                  styles.statusValue,
                  {
                    color:
                      modelStatus === 'ready'
                        ? colors.success || '#4caf50'
                        : modelStatus === 'downloading'
                          ? colors.primary
                          : colors.textMuted,
                  },
                ]}
              >
                {modelStatus === 'ready'
                  ? `${t('aiModelReady')} (${modelSize || '~1.6 GB'})`
                  : modelStatus === 'downloading'
                    ? t('aiModelDownloading').replace('{progress}', downloadProgress.toString())
                    : t('aiModelNotDownloaded')}
              </Text>
            </View>

            <View style={[styles.statusRow, { marginTop: 6 }]}>
              <Text style={[styles.statusLabel, { color: colors.textMuted }]}>
                {t('aiHardwareBackend')}:
              </Text>
              <Text style={[styles.statusValue, { color: colors.text }]}>{backendInfo}</Text>
            </View>

            {/* Download Progress Bar */}
            {modelStatus === 'downloading' && (
              <View style={styles.progressContainer}>
                <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        backgroundColor: colors.primary,
                        width: `${downloadProgress}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, { color: colors.textMuted }]}>
                  {downloadProgress}%
                </Text>
              </View>
            )}
          </View>

          {/* Model Action Buttons */}
          {modelStatus === 'downloading' ? (
            <Button
              title={t('aiCancelDownload')}
              onPress={cancelDownload}
              variant="secondary"
              style={styles.button}
            />
          ) : modelStatus === 'ready' ? (
            <Button
              title={t('aiDeleteModel')}
              onPress={handleDeleteModel}
              variant="danger"
              style={styles.button}
            />
          ) : (
            <Button
              title={t('aiDownloadModel')}
              onPress={handleDownloadModel}
              style={styles.button}
            />
          )}
        </Card>

        {/* Gemini API Key (Fallback Cloud) */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('geminiFallbackSection')}</Text>
          <Text style={styles.sectionHint}>{t('geminiFallbackHint')}</Text>
          <Input
            label={t('geminiApiKey')}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="AIza..."
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <ModelSelect label={t('geminiModel')} value={model} onChange={setModel} />
          <Button
            title={saving ? t('saving') : t('save')}
            onPress={handleSave}
            disabled={saving}
            style={styles.button}
          />
          <Button
            title={t('clearUseEnv')}
            onPress={handleClear}
            disabled={saving}
            variant="secondary"
            style={styles.button}
          />
        </Card>

        {Platform.OS !== 'web' && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>{t('cloudBackup')}</Text>
            <Text style={styles.sectionHint}>{t('cloudBackupHint')}</Text>

            {!isFirebaseConfigured() && (
              <Text style={styles.sectionHint}>{t('firebaseNotConfigured')}</Text>
            )}

            {currentUser ? (
              <>
                <Text style={styles.sectionHint}>
                  {t('loggedInAs').replace('{email}', currentUser.email ?? '')}
                </Text>
                <Button
                  title={backupBusy ? t('backupBusy') : t('backupToCloud')}
                  onPress={handleBackup}
                  disabled={backupBusy || restoreBusy}
                  style={styles.button}
                />
                <Button
                  title={restoreBusy ? t('restoreBusy') : t('restoreFromCloud')}
                  onPress={handleRestore}
                  disabled={backupBusy || restoreBusy}
                  variant="secondary"
                  style={styles.button}
                />
                <Button
                  title={t('logout')}
                  onPress={handleLogout}
                  disabled={backupBusy || restoreBusy}
                  variant="danger"
                  style={styles.button}
                />
              </>
            ) : (
              <Text style={styles.sectionHint}>{t('loginSubtitle')}</Text>
            )}
          </Card>
        )}

        {Platform.OS !== 'web' && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>{t('exportData')}</Text>
            <Button
              title={t('exportCsv')}
              onPress={() => handleExport('csv')}
              style={styles.button}
            />
            <Button
              title={t('exportPdf')}
              onPress={() => handleExport('pdf')}
              variant="secondary"
              style={styles.button}
            />
          </Card>
        )}

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('importData')}</Text>
          <Button
            title={t('importFromNotes')}
            onPress={() => setShowImportModal(true)}
            variant="secondary"
            style={styles.button}
          />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('localBackup')}</Text>
          <Button
            title={t('localBackupExport')}
            onPress={handleLocalBackup}
            style={styles.button}
          />
          <Button
            title={t('localBackupRestore')}
            onPress={handleLocalRestore}
            variant="secondary"
            style={styles.button}
          />
        </Card>

        <ImportTransactionsModal
          visible={showImportModal}
          onClose={() => setShowImportModal(false)}
        />

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('dangerZone')}</Text>
          <Button
            title={t('clearAllTransactions')}
            onPress={() => {
              Alert.alert(t('clearAllTransactions'), t('clearAllTransactionsMsg'), [
                { text: t('cancel'), style: 'cancel' },
                {
                  text: t('delete'),
                  style: 'destructive',
                  onPress: async () => {
                    const { clearTransactions } = useTransactionStore.getState();
                    await clearTransactions();
                    Alert.alert(t('success'), t('clearAllTransactionsSuccess'));
                  },
                },
              ]);
            }}
            variant="danger"
            style={styles.button}
          />
        </Card>
      </ScrollView>
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
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.text,
    },
    card: {
      marginTop: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
      marginTop: 8,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 4,
    },
    subSectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginTop: 10,
      marginBottom: 6,
    },
    subSectionHint: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 10,
    },
    sectionHint: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 8,
    },
    statusBox: {
      borderRadius: 10,
      borderWidth: 1,
      padding: 12,
      marginVertical: 10,
    },
    statusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 8,
    },
    statusLabel: {
      fontSize: 13,
      fontWeight: '500',
    },
    statusValue: {
      fontSize: 13,
      fontWeight: '600',
    },
    progressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
      gap: 8,
    },
    progressBarBg: {
      flex: 1,
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 4,
    },
    progressText: {
      fontSize: 12,
      fontWeight: '600',
      minWidth: 36,
      textAlign: 'right',
    },
    optionRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
    },
    optionChip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.chipBg,
    },
    optionChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    optionChipText: {
      fontSize: 13,
      color: colors.text,
    },
    optionChipTextActive: {
      color: '#fff',
      fontWeight: '600',
    },
    button: {
      marginTop: 8,
    },
  });
