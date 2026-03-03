import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
  TextInput,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import nlpService from '../lib/nlpService';

interface Complaint {
  complaint_id: number;
  title: string;
  description: string;
  category: string;
  severity: string;
  author_id: number;
  author_name: string;
  community_id: number;
  community_name: string;
  created_at: string;
  updated_at: string;
  status: 'Pending' | 'Resolved' | 'Dismissed';
  reviewed_by?: number;
  resolution_notes?: string;
  priority_score?: number;
  is_urgent: boolean;
  visibility?: string;
  allow_follow_up?: boolean;
  preferred_contact_channel?: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  tags?: string[];
}

interface ChatbotMessage {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
}

import { API_BASE_URL } from '../lib/api';
const BASE_URL = API_BASE_URL;
const { height } = Dimensions.get('window');

export default function ComplaintDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { complaintId, communityId } = route.params as { complaintId: number; communityId: number };

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);

  // AI chat state
  const [showAssistant, setShowAssistant] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [chatbotMessages, setChatbotMessages] = useState<ChatbotMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [isLoadingChatbot, setIsLoadingChatbot] = useState(false);

  useEffect(() => {
    fetchComplaintDetails();
  }, []);

  const fetchComplaintDetails = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');

      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await fetch(`${BASE_URL}/complaints/detail/${complaintId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Failed to fetch complaint details (${response.status})`);
      }

      const data = await response.json();
      const raw = data.complaint || data;
      const normalized: Complaint = {
        complaint_id: raw.complaint_id ?? raw.complaintId ?? 0,
        title: raw.title ?? '',
        description: raw.description ?? '',
        category: raw.category ?? '',
        severity: raw.severity ?? 'medium',
        author_id: raw.created_by ?? raw.author_id ?? raw.authorId ?? 0,
        author_name: raw.creator_name ?? raw.author_name ?? raw.authorName ?? raw.created_by_name ?? 'Unknown',
        community_id: raw.community_id ?? raw.communityId ?? 0,
        community_name: raw.community_name ?? raw.communityName ?? 'Unknown',
        created_at: raw.created_at ?? raw.createdAt ?? '',
        updated_at: raw.updated_at ?? raw.updatedAt ?? '',
        status: (raw.status ?? 'Pending') as 'Pending' | 'Resolved' | 'Dismissed',
        reviewed_by: raw.reviewed_by ?? raw.reviewedBy,
        resolution_notes: raw.resolution_notes ?? raw.resolutionNotes,
        priority_score: raw.priority_score ?? raw.priorityScore,
        is_urgent: Boolean(raw.is_urgent ?? raw.isUrgent ?? false),
        visibility: raw.visibility ?? 'private',
        allow_follow_up: raw.allow_follow_up ?? raw.allowFollowUp,
        preferred_contact_channel: raw.preferred_contact_channel ?? raw.preferredContactChannel,
        contact_email: raw.contact_email ?? raw.contactEmail ?? null,
        contact_phone: raw.contact_phone ?? raw.contactPhone ?? null,
        tags: (() => {
          const t = raw.tags;
          if (Array.isArray(t)) return t.map(String);
          if (typeof t === 'string' && t.trim()) {
            return t.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
          return [];
        })(),
      };
      setComplaint(normalized);
    } catch (err: any) {
      setError(err.message || 'Failed to load complaint details');
      console.error('Error fetching complaint details:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateComplaintStatus = async (newStatus: 'Resolved' | 'Dismissed', resolutionNotes?: string) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      const response = await fetch(`${BASE_URL}/complaints/${complaintId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          resolution_notes: resolutionNotes || '',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update complaint status');
      }

      Alert.alert('Success', `Complaint ${newStatus.toLowerCase()} successfully`);
      // Refresh the complaint details
      fetchComplaintDetails();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update complaint status');
      console.error('Error updating complaint status:', err);
    }
  };

  const handleResolve = () => {
    Alert.alert(
      'Resolve Complaint',
      'Are you sure you want to resolve this complaint?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Resolve', onPress: () => updateComplaintStatus('Resolved') },
      ]
    );
  };

  const handleDismiss = () => {
    Alert.alert(
      'Dismiss Complaint',
      'Are you sure you want to dismiss this complaint?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Dismiss', onPress: () => updateComplaintStatus('Dismissed') },
      ]
    );
  };

  const handleAskBot = async () => {
    const prompt = question.trim();
    if (!prompt) return;

    const userMessage: ChatbotMessage = {
      id: `${Date.now()}-q`,
      text: prompt,
      isBot: false,
      timestamp: new Date(),
    };

    setChatbotMessages((prev) => [...prev, userMessage]);
    setQuestion('');
    setIsLoadingChatbot(true);

    try {
      const complaintContext = complaint
        ? {
            type: 'complaint' as const,
            data: {
              complaint_id: complaint.complaint_id,
              title: complaint.title,
              description: complaint.description,
              category: complaint.category,
              severity: complaint.severity,
              status: complaint.status,
              author_name: complaint.author_name,
              community_name: complaint.community_name,
              is_urgent: complaint.is_urgent,
            },
          }
        : undefined;
      const response = await nlpService.askBot(prompt, communityId, undefined, complaintContext);
      const answerText =
        (response as any)?.data?.answer ||
        (response as any)?.answer ||
        'No response from AI.';

      const botMessage: ChatbotMessage = {
        id: `${Date.now()}-a`,
        text: String(answerText),
        isBot: true,
        timestamp: new Date(),
      };
      setChatbotMessages((prev) => [...prev, botMessage]);
    } catch (err: any) {
      const botMessage: ChatbotMessage = {
        id: `${Date.now()}-e`,
        text:
          err?.response?.data?.error ||
          err?.message ||
          'Sorry, I encountered an error. Please try again.',
        isBot: true,
        timestamp: new Date(),
      };
      setChatbotMessages((prev) => [...prev, botMessage]);
    } finally {
      setIsLoadingChatbot(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading complaint details...</Text>
      </View>
    );
  }

  if (error || !complaint) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Error: {error || 'Complaint not found'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Resolved': return '#10b981';
      case 'Dismissed': return '#6b7280';
      default: return '#f59e0b';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Complaint Details</Text>
          <TouchableOpacity
            onPress={() => setMenuVisible((prev) => !prev)}
            style={styles.menuButton}
          >
            <Text style={styles.menuButtonText}>⋮</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.complaintTitle}>{complaint.title}</Text>

            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(complaint.status) },
                ]}
              >
                <Text style={styles.statusText}>{complaint.status}</Text>
              </View>
              <View
                style={[
                  styles.severityBadge,
                  { backgroundColor: getSeverityColor(complaint.severity) },
                ]}
              >
                <Text style={styles.severityText}>{complaint.severity} Priority</Text>
              </View>
            </View>

            <View style={styles.metaInfo}>
              <Text style={styles.metaLabel}>Author:</Text>
              <Text style={styles.metaValue}>{complaint.author_name}</Text>
            </View>

            <View style={styles.metaInfo}>
              <Text style={styles.metaLabel}>Community:</Text>
              <Text style={styles.metaValue}>{complaint.community_name}</Text>
            </View>

            <View style={styles.metaInfo}>
              <Text style={styles.metaLabel}>Category:</Text>
              <Text style={styles.metaValue}>{complaint.category}</Text>
            </View>

            <View style={styles.metaInfo}>
              <Text style={styles.metaLabel}>Created:</Text>
              <Text style={styles.metaValue}>
                {new Date(complaint.created_at).toLocaleDateString()}
              </Text>
            </View>

            <View style={styles.metaInfo}>
              <Text style={styles.metaLabel}>Urgency:</Text>
              <View
                style={[
                  styles.urgencyBadge,
                  complaint.is_urgent ? styles.urgencyHigh : styles.urgencyNormal,
                ]}
              >
                <Text style={styles.urgencyText}>
                  {complaint.is_urgent ? 'Urgent' : 'Normal'}
                </Text>
              </View>
            </View>

            <View style={styles.metaInfo}>
              <Text style={styles.metaLabel}>Visibility:</Text>
              <Text style={styles.metaValue}>
                {complaint.visibility ? complaint.visibility : 'N/A'}
              </Text>
            </View>

            <View style={styles.metaInfo}>
              <Text style={styles.metaLabel}>Allow follow-up:</Text>
              <Text style={styles.metaValue}>
                {complaint.allow_follow_up ? 'Yes' : 'No'}
              </Text>
            </View>

            <View style={styles.metaInfo}>
              <Text style={styles.metaLabel}>Preferred contact:</Text>
              <Text style={styles.metaValue}>
                {complaint.preferred_contact_channel
                  ? complaint.preferred_contact_channel
                  : 'N/A'}
              </Text>
            </View>

            <View style={styles.metaInfo}>
              <Text style={styles.metaLabel}>Contact email:</Text>
              {complaint.contact_email ? (
                <Text style={styles.metaValue}>{complaint.contact_email}</Text>
              ) : (
                <Text style={[styles.metaValue, styles.metaValueMissing]}>Not provided</Text>
              )}
            </View>

            <View style={styles.metaInfo}>
              <Text style={styles.metaLabel}>Contact phone:</Text>
              {complaint.contact_phone ? (
                <Text style={styles.metaValue}>{complaint.contact_phone}</Text>
              ) : (
                <Text style={[styles.metaValue, styles.metaValueMissing]}>Not provided</Text>
              )}
            </View>

            {complaint.tags && complaint.tags.length > 0 && (
              <View style={styles.metaInfo}>
                <Text style={styles.metaLabel}>Tags:</Text>
                <View style={styles.tagsContainer}>
                  {complaint.tags.map((tag) => (
                    <View key={tag} style={styles.tagPill}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.sectionContent}>{complaint.description}</Text>
            </View>

            {complaint.resolution_notes && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Resolution Notes</Text>
                <Text style={styles.sectionContent}>{complaint.resolution_notes}</Text>
              </View>
            )}

            {complaint.priority_score && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Priority Score</Text>
                <Text style={styles.sectionContent}>{complaint.priority_score}/10</Text>
              </View>
            )}
          </View>

          {complaint.status === 'Pending' && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.resolveButton]}
                onPress={handleResolve}
              >
                <Text style={styles.resolveButtonText}>Mark as Resolved</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.dismissButton]}
                onPress={handleDismiss}
              >
                <Text style={styles.dismissButtonText}>Dismiss Complaint</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {menuVisible && (
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuDropdown}>
            <TouchableOpacity
              onPress={() => {
                setMenuVisible(false);
                setShowAssistant(true);
                setIsChatMinimized(false);
              }}
              style={styles.menuItem}
            >
              <Text style={styles.menuItemText}>Ask AI about this complaint</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}
      <Modal
        visible={showAssistant}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAssistant(false)}
      >
        <View style={styles.chatOverlay}>
          <View
            style={[
              styles.chatContainer,
              isChatMinimized && styles.chatContainerMinimized,
            ]}
          >
            <View style={styles.chatHeader}>
              <Text style={styles.chatTitle}>AI Assistant</Text>
              <View style={styles.chatHeaderActions}>
                <TouchableOpacity
                  onPress={() => setIsChatMinimized((prev) => !prev)}
                  style={styles.chatHeaderButton}
                >
                  <Text style={styles.chatHeaderButtonText}>
                    {isChatMinimized ? '▢' : '–'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowAssistant(false);
                    setIsChatMinimized(false);
                  }}
                  style={styles.chatHeaderButton}
                >
                  <Text style={styles.chatHeaderButtonText}>×</Text>
                </TouchableOpacity>
              </View>
            </View>

            {!isChatMinimized && (
              <>
                <ScrollView style={styles.chatMessages}>
                  {chatbotMessages.length === 0 && (
                    <View style={styles.chatEmpty}>
                      <Text style={styles.chatEmptyText}>
                        Ask the AI to help you analyse, summarize or suggest actions for this
                        complaint.
                      </Text>
                    </View>
                  )}
                  {chatbotMessages.map((m) => (
                    <View
                      key={m.id}
                      style={[
                        styles.chatBubble,
                        m.isBot ? styles.chatBubbleBot : styles.chatBubbleUser,
                      ]}
                    >
                      <Text style={styles.chatBubbleText}>{m.text}</Text>
                    </View>
                  ))}
                  {isLoadingChatbot && (
                    <View style={styles.chatLoadingRow}>
                      <ActivityIndicator size="small" color="#1e3a5f" />
                      <Text style={styles.chatLoadingText}>Thinking...</Text>
                    </View>
                  )}
                </ScrollView>

                <View style={styles.chatContextRow}>
                  <Text style={styles.chatContextLabel}>Complaint ID</Text>
                  <Text style={styles.chatContextValue}>#{complaint.complaint_id}</Text>
                </View>

                <View style={styles.chatInputRow}>
                  <TextInput
                    style={styles.chatInput}
                    placeholder="Ask AI about this complaint..."
                    placeholderTextColor="#9ca3af"
                    value={question}
                    onChangeText={setQuestion}
                    multiline
                  />
                  <TouchableOpacity
                    style={[
                      styles.chatSendButton,
                      (!question.trim() || isLoadingChatbot) &&
                        styles.chatSendButtonDisabled,
                    ]}
                    onPress={handleAskBot}
                    disabled={!question.trim() || isLoadingChatbot}
                  >
                    <Text style={styles.chatSendButtonText}>Send</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  backText: {
    fontSize: 16,
    color: '#3b82f6',
    textDecorationLine: 'underline',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
  },
  backButton: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginLeft: 16,
  },
  menuButton: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  menuButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
  menuDropdown: {
    position: 'absolute',
    top: Platform.select({ ios: 80, android: 80, default: 70 }),
    right: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 40,
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
  },
  menuItem: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  menuItemText: {
    fontSize: 14,
    color: '#111827',
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  complaintTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  statusText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  severityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  severityText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  metaInfo: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  metaLabel: {
    fontWeight: '600',
    color: '#374151',
    minWidth: 100,
  },
  metaValue: {
    color: '#1e293b',
    flex: 1,
  },
  metaValueMissing: {
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  section: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 24,
  },
  actions: {
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  resolveButton: {
    backgroundColor: '#10b981',
  },
  resolveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  dismissButton: {
    backgroundColor: '#6b7280',
  },
  dismissButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  chatOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  chatContainer: {
    backgroundColor: '#f9fafb',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: height * 0.5,
    minHeight: height * 0.5,
    paddingBottom: 8,
  },
  chatContainerMinimized: {
    maxHeight: 64,
    minHeight: 64,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#1e3a5f',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  chatTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  chatHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatHeaderButton: {
    marginLeft: 12,
  },
  chatHeaderButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  chatMessages: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chatEmpty: {
    paddingVertical: 16,
  },
  chatEmptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
  chatBubble: {
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: '85%',
  },
  chatBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563eb',
  },
  chatBubbleBot: {
    alignSelf: 'flex-start',
    backgroundColor: '#e5e7eb',
  },
  chatBubbleText: {
    fontSize: 14,
    color: '#111827',
  },
  chatLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  chatLoadingText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#6b7280',
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  chatInput: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginRight: 8,
  },
  chatSendButton: {
    backgroundColor: '#1e3a5f',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatSendButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  chatSendButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  urgencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  urgencyHigh: {
    backgroundColor: '#fee2e2',
  },
  urgencyNormal: {
    backgroundColor: '#e5e7eb',
  },
  urgencyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b91c1c',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#e0f2fe',
  },
  tagText: {
    fontSize: 12,
    color: '#0369a1',
  },
  chatContextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 2,
  },
  chatContextLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginRight: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chatContextValue: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '700',
  },
});