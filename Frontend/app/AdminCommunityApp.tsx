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

// Poll imports
import PollCreateScreen from './PollCreateScreen';
import PollMessageCard from './PollMessageCard';


// Chatbot imports
import nlpService from '../lib/nlpService';

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

type AdminCommunityRouteProp = RouteProp<{ AdminCommunityApp: { community: Community } }, 'AdminCommunityApp'>;
type AdminCommunityNavigationProp = NavigationProp<any>;

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

interface UpdateMessageResponse {
  message_id?: number;
  content?: string;
  created_at?: string;
}

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

const { width, height } = Dimensions.get('window');


// Custom hook for real-time messages
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
      console.error('âŒ Error fetching messages:', error);
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

    // âœ… FIXED: Handle incoming messages with proper sender_id validation
    socket.on('new_message', (message: Message) => {
      // Ensure sender_id is a number or undefined (never null)
      const normalizedMessage: Message = {
        ...message,
        sender_id:
          message.sender_id !== undefined && message.sender_id !== null
            ? Number(message.sender_id)
            : undefined,
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

    // Listen for message updates
    socket.on('message_updated', (updatedMessage: Message) => {
      setMessages(prev => {
        return prev.map(msg => {
          if ((msg.message_id && msg.message_id === updatedMessage.message_id) ||
            (msg.id && msg.id === updatedMessage.id)) {
            return updatedMessage;
          }
          return msg;
        });
      });
    });

    // Listen for message deletions
    socket.on('message_deleted', (deletedMessageId: number) => {
      setMessages(prev => {
        return prev.filter(msg =>
          msg.message_id !== deletedMessageId && msg.id !== deletedMessageId
        );
      });
    });

    return () => {
      socket.emit('leave_community', communityId);
      socket.disconnect();
    };
  }, [communityId, currentUserId]);

  const sendMessage = async (content: string, type: string = 'text', attachments: any[] = [], tempId?: string) => {
    try {
      const token = await AsyncStorage.getItem('authToken');

      // âœ… Validate token and current user before sending
      if (!token || !currentUserId) {
        throw new Error('Authentication required');
      }

      // âœ… Verify token contains correct user_id
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

      const newMessage = await response.json();

      // Merge server response into state (in case socket event is delayed or missed)
      setMessages(prev => {
        const withoutTemp = tempId ? prev.filter(m => m._id !== tempId) : prev;
        const exists = withoutTemp.some(m => m.message_id === newMessage.message_id);
        if (exists) return withoutTemp;
        const merged: Message = {
          ...newMessage,
          sender_id: newMessage.sender_id ?? undefined,
        };
        return [...withoutTemp, merged].sort((a, b) => {
          const tA = new Date(a.created_at || 0).getTime();
          const tB = new Date(b.created_at || 0).getTime();
          return tA - tB;
        });
      });

      return newMessage;
    } catch (error) {
      console.error('âŒ Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
      // Remove the optimistic message on error
      if (tempId) {
        setMessages(prev => prev.filter(msg => msg._id !== tempId));
      }
      throw error;
    }
  };

  const sendAnnouncement = async (content: string) => {
    await sendMessage(content, 'announcement');
  };

  const updateMessage = async (messageId: number, content: string) => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(
      `${API_BASE_URL}/communities/${communityId}/messages/${messageId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update message: ${errorText}`);
    }

    const updatedMessage: UpdateMessageResponse = await response.json();
    setMessages((prev) =>
      prev.map((msg) =>
        (msg.message_id && msg.message_id === updatedMessage.message_id) ||
          (msg.id && msg.id === updatedMessage.message_id)
          ? { ...msg, ...updatedMessage }
          : msg
      )
    );
    return updatedMessage;
  };

  const deleteMessage = async (messageId: number) => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(
      `${API_BASE_URL}/communities/${communityId}/messages/${messageId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete message: ${errorText}`);
    }

    setMessages((prev) =>
      prev.filter((msg) => msg.message_id !== messageId && msg.id !== messageId)
    );
  };

  return {
    messages,
    loading,
    sendMessage,
    sendAnnouncement,
    updateMessage,
    deleteMessage,
    setMessages,
    refetch: fetchMessages,
  };
};

// Simple icon components
const HomeIcon = () => (
  <View style={styles.iconPlaceholder}>
    <Text style={styles.iconText}>H</Text>
  </View>
);

const MenuIcon = () => (
  <View style={styles.iconPlaceholder}>
    <Text style={styles.iconText}>...</Text>
  </View>
);

const PlusIcon = () => (
  <View style={styles.iconPlaceholder}>
    <Text style={styles.boldIconText}>+</Text>
  </View>
);

const SendIcon = () => (
  <View style={styles.iconPlaceholder}>
    <Text style={styles.iconText}>{'>'}</Text>
  </View>
);

// Admin Features
const adminFeatures = [
  { id: 1, title: 'Send Announcement', icon: 'AN', color: '#FFC107' },
  { id: 2, title: 'View Complaints', icon: 'CP', color: '#FF6B6B' },
  { id: 3, title: 'View Petitions', icon: 'PT', color: '#4ECDC4' },
  { id: 4, title: 'Manage Events', icon: 'EV', color: '#96CEB4' },
  { id: 5, title: 'View Anonymous', icon: '💬', color: '#45B7D1' },
  { id: 6, title: 'Member Management', icon: 'MM', color: '#45B7D1' },
  { id: 7, title: 'Analytics', icon: 'ST', color: '#9B59B6' },
  { id: 8, title: 'Polling', icon: '🗳️', color: '#667eea' },
];


// Media options
const mediaOptions = [
  { id: 1, title: 'Photos', icon: 'PH', color: '#4ECDC4' },
  { id: 2, title: 'Videos', icon: 'VD', color: '#FF6B6B' },
  { id: 3, title: 'Documents', icon: 'DC', color: '#45B7D1' },
  { id: 4, title: 'Audio', icon: 'AU', color: '#96CEB4' },
  { id: 5, title: 'Location', icon: 'LO', color: '#FECA57' },
  { id: 6, title: 'Contact', icon: 'CT', color: '#FF9FF3' },
];

const AdminCommunityApp: React.FC = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<AdminCommunityRouteProp>();
  const communityId = Number(route.params?.community?.id || route.params?.community?.community_id || 36);

  const [modalVisible, setModalVisible] = useState(false);
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [announcementModalVisible, setAnnouncementModalVisible] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [announcementText, setAnnouncementText] = useState('');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [isValidatingAccess, setIsValidatingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);


  const [pollModalVisible, setPollModalVisible] = useState(false);


  const navigation = useNavigation<AdminCommunityNavigationProp>();
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

        // Validate that user has HEAD role in this community
        const membershipResponse = await fetch(
          `${API_BASE_URL}/community_members/${communityId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (membershipResponse.ok) {
          const membershipData = await membershipResponse.json();
          const userMembership = membershipData.members.find(
            (member: any) => member.user_id === tokenPayload.user_id
          );

          if (!userMembership || userMembership.role !== 'HEAD') {
            // User is not HEAD in this community
            Alert.alert(
              'Access Denied',
              'Admin access required. You must be a community head to access this panel.',
              [
                {
                  text: 'Switch to Member View',
                  onPress: () => {
                    if (userMembership && userMembership.role === 'MEMBER') {
                      router.replace('/MemberCommunityApp');
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

          // User has valid HEAD access
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

  const {
    messages,
    loading,
    sendMessage,
    sendAnnouncement,
    updateMessage,
    deleteMessage,
    setMessages,
  } = useCommunityMessages(communityId, currentUserId);

  // Auto-scroll to bottom when messages change
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
        <Text style={styles.errorSubtext}>You don&apos;t have permission to access this admin panel.</Text>
      </View>
    );
  }

  const openModal = () => setModalVisible(true);
  const closeModal = () => setModalVisible(false);
  const openMediaModal = () => setMediaModalVisible(true);
  const closeMediaModal = () => setMediaModalVisible(false);
  const openAnnouncementModal = () => setAnnouncementModalVisible(true);
  const closeAnnouncementModal = () => setAnnouncementModalVisible(false);

  const handleFeaturePress = (feature: any) => {

    if (feature.title === 'Send Announcement') {
      openAnnouncementModal();
    } else if (feature.title === 'View Complaints') {
      navigation.navigate('ViewComplaintsScreen' as any, {
        communityId: community?.id || community?.community_id || 36,
        community: community
      });
    } else if (feature.title === 'View Petitions') {
      navigation.navigate('ViewPetitionsScreen' as any, {
        communityId: community?.id || community?.community_id || 36,
        community: community
      });
    } else if (feature.title === 'View Anonymous') {
      navigation.navigate('AnonymousMessagesAdminScreen' as any, {
        communityId: community?.id || community?.community_id || 36,
        communityName: community?.name || 'Community',
      });
    } else if (feature.title === 'Manage Events') {
      navigation.navigate('EventsScreen' as any, {
        communityId: community?.id || community?.community_id || 36,
        community: community
      });
    } else if (feature.title === 'Member Management') {
      navigation.navigate('MemberManagementScreen' as any, {
        communityId: community?.id || community?.community_id || 36,
      });
    } else if (feature.title === 'Analytics') {
      navigation.navigate('AnalyticsScreen' as any, {
        communityId: community?.id || community?.community_id || 36,
      });
    } else if (feature.title === 'Polling') {
      navigation.navigate('PollsListScreen' as any, {
        communityId: community?.id || community?.community_id || 36,
        community: community,
        isAdmin: true
      });
    }


    closeModal();
  };

  const handleMediaOptionPress = (option: any) => {
    closeMediaModal();
  };

  const handleSend = async () => {
    if (messageText.trim() && currentUserId && currentUserName) {
      const messageContent = messageText.trim();
      setMessageText('');

      const tempId = `temp-${Date.now()}-${Math.random()}`; // More unique temp ID

      const tempMessage: Message = {
        _id: tempId,
        sender_id: Number(currentUserId),
        full_name: currentUserName,
        message_type: 'text',
        content: messageContent,
        created_at: new Date().toISOString(),
        profile_type: 'admin',
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
        console.error('Failed to send message:', error);
      }
    }
  };

  const handleSendOrEdit = async () => {
    const content = messageText.trim();
    if (!content || !currentUserId || !currentUserName) return;

    if (editingMessageId) {
      try {
        await updateMessage(editingMessageId, content);
        setEditingMessageId(null);
        setMessageText('');
      } catch (error) {
        console.error('Failed to update message:', error);
        Alert.alert('Error', 'Failed to edit message');
      }
      return;
    }

    await handleSend();
  };

  const handleMessageActions = (message: Message) => {
    const msgId = message.message_id || message.id;
    if (!msgId) return;

    Alert.alert(
      'Message options',
      'Choose an action',
      [
        {
          text: 'Edit',
          onPress: () => {
            setEditingMessageId(msgId);
            setMessageText(message.content || '');
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMessage(msgId);
              if (editingMessageId === msgId) {
                setEditingMessageId(null);
                setMessageText('');
              }
            } catch (error) {
              console.error('Failed to delete message:', error);
              Alert.alert('Error', 'Failed to delete message');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const handleSendAnnouncement = async () => {
    if (announcementText.trim()) {
      await sendAnnouncement(announcementText.trim());
      setAnnouncementText('');
      closeAnnouncementModal();
      Alert.alert('Success', 'Announcement sent to all members!');
    }
  };

  // Group messages by date
  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';
    let currentGroup: Message[] = [];

    messages.forEach(msg => {
      const msgDate = msg.created_at ? new Date(msg.created_at).toDateString() : 'Unknown Date';

      if (msgDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, messages: currentGroup });
        }
        currentDate = msgDate;
        currentGroup = [msg];
      } else {
        currentGroup.push(msg);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, messages: currentGroup });
    }

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
      console.error('âŒ Logout error:', error);
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

  const messageGroups = groupMessagesByDate(messages);

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={styles.background}
      >
        <SafeAreaView style={styles.container}>

      {/* Admin Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.communityAvatar}>
            <HomeIcon />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.communityName}>{community?.name || 'Community'}</Text>
            <Text style={styles.communitySubtitle}>
              {community?.member_count != null ? `${community.member_count} members` : 'Members'} - Online
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
        {/* Replace the entire message groups mapping section (around line 450-550) */}
        {messageGroups.map((group, groupIndex) => (
          <View key={`${group.date}-${groupIndex}`}>
            {/* Date Header */}
            <View style={styles.dateHeader}>
              <View style={styles.dateHeaderBadge}>
                <Text style={styles.dateHeaderText}>{formatDateHeader(group.date)}</Text>
              </View>
            </View>

            {/* Messages for this date */}
            {group.messages.map((message, msgIndex) => {
              const messageSenderId = message.sender_id ? Number(message.sender_id) : null;
              const currentUserIdNum = currentUserId ? Number(currentUserId) : null;

              const isMyMessage = messageSenderId !== null &&
                currentUserIdNum !== null &&
                messageSenderId === currentUserIdNum;

              const isAnnouncement = message.message_type === 'announcement';
              const isSOS = message.message_type === 'sos';
              const isComplaint = message.message_type === 'complaint';
              const isPetition = message.message_type === 'petition';
              const isSpecialMessage = isAnnouncement || isSOS || isComplaint || isPetition;


              return (
                <TouchableOpacity
                  key={`${message.message_id || message.id || message._id}-${msgIndex}`}
                  onLongPress={() => {
                    if (isMyMessage && !isSpecialMessage) {
                      handleMessageActions(message);
                    }
                  }}
                  delayLongPress={350}
                  activeOpacity={0.9}
                  style={[
                    styles.messageTouchableArea,
                    styles.messageWrapper,
                    isSpecialMessage
                      ? styles.specialMessageWrapper
                      : isMyMessage
                        ? styles.adminMessageWrapper  // âœ… Right side for my messages
                        : styles.memberMessageWrapper, // âœ… Left side for others
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      isAnnouncement && styles.announcementMessage,
                      isSOS && styles.sosMessage,
                      isComplaint && styles.complaintMessage,
                      isPetition && styles.petitionMessage,
                      !isSpecialMessage && (isMyMessage ? styles.adminMessage : styles.memberMessage),
                    ]}
                  >
                    {!isMyMessage && !isSpecialMessage && message.full_name && (
                      <Text style={styles.senderName}>{message.full_name}</Text>
                    )}

                    {isAnnouncement && (
                      <Text style={styles.announcementLabel}>ANNOUNCEMENT</Text>
                    )}
                    {isSOS && (
                      <Text style={styles.sosLabel}>SOS ALERT</Text>
                    )}
                    {isComplaint && (
                      <Text style={styles.complaintLabel}>COMPLAINT</Text>
                    )}
                    {isPetition && (
                      <Text style={styles.petitionLabel}>PETITION</Text>
                    )}

                    <Text
                      style={[
                        styles.messageText,
                        isMyMessage && !isSpecialMessage && styles.adminMessageText,
                        isAnnouncement && styles.announcementText,
                        isSOS && styles.sosText,
                        isComplaint && styles.complaintText,
                        isPetition && styles.petitionText,
                      ]}
                    >
                      {message.content}
                    </Text>

                    <View style={styles.messageFooter}>
                      <Text
                        style={[
                          styles.messageTime,
                          isMyMessage && !isSpecialMessage && styles.adminMessageTime,
                        ]}
                      >
                        {message.created_at
                          ? new Date(message.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                          : ''}
                      </Text>
                      {isMyMessage && !isSpecialMessage && message.message_id && (
                        <Text style={styles.checkMark}>ok</Text>
                      )}
                    </View>

                    {/* WhatsApp-style tail - only for non-special messages */}
                    {!isSpecialMessage && (
                      <View
                        style={[
                          styles.messageTail,
                          isMyMessage ? styles.adminMessageTail : styles.memberMessageTail,
                        ]}
                      />
                    )}

                    {/* POLL CARD INTEGRATION */}
                    {message.message_type === 'poll' && (
                      <PollMessageCard
                        communityId={Number(communityId)}
                        pollId={Number(message.content || '0')}
                        currentUserId={Number(currentUserId)}
                        isAdmin={true}

                        sentByMe={isMyMessage}
                        createdAt={message.created_at || ''}
                      />
                    )}
                  </View>
                </TouchableOpacity>

              );
            })}
          </View>
        ))}

      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.floatingButton} onPress={openModal}>
        <PlusIcon />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.chatbotFloatingButton}
        onPress={() => navigation.navigate('AIChatScreen', {
          communityId: communityId,
          communityName: community?.name || 'Community'
        })}
      >
        <Text style={styles.chatbotButtonText}>🤖</Text>
      </TouchableOpacity>

      {/* Message Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          {editingMessageId && (
            <View style={styles.editBanner}>
              <Text style={styles.editBannerText}>Editing message</Text>
              <TouchableOpacity
                onPress={() => {
                  setEditingMessageId(null);
                  setMessageText('');
                }}
              >
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
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
            onSubmitEditing={handleSendOrEdit}
            blurOnSubmit={false}
          />

          <TouchableOpacity onPress={handleSendOrEdit} style={styles.sendButton}>
            {editingMessageId ? <Text style={styles.saveText}>Save</Text> : <SendIcon />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Admin Features Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Admin Features</Text>
              <TouchableOpacity onPress={closeModal}>
                <Text style={styles.closeButton}>X</Text>
              </TouchableOpacity>
            </View>

            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {adminFeatures.map((feature) => (
                <TouchableOpacity
                  key={feature.id}
                  style={styles.featureItem}
                  onPress={() => handleFeaturePress(feature)}
                >
                  <View style={[styles.featureIcon, { backgroundColor: feature.color }]}>
                    <Text style={styles.featureEmoji}>{feature.icon}</Text>
                  </View>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureArrow}>{'>'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
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
          onCreated={(poll) => {
            setPollModalVisible(false);
            // The message list will update via Socket.IO since backend emits 'new_message'
          }}
        />
      </Modal>


      {/* Announcement Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={announcementModalVisible}
        onRequestClose={closeAnnouncementModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.announcementModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Announcement</Text>
              <TouchableOpacity onPress={closeAnnouncementModal}>
                <Text style={styles.closeButton}>X</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.announcementBody}>
              <Text style={styles.announcementLabel}>
                This message will be sent to all community members
              </Text>

              <TextInput
                style={styles.announcementInput}
                placeholder="Type your announcement here..."
                placeholderTextColor="#999"
                value={announcementText}
                onChangeText={setAnnouncementText}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />

              <View style={styles.announcementActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={closeAnnouncementModal}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sendAnnouncementButton,
                    !announcementText.trim() && styles.sendAnnouncementButtonDisabled
                  ]}
                  onPress={handleSendAnnouncement}
                  disabled={!announcementText.trim()}
                >
                  <Text style={styles.sendAnnouncementButtonText}>
                    Send Announcement
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
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
                <Text style={styles.closeButton}>X</Text>
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


        </SafeAreaView>
      </LinearGradient>
    </View>
  );
};

export default AdminCommunityApp;

// Styles
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
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
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
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
    backgroundColor: '#2c5282',
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
  messageTouchableArea: {},
  adminMessageWrapper: {
    alignItems: 'flex-end',
  },
  memberMessageWrapper: {
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
  adminMessage: {
    backgroundColor: '#6366f1',
    borderTopRightRadius: 4,
  },
  memberMessage: {
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
  adminMessageTail: {
    right: -8,
    top: 0,
    borderTopWidth: 10,
    borderRightWidth: 8,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopColor: '#D4E4F7',
    borderRightColor: 'transparent',
  },
  memberMessageTail: {
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
  adminBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e3a5f',
    marginBottom: 4,
    letterSpacing: 0.3,
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
  adminMessageText: {
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
  adminMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  checkMark: {
    fontSize: 16,
    color: '#2563eb',
    marginLeft: 4,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 78,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1e3a5f',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  editBanner: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f4f8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
  },
  editBannerText: {
    color: '#1e3a5f',
    fontSize: 13,
    fontWeight: '600',
  },
  editCancelText: {
    color: '#c53030',
    fontSize: 13,
    fontWeight: '600',
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e3a5f',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  attachText: {
    fontSize: 22,
    color: 'white',
    fontWeight: '600',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
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
    marginLeft: 12,
    elevation: 4,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
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
    maxHeight: '80%',
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
    color: '#666',
    fontWeight: '300',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureEmoji: {
    fontSize: 22,
  },
  featureTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#e2e8f0',
  },
  featureArrow: {
    fontSize: 24,
    color: '#A0AEC0',
  },
  announcementModalContent: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  announcementBody: {
    padding: 20,
  },
  announcementInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    minHeight: 150,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 16,
    color: '#f8fafc',
  },
  announcementActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  sendAnnouncementButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    alignItems: 'center',
  },
  sendAnnouncementButtonDisabled: {
    backgroundColor: '#A0AEC0',
  },
  sendAnnouncementButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  mediaModalContent: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: '60%',
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
  },
  mediaOption: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: 16,
  },
  mediaIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  mediaEmoji: {
    fontSize: 28,
  },
  mediaTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#f8fafc',
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

  // Chatbot Styles
  chatbotFloatingButton: {
    position: 'absolute',
    bottom: 78,
    left: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#155EEF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  chatbotButtonText: {
    fontSize: 24,
    color: '#fff',
  },
  chatbotModal: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  chatbotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#0f172a',
  },
  chatbotTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  chatbotHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  chatbotClearButton: {
    fontSize: 14,
    color: '#c53030',
    fontWeight: '600',
  },
  chatbotCloseButton: {
    fontSize: 24,
    color: '#E2E8F0',
  },
  chatbotMessagesContainer: {
    flex: 1,
    padding: 16,
  },
  chatbotEmptyState: {
    padding: 20,
    alignItems: 'center',
  },
  chatbotEmptyStateText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  chatbotSuggestionText: {
    fontSize: 14,
    color: '#666',
    marginVertical: 4,
  },
  chatbotMessageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#d5deec',
  },
  chatbotMessageTouchableArea: {},
  chatbotUserBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#6366f1',
    borderWidth: 0,
  },
  chatbotBotBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  chatbotMessageText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#334155', // Dark slate color for readability
  },
  chatbotUserBubbleText: {
    color: '#ffffff', // White text for user messages which have #6366f1 background
  },
  chatbotSectionBlock: {
    marginBottom: 8,
  },
  chatbotSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E3A8A',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  chatbotConfidenceText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  chatbotSourcesContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  chatbotSourcesTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  chatbotSourceText: {
    fontSize: 11,
    color: '#666',
  },
  chatbotActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  chatbotActionButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#DCE7FF',
  },
  chatbotActionText: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: '600',
  },
  chatbotDeleteActionButton: {
    backgroundColor: 'rgba(197,48,48,0.2)',
  },
  chatbotDeleteActionText: {
    color: '#ffe5e5',
    fontSize: 12,
    fontWeight: '600',
  },
  chatbotHintText: {
    fontSize: 11,
    color: '#666',
    marginTop: 6,
  },
  chatbotTimestamp: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  chatbotLoadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  chatbotLoadingText: {
    marginLeft: 8,
    color: '#666',
  },
  chatbotInputContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
  },
  chatbotEditBanner: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f4f8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  chatbotEditBannerText: {
    fontSize: 12,
    color: '#1e3a5f',
    fontWeight: '600',
  },
  chatbotEditCancelText: {
    fontSize: 12,
    color: '#c53030',
    fontWeight: '600',
  },
  chatbotInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    color: '#f8fafc',
  },
  chatbotAskButton: {
    backgroundColor: '#6366f1',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  chatbotAskButtonDisabled: {
    backgroundColor: '#ccc',
  },
  chatbotAskButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

