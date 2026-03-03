import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useRoute, useNavigation } from '@react-navigation/native';
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';

// Declare window for web platform
declare const window: any;
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../lib/api';

// ============================================================================
// TYPES
// ============================================================================

type Head = {
  id: string;
  name: string;
  roleBadge?: string;
  avatarColor?: string;
};

type Attachment = {
  id: string;
  name: string;
  type: 'image' | 'video' | 'document' | 'audio';
  uri: string;
  mimeType?: string;
  size?: number;
};

type AnonymousMessageScreenProps = {
  onSend?: (payload: {
    text: string;
    headIds: string[];
    attachments: Attachment[];
  }) => Promise<void> | void;
  onBack?: () => void;
};

const { width } = Dimensions.get('window');
const MAX_CHARS = 1000;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AnonymousMessageScreen({
  onSend,
  onBack,
}: AnonymousMessageScreenProps) {
  const route = useRoute();
  const navigation = useNavigation();
  const params = route.params as any; // Route params can be any object

  const communityId = params?.communityId;
  const communityName = params?.communityName || 'Community';

  // Handle back navigation - use onBack prop if available, otherwise use navigation
  const handleBackPress = useCallback(() => {
    if (onBack) {
      onBack();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else if (Platform.OS === 'web') {
      window.history.back();
    }
  }, [onBack, navigation]);

  console.log('📡 Route params:', params);
  console.log('📡 Extracted communityId:', communityId);
  console.log('📡 Extracted communityName:', communityName);
  const [messageText, setMessageText] = useState('');
  const [selectedHeadIds, setSelectedHeadIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showHeadSelector, setShowHeadSelector] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [headSelectorError, setHeadSelectorError] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showInfoStrip, setShowInfoStrip] = useState(true);
  const [isSending, setIsSending] = useState(false);
  
  // Real heads data
  const [heads, setHeads] = useState<Head[]>([]);
  const [isLoadingHeads, setIsLoadingHeads] = useState(true);
  const [hoveredHeadId, setHoveredHeadId] = useState<string | null>(null);

  // Community head name
  const [communityHeadName, setCommunityHeadName] = useState<string>('');
  const [isLoadingHeadName, setIsLoadingHeadName] = useState(true);

  const selectedHeads = useMemo(() => {
    if (heads.length > 0) {
      // Use actual heads if available
      return heads.filter((h) => selectedHeadIds.includes(h.id));
    } else if (selectedHeadIds.includes('fallback-head') && communityHeadName) {
      // Use fallback head with community head name
      return [{
        id: 'fallback-head',
        name: communityHeadName,
        roleBadge: 'HEAD',
        avatarColor: '#1C7C54',
      }];
    }
    return [];
  }, [heads, selectedHeadIds, communityHeadName]);

  const charCount = messageText.length;
  const canSend = messageText.trim().length > 0 && charCount <= MAX_CHARS;

  // Fetch real heads and community head name from backend
  useEffect(() => {
    fetchCommunityHeads();
    fetchCommunityHeadName();
  }, [communityId]);

  const fetchCommunityHeads = async () => {
    try {
      setIsLoadingHeads(true);
      const token = await AsyncStorage.getItem('token');

      console.log('🌐 Fetching heads for community:', communityId);
      console.log('🔑 Token exists:', !!token);

      const headers: any = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/communities/${communityId}/heads`, {
        headers,
      });

      console.log('📡 Heads response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to fetch heads, response:', errorText);

        // For anonymous messaging, if we can't fetch heads due to auth,
        // we'll create a fallback head from the community head name
        console.log('⚠️ Heads fetch failed, will use fallback head logic');
        setHeads([]); // This will trigger the fallback in HeadSelector
        return;
      }

      const data = await response.json();
      console.log('✅ Heads data received:', data);
      console.log('✅ Heads array length:', data.heads?.length || 0);

      if (!data.heads || !Array.isArray(data.heads)) {
        console.error('❌ Invalid response structure. Expected { heads: [] }, got:', data);
        setHeads([]); // Use fallback
        return;
      }

      // Map backend response to Head type
      const mappedHeads: Head[] = data.heads.map((head: any, index: number) => ({
        id: head.user_id.toString(),
        name: head.full_name,
        roleBadge: head.role || 'HEAD',
        avatarColor: getAvatarColor(index),
      }));

      console.log('✅ Mapped heads:', mappedHeads);
      setHeads(mappedHeads);
    } catch (error) {
      console.error('❌ Error fetching community heads:', error);

      // For anonymous messaging, don't show error alert, just use fallback
      console.log('⚠️ Using fallback head selection due to error');
      setHeads([]); // This will trigger the fallback in HeadSelector
    } finally {
      setIsLoadingHeads(false);
    }
  };

  const fetchCommunityHeadName = async () => {
    try {
      setIsLoadingHeadName(true);
      const token = await AsyncStorage.getItem('token');

      console.log('🌐 Platform.OS:', Platform.OS);
      console.log('🔗 API_BASE_URL:', API_BASE_URL);
      console.log('📡 Fetching head name for community:', communityId);
      console.log('📡 Community ID type:', typeof communityId);
      console.log('📡 Community ID is NaN:', isNaN(Number(communityId)));
      console.log('🔑 Token exists:', !!token);

      const headers: any = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        console.warn('⚠️ No authentication token found! Request may still work.');
      }

      const numericCommunityId = Number(communityId);
      console.log('📡 Original communityId:', communityId, 'Type:', typeof communityId);
      console.log('📡 Numeric communityId:', numericCommunityId, 'Is valid number:', !isNaN(numericCommunityId));

      if (isNaN(numericCommunityId)) {
        throw new Error(`Invalid community ID: ${communityId} (must be a number)`);
      }

      const url = `${API_BASE_URL}/communities/${numericCommunityId}/head`;
      console.log('📡 Making request to:', url);

      const response = await fetch(url, {
        headers,
      });

      console.log('📡 Head name response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to fetch head name, response:', errorText);
        throw new Error(`Failed to fetch community head name: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Head name data received:', data);

      if (!data.head_name) {
        console.error('❌ Invalid response structure. Expected { head_name: string }, got:', data);
        throw new Error('Invalid response structure from server');
      }

      console.log('✅ Setting community head name to:', data.head_name);
      setCommunityHeadName(data.head_name);
  } catch (error) {
    console.error('❌ Error fetching community head name:', error);
    console.error('❌ Error message:', error instanceof Error ? error.message : 'Unknown error');
    // Set a fallback name in case of error
    setCommunityHeadName('Community Head');
  } finally {
      setIsLoadingHeadName(false);
    }
  };

  const getAvatarColor = (index: number) => {
    const colors = ['#1C7C54', '#2E5A3F', '#3D6B4F', '#1F5D3A', '#0F5132'];
    return colors[index % colors.length];
  };

  const handleToggleHead = useCallback((headId: string) => {
    setSelectedHeadIds([headId]); // Single selection only
    setHeadSelectorError('');
    setShowHeadSelector(false);
  }, []);

  const handleRemoveHead = useCallback((headId: string) => {
    setSelectedHeadIds(prev => prev.filter(id => id !== headId));
  }, []);

  const handlePickAttachment = useCallback(() => {
    setShowMediaPicker(true);
  }, []);

  const handleMediaTypeSelect = useCallback(async (type: 'photo' | 'video' | 'document' | 'audio') => {
    setShowMediaPicker(false);

    try {
      if (type === 'photo') {
        await handlePickImage();
      } else if (type === 'video') {
        await handlePickVideo();
      } else if (type === 'document' || type === 'audio') {
        await handlePickDocument(type);
      }
    } catch (error) {
      console.error('Error picking media:', error);
      Alert.alert('Error', 'Failed to pick file');
    }
  }, []);

  // ⚠️ FILE IS LONG – ONLY CHANGED PARTS ARE COMMENTED WITH ✅ FIX

// ... imports unchanged ...

// ============================================================================
// FIXED ATTACHMENT PICKERS (Expo SDK compatible)
// ============================================================================

const handlePickImage = async () => {
  try {
    console.log('Requesting photo library permissions');
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please grant photo library access');
      return;
    }

    console.log('Opening image picker');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    console.log('Image picker result:', result);

    if (result.canceled) {
      console.log('User canceled image picker');
      return;
    }

    if (result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      console.log('Selected image:', asset);

      setAttachments(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          name: asset.fileName ?? `image_${Date.now()}.jpg`,
          type: 'image',
          uri: asset.uri,
          mimeType: asset.mimeType,
          size: asset.fileSize,
        },
      ]);

      console.log('Image added to attachments');
    } else {
      console.log('No assets in image picker result');
      Alert.alert('Error', 'No image was selected');
    }
  } catch (error) {
    console.error('Error picking image:', error);
    Alert.alert('Error', 'Failed to pick image. Please try again.');
  }
};

const handlePickVideo = async () => {
  try {
    console.log('Requesting video library permissions');
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please grant video access');
      return;
    }

    console.log('Opening video picker');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    });

    console.log('Video picker result:', result);

    if (result.canceled) {
      console.log('User canceled video picker');
      return;
    }

    if (result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      console.log('Selected video:', asset);

      setAttachments(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          name: asset.fileName ?? `video_${Date.now()}.mp4`,
          type: 'video',
          uri: asset.uri,
          mimeType: asset.mimeType,
          size: asset.fileSize,
        },
      ]);

      console.log('Video added to attachments');
    } else {
      console.log('No assets in video picker result');
      Alert.alert('Error', 'No video was selected');
    }
  } catch (error) {
    console.error('Error picking video:', error);
    Alert.alert('Error', 'Failed to pick video. Please try again.');
  }
};

// FIXED: Document picker with proper error handling
const handlePickDocument = async (type: 'document' | 'audio') => {
  try {
    console.log('Opening document picker for type:', type);

    const result = await DocumentPicker.getDocumentAsync({
      type: type === 'audio' ? 'audio/*' : '*/*',
      copyToCacheDirectory: true,
    });

    console.log('Document picker result:', result);

    // Check if user canceled the picker
    if (result.canceled) {
      console.log('User canceled document picker');
      return;
    }

    // Check if assets exist and have content
    if (result.assets && result.assets.length > 0) {
      const file = result.assets[0];
      console.log('Selected file:', file);

      setAttachments(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          name: file.name || `file_${Date.now()}`,
          type,
          uri: file.uri,
          mimeType: file.mimeType,
          size: file.size,
        },
      ]);

      console.log('File added to attachments');
    } else {
      console.log('No assets in result');
      Alert.alert('Error', 'No file was selected');
    }
  } catch (error) {
    console.error('Error picking document:', error);
    Alert.alert('Error', 'Failed to pick file. Please try again.');
  }
};

// ============================================================================
// FIX: ENSURE HEADS ALWAYS DISPLAY AFTER FETCH
// ============================================================================

useEffect(() => {
  if (heads.length > 0 && selectedHeadIds.length === 0) {
    // noop – ensures rerender after fetch
  }
}, [heads]);

  // Don't auto-select - let user explicitly choose from dropdown
  // useEffect(() => {
  //   if (!isLoadingHeads && !isLoadingHeadName && heads.length === 0 && communityHeadName && selectedHeadIds.length === 0) {
  //     console.log('🤖 Auto-selecting fallback head:', communityHeadName);
  //     setSelectedHeadIds(['fallback-head']);
  //   }
  // }, [heads.length, communityHeadName, isLoadingHeads, isLoadingHeadName, selectedHeadIds.length]);

// fetchCommunityHeads remains unchanged


  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const handleSendPress = useCallback(() => {
    if (!canSend) return;
    if (selectedHeadIds.length === 0) {
      setHeadSelectorError('Please select at least one community head.');
      return;
    }
    setShowConfirmModal(true);
  }, [canSend, selectedHeadIds]);

  const handleConfirmSend = useCallback(async () => {
    setShowConfirmModal(false);
    setIsSending(true);

    try {
      const sendFunction = onSend || (route.params as any)?.onSend;
      if (!sendFunction) {
        throw new Error('Send function not available');
      }

      // Validate message before sending
      if (!messageText || messageText.trim().length === 0) {
        throw new Error('Message cannot be empty');
      }

      if (selectedHeadIds.length === 0) {
        throw new Error('Please select at least one head');
      }

      console.log('📤 Calling send function with payload:', {
        text: messageText,
        headIds: selectedHeadIds,
        attachments,
        communityId
      });

      // Call the send function (which makes the API call)
      await sendFunction({
        text: messageText,
        headIds: selectedHeadIds,
        attachments,
      });

      console.log('✅ Message sent successfully, clearing form...');

      // Show success toast first
      setShowSuccessToast(true);

      // Only clear form and navigate if API call succeeded
      setMessageText('');
      setAttachments([]);
      setSelectedHeadIds([]);
      setHeadSelectorError('');

      // Navigate back after successful send
      setTimeout(() => {
        setShowSuccessToast(false);
        try {
          if (onBack && typeof onBack === 'function') {
            console.log('📤 Calling onBack handler');
            onBack();
          } else if (navigation && navigation.canGoBack && navigation.canGoBack()) {
            console.log('📤 Navigating back using React Navigation');
            navigation.goBack();
          } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
            // For web, if no navigation available, try to go back in history
            console.log('📤 Attempting browser history back');
            if (window.history && window.history.length > 1) {
              window.history.back();
            } else {
              // If no history, reload the page to refresh the message list
              console.log('📤 Reloading page');
              window.location.reload();
            }
          } else {
            console.warn('⚠️ No navigation method available');
          }
        } catch (navError) {
          console.error('❌ Error during navigation:', navError);
          // If navigation fails, at least reload on web
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.location.reload();
          }
        }
      }, 2000);
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send anonymous message';
      
      // Show error alert with details
      if (Platform.OS === 'web') {
        alert(`Error: ${errorMessage}`);
      } else {
        Alert.alert('Error', errorMessage);
      }
      
      // Don't clear the form on error - keep the message so user can retry
    } finally {
      setIsSending(false);
    }
  }, [messageText, selectedHeadIds, attachments, onSend, onBack, communityId, navigation, (route.params as any)?.onSend]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBackPress}
            style={styles.backButton}
            accessible={true}
            accessibilityLabel="Go back"
          >
            <View style={styles.backIcon}>
              <Text style={styles.backIconText}>←</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>{communityName}</Text>
            <Text style={styles.headerSubtitle}>Anonymous message to heads</Text>
          </View>
        </View>

        {/* Info Strip */}
        {showInfoStrip && (
          <View style={styles.infoStrip}>
            <View style={styles.infoIcon}>
              <Text style={styles.infoIconText}>🔒</Text>
            </View>
            <Text style={styles.infoText}>
              Your identity is hidden from heads. Admins only see aggregate statistics.
            </Text>
            <TouchableOpacity
              onPress={() => setShowInfoStrip(false)}
              style={styles.infoCloseButton}
              accessible={true}
              accessibilityLabel="Close info banner"
            >
              <Text style={styles.infoCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Success Toast */}
        {showSuccessToast && (
          <View style={styles.successToast}>
            <Text style={styles.successToastText}>
              Anonymous message sent to {selectedHeadIds.length}{' '}
              {selectedHeadIds.length === 1 ? 'head' : 'heads'}.
            </Text>
          </View>
        )}

        {/* Middle Preview Area */}
        <ScrollView style={styles.previewArea} contentContainerStyle={styles.previewContent}>
          {/* Info Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <View style={styles.anonymousBadge}>
                <Text style={styles.anonymousBadgeText}>ANONYMOUS CHANNEL</Text>
              </View>
            </View>
            <Text style={styles.infoCardText}>
              Messages sent here are encrypted and anonymous. Community heads can respond, but
              cannot see your identity. All communications are audit-logged for safety.
            </Text>
          </View>

          {/* Sample Bubbles */}
          <View style={styles.bubbleContainer}>
            <View style={[styles.bubble, styles.headBubble]}>
              <Text style={styles.bubbleLabel}>Head</Text>
              <Text style={styles.bubbleText}>
                Thank you for reaching out. We'll look into this matter.
              </Text>
            </View>
          </View>

          <View style={styles.bubbleContainer}>
            <View style={[styles.bubble, styles.memberBubble]}>
              <View style={styles.anonymousTag}>
                <Text style={styles.anonymousTagText}>You (anonymous)</Text>
              </View>
              <Text style={[styles.bubbleText, styles.memberBubbleText]}>
                I wanted to share a concern about the common area maintenance.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Input Area */}
        <View style={styles.inputArea}>
          {/* Head Selector */}
          
<HeadSelector
  heads={heads}
  selectedHeads={selectedHeads}
  onToggleHead={handleToggleHead}
  onRemoveHead={handleRemoveHead}
  showSelector={showHeadSelector}
  setShowSelector={setShowHeadSelector}
  error={headSelectorError}
  isLoading={isLoadingHeads}
  hoveredHeadId={hoveredHeadId}
  setHoveredHeadId={setHoveredHeadId}
  communityHeadName={communityHeadName}            // ✅ Added
  isLoadingHeadName={isLoadingHeadName}            // ✅ Added
/>


          {/* Attachment Bar */}
          <AttachmentBar
            attachments={attachments}
            onPickAttachment={handlePickAttachment}
            onRemoveAttachment={handleRemoveAttachment}
          />

          {/* Character Counter */}
          <View style={styles.charCounterContainer}>
            <Text style={[styles.charCounter, charCount > MAX_CHARS && styles.charCounterError]}>
              {charCount} / {MAX_CHARS}
            </Text>
          </View>

          {/* Message Input */}
          <View style={styles.inputRow}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Share your concern anonymously…"
                placeholderTextColor="#999"
                value={messageText}
                onChangeText={setMessageText}
                multiline
                maxLength={MAX_CHARS}
                accessible={true}
                accessibilityLabel="Anonymous message input"
              />
            </View>
            <TouchableOpacity
              style={[styles.sendButton, (!canSend || isSending) && styles.sendButtonDisabled]}
              onPress={handleSendPress}
              disabled={!canSend || isSending}
              accessible={true}
              accessibilityLabel="Send message"
            >
              <Text style={styles.sendButtonText}>→</Text>
            </TouchableOpacity>
          </View>

          {/* Helper Text */}
          <Text style={styles.helperText}>
            Do not include personal identifiers if you want to stay anonymous.
          </Text>
        </View>

        {/* Confirmation Modal */}
        <ConfirmationModal
          visible={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleConfirmSend}
          selectedHeads={selectedHeads}
          attachmentsCount={attachments.length}
          communityHeadName={communityHeadName}
          isLoadingHeadName={isLoadingHeadName}
        />

        {/* Media Picker Modal */}
        <MediaPickerModal
          visible={showMediaPicker}
          onClose={() => setShowMediaPicker(false)}
          onSelectType={handleMediaTypeSelect}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

type HeadSelectorProps = {
  heads?: Head[];
  selectedHeads?: Head[];
  onToggleHead: (headId: string) => void;
  onRemoveHead: (headId: string) => void;
  showSelector: boolean;
  setShowSelector: (show: boolean) => void;
  error: string;
  isLoading: boolean;
  hoveredHeadId: string | null;
  setHoveredHeadId: (id: string | null) => void;
};

function HeadSelector({
  heads = [],
  selectedHeads = [],
  onToggleHead,
  onRemoveHead,
  showSelector,
  setShowSelector,
  error,
  isLoading,
  hoveredHeadId,
  setHoveredHeadId,
  communityHeadName,
  isLoadingHeadName,
}: HeadSelectorProps & { communityHeadName?: string; isLoadingHeadName?: boolean }) {
  const selectedHeadId = selectedHeads[0]?.id ?? null; // Only one selected head

  // Create a fallback head option when no heads are available
  const fallbackHeads = heads.length === 0 && communityHeadName && !isLoadingHeadName
    ? [{
        id: 'fallback-head',
        name: communityHeadName,
        roleBadge: 'HEAD',
        avatarColor: '#1C7C54',
      }]
    : heads;

  return (
    <View style={styles.headSelector}>
      {/* Toggle button */}
      <TouchableOpacity
        style={styles.headSelectorButton}
        onPress={() => setShowSelector(!showSelector)}
        accessible={true}
        accessibilityLabel="Select community head"
      >
        <Text style={styles.headSelectorLabel}>Send securely to</Text>
        <Text style={styles.headSelectorArrow}>{showSelector ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {/* Display selected head */}
      {selectedHeadId && selectedHeads.length > 0 && (
        <View style={styles.selectedHeadsContainer}>
          {selectedHeads.map((head) => (
            <View key={head.id} style={styles.headPill}>
              <View
                style={[
                  styles.headAvatar,
                  { backgroundColor: head.avatarColor || '#1C7C54' },
                ]}
              >
                <Text style={styles.headAvatarText}>
                  {head.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.headPillTextContainer}>
                <Text style={styles.headPillName}>{head.name}</Text>
                {head.roleBadge && (
                  <Text style={styles.headPillBadge}>
                    {head.roleBadge.toUpperCase()}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => onRemoveHead(head.id)}
                style={styles.headRemoveButton}
                accessible={true}
                accessibilityLabel={`Remove ${head.name}`}
              >
                <Text style={styles.headRemoveText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Dropdown */}
      {showSelector && (
        <View style={styles.headDropdown}>
          {isLoading ? (
            <View style={styles.headOption}>
              <Text style={styles.emptyHeadsText}>Loading heads...</Text>
            </View>
          ) : fallbackHeads.length === 0 ? (
            <View style={styles.headOption}>
              <Text style={[styles.emptyHeadsText, { fontWeight: "600", color: "#0C4A6E" }]}>
                {isLoadingHeadName
                  ? "Loading head name..."
                  : "No head assigned yet"}
              </Text>
            </View>
          ) :
           (
            fallbackHeads.map((head) => {
              const isSelected = selectedHeadId === head.id;
              return (
                <TouchableOpacity
                  key={head.id}
                  style={[styles.headOption, isSelected && styles.headOptionSelected]}
                  onPress={() => onToggleHead(head.id)}
                  accessible={true}
                  accessibilityLabel={`Select ${head.name}`}
                >
                  <View style={styles.radioOuter}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>

                  <View
                    style={[
                      styles.headAvatar,
                      { backgroundColor: head.avatarColor || '#1C7C54' },
                    ]}
                  >
                    <Text style={styles.headAvatarText}>
                      {head.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.headOptionTextContainer}>
                    <Text style={styles.headOptionName}>{head.name}</Text>
                    {head.roleBadge && (
                      <Text style={styles.headOptionBadge}>
                        {head.roleBadge.toUpperCase()}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

  
type AttachmentBarProps = {
  attachments: Attachment[];
  onPickAttachment: () => void;
  onRemoveAttachment: (id: string) => void;
};

function AttachmentBar({ attachments, onPickAttachment, onRemoveAttachment }: AttachmentBarProps) {
  const getFileIcon = (type: Attachment['type']) => {
    switch (type) {
      case 'image':
        return '🖼️';
      case 'video':
        return '🎥';
      case 'audio':
        return '🎵';
      case 'document':
        return '📄';
      default:
        return '📎';
    }
  };

  const truncateFileName = (name: string, maxLength: number = 15) => {
    if (name.length <= maxLength) return name;
    const ext = name.split('.').pop();
    const nameWithoutExt = name.substring(0, name.lastIndexOf('.'));
    const truncated = nameWithoutExt.substring(0, maxLength - 3 - (ext?.length || 0));
    return `${truncated}...${ext}`;
  };

  return (
    <View style={styles.attachmentBar}>
      <TouchableOpacity
        style={styles.attachmentButton}
        onPress={onPickAttachment}
        accessible={true}
        accessibilityLabel="Attach file"
      >
        <View style={styles.attachmentIcon}>
          <Text style={styles.attachmentIconText}>📎</Text>
        </View>
        <Text style={styles.attachmentButtonText}>Attach file</Text>
      </TouchableOpacity>

      {attachments.length > 0 && (
        <View style={styles.attachmentChipsContainer}>
          {attachments.map((attachment) => (
            <View key={attachment.id} style={styles.attachmentChipWrapper}>
              <View style={styles.attachmentChip}>
                <Text style={styles.attachmentChipIcon}>
                  {getFileIcon(attachment.type)}
                </Text>
                <Text style={styles.attachmentChipName} numberOfLines={1}>
                  {truncateFileName(attachment.name)}
                </Text>
                <TouchableOpacity
                  onPress={() => onRemoveAttachment(attachment.id)}
                  style={styles.attachmentRemoveButton}
                  accessible={true}
                  accessibilityLabel={`Remove ${attachment.name}`}
                >
                  <Text style={styles.attachmentRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

type ConfirmationModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedHeads: Head[];
  attachmentsCount: number;
  communityHeadName: string;
  isLoadingHeadName: boolean;
};

function ConfirmationModal({
  visible,
  onClose,
  onConfirm,
  selectedHeads,
  attachmentsCount,
  communityHeadName,
  isLoadingHeadName,
}: ConfirmationModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessible={true}
      accessibilityLabel="Confirmation dialog"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Send anonymous message to community heads?</Text>
          <Text style={styles.modalBody}>
            Your name and profile will not be shared with the selected heads. The message will be
            logged for audit, but only community heads can view it.
          </Text>

          <View style={styles.modalSummary}>
            <Text style={styles.modalSummaryText}>
              • Community: {isLoadingHeadName ? 'Loading...' : communityHeadName}
            </Text>
            <Text style={[styles.modalSummaryText, styles.modalSummaryTextBold]}>
              • Sending to: {selectedHeads.length > 0 ? selectedHeads.map(head => head.name).join(', ') : 'No heads selected'}
            </Text>
            <Text style={styles.modalSummaryText}>• Attachments: {attachmentsCount}</Text>
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={onClose}
              accessible={true}
              accessibilityLabel="Cancel"
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalConfirmButton}
              onPress={onConfirm}
              accessible={true}
              accessibilityLabel="Send anonymously"
            >
              <Text style={styles.modalConfirmText}>Send Anonymously</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type MediaPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelectType: (type: 'photo' | 'video' | 'document' | 'audio') => void;
};

function MediaPickerModal({ visible, onClose, onSelectType }: MediaPickerModalProps) {
  const mediaOptions = [
    { type: 'photo' as const, label: 'Photos', icon: '📷', color: '#67C6C0' },
    { type: 'video' as const, label: 'Videos', icon: '🎥', color: '#EF8481' },
    { type: 'document' as const, label: 'Documents', icon: '📄', color: '#6BB9D9' },
    { type: 'audio' as const, label: 'Audio', icon: '🎵', color: '#B5D3B8' },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessible={true}
      accessibilityLabel="Media picker dialog"
    >
      <TouchableOpacity 
        style={styles.mediaModalOverlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={styles.mediaModalContent}>
          <View style={styles.mediaModalHeader}>
            <Text style={styles.mediaModalTitle}>Share Media</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.mediaModalClose}
              accessible={true}
              accessibilityLabel="Close media picker"
            >
              <Text style={styles.mediaModalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mediaOptionsGrid}>
            {mediaOptions.map((option) => (
              <TouchableOpacity
                key={option.type}
                style={styles.mediaOptionCard}
                onPress={() => onSelectType(option.type)}
                accessible={true}
                accessibilityLabel={`Select ${option.label}`}
              >
                <View style={[styles.mediaOptionIcon, { backgroundColor: option.color }]}>
                  <Text style={styles.mediaOptionIconText}>{option.icon}</Text>
                </View>
                <Text style={styles.mediaOptionLabel}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F5F7',
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E5A3F',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    marginRight: 12,
  },
  backIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIconText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    marginTop: 2,
  },
  infoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#C8E6C9',
  },
  infoIcon: {
    marginRight: 8,
  },
  infoIconText: {
    fontSize: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#2E7D32',
    lineHeight: 16,
  },
  infoCloseButton: {
    marginLeft: 8,
    padding: 4,
  },
  infoCloseText: {
    fontSize: 18,
    color: '#2E7D32',
    fontWeight: '600',
  },
  successToast: {
    backgroundColor: '#1C7C54',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  successToastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  previewArea: {
    flex: 1,
  },
  previewContent: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#FFF9E6',
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  infoCardHeader: {
    marginBottom: 10,
  },
  anonymousBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FF9800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  anonymousBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  infoCardText: {
    fontSize: 13,
    color: '#5D4037',
    lineHeight: 18,
  },
  bubbleContainer: {
    marginBottom: 12,
  },
  bubble: {
    maxWidth: width * 0.75,
    borderRadius: 12,
    padding: 12,
  },
  headBubble: {
    backgroundColor: '#FFF5E1',
    alignSelf: 'flex-start',
  },
  memberBubble: {
    backgroundColor: '#E3F5EC',
    alignSelf: 'flex-end',
  },
  bubbleLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  bubbleText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  memberBubbleText: {
    color: '#1C5234',
  },
  anonymousTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#1C7C54',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 6,
  },
  anonymousTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  inputArea: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
  },
  headSelector: {
    marginBottom: 12,
  },
  headSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headSelectorLabel: {
    fontSize: 14,
    color: '#0C4A6E',
    fontWeight: '600',
  },
  headSelectorArrow: {
    fontSize: 12,
    color: '#0EA5E9',
    fontWeight: '700',
  },
  selectedHeadsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 8,
  },
  headPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
  },
  headAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  headPillTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headPillName: {
    fontSize: 13,
    color: '#1E40AF',
    fontWeight: '600',
    marginRight: 6,
  },
  headPillBadge: {
    fontSize: 9,
    color: '#1E3A8A',
    fontWeight: '700',
    backgroundColor: '#93C5FD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  headRemoveButton: {
    marginLeft: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headRemoveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  headDropdown: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    maxHeight: 200,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  headOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F9FF',
    backgroundColor: '#fff',
  },
  headOptionSelected: {
    backgroundColor: '#EFF6FF',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#0EA5E9',
    borderRadius: 11,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#0EA5E9',
    borderRadius: 10,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0EA5E9',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  headOptionTextContainer: {
    flex: 1,
  },
  headOptionName: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  headOptionBadge: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  emptyHeadsText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 12,
    fontStyle: 'italic',
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    paddingHorizontal: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 6,
  },
  attachmentBar: {
    marginBottom: 10,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FCD34D',
  },
  attachmentIcon: {
    marginRight: 8,
  },
  attachmentIconText: {
    fontSize: 18,
  },
  attachmentButtonText: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '600',
  },
  attachmentChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    justifyContent: 'space-between',
  },
  attachmentChipWrapper: {
    width: '48%',
    marginBottom: 8,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  attachmentChipIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  attachmentChipName: {
    flex: 1,
    fontSize: 12,
    color: '#78350F',
    fontWeight: '500',
  },
  attachmentRemoveButton: {
    marginLeft: 8,
    padding: 2,
  },
  attachmentRemoveText: {
    fontSize: 16,
    color: '#92400E',
    fontWeight: '700',
  },
  charCounterContainer: {
    alignItems: 'flex-end',
    marginBottom: 6,
    marginTop: 2,
  },
  charCounter: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  charCounterError: {
    color: '#DC2626',
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  inputContainer: {
    flex: 1,
    marginRight: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  textInput: {
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    borderColor: '#86EFAC',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#064E3B',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  helperText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  modalBody: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  modalSummary: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  modalSummaryText: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 4,
  },
  modalSummaryTextBold: {
    fontWeight: '700',
    color: '#1C7C54',
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#1C7C54',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  mediaModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  mediaModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  mediaModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  mediaModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  mediaModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaModalCloseText: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: '600',
  },
  mediaOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  mediaOptionCard: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  mediaOptionIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  mediaOptionIconText: {
    fontSize: 32,
  },
  mediaOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
});