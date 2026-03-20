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
  status: 'Pending' | 'InProgress' | 'Resolved' | 'Approved' | 'Rejected' | 'Dismissed';
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
  const [userRole, setUserRole] = useState<string | null>(null);

  // AI chat state
  const [showAssistant, setShowAssistant] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [chatbotMessages, setChatbotMessages] = useState<ChatbotMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [isLoadingChatbot, setIsLoadingChatbot] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<{ summary: string; suggestion: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    fetchComplaintDetails();
    fetchUserRole();
  }, []);

  const fetchUserRole = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(`${BASE_URL}/community/${communityId}/my-role`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUserRole(data.role);
      }
    } catch (err) {
      console.error('Error fetching user role:', err);
    }
  };


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
        status: (raw.status ?? 'Pending') as Complaint['status'],
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

  const updateComplaintStatus = async (newStatus: Complaint['status'], resolutionNotes?: string) => {
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
          remarks: resolutionNotes || '',
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

  const handleInProgress = () => {
    updateComplaintStatus('InProgress');
  };

  const handleApprove = () => {
    updateComplaintStatus('Approved');
  };

  const handleReject = () => {
    updateComplaintStatus('Rejected');
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

  const handleAutoAnalyze = async () => {
    if (!complaint || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const response = await nlpService.suggestAction(complaint.complaint_id, 'complaint', communityId);
      if (response && response.success) {
        setAiAnalysis({
          summary: response.data.summary || 'Summary generated by AI.',
          suggestion: response.data.suggestion || response.data.answer || 'No specific action suggested.'
        });
      }
    } catch (err) {
      console.error('Auto analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (complaint && userRole === 'HEAD' && !aiAnalysis && !isAnalyzing) {
      handleAutoAnalyze();
    }
  }, [complaint, userRole]);

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
    switch (status?.toUpperCase()) {
      case 'APPROVED': return '#16a34a';
      case 'REJECTED': return '#dc2626';
      case 'RESOLVED': return '#16a34a';
      case 'INPROGRESS':
      case 'IN_PROGRESS': return '#3b82f6';
      default: return '#ea580c';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'high': return '#dc2626';
      case 'medium': return '#ea580c';
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
          {['Pending', 'InProgress', 'Review', 'OPEN', 'IN_PROGRESS'].includes(complaint.status) && userRole === 'HEAD' && (
            <View style={styles.topActions}>
              <View style={styles.aiAnalysisCard}>
                <View style={styles.aiHeader}>
                  <Text style={styles.aiTitle}>🤖 AI Analysis & Suggestions</Text>
                  {isAnalyzing && <ActivityIndicator size="small" color="#818cf8" />}
                </View>
                {aiAnalysis ? (
                  <View>
                    <Text style={styles.aiSummaryText}>"{aiAnalysis.summary}"</Text>
                    <View style={styles.aiSuggestionBox}>
                      <Text style={styles.aiSuggestionTitle}>Suggested Action:</Text>
                      <Text style={styles.aiSuggestionText}>{aiAnalysis.suggestion}</Text>
                    </View>
                  </View>
                ) : !isAnalyzing && (
                  <TouchableOpacity onPress={handleAutoAnalyze} style={styles.aiRetryButton}>
                    <Text style={styles.aiRetryText}>Generate AI Analysis</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.adminActionTitle}>Update Complaint Status</Text>
              <View style={[styles.actionRow, { flexWrap: 'wrap', gap: 8 }]}>
                <TouchableOpacity
                  style={[styles.miniActionButton, styles.inProgressButton]}
                  onPress={handleInProgress}
                >
                  <Text style={styles.miniActionButtonText}>In Progress</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.miniActionButton, styles.resolveButton]}
                  onPress={handleResolve}
                >
                  <Text style={styles.miniActionButtonText}>Mark Resolved</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.miniActionButton, styles.approveButton]}
                  onPress={handleApprove}
                >
                  <Text style={styles.miniActionButtonText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.miniActionButton, styles.rejectButton]}
                  onPress={handleReject}
                >
                  <Text style={styles.miniActionButtonText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.miniActionButton, styles.dismissButton]}
                  onPress={handleDismiss}
                >
                  <Text style={styles.miniActionButtonText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.complaintTitle}>{complaint.title}</Text>

            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(complaint.status) + '15', borderWidth: 1, borderColor: getStatusColor(complaint.status) + '30' },
                ]}
              >
                <Text style={[styles.statusText, { color: getStatusColor(complaint.status) }]}>{complaint.status}</Text>
              </View>
              <View
                style={[
                  styles.severityBadge,
                  { backgroundColor: getSeverityColor(complaint.severity) + '15', borderWidth: 1, borderColor: getSeverityColor(complaint.severity) + '30' },
                ]}
              >
                <Text style={[styles.severityText, { color: getSeverityColor(complaint.severity) }]}>{complaint.severity} Priority</Text>
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


        </View>
      </ScrollView>

      {(userRole === 'HEAD' || userRole === 'ADMIN') && menuVisible && (
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
        visible={(userRole === 'HEAD' || userRole === 'ADMIN') && showAssistant}
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
    backgroundColor: '#0f172a',
  },
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94a3b8',
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  backText: {
    fontSize: 16,
    color: '#818cf8',
    textDecorationLine: 'underline',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 55,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    fontSize: 16,
    color: '#f8fafc',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
    marginLeft: 16,
  },
  menuButton: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  menuButtonText: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '800',
  },
  menuDropdown: {
    position: 'absolute',
    top: Platform.select({ ios: 90, android: 90, default: 80 }),
    right: 20,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 15,
    color: '#f8fafc',
    fontWeight: '500',
  },
  content: {
    padding: 20,
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  complaintTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 16,
    lineHeight: 32,
  },
  statusRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  statusText: {
    fontWeight: '800',
    fontSize: 12,
  },
  severityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  severityText: {
    fontWeight: '800',
    fontSize: 12,
  },
  metaInfo: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  metaLabel: {
    fontWeight: '600',
    color: '#94a3b8',
    minWidth: 120,
    fontSize: 15,
  },
  metaValue: {
    color: '#e2e8f0',
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  metaValueMissing: {
    color: '#64748b',
    fontStyle: 'italic',
  },
  section: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 12,
  },
  sectionContent: {
    fontSize: 16,
    color: '#cbd5e1',
    lineHeight: 26,
  },
  actions: {
    marginTop: 24,
    gap: 12,
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  resolveButton: {
    backgroundColor: '#10b981',
  },
  resolveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  dismissButton: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dismissButtonText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700',
  },
  topActions: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  adminActionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  miniActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniActionButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
  },
  inProgressButton: {
    backgroundColor: '#3b82f6',
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },

  chatOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  chatContainer: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.6,
    minHeight: height * 0.5,
    paddingBottom: 20,
  },
  chatContainerMinimized: {
    maxHeight: 70,
    minHeight: 70,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'transparent',
  },
  chatTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  chatHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatHeaderButton: {
    marginLeft: 16,
    padding: 4,
  },
  chatHeaderButtonText: {
    color: '#cbd5e1',
    fontSize: 20,
    fontWeight: '700',
  },
  chatMessages: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  chatEmpty: {
    paddingVertical: 24,
  },
  chatEmptyText: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
  },
  chatBubble: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    maxWidth: '85%',
  },
  chatBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#6366f1',
  },
  chatBubbleBot: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(30, 41, 59, 1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  chatBubbleText: {
    fontSize: 15,
    color: '#f8fafc',
    lineHeight: 22,
  },
  chatLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  chatLoadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#94a3b8',
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  chatInput: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginRight: 12,
    color: '#f8fafc',
  },
  chatSendButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatSendButtonDisabled: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    opacity: 0.5,
  },
  chatSendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  urgencyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  urgencyHigh: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  urgencyNormal: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  urgencyText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#f87171',
    letterSpacing: 0.5,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  tagText: {
    fontSize: 13,
    color: '#818cf8',
    fontWeight: '600',
  },
  chatContextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  chatContextLabel: {
    fontSize: 13,
    color: '#64748b',
    marginRight: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  chatContextValue: {
    fontSize: 13,
    color: '#e2e8f0',
    fontWeight: '800',
  },
  aiAnalysisCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#818cf8',
  },
  aiSummaryText: {
    fontSize: 14,
    color: '#e2e8f0',
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: 12,
  },
  aiSuggestionBox: {
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#818cf8',
  },
  aiSuggestionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  aiSuggestionText: {
    fontSize: 14,
    color: '#f8fafc',
    lineHeight: 20,
  },
  aiRetryButton: {
    padding: 10,
    alignItems: 'center',
  },
  aiRetryText: {
    color: '#818cf8',
    fontSize: 14,
    fontWeight: '600',
  },
});