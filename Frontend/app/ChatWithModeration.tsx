import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Animated,
  Dimensions,
  StatusBar,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Send, 
  Bot, 
  User, 
  Menu, 
  Plus, 
  Search, 
  MessageSquare, 
  AlertCircle, 
  FileText, 
  X,
  Sparkles,
  ChevronRight,
  MoreHorizontal,
  History
} from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatHistoryItem {
  id: string;
  type: 'chat' | 'complaint' | 'petition';
  title: string;
  timestamp: Date;
  messages: Message[];
}

const ChatWithModeration = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [activeChatId, setActiveChatId] = useState('1');
  const [searchQuery, setSearchQuery] = useState('');

  // Animation values
  const historyAnim = useRef(new Animated.Value(-width * 0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [chats, setChats] = useState<ChatHistoryItem[]>([
    {
      id: '1',
      type: 'chat',
      title: 'Quantum Computing Basics',
      timestamp: new Date(),
      messages: [
        { id: 'm1', role: 'user', content: 'What is quantum computing?', timestamp: new Date() },
        { id: 'm2', role: 'assistant', content: 'Quantum computing is a type of computing that uses quantum-mechanical phenomena...', timestamp: new Date() },
      ]
    },
    { id: '2', type: 'complaint', title: 'Delayed Water Supply', timestamp: new Date(Date.now() - 86400000), messages: [] },
    { id: '3', type: 'petition', title: 'Save the Local Park', timestamp: new Date(Date.now() - 3 * 86400000), messages: [] },
  ]);

  useEffect(() => {
    // Pulse animation for AI icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const toggleHistory = () => {
    const toValue = showHistory ? -width * 0.8 : 0;
    Animated.spring(historyAnim, {
      toValue,
      useNativeDriver: true,
      friction: 8,
    }).start();
    setShowHistory(!showHistory);
  };

  const handleSendMessage = () => {
    if (!input.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages([...messages, newMessage]);
    setInput('');

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `This is a premium AI response for: "${input}". The interface is now integrated into your mobile app with a high-end dark aesthetic.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  const groupChats = (items: ChatHistoryItem[]) => {
    const groups: Record<string, ChatHistoryItem[]> = { 'Today': [], 'Yesterday': [], 'Older': [] };
    const now = new Date();
    items.forEach(chat => {
      const diff = Math.floor((now.getTime() - chat.timestamp.getTime()) / (86400000));
      if (diff === 0) groups['Today'].push(chat);
      else if (diff === 1) groups['Yesterday'].push(chat);
      else groups['Older'].push(chat);
    });
    return groups;
  };

  const groupedChats = useMemo(() => groupChats(chats), [chats]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isAI = item.role === 'assistant';
    return (
      <View style={[styles.messageContainer, isAI ? styles.aiMessage : styles.userMessage]}>
        <View style={[styles.avatarContainer, isAI ? styles.aiAvatar : styles.userAvatar]}>
          {isAI ? <Bot size={16} color="white" /> : <User size={16} color="white" />}
        </View>
        <View style={[styles.bubble, isAI ? styles.aiBubble : styles.userBubble]}>
          <Text style={styles.messageText}>{item.content}</Text>
          <Text style={styles.timestampText}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={toggleHistory} style={styles.iconButton}>
          <History size={24} color="white" opacity={0.7} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <LinearGradient colors={['#6366f1', '#a855f7']} style={styles.headerBotIcon}>
              <Bot size={18} color="white" />
            </LinearGradient>
          </Animated.View>
          <View>
            <Text style={styles.headerTitle}>AI Assistant</Text>
            <Text style={styles.headerSubtitle}>Online</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.iconButton}>
          <MoreHorizontal size={24} color="white" opacity={0.7} />
        </TouchableOpacity>
      </View>

      {/* Main Chat Area */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <LinearGradient colors={['#6366f1', '#a855f7']} style={styles.welcomeIcon}>
                <Sparkles size={40} color="white" />
              </LinearGradient>
              <Text style={styles.welcomeTitle}>How can I help you?</Text>
              <Text style={styles.welcomeSubtitle}>Experience the power of modern AI in your community app.</Text>
            </View>
          }
        />

        {/* Input Bar */}
        <View style={styles.inputWrapper}>
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.attachButton}>
              <Plus size={20} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={input}
              onChangeText={setInput}
              multiline
            />
            <TouchableOpacity 
              onPress={handleSendMessage}
              disabled={!input.trim()}
              style={[styles.sendButton, !input.trim() && { opacity: 0.5 }]}
            >
              <LinearGradient colors={['#6366f1', '#a855f7']} style={styles.sendGradient}>
                <Send size={18} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* History Sidebar (Animated Overlay) */}
      <Animated.View style={[styles.sidebar, { transform: [{ translateX: historyAnim }] }]}>
        <SafeAreaView style={styles.sidebarContent}>
          <View style={styles.sidebarHeader}>
            <Text style={styles.sidebarTitle}>Chat History</Text>
            <TouchableOpacity onPress={toggleHistory}>
              <X size={24} color="white" opacity={0.5} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Search size={16} color="rgba(255,255,255,0.3)" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search chats..."
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <ScrollView style={styles.historyList}>
            {Object.entries(groupedChats).map(([group, items]) => (
              items.length > 0 && (
                <View key={group} style={styles.historyGroup}>
                  <Text style={styles.groupLabel}>{group}</Text>
                  {items.map(chat => (
                    <TouchableOpacity key={chat.id} style={styles.historyItem}>
                      <View style={styles.historyItemIcon}>
                        <MessageSquare size={14} color="#6366f1" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyItemTitle} numberOfLines={1}>{chat.title}</Text>
                        <Text style={styles.historyItemDate}>{chat.timestamp.toLocaleDateString()}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.newChatButton}>
            <LinearGradient colors={['#6366f1', '#a855f7']} style={styles.newChatGradient}>
              <Plus size={20} color="white" />
              <Text style={styles.newChatText}>New Chat</Text>
            </LinearGradient>
          </TouchableOpacity>
        </SafeAreaView>
      </Animated.View>

      {/* Backdrop when sidebar is open */}
      {showHistory && (
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={toggleHistory}
          style={styles.backdrop}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050509',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBotIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(34, 197, 94, 0.8)',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  iconButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  messageList: {
    padding: 16,
    paddingBottom: 32,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    maxWidth: '85%',
  },
  aiMessage: {
    alignSelf: 'flex-start',
  },
  userMessage: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  avatarContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  aiAvatar: {
    backgroundColor: '#6366f1',
    marginRight: 8,
  },
  userAvatar: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginLeft: 8,
  },
  bubble: {
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  aiBubble: {
    backgroundColor: '#16161e',
    borderColor: 'rgba(255,255,255,0.05)',
    borderTopLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: 'rgba(99, 102, 241, 0.9)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopRightRadius: 4,
  },
  messageText: {
    color: 'white',
    fontSize: 14,
    lineHeight: 20,
  },
  timestampText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 9,
    marginTop: 6,
  },
  inputWrapper: {
    padding: 16,
    paddingTop: 8,
    backgroundColor: '#050509',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  input: {
    flex: 1,
    color: 'white',
    fontSize: 14,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  sendGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    padding: 40,
  },
  welcomeIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  welcomeTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeSubtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: width * 0.8,
    backgroundColor: '#0d0d12',
    zIndex: 100,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.05)',
  },
  sidebarContent: {
    flex: 1,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  sidebarTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    margin: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: 'white',
    fontSize: 14,
  },
  historyList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  historyGroup: {
    marginBottom: 24,
  },
  groupLabel: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  historyItemIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyItemTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
  },
  historyItemDate: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    marginTop: 2,
  },
  newChatButton: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  newChatGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  newChatText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 90,
  },
});

export default ChatWithModeration;
