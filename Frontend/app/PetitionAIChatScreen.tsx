import React, { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import nlpService from '../lib/nlpService';
import AIChatUI, { ChatMessage } from '../components/AIChatUI';

interface BotHistoryItem {
  id: number;
  question: string;
  answer: string;
  created_at: string;
  confidence?: number;
  source_count?: number;
}

export default function PetitionAIChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const communityId = Number(route.params?.communityId || 0);
  const communityName = route.params?.communityName || 'Community';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [communityId]);

  const loadHistory = useCallback(async () => {
    try {
      const response = await nlpService.getBotPetitionsHistory(communityId);
      if (response?.success) {
        const history: BotHistoryItem[] = response.data || [];
        const loaded: ChatMessage[] = [];
        history.forEach((item) => {
          // Robust date parsing (handling spaces and invalid dates)
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
      console.error('Failed to load petition AI history:', error);
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
      const response = await nlpService.askBotPetitions(text, communityId);
      if (response?.success) {
        const historyId = response.data?.historyId;
        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          text: response.data?.answer || 'No response from AI.',
          isBot: true,
          historyId,
          timestamp: new Date(),
          confidence: response.data?.confidence,
        };
        // Update user message with historyId
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.id === userMsg.id ? { ...m, historyId: historyId } : m
          );
          return [...updated, botMsg];
        });
      }
    } catch (error) {
      console.error('Petition AI query failed:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          text: 'Sorry, I encountered an error processing your petition query.',
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
      await nlpService.clearBotHistory(communityId, 'petitions');
      setMessages([]);
    } catch (error) {
      console.error('Failed to clear chat history:', error);
    }
  };

  const handleEdit = async (id: string, newText: string) => {
    const msg = messages.find((m) => m.id === id);
    if (!msg || !msg.historyId) return;

    try {
      const response = await nlpService.updateBotHistoryItem(communityId, msg.historyId, newText, 'petitions');
      if (response?.success) {
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, text: newText } : m))
        );
      }
    } catch (error) {
      console.error('Failed to edit petition message:', error);
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
      const response = await nlpService.deleteBotHistoryItem(communityId, msg.historyId, 'petitions');
      if (response?.success) {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      } else {
        Alert.alert('Error', 'Server failed to delete message.');
      }
    } catch (error) {
      console.error('Failed to delete petition message:', error);
      Alert.alert('Error', 'Failed to delete message from server.');
    }
  };

  return (
    <AIChatUI
      title="Petition AI Assistant"
      messages={messages}
      isLoading={isLoading}
      onSendMessage={handleSend}
      onClearChat={handleClear}
      onGoBack={() => navigation.goBack()}
      onEditMessage={handleEdit}
      onDeleteMessage={handleDelete}
      emptyStateIcon="📋"
      emptyStateText={`How can I help you with petitions in ${communityName}? I can explain rules, analyze support, or suggest next steps.`}
      accentColor="#10b981"
    />
  );
}
