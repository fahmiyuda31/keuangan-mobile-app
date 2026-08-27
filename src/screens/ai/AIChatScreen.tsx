import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import {
  chatWithFinancialAI,
  ChatMessage,
  getAIStatus,
  releaseAISession,
  AIStatus,
} from '@/services/aiService';
import { getFinancialSummaryContext } from '@/services/dbService';

export default function AIChatScreen() {
  const insets = useSafeAreaInsets();
  const colors = useTheme();
  const t = useT();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    checkStatus();
    return () => {
      releaseAISession();
    };
  }, []);

  const checkStatus = async () => {
    try {
      const status = await getAIStatus();
      setAiStatus(status);
    } catch (err) {
      console.warn('Failed to check AI status:', err);
    }
  };

  const handleSend = async (customText?: string) => {
    const textToSend = customText || inputText.trim();
    if (!textToSend || loading) return;

    const currentStatus = aiStatus || (await getAIStatus());
    setAiStatus(currentStatus);

    if (!currentStatus.available) {
      Alert.alert(t('aiError'), t('aiModelNotReadyBanner'));
      return;
    }

    const userMsg: ChatMessage = { role: 'user', content: textToSend };
    const updatedHistory = [...messages, userMsg];

    // Optimistically add user message and empty model message for streaming
    setMessages([...updatedHistory, { role: 'model', content: '' }]);
    if (!customText) setInputText('');
    setLoading(true);

    try {
      // Ambil data transaksi terkini dari SQLite
      const financialContext = await getFinancialSummaryContext();

      // Kirim riwayat pesan ke hybrid aiService dengan streaming callback
      const replyContent = await chatWithFinancialAI(
        updatedHistory,
        financialContext,
        (partialText) => {
          setMessages((prev) => {
            const copy = [...prev];
            if (copy.length > 0 && copy[copy.length - 1].role === 'model') {
              copy[copy.length - 1] = { role: 'model', content: partialText };
            }
            return copy;
          });
        }
      );

      // Final update
      setMessages((prev) => {
        const copy = [...prev];
        if (copy.length > 0 && copy[copy.length - 1].role === 'model') {
          copy[copy.length - 1] = { role: 'model', content: replyContent };
        } else {
          copy.push({ role: 'model', content: replyContent });
        }
        return copy;
      });
    } catch (err: any) {
      // Rollback placeholder if failed
      setMessages(updatedHistory);
      Alert.alert(t('aiError'), err.message || t('aiChatError'));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
  };

  const quickPrompts = [t('aiChatQuick1'), t('aiChatQuick2'), t('aiChatQuick3')];

  const renderFormattedText = (content: string, textColor: string) => {
    // Parser sederhana untuk markdown dasar: heading (#, ##, ###), bold (**text**), bullet points (* / -)
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      let trimmed = line.trim();

      // Heading (###, ##, #)
      const isHeader = /^#{1,6}\s+/.test(trimmed);
      if (isHeader) {
        trimmed = trimmed.replace(/^#{1,6}\s+/, '');
      }

      // Bullet list (* or -)
      const isBullet = /^[\*\-]\s+/.test(trimmed);
      if (isBullet) {
        trimmed = trimmed.replace(/^[\*\-]\s+/, '');
      }

      // Parse bold **text**
      const parts = trimmed.split(/(\*\*.*?\*\*)/g);

      return (
        <View
          key={idx}
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginTop: isHeader ? 6 : 2,
            marginBottom: isHeader ? 4 : 0,
          }}
        >
          {isBullet && (
            <Text style={[{ color: textColor, fontWeight: '700', marginRight: 6 }]}>•</Text>
          )}
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <Text
                  key={pIdx}
                  style={{
                    color: textColor,
                    fontWeight: '700',
                    fontSize: isHeader ? 15 : 14,
                  }}
                >
                  {part.slice(2, -2)}
                </Text>
              );
            }
            return (
              <Text
                key={pIdx}
                style={{
                  color: textColor,
                  fontWeight: isHeader ? '700' : '400',
                  fontSize: isHeader ? 15 : 14,
                  lineHeight: 20,
                }}
              >
                {part}
              </Text>
            );
          })}
        </View>
      );
    });
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View
        style={[
          styles.messageBubbleContainer,
          isUser ? styles.userBubbleContainer : styles.aiBubbleContainer,
        ]}
      >
        {!isUser && (
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Ionicons name="sparkles" size={16} color="#FFFFFF" />
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isUser
              ? [styles.userBubble, { backgroundColor: colors.primary }]
              : [styles.aiBubble, { backgroundColor: colors.card, borderColor: colors.border }],
          ]}
        >
          {renderFormattedText(item.content, isUser ? '#FFFFFF' : colors.text)}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.screen }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View
        style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}
      >
        <View style={styles.headerTitleRow}>
          <View style={[styles.headerIcon, { backgroundColor: `${colors.primary}15` }]}>
            <Ionicons name="sparkles" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>{t('aiChatTitle')}</Text>
              {aiStatus && (
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor:
                        aiStatus.activeBackend === 'on-device'
                          ? '#e8f5e9'
                          : aiStatus.activeBackend === 'cloud'
                            ? '#e3f2fd'
                            : '#fff3cd',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.badgeDot,
                      {
                        backgroundColor:
                          aiStatus.activeBackend === 'on-device'
                            ? '#2e7d32'
                            : aiStatus.activeBackend === 'cloud'
                              ? '#1565c0'
                              : '#f57f17',
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.badgeText,
                      {
                        color:
                          aiStatus.activeBackend === 'on-device'
                            ? '#2e7d32'
                            : aiStatus.activeBackend === 'cloud'
                              ? '#1565c0'
                              : '#f57f17',
                      },
                    ]}
                  >
                    {aiStatus.activeBackend === 'on-device'
                      ? t('aiOfflineBadge')
                      : aiStatus.activeBackend === 'cloud'
                        ? t('aiCloudBadge')
                        : t('aiAutoBadge')}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              {t('aiChatSubtitle')}
            </Text>
          </View>
          {messages.length > 0 && (
            <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
              <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Warning jika AI belum siap (belum unduh model & belum ada API key) */}
      {aiStatus && !aiStatus.available && (
        <View style={[styles.warningBanner, { backgroundColor: '#fff3cd' }]}>
          <Ionicons name="warning-outline" size={18} color="#856404" />
          <Text style={[styles.warningText, { color: '#856404' }]}>
            {t('aiModelNotReadyBanner')}
          </Text>
        </View>
      )}

      {/* Main Chat Area */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          messages.length === 0 && styles.emptyListContent,
        ]}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconBg, { backgroundColor: `${colors.primary}10` }]}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('aiChatEmpty')}</Text>

            <View style={styles.quickPromptsContainer}>
              {quickPrompts.map((prompt, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.quickPromptChip,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                  onPress={() => handleSend(prompt)}
                  disabled={loading}
                >
                  <Ionicons
                    name="help-circle-outline"
                    size={16}
                    color={colors.primary}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.quickPromptText, { color: colors.text }]}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
      />

      {/* Loading Indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>{t('processing')}</Text>
        </View>
      )}

      {/* Form Input Pesan */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
          },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.screen,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder={t('aiChatPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              backgroundColor: inputText.trim() && !loading ? colors.primary : colors.border,
            },
          ]}
          onPress={() => handleSend()}
          disabled={!inputText.trim() || loading}
        >
          <Ionicons name="send" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  clearBtn: {
    padding: 8,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  warningText: {
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  messageBubbleContainer: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-end',
  },
  userBubbleContainer: {
    justifyContent: 'flex-end',
  },
  aiBubbleContainer: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    borderBottomRightRadius: 2,
  },
  aiBubble: {
    borderBottomLeftRadius: 2,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  quickPromptsContainer: {
    width: '100%',
  },
  quickPromptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
  },
  quickPromptText: {
    fontSize: 13,
    fontWeight: '500',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 13,
    marginLeft: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
