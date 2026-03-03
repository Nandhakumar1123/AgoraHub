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

type PetitionStatus = 'Review' | 'Pending' | 'InProgress' | 'Approved' | 'Rejected';

interface Petition {
  petition_id: number;
  title: string;
  summary: string;
  problem_statement: string;
  proposed_action: string;
  author_id: number;
  author_name: string;
  community_id: number;
  community_name: string;
  created_at: string;
  updated_at: string;
  goal_type: string;
  other_goal_type?: string;
  impact_area: string;
  other_impact_area?: string;
  affected_groups?: string[];
  priority_level: 'normal' | 'important' | 'critical';
  reference_context?: string;
  visibility: 'public' | 'private';
  status: PetitionStatus;
  reviewed_by?: number;
  remarks?: string;
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

export default function PetitionDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { petitionId, communityId } = route.params as { petitionId: number; communityId: number };

  const [petition, setPetition] = useState<Petition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  // AI chat state
  const [showAssistant, setShowAssistant] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [chatbotMessages, setChatbotMessages] = useState<ChatbotMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [isLoadingChatbot, setIsLoadingChatbot] = useState(false);

  useEffect(() => {
    fetchPetitionDetails();
  }, []);

  const fetchPetitionDetails = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');

      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await fetch(`${BASE_URL}/petitions/detail/${petitionId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch petition details');
      }

      const data = await response.json();
      const raw = data.petition || data;
      // Normalize: backend may return snake_case; ensure we have a consistent shape
      const normalized: Petition = {
        petition_id: raw.petition_id ?? raw.petitionId ?? 0,
        title: raw.title ?? '',
        summary: raw.summary ?? '',
        problem_statement: raw.problem_statement ?? raw.problemStatement ?? '',
        proposed_action: raw.proposed_action ?? raw.proposedAction ?? '',
        author_id: raw.author_id ?? raw.authorId ?? 0,
        author_name: raw.author_name ?? raw.authorName ?? 'Unknown',
        community_id: raw.community_id ?? raw.communityId ?? 0,
        community_name: raw.community_name ?? raw.communityName ?? 'Unknown',
        created_at: raw.created_at ?? raw.createdAt ?? '',
        updated_at: raw.updated_at ?? raw.updatedAt ?? '',
        goal_type: raw.goal_type ?? raw.goalType ?? '',
        other_goal_type: raw.other_goal_type ?? raw.otherGoalType,
        impact_area: raw.impact_area ?? raw.impactArea ?? '',
        other_impact_area: raw.other_impact_area ?? raw.otherImpactArea,
        affected_groups: (() => {
          const ag = raw.affected_groups ?? raw.affectedGroups;
          if (Array.isArray(ag)) return ag.map((x: any) => (typeof x === 'string' ? x : String(x)));
          if (typeof ag === 'string') {
            const trimmed = ag.trim();
            if (!trimmed) return [];
            try {
              const parsed = JSON.parse(ag);
              return Array.isArray(parsed) ? parsed.map((x: any) => String(x)) : [ag];
            } catch {
              return [ag];
            }
          }
          return [];
        })(),
        priority_level: (raw.priority_level ?? raw.priorityLevel ?? 'normal') as 'normal' | 'important' | 'critical',
        reference_context: raw.reference_context ?? raw.referenceContext,
        visibility: (raw.visibility ?? 'public') as 'public' | 'private',
        status: (raw.status ?? 'Review') as PetitionStatus,
        reviewed_by: raw.reviewed_by ?? raw.reviewedBy,
        remarks: raw.remarks,
      };
      setPetition(normalized);
    } catch (err: any) {
      setError(err.message || 'Failed to load petition details');
      console.error('Error fetching petition details:', err);
    } finally {
      setLoading(false);
    }
  };

  const STATUS_OPTIONS: PetitionStatus[] = ['Review', 'Pending', 'InProgress', 'Approved', 'Rejected'];

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
      const petitionContext = petition
        ? {
            type: 'petition' as const,
            data: {
              petition_id: petition.petition_id,
              title: petition.title,
              summary: petition.summary,
              problem_statement: petition.problem_statement,
              proposed_action: petition.proposed_action,
              goal_type: petition.goal_type,
              impact_area: petition.impact_area,
              status: petition.status,
              author_name: petition.author_name,
              community_name: petition.community_name,
              priority_level: petition.priority_level,
            },
          }
        : undefined;
      const response = await nlpService.askBot(prompt, communityId, undefined, petitionContext);
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
        <Text style={styles.loadingText}>Loading petition details...</Text>
      </View>
    );
  }

  if (error || !petition) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Error: {error || 'Petition not found'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getStatusColor = (status: PetitionStatus) => {
    switch (status) {
      case 'Review': return '#3b82f6';
      case 'Pending': return '#f59e0b';
      case 'InProgress': return '#8b5cf6';
      case 'Approved': return '#10b981';
      case 'Rejected': return '#ef4444';
    }
  };

  const getStatusSoftColors = (status: PetitionStatus) => {
    switch (status) {
      case 'Review':
        return { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' };
      case 'Pending':
        return { bg: '#fef9c3', text: '#b45309', border: '#facc15' };
      case 'InProgress':
        return { bg: '#ede9fe', text: '#6d28d9', border: '#c4b5fd' };
      case 'Approved':
        return { bg: '#dcfce7', text: '#15803d', border: '#86efac' };
      case 'Rejected':
        return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' };
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return '#ef4444';
      case 'important': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const updatePetitionStatus = async (newStatus: PetitionStatus, remarks?: string) => {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${BASE_URL}/petitions/${petitionId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        status: newStatus,
        remarks: remarks || '',
      }),
    });

    const text = await response.text();
    let data: any = null;
    if (text && text.trim()) {
      try {
        data = JSON.parse(text);
      } catch {
        // ignore parse errors; handled by response.ok
      }
    }

    if (!response.ok) {
      const msg = data?.error || 'Failed to update petition status';
      throw new Error(msg);
    }

    return data;
  };

  const handleSelectStatus = async (newStatus: PetitionStatus) => {
    if (!petition) return;
    if (isUpdatingStatus) return;
    if (petition.status === newStatus) return;

    const prevStatus = petition.status;
    setPetition(prev => (prev ? { ...prev, status: newStatus } : prev)); // optimistic UI
    setIsUpdatingStatus(true);

    try {
      await updatePetitionStatus(newStatus);
      // keep optimistic UI and refresh for consistency (remarks/reviewed_by/updated_at)
      fetchPetitionDetails();
    } catch (err: any) {
      setPetition(prev => (prev ? { ...prev, status: prevStatus } : prev)); // revert
      Alert.alert('Error', err?.message || 'Failed to update petition status');
      console.error('Error updating petition status:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const formatDate = (dateVal: string | undefined) => {
    if (!dateVal) return 'N/A';
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString(undefined, { dateStyle: 'medium' });
  };

  const displayText = (val: string | undefined) => (val != null && String(val).trim() !== '' ? String(val).trim() : 'N/A');

  return (
    <View style={styles.root}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Petition Details</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => setMenuVisible((prev) => !prev)}
              style={styles.menuButton}
            >
              <Text style={styles.menuButtonText}>⋮</Text>
            </TouchableOpacity>
            <View
              style={[
                styles.headerStatusBadge,
                { backgroundColor: getStatusColor(petition.status) },
              ]}
            >
              <Text style={styles.headerStatusText}>{petition.status}</Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.petitionTitle}>{displayText(petition.title)}</Text>

            <View style={styles.statusRow}>
              <View
                style={[
                  styles.priorityBadge,
                  { backgroundColor: getPriorityColor(petition.priority_level) },
                ]}
              >
                <Text style={styles.priorityText}>{petition.priority_level}</Text>
              </View>
            </View>

            <View style={styles.metaInfo}>
              <Text style={styles.metaLabel}>Author:</Text>
              <Text style={styles.metaValue}>{displayText(petition.author_name)}</Text>
            </View>

            <View style={styles.metaInfo}>
              <Text style={styles.metaLabel}>Community:</Text>
              <Text style={styles.metaValue}>{displayText(petition.community_name)}</Text>
            </View>

            <View style={styles.metaInfo}>
              <Text style={styles.metaLabel}>Created:</Text>
              <Text style={styles.metaValue}>{formatDate(petition.created_at)}</Text>
            </View>

            <View style={styles.metaInfo}>
              <Text style={styles.metaLabel}>Goal Type:</Text>
              <Text style={styles.metaValue}>
                {displayText(
                  petition.goal_type === 'Other'
                    ? petition.other_goal_type
                    : petition.goal_type
                )}
              </Text>
            </View>

            <View style={styles.metaInfo}>
              <Text style={styles.metaLabel}>Impact Area:</Text>
              <Text style={styles.metaValue}>
                {displayText(
                  petition.impact_area === 'Other'
                    ? petition.other_impact_area
                    : petition.impact_area
                )}
              </Text>
            </View>

            <View style={styles.metaInfo}>
              <Text style={styles.metaLabel}>Affected Groups:</Text>
              <Text style={styles.metaValue}>
                {Array.isArray(petition.affected_groups) &&
                petition.affected_groups.length > 0
                  ? petition.affected_groups.join(', ')
                  : 'N/A'}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Summary</Text>
              <Text style={styles.sectionContent}>{displayText(petition.summary)}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Problem Statement</Text>
              <Text style={styles.sectionContent}>
                {displayText(petition.problem_statement)}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Proposed Action</Text>
              <Text style={styles.sectionContent}>
                {displayText(petition.proposed_action)}
              </Text>
            </View>

            {petition.reference_context && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Reference Context</Text>
                <Text style={styles.sectionContent}>{petition.reference_context}</Text>
              </View>
            )}

            {petition.remarks && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Remarks</Text>
                <Text style={styles.sectionContent}>{petition.remarks}</Text>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Update Status</Text>
              <View style={styles.statusOptionsRow}>
                {STATUS_OPTIONS.map((opt) => {
                  const soft = getStatusSoftColors(opt);
                  const selected = petition.status === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => handleSelectStatus(opt)}
                      disabled={isUpdatingStatus || selected}
                      style={[
                        styles.statusOption,
                        { backgroundColor: soft.bg, borderColor: soft.border },
                        selected && styles.statusOptionSelected,
                        (isUpdatingStatus || selected) && styles.statusOptionDisabled,
                      ]}
                    >
                      <Text style={[styles.statusOptionText, { color: soft.text }]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {isUpdatingStatus && (
                <Text style={styles.statusUpdatingText}>Updating status…</Text>
              )}
            </View>
          </View>
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
              <Text style={styles.menuItemText}>Ask AI about this petition</Text>
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
                        Ask the AI to help you review or summarize this petition, or draft a
                        response.
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
                  <Text style={styles.chatContextLabel}>Petition ID</Text>
                  <Text style={styles.chatContextValue}>#{petition.petition_id}</Text>
                </View>

                <View style={styles.chatInputRow}>
                  <TextInput
                    style={styles.chatInput}
                    placeholder="Ask AI about this petition..."
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
    justifyContent: 'space-between',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    flexShrink: 1,
  },
  headerStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  headerStatusText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 13,
  },
  menuButton: {
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
  petitionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  priorityText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
    textTransform: 'capitalize',
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
  statusOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  statusOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusOptionText: {
    fontWeight: '800',
    fontSize: 13,
  },
  statusOptionSelected: {
    borderWidth: 2,
  },
  statusOptionDisabled: {
    opacity: 0.7,
  },
  statusUpdatingText: {
    marginTop: 10,
    color: '#64748b',
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