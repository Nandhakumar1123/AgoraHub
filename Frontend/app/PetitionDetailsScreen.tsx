import React, { useEffect, useState, useContext } from 'react';
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
import { AppContext } from './_layout';

type PetitionStatus = 'Review' | 'Pending' | 'InProgress' | 'Approved' | 'Rejected';

interface Petition {
  petition_id: number;
  title: string;
  summary: string;
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
  const { theme } = useContext(AppContext);
  const isDark = theme === 'dark';

  const route = useRoute();
  const navigation = useNavigation();
  const { petitionId, communityId } = route.params as { petitionId: number; communityId: number };

  const [petition, setPetition] = useState<Petition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
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
    fetchPetitionDetails();
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

  const handleAutoAnalyze = async () => {
    if (!petition || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const response = await nlpService.suggestAction(petition.petition_id, 'petition', Number(communityId));
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
    if (petition && userRole === 'HEAD' && !aiAnalysis && !isAnalyzing) {
      handleAutoAnalyze();
    }
  }, [petition, userRole]);

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
      case 'Pending': return '#ea580c';
      case 'InProgress': return '#3b82f6';
      case 'Approved': return '#16a34a';
      case 'Rejected': return '#dc2626';
    }
  };

  const getStatusSoftColors = (status: PetitionStatus) => {
    switch (status) {
      case 'Review':
        return { bg: '#eff6ff', text: '#3b82f6', border: '#bfdbfe' };
      case 'Pending':
        return { bg: '#fff7ed', text: '#ea580c', border: '#ffedd5' };
      case 'InProgress':
        return { bg: '#eff6ff', text: '#3b82f6', border: '#bfdbfe' };
      case 'Approved':
        return { bg: '#f0fdf4', text: '#16a34a', border: '#dcfce7' };
      case 'Rejected':
        return { bg: '#fef2f2', text: '#dc2626', border: '#fee2e2' };
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return '#dc2626';
      case 'important': return '#ea580c';
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

  const themeStyles = isDark ? darkTheme : lightTheme;

  return (
    <View style={[styles.root, themeStyles.root]}>
      <ScrollView style={[styles.container, themeStyles.root]}>
        <View style={[styles.header, themeStyles.header]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={[styles.backButton, themeStyles.headerText]}>← Back</Text>
            </TouchableOpacity>
            <Text style={[styles.title, themeStyles.headerText]}>Petition Details</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => setMenuVisible((prev) => !prev)}
              style={styles.menuButton}
            >
              <Text style={[styles.menuButtonText, themeStyles.headerText]}>⋮</Text>
            </TouchableOpacity>
            <View
              style={[
                styles.headerStatusBadge,
                { backgroundColor: getStatusColor(petition.status) + '15', borderWidth: 1, borderColor: getStatusColor(petition.status) + '30' },
              ]}
            >
              <Text style={[styles.headerStatusText, { color: getStatusColor(petition.status) }]}>{petition.status}</Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {['Pending', 'InProgress', 'Review', 'OPEN', 'IN_PROGRESS'].includes(petition.status) && userRole === 'HEAD' && (
            <View style={[styles.topActions, themeStyles.card]}>
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

              <Text style={[styles.adminActionTitle, themeStyles.text]}>Update Petition Status</Text>
              <View style={[styles.actionRow, { flexWrap: 'wrap', gap: 8 }]}>
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
          )}

          <View style={[styles.card, themeStyles.card]}>
            <Text style={[styles.petitionTitle, themeStyles.text]}>{displayText(petition.title)}</Text>

            <View style={styles.statusRow}>
              <View
                style={[
                  styles.priorityBadge,
                  { backgroundColor: getPriorityColor(petition.priority_level) + '15', borderWidth: 1, borderColor: getPriorityColor(petition.priority_level) + '30' },
                ]}
              >
                <Text style={[styles.priorityText, { color: getPriorityColor(petition.priority_level) }]}>{petition.priority_level}</Text>
              </View>
            </View>

            <View style={styles.metaInfo}>
              <Text style={styles.metaLabel}>Author:</Text>
              <Text style={[styles.metaValue, themeStyles.text]}>{displayText(petition.author_name)}</Text>
            </View>

            <View style={styles.metaInfo}>
              <Text style={styles.metaLabel}>Community:</Text>
              <Text style={[styles.metaValue, themeStyles.text]}>{displayText(petition.community_name)}</Text>
            </View>

            <View style={styles.metaInfo}>
              <Text style={styles.metaLabel}>Created:</Text>
              <Text style={[styles.metaValue, themeStyles.text]}>{formatDate(petition.created_at)}</Text>
            </View>

            <View style={styles.metaInfo}>
              <Text style={styles.metaLabel}>Goal Type:</Text>
              <Text style={[styles.metaValue, themeStyles.text]}>
                {displayText(
                  petition.goal_type === 'Other'
                    ? petition.other_goal_type
                    : petition.goal_type
                )}
              </Text>
            </View>

            <View style={styles.metaInfo}>
              <Text style={styles.metaLabel}>Impact Area:</Text>
              <Text style={[styles.metaValue, themeStyles.text]}>
                {displayText(
                  petition.impact_area === 'Other'
                    ? petition.other_impact_area
                    : petition.impact_area
                )}
              </Text>
            </View>

            <View style={styles.metaInfo}>
              <Text style={styles.metaLabel}>Affected Groups:</Text>
              <Text style={[styles.metaValue, themeStyles.text]}>
                {Array.isArray(petition.affected_groups) &&
                  petition.affected_groups.length > 0
                  ? petition.affected_groups.join(', ')
                  : 'N/A'}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, themeStyles.text]}>Summary</Text>
              <Text style={[styles.sectionContent, themeStyles.subText]}>{displayText(petition.summary)}</Text>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, themeStyles.text]}>Proposed Action</Text>
              <Text style={[styles.sectionContent, themeStyles.subText]}>
                {displayText(petition.proposed_action)}
              </Text>
            </View>

            {petition.reference_context && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, themeStyles.text]}>Reference Context</Text>
                <Text style={[styles.sectionContent, themeStyles.subText]}>{petition.reference_context}</Text>
              </View>
            )}

            {petition.remarks && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, themeStyles.text]}>Remarks</Text>
                <Text style={[styles.sectionContent, themeStyles.subText]}>{petition.remarks}</Text>
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
          <View style={[styles.menuDropdown, themeStyles.dropdown]}>
            <TouchableOpacity
              onPress={() => {
                setMenuVisible(false);
                setShowAssistant(true);
                setIsChatMinimized(false);
              }}
              style={styles.menuItem}
            >
              <Text style={[styles.menuItemText, themeStyles.text]}>Ask AI about this petition</Text>
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
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 55,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
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
    gap: 12,
  },
  backButton: {
    fontSize: 16,
    color: '#f8fafc',
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    flexShrink: 1,
  },
  headerStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  headerStatusText: {
    fontWeight: '800',
    fontSize: 12,
  },
  menuButton: {
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
  petitionTitle: {
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
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  priorityText: {
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  statusOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  statusOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusOptionText: {
    fontWeight: '700',
    fontSize: 14,
  },
  statusOptionSelected: {
    borderWidth: 2,
  },
  statusOptionDisabled: {
    opacity: 0.5,
  },
  topActionsCard: {
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
    marginBottom: 8,
  },
  statusUpdatingText: {
    marginTop: 12,
    color: '#94a3b8',
    fontWeight: '600',
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
  topActions: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
});
const lightTheme = StyleSheet.create({
    root: { backgroundColor: 'transparent' },
    header: { backgroundColor: 'rgba(255, 255, 255, 0.8)', borderBottomColor: 'rgba(0,0,0,0.1)' },
    headerText: { color: '#1e293b' },
    card: { backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: 'rgba(0,0,0,0.1)' },
    text: { color: '#1e293b' },
    subText: { color: '#475569' },
    dropdown: { backgroundColor: '#ffffff', borderColor: 'rgba(0,0,0,0.1)' },
});

const darkTheme = StyleSheet.create({
    root: { backgroundColor: 'transparent' },
    header: { backgroundColor: 'rgba(15, 23, 42, 0.8)', borderBottomColor: 'rgba(255,255,255,0.05)' },
    headerText: { color: '#f8fafc' },
    card: { backgroundColor: 'rgba(30, 41, 59, 1)', borderColor: 'rgba(255,255,255,0.08)' },
    text: { color: '#f8fafc' },
    subText: { color: '#cbd5e1' },
    dropdown: { backgroundColor: '#1e293b', borderColor: 'rgba(255,255,255,0.1)' },
});
