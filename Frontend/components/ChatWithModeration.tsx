// components/ChatWithModeration.tsx - Reusable chat component with NLP moderation
import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import nlpSocketService from '../lib/nlpSocketService';

interface ChatWithModerationProps {
  communityId: number;
  onMessageSent: (message: string) => void;
}

export const ChatWithModeration: React.FC<ChatWithModerationProps> = ({
  communityId,
  onMessageSent,
}) => {
  const [message, setMessage] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    connectToModerationService();
    return () => nlpSocketService.disconnect();
  }, []);

  const connectToModerationService = async () => {
    try {
      await nlpSocketService.connect();
      nlpSocketService.on('connected', () => setIsConnected(true));
      nlpSocketService.on('disconnected', () => setIsConnected(false));
      nlpSocketService.on('moderation:result', handleModerationResult);
      nlpSocketService.on('moderation:error', handleModerationError);
    } catch (error) {
      console.error('Failed to connect to moderation service:', error);
    }
  };

  const handleModerationResult = (result: any) => {
    setIsChecking(false);
    if (result.approved) {
      onMessageSent(message);
      setMessage('');
    } else {
      Alert.alert('Message Flagged', result.reason || 'Your message has been flagged for review.', [
        { text: 'Edit' },
        { text: 'Cancel', onPress: () => setMessage(''), style: 'cancel' as const },
      ]);
    }
  };

  const handleModerationError = () => {
    setIsChecking(false);
    Alert.alert('Error', 'Failed to check message. Please try again.', [{ text: 'OK' }]);
  };

  const handleSendMessage = () => {
    if (!message.trim() || !isConnected) {
      if (!isConnected) Alert.alert('Error', 'Not connected to moderation service');
      return;
    }
    setIsChecking(true);
    nlpSocketService.moderateMessage(message, 'chat');
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Type your message..."
          multiline
          maxLength={5000}
          editable={!isChecking}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!message.trim() || isChecking) && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!message.trim() || isChecking}
        >
          {isChecking ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sendButtonText}>Send</Text>}
        </TouchableOpacity>
      </View>
      {(!isConnected || isChecking) && (
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>{isChecking ? '🔍 Checking message...' : '⚠️ Moderation service offline'}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff' },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  sendButtonDisabled: { backgroundColor: '#ccc' },
  sendButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  statusBar: { backgroundColor: '#fff3cd', padding: 8, borderTopWidth: 1, borderTopColor: '#ffc107' },
  statusText: { color: '#856404', fontSize: 12, textAlign: 'center' as const },
});

export default ChatWithModeration;
