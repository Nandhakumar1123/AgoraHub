import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Alert, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import nlpService from '../lib/nlpService';
import { loadTamilSummaryCache, saveTamilSummaryCache } from '../lib/tamilSummaryCache';
import AIChatUI, { ChatMessage, ChatThreadItem } from '../components/AIChatUI';

interface BotHistoryItem {
  id: number;
  question: string;
  answer: string;
  created_at: string;
  confidence?: number;
  sources?: { title: string }[];
  reaction_count?: Record<string, number>;
  user_reaction?: string;
}

export default function AIChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const communityId = Number(route.params?.communityId || 0);
  const communityName = route.params?.communityName || 'Community';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionHash, setSessionHash] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<BotHistoryItem[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isNewChat, setIsNewChat] = useState(false);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, [communityId]);

  const isTamilText = (text: string) => /[\u0B80-\u0BFF]/.test(String(text || ''));

  const sanitizeTamilSummary = (value: string | undefined | null): string => {
    const normalized = String(value || '').trim();
    return isTamilText(normalized) ? normalized : '';
  };

  const toValidDate = (raw: string | undefined) => {
    const normalized = raw ? raw.replace(' ', 'T') : '';
    const parsed = normalized ? new Date(normalized) : new Date();
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const getDateKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const loadHistory = useCallback(async () => {
    try {
      const response = await nlpService.getBotHistory(communityId, 100, 'chat');
      if (response?.success) {
        const history: BotHistoryItem[] = response.data?.history || response.history || [];
        setHistoryItems(history);

        if (history.length > 0) {
          setSelectedThreadId(null);
          setMessages([]);
          setIsNewChat(true);
        } else {
          setSelectedThreadId(null);
          setMessages([]);
          setIsNewChat(true);
        }
      }
    } catch (error) {
      console.error('Failed to load AI chat history:', error);
    }
  }, [communityId]);

  const buildMessagesForDate = useCallback((history: BotHistoryItem[], dateKey: string): ChatMessage[] => {
    const dayItems = history
      .filter(item => getDateKey(toValidDate(item.created_at)) === dateKey)
      .sort((a, b) => toValidDate(a.created_at).getTime() - toValidDate(b.created_at).getTime());

    const result: ChatMessage[] = [];
    dayItems.forEach(item => {
      const ts = toValidDate(item.created_at);
      result.push({
        id: `q-${item.id}`,
        text: item.question,
        isBot: false,
        historyId: item.id,
        timestamp: ts,
      });
      result.push({
        id: `a-${item.id}`,
        text: item.answer,
        isBot: true,
        historyId: item.id,
        confidence: item.confidence,
        timestamp: new Date(ts.getTime() + 1000), // Ensure bot message is after user message
        reaction_count: item.reaction_count,
        user_reaction: item.user_reaction,
      });
    });
    return result;
  }, []);

  const formatDayLabel = (raw: string) => {
    const dt = toValidDate(raw);
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const threads = useMemo<ChatThreadItem[]>(() => {
    const grouped: Record<string, BotHistoryItem[]> = {};
    historyItems.forEach(item => {
      const dateKey = getDateKey(toValidDate(item.created_at));
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(item);
    });

    return Object.entries(grouped)
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .map(([dateKey, items]) => {
        const latest = items.sort((a, b) => toValidDate(b.created_at).getTime() - toValidDate(a.created_at).getTime())[0];
        return {
          id: dateKey,
          title: formatDayLabel(latest.created_at),
          subtitle: latest.question,
          dayLabel: formatDayLabel(latest.created_at),
          createdAt: latest.created_at,
        };
      });
  }, [historyItems]);

  const handleSelectThread = useCallback(
    async (dateKey: string) => {
      setSelectedThreadId(dateKey);
      const raw = buildMessagesForDate(historyItems, dateKey);
      const hydrated = await Promise.all(
        raw.map(async (m) => {
          if (!m.isBot || !m.historyId) return m;
          const cached = sanitizeTamilSummary(await loadTamilSummaryCache('chat', communityId, m.historyId));
          return cached ? { ...m, translatedText: cached } : m;
        })
      );
      setMessages(hydrated);
      setIsNewChat(false);
      setSessionHash(null); // Reset session when switching days
    },
    [historyItems, buildMessagesForDate, communityId]
  );

  const handleNewChat = () => {
    setMessages([]);
    setSelectedThreadId(null);
    setSessionHash(null);
    setIsNewChat(true);
  };

  const handleSend = async (text: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      text,
      isBot: false,
      timestamp: new Date(),
    };

    // If it was a new chat, we just show this message.
    // If it wasn't, we append to existing messages.
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await nlpService.askBot(text, communityId, sessionHash || undefined);
      if (response?.success) {
        const historyId = response.data?.historyId;
        const nowIso = new Date().toISOString();
        const tamilPrefetch = sanitizeTamilSummary(response.data?.tamilSummary);
        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          text: response.data?.answer || 'No response from AI.',
          isBot: true,
          historyId,
          timestamp: new Date(),
          confidence: response.data?.confidence,
          sources: response.data?.sources,
          prefetchedTamilSummary: tamilPrefetch || undefined,
        };

        // Update UI
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.id === userMsg.id ? { ...m, historyId } : m
          );
          return [...updated, botMsg];
        });

        // Update history cache
        if (historyId) {
          const nextItem: BotHistoryItem = {
            id: historyId,
            question: text,
            answer: response.data?.answer || 'No response from AI.',
            created_at: nowIso,
            confidence: response.data?.confidence,
          };
          setHistoryItems((prev) => [nextItem, ...prev.filter(p => p.id !== historyId)]);

          // After first message in new chat, it's no longer "new" and belongs to today
          if (isNewChat) {
            setIsNewChat(false);
            setSelectedThreadId(getDateKey(new Date()));
          }
        }
        setSessionHash(response.data?.sessionHash || null);
      }
    } catch (error) {
      console.error('AI query failed:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          text: 'Sorry, I encountered an error. Please try again later.',
          isBot: true,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      await nlpService.clearBotHistory(communityId);
      setMessages([]);
      setHistoryItems([]);
      setSelectedThreadId(null);
      setIsNewChat(true);
    } catch (error) {
      console.error('Failed to clear chat history:', error);
    }
  };

  const handleEdit = async (id: string, newText: string) => {
    const msg = messages.find((m) => m.id === id);
    if (!msg || !msg.historyId) return;

    try {
      const response = await nlpService.updateBotHistoryItem(communityId, msg.historyId, newText, 'chat');
      if (response?.success) {
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, text: newText } : m))
        );
        // Also update historyItems
        setHistoryItems(prev => prev.map(h => h.id === msg.historyId ? { ...h, question: newText } : h));
      }
    } catch (error) {
      console.error('Failed to edit message:', error);
      Alert.alert('Error', 'Failed to update message on server.');
    }
  };

  const handleDelete = async (id: string) => {
    const msg = messages.find((m) => m.id === id);
    if (!msg || !msg.historyId) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      return;
    }

    try {
      const response = await nlpService.deleteBotHistoryItem(communityId, msg.historyId, 'chat');
      if (response?.success) {
        setMessages((prev) => prev.filter((m) => m.id !== id));
        setHistoryItems(prev => prev.filter(h => h.id !== msg.historyId));
      } else {
        Alert.alert('Error', 'Server failed to delete message.');
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
      Alert.alert('Error', 'Failed to delete message from server.');
    }
  };

  const runTranslate = async (id: string, targetLanguage: 'Tamil' | 'Tanglish') => {
    const msg = messages.find((m) => m.id === id);
    if (!msg || !msg.text) return;

    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isTranslating: true } : m))
    );

    try {
      const response = await nlpService.translateMessage(msg.text, communityId, targetLanguage);
      if (response?.success) {
        const translated = sanitizeTamilSummary(response?.translated || response?.data?.translated);
        if (!translated) {
          Alert.alert('Translation Error', 'Tamil translation is invalid. Please try again.');
          setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, isTranslating: false } : m))
          );
          return;
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, translatedText: translated, isTranslating: false } : m
          )
        );
        if (msg.historyId) {
          await saveTamilSummaryCache('chat', communityId, msg.historyId, String(translated).trim());
        }
      } else {
        Alert.alert('Translation Error', 'Failed to translate message.');
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, isTranslating: false } : m))
        );
      }
    } catch (error) {
      console.error('Translation failed:', error);
      Alert.alert('Error', 'Failed to reach translation service.');
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, isTranslating: false } : m))
      );
    }
  };

  const handleTranslate = async (id: string) => {
    const msg = messages.find((m) => m.id === id);
    if (!msg || !msg.historyId) return;

    const prefetch = sanitizeTamilSummary(msg.prefetchedTamilSummary);
    if (prefetch) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, translatedText: prefetch, prefetchedTamilSummary: undefined } : m
        )
      );
      await saveTamilSummaryCache('chat', communityId, msg.historyId, prefetch);
      return;
    }

    runTranslate(id, 'Tamil');
  };

  const handleReact = async (id: string, emoji: string) => {
    const msg = messages.find(m => m.id === id);
    if (!msg || !msg.historyId) return;

    // Optimistic update
    setMessages(prev => prev.map(m => {
      if (m.id === id) {
        const newCount = { ...(m.reaction_count || {}) };
        let newUserReaction = emoji;

        if (m.user_reaction === emoji) {
          newCount[emoji] = Math.max(0, (newCount[emoji] || 1) - 1);
          newUserReaction = undefined as any;
        } else {
          if (m.user_reaction) {
            newCount[m.user_reaction] = Math.max(0, (newCount[m.user_reaction] || 1) - 1);
          }
          newCount[emoji] = (newCount[emoji] || 0) + 1;
        }

        return { ...m, reaction_count: newCount, user_reaction: newUserReaction };
      }
      return m;
    }));

    try {
      const response = await nlpService.reactToBotHistory(communityId, msg.historyId, emoji);
      if (response?.success) {
        setMessages(prev => prev.map(m =>
          m.id === id ? { ...m, reaction_count: response.data.reaction_count, user_reaction: response.data.user_reaction } : m
        ));
      }
    } catch (error) {
      console.error('Failed to react:', error);
    }
  };

  return (
    <AIChatUI
      title={communityName}
      messages={messages}
      isLoading={isLoading}
      onSendMessage={handleSend}
      onClearChat={handleClear}
      onGoBack={() => navigation.goBack()}
      onEditMessage={handleEdit}
      onDeleteMessage={handleDelete}
      onTranslateMessage={handleTranslate}
      onReactMessage={handleReact}
      chatThreads={threads}
      currentThreadId={selectedThreadId}
      onSelectThread={handleSelectThread}
      onNewChat={handleNewChat}
      emptyStateIcon="🤖"
      emptyStateText={isNewChat ? "Ask me anything about rules, events, or local issues." : "Select a day from the list to view history."}
      accentColor="#6366f1"
    />
  );
}

