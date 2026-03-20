import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigation, useRoute, RouteProp, NavigationProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io, { Socket } from 'socket.io-client';
import { API_BASE_URL, SOCKET_BASE_URL } from '../lib/api';
import PollMessageCard from './PollMessageCard';
import PollCreateScreen from './PollCreateScreen';


// Type definitions
interface Community {
  id?: number | string;
  community_id?: number | string;
  name?: string;
  member_count?: number;
}

interface RouteParams {
  community?: Community;
}

type MemberCommunityRouteProp = RouteProp<{ MemberCommunityApp: { community: Community } }, 'MemberCommunityApp'>;
type MemberCommunityNavigationProp = NavigationProp<any>;

interface Message {
  id?: number;
  _id?: string; // Temporary client-side ID for optimistic updates
  message_id?: number;
  community_id?: number;
  sender_id?: number | null;

  full_name?: string;
  message_type?: 'text' | 'image' | 'audio' | 'announcement' | 'sos' | 'poll' | 'complaint' | 'petition';
  content?: string;
  attachments?: any[];
  parent_message_id?: number;
  created_at?: string;
  profile_type?: string;
  reply_count?: number;
}

const { width, height } = Dimensions.get('window');
import nlpService from '../lib/nlpService';

interface ChatbotMessage {
  id: string;
  text: string;
  isBot: boolean;
  historyId?: number;
  sources?: any[];
  confidence?: number;
  timestamp: Date;
}

interface BotHistoryItem {
  id: number;
  question: string;
  answer: string;
  created_at: string;
  confidence?: number;
}

interface CachedChatbotMessage {
  id: string;
  text: string;
  isBot: boolean;
  historyId?: number;
  confidence?: number;
  timestamp: string;
}

// =====================================================
// 🔹 FIXED: Custom hook for real-time messages
// =====================================================
const useCommunityMessages = (communityId: number, currentUserId: number | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (currentUserId !== null) {
      fetchMessages();
      const cleanup = setupSocket();
      return cleanup;
    }
    return () => { };
  }, [communityId, currentUserId]);

  const fetchMessages = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(
        `${API_BASE_URL}/communities/${communityId}/messages?limit=50`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const list = Array.isArray(data) ? data : [];
      const sortedMessages = list.sort((a: Message, b: Message) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateA - dateB;
      });
      setMessages(sortedMessages);
    } catch (error) {
      console.error('❌ Member error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupSocket = useCallback(() => {
    const socket = io(SOCKET_BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_community', communityId);
    });

    socket.on('disconnect', () => {
    });

    socket.on('reconnect', () => {
      socket.emit('join_community', communityId);
    });

    // ✅ FIXED: Handle incoming messages with proper sender_id validation
    socket.on('new_message', (message: Message) => {
      // ✅ Ensure sender_id is a number
      const normalizedMessage = {
        ...message,
        sender_id: message.sender_id ? Number(message.sender_id) : null
      };


      setMessages(prev => {
        // Check if message already exists by message_id
        const exists = prev.some(msg =>
          msg.message_id && msg.message_id === normalizedMessage.message_id
        );

        if (exists) {
          return prev;
        }

        // If it's a server-confirmed message with matching _id, replace optimistic message
        if (normalizedMessage.message_id && normalizedMessage._id) {
          const optimisticIndex = prev.findIndex(msg => msg._id === normalizedMessage._id);
          if (optimisticIndex > -1) {
            const updated = [...prev];
            updated[optimisticIndex] = normalizedMessage;
            return updated.sort((a, b) => {
              const dateA = new Date(a.created_at || 0).getTime();
              const dateB = new Date(b.created_at || 0).getTime();
              return dateA - dateB;
            });
          }
        }

        const updated = [...prev, normalizedMessage];
        return updated.sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateA - dateB;
        });
      });
    });

    socket.on('new_announcement', (announcement: Message) => {
      setMessages(prev => {
        const exists = prev.some(msg =>
          (msg.message_id && msg.message_id === announcement.message_id) ||
          (msg.id && msg.id === announcement.id)
        );
        if (exists) return prev;

        const updated = [...prev, { ...announcement, message_type: 'announcement' } as Message];
        return updated.sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateA - dateB;
        });
      });
    });

    socket.on('sos_alert', (sos: Message) => {
      setMessages(prev => {
        const exists = prev.some(msg =>
          (msg.message_id && msg.message_id === sos.message_id) ||
          (msg.id && msg.id === sos.id)
        );
        if (exists) return prev;

        const updated = [...prev, { ...sos, message_type: 'sos' } as Message];
        return updated.sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateA - dateB;
        });
      });
    });

    socket.on('new_complaint', (complaint: Message) => {
      setMessages(prev => {
        const exists = prev.some(msg =>
          (msg.message_id && msg.message_id === complaint.message_id) ||
          (msg.id && msg.id === complaint.id)
        );
        if (exists) return prev;

        const updated = [...prev, { ...complaint, message_type: 'complaint' } as Message];
        return updated.sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateA - dateB;
        });
      });
    });

    socket.on('new_petition', (petition: Message) => {
      setMessages(prev => {
        const exists = prev.some(msg =>
          (msg.message_id && msg.message_id === petition.message_id) ||
          (msg.id && msg.id === petition.id)
        );
        if (exists) return prev;

        const updated = [...prev, { ...petition, message_type: 'petition' } as Message];
        return updated.sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateA - dateB;
        });
      });
    });

    return () => {
      socket.emit('leave_community', communityId);
      socket.disconnect();
    };
  }, [communityId, currentUserId]); // ✅ Added currentUserId to dependencies

  const sendMessage = async (content: string, type: string = 'text', attachments: any[] = [], tempId?: string) => {
    try {
      const token = await AsyncStorage.getItem('authToken');

      // ✅ Validate token and current user before sending
      if (!token || !currentUserId) {
        throw new Error('Authentication required');
      }

      // ✅ Verify token contains correct user_id
      const tokenPayload = JSON.parse(atob(token.split('.')[1]));
      if (tokenPayload.user_id !== currentUserId) {
        throw new Error('Token mismatch - please log out and log back in');
      }

      const response = await fetch(
        `${API_BASE_URL}/communities/${communityId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            content,
            message_type: type,
            attachments,
            _id: tempId
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send message: ${errorText}`);
      }

      const sentMessage = await response.json();

      // Merge server response into state (in case socket event is delayed or missed)
      setMessages(prev => {
        const withoutTemp = tempId ? prev.filter(m => m._id !== tempId) : prev;
        const exists = withoutTemp.some(m => m.message_id === sentMessage.message_id);
        if (exists) return withoutTemp;
        const merged: Message = {
          ...sentMessage,
          sender_id: sentMessage.sender_id ?? undefined,
        };
        return [...withoutTemp, merged].sort((a, b) => {
          const tA = new Date(a.created_at || 0).getTime();
          const tB = new Date(b.created_at || 0).getTime();
          return tA - tB;
        });
      });

      return sentMessage;
    } catch (error) {
      console.error('❌ Member error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
      // Remove the optimistic message on error
      if (tempId) {
        setMessages(prev => prev.filter(msg => msg._id !== tempId));
      }
      throw error;
    }
  };

  return { messages, loading, sendMessage, setMessages, refetch: fetchMessages };
};

// Simple icon components
const HomeIcon = () => (
  <View style={styles.iconPlaceholder}>
    <Text style={styles.iconText}>🏠</Text>
  </View>
);

const MenuIcon = () => (
  <View style={styles.iconPlaceholder}>
    <Text style={styles.iconText}>⋮</Text>
  </View>
);

const PlusIcon = () => (
  <View style={styles.iconPlaceholder}>
    <Text style={styles.boldIconText}>+</Text>
  </View>
);

const SendIcon = () => (
  <View style={styles.iconPlaceholder}>
    <Text style={styles.iconText}>→</Text>
  </View>
);

// Member Features
const memberFeatures = [
  { id: 1, title: 'Raise Complaint', icon: '⚠️', color: '#FF6B6B' },
  { id: 2, title: 'Raise Petition', icon: '📝', color: '#4ECDC4' },
  { id: 3, title: 'AI Assistant', icon: '🤖', color: '#8E44AD' },
  { id: 4, title: 'Anonymous Chat', icon: '💬', color: '#45B7D1' },
  { id: 5, title: 'Community Events', icon: '📅', color: '#96CEB4' },
  { id: 6, title: 'Resources', icon: '📚', color: '#FECA57' },
  { id: 7, title: 'Polling', icon: '🗳️', color: '#667eea' },
];

// Media options
const mediaOptions = [
  { id: 1, title: 'Photos', icon: '📷', color: '#4ECDC4' },
  { id: 2, title: 'Videos', icon: '🎥', color: '#FF6B6B' },
  { id: 3, title: 'Documents', icon: '📄', color: '#45B7D1' },
  { id: 4, title: 'Audio', icon: '🎵', color: '#96CEB4' },
  { id: 5, title: 'Location', icon: '📍', color: '#FECA57' },
  { id: 6, title: 'Contact', icon: '👤', color: '#FF9FF3' },
];

const MemberCommunityApp: React.FC = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<MemberCommunityRouteProp>();
  const communityId = Number(route.params?.community?.id || route.params?.community?.community_id || 36);

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [pollModalVisible, setPollModalVisible] = useState(false);
  
  // AI assistant state
  const [showAssistant, setShowAssistant] = useState(false);
  const [chatbotMessages, setChatbotMessages] = useState<ChatbotMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [isLoadingChatbot, setIsLoadingChatbot] = useState(false);
  const [hasLoadedBotHistory, setHasLoadedBotHistory] = useState(false);
  const [editingBotHistoryId, setEditingBotHistoryId] = useState<number | null>(null);
  const [sessionHash, setSessionHash] = useState<string | null>(null);

  useEffect(() => {
    // Only load if currentUserId is set
    if (currentUserId) {
      const cacheKey = `botMessageCache:${communityId}`;
      AsyncStorage.getItem(cacheKey).then((cached) => {
        if (cached) {
          try {
            const parsed: CachedChatbotMessage[] = JSON.parse(cached);
            setChatbotMessages(parsed.map(m => ({
              ...m,
              timestamp: new Date(m.timestamp)
            })));
          } catch (e) {
            console.error('Failed to parse cached bot messages', e);
          }
        }
      });
    }
  }, [communityId, currentUserId]);

  useEffect(() => {
    if (currentUserId && chatbotMessages.length > 0) {
      const cacheKey = `botMessageCache:${communityId}`;
      const payload = chatbotMessages.map(m => ({
        ...m,
        timestamp: m.timestamp.toISOString()
      }));
      AsyncStorage.setItem(cacheKey, JSON.stringify(payload)).catch(() => { });
    }
  }, [chatbotMessages, communityId, currentUserId]);

  const loadBotHistory = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const response = await nlpService.getBotHistory(Number(communityId), 50);
      if (response && response.success) {
        const history: BotHistoryItem[] = response.data?.history || response.history || [];
        const loaded: ChatbotMessage[] = [];
        history.forEach((item) => {
          const ts = item.created_at ? new Date(item.created_at) : new Date();
          loaded.push({
            id: `q-${item.id}`,
            text: item.question,
            isBot: false,
            historyId: item.id,
            timestamp: ts,
          });
          if (!isLimitMessage(item.answer)) {
            loaded.push({
              id: `a-${item.id}`,
              text: item.answer,
              isBot: true,
              historyId: item.id,
              confidence: item.confidence,
              timestamp: ts,
            });
          }
        });
        setChatbotMessages(loaded);
      }
    } catch (error) {
      console.error('Failed to load bot history:', error);
    }
  }, [communityId, currentUserId]);

  useEffect(() => {
    if (showAssistant && !hasLoadedBotHistory) {
      loadBotHistory().then(() => setHasLoadedBotHistory(true));
    }
  }, [showAssistant, hasLoadedBotHistory, loadBotHistory]);

  const isLimitMessage = (text: string) => {
    const t = String(text || '').toLowerCase();
    return (
      t.includes('limit') &&
      (t.includes('exceeded') || t.includes('quota') || t.includes('too many requests'))
    );
  };

  const splitBotSections = (text: string) => {
    const raw = String(text || '');
    // Support multiple label variants from LLM
    const parts = raw.split(/(?:Summary|Recommendations|Solutions|Suggested Actions|Action Plan):\s*/i);
    
    // If we have at least TWO parts, the first might be empty or a preamble, 
    // the second is usually the summary, and the third is recommendations.
    // However, usually it's "Summary: ... Solutions: ..."
    
    let summary = '';
    let recommendations = '';
    
    if (raw.toLowerCase().includes('summary:') && raw.toLowerCase().includes('solutions:')) {
      const sIndex = raw.toLowerCase().indexOf('summary:');
      const rIndex = raw.toLowerCase().indexOf('solutions:');
      if (sIndex < rIndex) {
        summary = raw.substring(sIndex + 8, rIndex).trim();
        recommendations = raw.substring(rIndex + 10).trim();
      }
    } else if (raw.toLowerCase().includes('summary:') && raw.toLowerCase().includes('recommendations:')) {
      const sIndex = raw.toLowerCase().indexOf('summary:');
      const rIndex = raw.toLowerCase().indexOf('recommendations:');
      if (sIndex < rIndex) {
        summary = raw.substring(sIndex + 8, rIndex).trim();
        recommendations = raw.substring(rIndex + 16).trim();
      }
    }
    
    if (!summary && !recommendations) {
      // Fallback to regex split if explicit labels aren't found in order
      const match = raw.split(/(?:Recommendations|Solutions|Suggested Actions|Action Plan):\s*/i);
      if (match.length >= 2) {
        summary = match[0].replace(/Summary:\s*/i, '').trim();
        recommendations = match.slice(1).join('\n').trim();
      } else {
        summary = raw.trim();
      }
    }
    
    return { summary, recommendations };
  };

  const renderChatbotMessage = (msg: ChatbotMessage, idx: number) => {
    const isBot = msg.isBot;
    const { summary, recommendations } = isBot ? splitBotSections(msg.text) : { summary: msg.text, recommendations: '' };

    return (
      <View
        key={msg.id || idx}
        style={{
          alignSelf: isBot ? 'flex-start' : 'flex-end',
          backgroundColor: isBot ? '#F8F9FA' : '#E7FFDB',
          padding: 14,
          borderRadius: 20,
          borderTopLeftRadius: isBot ? 4 : 20,
          borderTopRightRadius: isBot ? 20 : 4,
          marginBottom: 12,
          maxWidth: '85%',
          elevation: 2,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.15,
          shadowRadius: 2,
          borderWidth: isBot ? 1 : 0,
          borderColor: '#EDF2F7',
        }}
      >
        {isBot ? (
          <View>
            {summary ? (
              <View style={styles.chatbotSectionBlock}>
                {recommendations ? <Text style={styles.chatbotSectionTitle}>Summary</Text> : null}
                <Text style={{ color: '#2D3748', fontSize: 15, lineHeight: 22 }}>{summary}</Text>
              </View>
            ) : null}
            
            {recommendations ? (
              <View style={[styles.chatbotSectionBlock, { marginTop: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10 }]}>
                <Text style={[styles.chatbotSectionTitle, { color: '#38A169' }]}>Proposed Solutions</Text>
                <Text style={{ color: '#2D3748', fontSize: 15, lineHeight: 22 }}>{recommendations}</Text>
              </View>
            ) : null}
            
            {msg.sources && msg.sources.length > 0 && (
              <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#CBD5E0' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#718096', marginBottom: 4 }}>SOURCES</Text>
                {msg.sources.slice(0, 3).map((s, i) => (
                  <Text key={i} style={{ fontSize: 11, color: '#A0AEC0' }}>• {s.title || 'Community Document'}</Text>
                ))}
              </View>
            )}
          </View>
        ) : (
          <Text style={{ color: '#1A202C', fontSize: 15, lineHeight: 20 }}>{msg.text}</Text>
        )}
        
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 }}>
          {isBot && msg.confidence && (
            <Text style={{ fontSize: 10, color: '#A0AEC0', marginRight: 8 }}>
              {msg.confidence}% confident
            </Text>
          )}
          <Text style={{ fontSize: 10, color: '#718096' }}>
            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  const handleAskBot = async () => {
    const prompt = question.trim();
    if (!prompt) return;

    const userMessage: ChatbotMessage = {
      id: Date.now().toString(),
      text: prompt,
      isBot: false,
      timestamp: new Date(),
    };

    setChatbotMessages((prev) => [...prev, userMessage]);
    setQuestion('');
    setIsLoadingChatbot(true);

    try {
      const response = await nlpService.askBot(prompt, Number(communityId), sessionHash || undefined);
      if (response && response.success) {
        const botMessage: ChatbotMessage = {
          id: (Date.now() + 1).toString(),
          text: response.data.answer || 'No response from AI.',
          isBot: true,
          sources: response.data.sources,
          confidence: response.data.confidence,
          timestamp: new Date(),
        };
        setChatbotMessages((prev) => [...prev, botMessage]);
        setSessionHash(response.data.sessionHash || null);
      }
    } catch (error) {
      console.error('AI query failed:', error);
      const errorMessage: ChatbotMessage = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error. Please try again later.',
        isBot: true,
        timestamp: new Date(),
      };
      setChatbotMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoadingChatbot(false);
    }
  };

  const handleClearBotChat = async () => {
    Alert.alert('Clear AI chat', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            await nlpService.clearBotHistory(Number(communityId));
            setChatbotMessages([]);
            setSessionHash(null);
          } catch (e) {
            console.error('Failed to clear bot history', e);
          }
        }
      }
    ]);
  };
  const [messageText, setMessageText] = useState('');
  const [isValidatingAccess, setIsValidatingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  const navigation = useNavigation<MemberCommunityNavigationProp>();
  const community = route.params?.community;
  const scrollViewRef = useRef<ScrollView>(null);

  // Extract current user ID from token and validate role
  useEffect(() => {
    const validateAccess = async () => {
      try {
        setIsValidatingAccess(true);
        const token = await AsyncStorage.getItem('authToken');

        if (!token) {
          router.replace('/LoginScreen');
          return;
        }

        const tokenPayload = JSON.parse(atob(token.split('.')[1]));

        // Validate that user has MEMBER role in this community
        const membershipResponse = await fetch(
          `${API_BASE_URL}/community_members/${communityId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (membershipResponse.ok) {
          const membershipData = await membershipResponse.json();
          const userMembership = membershipData.members.find(
            (member: any) => member.user_id === tokenPayload.user_id
          );

          if (!userMembership || userMembership.role !== 'MEMBER') {
            // User is not MEMBER in this community
            Alert.alert(
              'Access Denied',
              'Member access required. You must be a community member to access this panel.',
              [
                {
                  text: 'Switch to Admin View',
                  onPress: () => {
                    if (userMembership && userMembership.role === 'HEAD') {
                      router.replace({
                        pathname: '/AdminCommunityApp',
                        params: { community: JSON.stringify(community) }
                      });

                    } else {
                      AsyncStorage.clear();
                      router.replace('/LoginScreen');
                    }
                  }
                },
                {
                  text: 'Logout',
                  onPress: () => {
                    AsyncStorage.clear();
                    router.replace('/LoginScreen');
                  },
                  style: 'destructive'
                }
              ]
            );
            setHasAccess(false);
            return;
          }

          // User has valid MEMBER access
          setCurrentUserId(tokenPayload.user_id);
          setCurrentUserName(tokenPayload.full_name || 'You');
          setHasAccess(true);
        } else {
          // Failed to verify membership
          await AsyncStorage.clear();
          router.replace('/LoginScreen');
        }
      } catch (error) {
        console.error('Error validating access:', error);
        await AsyncStorage.clear();
        router.replace('/LoginScreen');
      } finally {
        setIsValidatingAccess(false);
      }
    };

    validateAccess();
  }, [communityId, community, navigation]);

  const { messages, loading, sendMessage, setMessages } = useCommunityMessages(communityId, currentUserId);

  // Auto-scroll when messages change
  useEffect(() => {
    if (hasAccess) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, hasAccess]);

  // Show loading screen while validating access
  if (isValidatingAccess) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Validating access...</Text>
      </View>
    );
  }

  // Show access denied if validation failed
  if (!hasAccess) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Access Denied</Text>
        <Text style={styles.errorSubtext}>You don&apos;t have permission to access this member panel.</Text>
      </View>
    );
  }

  const openModal = () => setModalVisible(true);
  const closeModal = () => setModalVisible(false);
  const openMediaModal = () => setMediaModalVisible(true);
  const closeMediaModal = () => setMediaModalVisible(false);

  const handleFeaturePress = (feature: any) => {

    if (feature.title === 'Raise Petition') {
      navigation.navigate('RaisePetitionScreen' as any, {
        communityId: community?.id || community?.community_id || 36,
        communityName: community?.name || 'Community',
        visibility: 'public'
      });
    } else if (feature.title === 'Raise Complaint') {
      navigation.navigate('RaiseComplaintScreen' as any, {
        communityId: community?.id || community?.community_id || 36,
        communityName: community?.name || 'Community',
      });
    } else if (feature.title === 'Community Events') {
      navigation.navigate('EventsScreenMember' as any, {
        communityId: community?.id || community?.community_id || 36,
        community: community
      });
    } else if (feature.title === 'Anonymous Chat') {
      const communityId = community?.id || community?.community_id || 36;
      navigation.navigate('AnonymousMessageScreen' as any, {
        communityId: String(communityId),
        communityName: community?.name || 'Community',
        onSend: async (payload: { text: string; headIds: string[]; attachments?: any[] }) => {
          try {
            const numericCommunityId = Number(communityId);
            if (isNaN(numericCommunityId)) {
              throw new Error(`Invalid community ID: ${communityId}`);
            }

            const apiPayload = {
              text: payload.text,
              headIds: payload.headIds || [],
              attachments: payload.attachments || [],
              communityId: numericCommunityId
            };

            const token = await AsyncStorage.getItem('token');
            const sendHeaders: any = { 'Content-Type': 'application/json' };

            if (token && token !== 'undefined' && token !== 'null') {
              sendHeaders['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`${API_BASE_URL}/public/anonymous_messages`, {
              method: 'POST',
              headers: sendHeaders,
              body: JSON.stringify(apiPayload)
            });

            if (!response.ok) {
              const errorData = await response.text();
              throw new Error(`Failed to send message: ${response.status} - ${errorData}`);
            }

            const result = await response.json();

            if (Platform.OS === 'web') {
              alert('Anonymous message sent successfully!');
            } else {
              Alert.alert('Success', 'Anonymous message sent successfully!');
            }

            return result;
          } catch (error) {
            console.error('❌ Error sending anonymous message:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to send anonymous message';

            if (Platform.OS === 'web') {
              alert(`Error: ${errorMessage}`);
            } else {
              Alert.alert('Error', errorMessage);
            }

            throw error;
          }
        }
      });
    } else    if (feature.title === 'AI Assistant') {
      setShowAssistant(true);
    } else if (feature.title === 'Polling') {
      navigation.navigate('PollsListScreen' as any, {
        communityId: community?.id || community?.community_id || 36,
        community: community,
        isAdmin: false
      });
    }

    closeModal();
  };

  const handleMediaOptionPress = (option: any) => {
    closeMediaModal();
  };

  // ✅ FIXED: handleSend with proper type handling
  const handleSend = async () => {
    if (messageText.trim() && currentUserId && currentUserName) {
      const messageContent = messageText.trim();
      setMessageText('');

      const tempId = `temp-${Date.now()}-${Math.random()}`; // More unique temp ID

      // ✅ Create optimistic message with NUMBER sender_id
      const tempMessage: Message = {
        _id: tempId,
        sender_id: Number(currentUserId), // ✅ Ensure it's a number
        full_name: currentUserName,
        message_type: 'text',
        content: messageContent,
        created_at: new Date().toISOString(),
        profile_type: 'member',
      };


      // Add optimistic message
      setMessages(prev => [...prev, tempMessage]);

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Send to server
      try {
        await sendMessage(messageContent, 'text', [], tempId);
      } catch (error) {
        // Error handling is done in sendMessage
        console.error('Member failed to send message:', error);
      }
    }
  };

  // Group messages by date
  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { [key: string]: Message[] } = {};

    messages.forEach(msg => {
      const date = msg.created_at ? new Date(msg.created_at).toDateString() : 'Unknown Date';
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(msg);
    });

    return groups;
  };
  const handleLogout = async () => {
    try {
      // Clear ALL auth-related storage
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('userId');

      // Clear any other app-specific storage
      await AsyncStorage.clear(); // Nuclear option - clears everything


      // Navigate to login screen
      router.replace('/LoginScreen');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  const formatDateHeader = (dateString: string) => {
    if (dateString === 'Unknown Date') return dateString;

    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  // Sort messages by date and time
  const sortedMessages = [...messages].sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateA - dateB;
  });

  const messageGroups = groupMessagesByDate(sortedMessages);
  const orderedDates = Object.keys(messageGroups).sort((a, b) => {
    if (a === 'Unknown Date') return 1;
    if (b === 'Unknown Date') return -1;
    return new Date(a).getTime() - new Date(b).getTime();
  });

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={styles.background}
      >
        <SafeAreaView style={styles.container}>

      {/* WhatsApp-style Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>


        <View style={styles.headerCenter}>
          <View style={styles.communityAvatar}>
            <HomeIcon />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.communityName}>{community?.name || 'Community'}</Text>
            <Text style={styles.communitySubtitle}>
              {community?.member_count != null ? `${community.member_count} members` : 'Members'} • Online
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.headerButton}>
          <MenuIcon />
        </TouchableOpacity>
      </View>

      {/* Messages with Date Headers */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesWrapper}
        contentContainerStyle={styles.messagesContent}
      >
        {/* ✅ FIXED: Message rendering with proper alignment */}
        {orderedDates.map((dateKey) => (
          <View key={dateKey}>
            {/* Date Header */}
            <View style={styles.dateHeader}>
              <View style={styles.dateHeaderBadge}>
                <Text style={styles.dateHeaderText}>{formatDateHeader(dateKey)}</Text>
              </View>
            </View>

            {/* Messages for this date */}
            {messageGroups[dateKey].map((message, msgIndex) => {
              // ✅ CRITICAL FIX: Ensure both IDs are numbers and handle null cases
              const messageSenderId = message.sender_id ? Number(message.sender_id) : null;
              const currentUserIdNum = currentUserId ? Number(currentUserId) : null;

              // ✅ Only mark as "my message" if both IDs exist and match
              const isOwn = messageSenderId !== null &&
                currentUserIdNum !== null &&
                messageSenderId === currentUserIdNum;

              const isAnnouncement = message.message_type === 'announcement';
              const isSOS = message.message_type === 'sos';
              const isComplaint = message.message_type === 'complaint';
              const isPetition = message.message_type === 'petition';
              const isSpecialMessage = isAnnouncement || isSOS || isComplaint || isPetition;


              return (
                <View
                  key={`msg-${message.message_id || message.id || message._id}-${msgIndex}`}
                  style={[
                    styles.messageWrapper,
                    isSpecialMessage
                      ? styles.specialMessageWrapper
                      : isOwn
                        ? styles.ownMessageWrapper    // ✅ Right side for my messages
                        : styles.otherMessageWrapper, // ✅ Left side for others
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      isAnnouncement && styles.announcementMessage,
                      isSOS && styles.sosMessage,
                      isComplaint && styles.complaintMessage,
                      isPetition && styles.petitionMessage,
                      !isSpecialMessage && (isOwn ? styles.ownMessage : styles.otherMessage),
                    ]}
                  >
                    {/* ✅ Show sender name ONLY for messages from others */}
                    {!isOwn && !isSpecialMessage && message.full_name && (
                      <Text style={styles.senderName}>{message.full_name}</Text>
                    )}

                    {/* Special message labels */}
                    {isAnnouncement && (
                      <Text style={styles.announcementLabel}>📢 ANNOUNCEMENT</Text>
                    )}
                    {isSOS && (
                      <Text style={styles.sosLabel}>🚨 SOS ALERT</Text>
                    )}
                    {isComplaint && (
                      <Text style={styles.complaintLabel}>⚠️ COMPLAINT</Text>
                    )}
                    {isPetition && (
                      <Text style={styles.petitionLabel}>📋 PETITION</Text>
                    )}

                    {/* Message content */}
                    <Text
                      style={[
                        styles.messageText,
                        isOwn && !isSpecialMessage && styles.ownMessageText,
                        isAnnouncement && styles.announcementText,
                        isSOS && styles.sosText,
                        isComplaint && styles.complaintText,
                        isPetition && styles.petitionText,
                      ]}
                    >
                      {message.content}
                    </Text>

                    {/* Message time with checkmark */}
                    <View style={styles.messageFooter}>
                      <Text
                        style={[
                          styles.messageTime,
                          isOwn && !isSpecialMessage && styles.ownMessageTime,
                        ]}
                      >
                        {message.created_at
                          ? new Date(message.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                          : ''}
                      </Text>
                      {/* ✅ Show checkmark ONLY for my messages with message_id */}
                      {isOwn && !isSpecialMessage && message.message_id && (
                        <Text style={styles.checkMark}>✓✓</Text>
                      )}
                    </View>

                    {/* WhatsApp-style tail - only for non-special messages */}
                    {!isSpecialMessage && (
                      <View
                        style={[
                          styles.messageTail,
                          isOwn ? styles.ownMessageTail : styles.otherMessageTail,
                        ]}
                      />
                    )}

                    {/* POLL CARD INTEGRATION */}
                    {message.message_type === 'poll' && (
                      <PollMessageCard
                        communityId={Number(communityId)}
                        pollId={Number(message.content || '0')}
                        currentUserId={Number(currentUserId)}
                        isAdmin={false}

                        sentByMe={isOwn}
                        createdAt={message.created_at || ''}
                      />
                    )}
                  </View>
                </View>

              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.floatingButton} onPress={openModal}>
        <PlusIcon />
      </TouchableOpacity>

      {/* Message Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <TouchableOpacity onPress={openMediaModal} style={styles.attachButton}>
            <Text style={styles.attachText}>+</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Type a message"
            placeholderTextColor="#888"
            value={messageText}
            onChangeText={setMessageText}
            multiline
            onSubmitEditing={handleSend}
          />

          <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
            <SendIcon />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Features Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Community Features</Text>
              <TouchableOpacity onPress={closeModal}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {memberFeatures.map((feature) => (
                <TouchableOpacity
                  key={feature.id}
                  style={styles.featureItem}
                  onPress={() => handleFeaturePress(feature)}
                >
                  <View style={[styles.featureIcon, { backgroundColor: feature.color }]}>
                    <Text style={styles.featureEmoji}>{feature.icon}</Text>
                  </View>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Media Attachment Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={mediaModalVisible}
        onRequestClose={closeMediaModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.mediaModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share Media</Text>
              <TouchableOpacity onPress={closeMediaModal}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.mediaGrid}>
              {mediaOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={styles.mediaOption}
                  onPress={() => handleMediaOptionPress(option)}
                >
                  <View style={[styles.mediaIconContainer, { backgroundColor: option.color }]}>
                    <Text style={styles.mediaEmoji}>{option.icon}</Text>
                  </View>
                  <Text style={styles.mediaTitle}>{option.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Poll Creation Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={pollModalVisible}
        onRequestClose={() => setPollModalVisible(false)}
      >
        <PollCreateScreen
          communityId={String(communityId)}
          onCancel={() => setPollModalVisible(false)}
          onCreated={(poll: any) => {
            setPollModalVisible(false);
          }}
        />
      </Modal>
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAssistant}
        onRequestClose={() => setShowAssistant(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: height * 0.85 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>AI Community Assistant</Text>
              <View style={{ flexDirection: 'row', gap: 15 }}>
                <TouchableOpacity onPress={handleClearBotChat}>
                  <Text style={{ color: '#E53E3E', fontSize: 16 }}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowAssistant(false)}>
                  <Text style={styles.closeButton}>×</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              style={{ flex: 1, padding: 15 }}
              contentContainerStyle={{ paddingBottom: 20 }}
              ref={(ref) => ref?.scrollToEnd({ animated: true })}
            >
              {chatbotMessages.length === 0 ? (
                <View style={{ alignItems: 'center', marginTop: 40 }}>
                  <Text style={{ fontSize: 40 }}>🤖</Text>
                  <Text style={{ color: '#718096', textAlign: 'center', marginTop: 10, fontSize: 16 }}>
                    Hello! I'm your community's AI assistant. Ask me anything about rules, events, or local info!
                  </Text>
                </View>
              ) : (
                chatbotMessages.map((msg, idx) => renderChatbotMessage(msg, idx))
              )}
              {isLoadingChatbot && (
                <View style={{ alignSelf: 'flex-start', backgroundColor: '#F0F2F5', padding: 12, borderRadius: 15, marginBottom: 10 }}>
                  <ActivityIndicator size="small" color="#075E54" />
                </View>
              )}
            </ScrollView>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Ask something..."
                placeholderTextColor="#A0AEC0"
                value={question}
                onChangeText={setQuestion}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendButton, !question.trim() && { opacity: 0.5 }]}
                disabled={!question.trim() || isLoadingChatbot}
                onPress={handleAskBot}
              >
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Ask</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
};

export default MemberCommunityApp;

// Styles (keeping original styles unchanged)
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  iconPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 18,
    color: '#94a3b8',
  },
  boldIconText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 8,
  },
  backArrow: {
    fontSize: 24,
    color: 'white',
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  communityAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#128C7E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  communityName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  communitySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  headerButton: {
    padding: 8,
  },
  messagesWrapper: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 8,
  },
  dateHeader: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateHeaderBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  dateHeaderText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  messageWrapper: {
    marginVertical: 2,
    paddingHorizontal: 8,
  },
  ownMessageWrapper: {
    alignItems: 'flex-end',
  },
  otherMessageWrapper: {
    alignItems: 'flex-start',
  },
  specialMessageWrapper: {
    alignItems: 'center',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  ownMessage: {
    backgroundColor: '#6366f1',
    borderTopRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderTopLeftRadius: 4,
  },
  announcementMessage: {
    backgroundColor: '#FFF9E6',
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
    maxWidth: '90%',
    borderRadius: 8,
  },
  sosMessage: {
    backgroundColor: '#FFE6E6',
    borderLeftWidth: 4,
    borderLeftColor: '#FF4757',
    maxWidth: '90%',
    borderRadius: 8,
  },
  complaintMessage: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: '#FF8C00',
    maxWidth: '90%',
    borderRadius: 8,
  },
  petitionMessage: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: '#4A90E2',
    maxWidth: '90%',
    borderRadius: 8,
  },
  messageTail: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
  },
  ownMessageTail: {
    right: -8,
    top: 0,
    borderTopWidth: 10,
    borderRightWidth: 8,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopColor: '#DCF8C6',
    borderRightColor: 'transparent',
  },
  otherMessageTail: {
    left: -8,
    top: 0,
    borderTopWidth: 10,
    borderLeftWidth: 8,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderTopColor: 'white',
    borderLeftColor: 'transparent',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#818cf8',
    marginBottom: 4,
  },
  announcementLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#856404',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  sosLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF4757',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  complaintLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF8C00',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  petitionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4A90E2',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#f8fafc',
    marginBottom: 2,
  },
  ownMessageText: {
    color: '#ffffff',
  },
  announcementText: {
    color: '#856404',
    fontWeight: '500',
  },
  sosText: {
    color: '#FF4757',
    fontWeight: '600',
  },
  complaintText: {
    color: '#FF8C00',
    fontWeight: '500',
  },
  petitionText: {
    color: '#4A90E2',
    fontWeight: '500',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  messageTime: {
    fontSize: 10,
    color: '#94a3b8',
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  checkMark: {
    fontSize: 16,
    color: '#4FC3F7',
    marginLeft: 4,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 78,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  attachButton: {
    padding: 8,
    marginRight: 4,
  },
  attachText: {
    fontSize: 24,
    color: '#075E54',
    fontWeight: 'bold',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
    marginRight: 12,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  closeButton: {
    fontSize: 24,
    color: '#888',
    fontWeight: '300',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  chatbotSectionBlock: {
    marginBottom: 4,
  },
  chatbotSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A5568',
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureEmoji: {
    fontSize: 24,
  },
  featureTitle: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  featureArrow: {
    fontSize: 24,
    color: '#CCC',
  },
  mediaModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
  },
  mediaOption: {
    width: width / 3 - 20,
    alignItems: 'center',
    marginBottom: 24,
    marginHorizontal: 6,
  },
  mediaIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  mediaEmoji: {
    fontSize: 32,
  },
  mediaTitle: {
    fontSize: 13,
    color: '#333',
    textAlign: 'center',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4A5568',
  },
  errorText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E53E3E',
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
});