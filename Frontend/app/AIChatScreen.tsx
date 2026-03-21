import React, { useState, useEffect, useCallback } from 'react';
import { View, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import nlpService from '../lib/nlpService';
import AIChatUI, { ChatMessage } from '../components/AIChatUI';

interface BotHistoryItem {
  id: number;
  question: string;
  answer: string;
  created_at: string;
  confidence?: number;
  sources?: { title: string }[];
}

export default function AIChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const communityId = Number(route.params?.communityId || 0);
  const communityName = route.params?.communityName || 'Community';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionHash, setSessionHash] = useState<string | null>(null);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, [communityId]);

  const loadHistory = useCallback(async () => {
    try {
      const response = await nlpService.getBotHistory(communityId, 50, 'chat');
      if (response?.success) {
        const history: BotHistoryItem[] = response.data?.history || response.history || [];
        const loaded: ChatMessage[] = [];
        history.forEach((item) => {
          // Robust date parsing
          const rawDate = item.created_at ? item.created_at.replace(' ', 'T') : null;
          const ts = rawDate ? new Date(rawDate) : new Date();
          const validTs = isNaN(ts.getTime()) ? new Date() : ts;

          loaded.push({
            id: `q-${item.id}`,
            text: item.question,
            isBot: false,
            historyId: item.id,
            timestamp: validTs,
          });
          
          // Add 1ms offset to answer to guarantee stable ordering
          const answerTs = new Date(validTs.getTime() + 1);
          loaded.push({
            id: `a-${item.id}`,
            text: item.answer,
            isBot: true,
            historyId: item.id,
            confidence: item.confidence,
            timestamp: answerTs,
          });
        });
        setMessages(loaded);
      }
    } catch (error) {
      console.error('Failed to load AI chat history:', error);
    }
  }, [communityId]);

  const handleSend = async (text: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      text,
      isBot: false,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await nlpService.askBot(text, communityId, sessionHash || undefined);
      if (response?.success) {
        const historyId = response.data?.historyId;
        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          text: response.data?.answer || 'No response from AI.',
          isBot: true,
          historyId,
          timestamp: new Date(),
          confidence: response.data?.confidence,
          sources: response.data?.sources,
        };
        // Also update the USER message with the same historyId so it can be deleted
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.id === userMsg.id ? { ...m, historyId } : m
          );
          return [...updated, botMsg];
        });
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
      }
    } catch (error) {
      console.error('Failed to edit message:', error);
      Alert.alert('Error', 'Failed to update message on server.');
    }
  };

  const handleDelete = async (id: string) => {
    const msg = messages.find((m) => m.id === id);
    if (!msg || !msg.historyId) {
      // If it's a fresh message without historyId, just remove from state
      setMessages((prev) => prev.filter((m) => m.id !== id));
      return;
    }

    try {
      const response = await nlpService.deleteBotHistoryItem(communityId, msg.historyId, 'chat');
      if (response?.success) {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      } else {
        Alert.alert('Error', 'Server failed to delete message.');
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
      Alert.alert('Error', 'Failed to delete message from server.');
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
      emptyStateIcon="🤖"
      emptyStateText="Hello! I'm your community's AI assistant. Ask me anything about rules, events, or local info!"
      accentColor="#6366f1"
    />
  );
}
