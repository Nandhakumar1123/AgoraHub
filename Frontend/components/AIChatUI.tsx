import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// ─── Types ───────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
  confidence?: number;
  sources?: { title: string }[];
  historyId?: number;
}

interface AIChatUIProps {
  title: string;
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  onClearChat: () => void;
  onGoBack: () => void;
  onEditMessage?: (id: string, newText: string) => void;
  onDeleteMessage?: (id: string) => void;
  emptyStateText?: string;
  emptyStateIcon?: string;
  accentColor?: string;
  accentGradient?: [string, string];
}

// ─── Date helpers ────────────────────────────────────────────
function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(dateKey: string): string {
  if (!dateKey || dateKey.includes('NaN')) return 'Unknown Date';
  
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const dateStr = date.toDateString();
  if (dateStr === today.toDateString()) return 'Today';
  if (dateStr === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Group messages by date ──────────────────────────────────
function groupByDate(messages: ChatMessage[]): { dateKey: string; messages: ChatMessage[] }[] {
  if (!messages || messages.length === 0) return [];

  const map = new Map<string, ChatMessage[]>();

  // Ensure stable sort: by timestamp, then by original index if timestamps are equal
  const sorted = [...messages].sort((a, b) => {
    const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
    const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
    return timeA - timeB;
  });

  sorted.forEach((msg) => {
    const ts = msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp);
    const key = getDateKey(isNaN(ts.getTime()) ? new Date() : ts);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(msg);
  });

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, msgs]) => ({ dateKey, messages: msgs }));
}

// ─── Typing dots animation ──────────────────────────────────
const TypingIndicator: React.FC<{ color: string }> = ({ color }) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      );

    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 150);
    const a3 = animate(dot3, 300);
    a1.start();
    a2.start();
    a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  const dotStyle = (anim: Animated.Value) => ({
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color,
    marginHorizontal: 3,
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -4],
        }),
      },
    ],
  });

  return (
    <View style={typingStyles.wrapper}>
      <View style={typingStyles.bubble}>
        <Animated.View style={dotStyle(dot1)} />
        <Animated.View style={dotStyle(dot2)} />
        <Animated.View style={dotStyle(dot3)} />
      </View>
    </View>
  );
};

const typingStyles = StyleSheet.create({
  wrapper: { alignSelf: 'flex-start', marginLeft: 16, marginBottom: 12 },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
});

// ═════════════════════════════════════════════════════════════
// Main Component
// ═════════════════════════════════════════════════════════════
const AIChatUI: React.FC<AIChatUIProps> = ({
  title,
  messages,
  isLoading,
  onSendMessage,
  onClearChat,
  onGoBack,
  onEditMessage,
  onDeleteMessage,
  emptyStateText = "Hello! I'm your AI assistant. Ask me anything!",
  emptyStateIcon = '🤖',
  accentColor = '#6366f1',
  accentGradient = ['#6366f1', '#8b5cf6'],
}) => {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [inputText, setInputText] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Auto-scroll when messages change or loading state changes
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 150);
    return () => clearTimeout(timer);
  }, [messages.length, isLoading]);

  // Fade-in on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed || isLoading) return;
    setInputText('');
    onSendMessage(trimmed);
  };

  const handleClear = () => {
    Alert.alert('Clear Chat', 'Are you sure you want to clear all messages?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: onClearChat },
    ]);
  };

  const handleLongPress = (msg: ChatMessage) => {
    const options = [];
    
    if (!msg.isBot && onEditMessage) {
      options.push({
        text: 'Edit Message',
        onPress: () => {
          setEditingId(msg.id);
          setEditText(msg.text);
        },
      });
    }

    if (onDeleteMessage) {
      options.push({
        text: 'Delete Message',
        style: 'destructive' as const,
        onPress: () => {
          Alert.alert('Delete Message', 'Are you sure you want to delete this message?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => onDeleteMessage(msg.id) },
          ]);
        },
      });
    }

    if (options.length > 0) {
      Alert.alert('Message Actions', '', [...options, { text: 'Cancel', style: 'cancel' }]);
    }
  };

  const saveEdit = () => {
    if (editingId && onEditMessage) {
      onEditMessage(editingId, editText);
      setEditingId(null);
      setEditText('');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const groups = groupByDate(messages);

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" />
      <LinearGradient
        colors={['#0a0f1e', '#111827', '#0a0f1e']}
        style={styles.gradient}
      >
        {/* ── Header ────────────────────────────────────── */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onGoBack} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={[styles.headerDot, { backgroundColor: accentColor }]} />
            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          </View>

          <TouchableOpacity onPress={handleClear} style={styles.clearBtn} activeOpacity={0.7}>
            <Text style={styles.clearIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>

        {/* ── Messages Area ─────────────────────────────── */}
        <ScrollView
          ref={scrollRef}
          style={styles.messagesArea}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 && !isLoading ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconWrap, { shadowColor: accentColor }]}>
                <Text style={styles.emptyIcon}>{emptyStateIcon}</Text>
              </View>
              <Text style={styles.emptyTitle}>{title}</Text>
              <Text style={styles.emptyText}>{emptyStateText}</Text>
              <View style={styles.suggestionsWrap}>
                {['What can you help me with?', 'Show me a summary', 'Any recent updates?'].map(
                  (s, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.suggestion, { borderColor: accentColor + '40' }]}
                      onPress={() => {
                        setInputText(s);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.suggestionText, { color: accentColor }]}>{s}</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>
          ) : (
            groups.map((group) => (
              <View key={group.dateKey}>
                {/* Date separator */}
                <View style={styles.dateSeparator}>
                  <Text style={styles.dateText}>{formatDateLabel(group.dateKey)}</Text>
                </View>

                {/* Messages in this group */}
                {group.messages.map((msg) => (
                  <View
                    key={msg.id}
                    style={[
                      styles.msgRow,
                      msg.isBot ? styles.msgRowBot : styles.msgRowUser,
                    ]}
                  >
                    {/* Bot avatar */}
                    {msg.isBot && (
                      <View style={[styles.avatar, { backgroundColor: accentColor + '20' }]}>
                        <Text style={styles.avatarText}>{emptyStateIcon}</Text>
                      </View>
                    )}

                    <View
                      style={[
                        styles.bubble,
                        msg.isBot
                          ? styles.botBubble
                          : [styles.userBubble, { backgroundColor: accentColor }],
                      ]}
                    >
                      {editingId === msg.id ? (
                        <View style={styles.editContainer}>
                          <TextInput
                            style={[styles.msgText, styles.userText, styles.editInput]}
                            value={editText}
                            onChangeText={setEditText}
                            multiline
                            autoFocus
                          />
                          <View style={styles.editActions}>
                            <TouchableOpacity onPress={cancelEdit} style={styles.editBtn}>
                              <Text style={styles.editBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={saveEdit} style={[styles.editBtn, { backgroundColor: accentColor }]}>
                              <Text style={[styles.editBtnText, { color: '#fff' }]}>Save</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          activeOpacity={0.9}
                          style={styles.msgTouch}
                        >
                          <Text
                            style={[
                              styles.msgText,
                              msg.isBot ? styles.botText : styles.userText,
                            ]}
                            selectable={editingId !== msg.id}
                          >
                            {msg.text}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {editingId !== msg.id && (
                        <View style={styles.actionRow}>
                          {!msg.isBot && (
                            <TouchableOpacity 
                              onPress={() => {
                                setEditingId(msg.id);
                                setEditText(msg.text);
                              }} 
                              style={styles.actionItem}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Ionicons name="pencil" size={14} color="rgba(255,255,255,0.4)" />
                              <Text style={styles.actionText}>Edit</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity 
                            onPress={() => onDeleteMessage?.(msg.id)} 
                            style={[styles.actionItem, { marginLeft: !msg.isBot ? 12 : 0 }]}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Ionicons name="trash-outline" size={14} color="#ef4444" />
                            <Text style={[styles.actionText, { color: '#ef4444' }]}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      )}



                      {/* Footer: time + confidence */}
                      <View style={styles.msgFooter}>
                        <Text
                          style={[
                            styles.timeText,
                            msg.isBot ? styles.botTime : styles.userTime,
                          ]}
                        >
                          {formatTime(msg.timestamp)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ))
          )}

          {/* Typing indicator */}
          {isLoading && <TypingIndicator color={accentColor} />}
        </ScrollView>

        {/* ── Input Bar ─────────────────────────────────── */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Type a message..."
                placeholderTextColor="#475569"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={2000}
                editable={!isLoading}
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
              />
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor:
                      inputText.trim() && !isLoading ? accentColor : 'rgba(255,255,255,0.05)',
                  },
                ]}
                onPress={handleSend}
                disabled={!inputText.trim() || isLoading}
                activeOpacity={0.7}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.sendIcon, {
                    color: inputText.trim() ? '#fff' : '#475569'
                  }]}>↑</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </Animated.View>
  );
};

// ═════════════════════════════════════════════════════════════
// Styles
// ═════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0f1e' },
  gradient: { flex: 1 },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(10, 15, 30, 0.85)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: { fontSize: 20, color: '#e2e8f0', fontWeight: '600' },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  headerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    letterSpacing: 0.3,
    flex: 1,
  },
  clearBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearIcon: { fontSize: 18 },

  // ── Messages area
  messagesArea: { flex: 1 },
  messagesContent: { paddingVertical: 16, paddingHorizontal: 8 },

  // ── Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f1f5f9',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  suggestionsWrap: { width: '100%', gap: 10 },
  suggestion: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  suggestionText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },

  // ── Date separator
  dateSeparator: {
    paddingHorizontal: 16,
    marginTop: 40,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 3,
    textTransform: 'uppercase',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  // ── Message rows
  msgRow: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  msgRowBot: { justifyContent: 'flex-start' },
  msgRowUser: { justifyContent: 'flex-end' },

  // ── Avatar
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 4,
  },
  avatarText: { fontSize: 16 },

  // ── Bubbles
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  botBubble: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderTopLeftRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  userBubble: {
    borderTopRightRadius: 6,
  },

  // ── Message text
  msgText: { fontSize: 15, lineHeight: 22 },
  botText: { color: '#e2e8f0' },
  userText: { color: '#ffffff' },



  // ── Message footer
  msgFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 6,
  },
  timeText: { fontSize: 11, fontWeight: '500' },
  botTime: { color: '#64748b' },
  userTime: { color: 'rgba(255,255,255,0.7)' },

  msgTouch: {
    paddingRight: 4,
  },

  // Action styles
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
  },
  editContainer: {
    minWidth: 200,
  },
  editInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    color: '#fff',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },

  // ── Input bar
  inputBar: {
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: 'rgba(10, 15, 30, 0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#f1f5f9',
    maxHeight: 120,
    lineHeight: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 6,
    paddingBottom: Platform.OS === 'ios' ? 8 : 6,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendIcon: {
    fontSize: 20,
    fontWeight: '800',
  },
});

export default AIChatUI;
