import React, { useState, useEffect, useCallback } from 'react';
import { View, Alert, Platform, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';

import { API_BASE_URL } from '../lib/api';
import nlpService from '../lib/nlpService';
import { Modal } from 'react-native';

// Types
type ComplaintVisibility = 'public' | 'private';
type ComplaintCategory = 'infrastructure' | 'cleanliness' | 'safety' | 'food' | 'noise' | 'finance' | 'behavior' | 'other';
type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

interface Complaint {
  complaint_id: number;
  title: string;
  description: string;
  category: string;
  severity: string;
  is_urgent: boolean;
  visibility: string;
  status: string;
  created_at: string;
  created_by: number;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

const RaiseComplaintScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const communityId = route.params?.communityId || route.params?.community_id;
  const communityName = route.params?.communityName || 'Community';
  const visibility = route.params?.visibility || 'public';

  // Tabs
  const [activeTab, setActiveTab] = useState<'raise' | 'my_complaints' | 'review'>('raise');
  const [userRole, setUserRole] = useState<string | null>(null);

  // Review Tab State
  const [allComplaints, setAllComplaints] = useState<Complaint[]>([]);
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'month' | 'all' | 'particular_day' | 'particular_month'>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [aiRecommendation, setAiRecommendation] = useState<{ recommendation: string; justification: string; remarks: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'other' as ComplaintCategory,
    severity: 'medium' as SeverityLevel,
    isUrgent: false,
    allowFollowUp: false,
    preferredContactChannel: 'chat' as 'chat' | 'email' | 'phone',
    attachments: [] as any[],
    tags: [] as string[],
    contactEmail: '',
    contactPhone: '',
  });

  // My Complaints State
  const [myComplaints, setMyComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const fetchUserRole = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token && communityId) {
        const decoded: any = jwtDecode(token);
        const userId = decoded.user_id;
        setCurrentUserId(userId);

        const response = await fetch(`${API_BASE_URL}/community_members/${communityId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          const myMember = data.members.find((m: any) => m.user_id === userId);
          if (myMember) {
            setUserRole(myMember.role);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching role:', err);
    }
  };

  useEffect(() => {
    fetchUserRole();
  }, [communityId]);

  const fetchMyComplaints = useCallback(async () => {
    if (!communityId) return;
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      let uId = currentUserId;
      if (!uId) {
        const decoded: any = jwtDecode(token);
        uId = decoded.user_id;
        setCurrentUserId(uId);
      }

      console.log('Fetching my complaints for user:', uId, 'in community:', communityId);
      const response = await axios.get(`${API_BASE_URL}/complaints/${communityId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const list = Array.isArray(response.data) ? response.data : response.data.complaints || [];
      const userComplaints = list.filter((c: any) => c.created_by === uId);
      setMyComplaints(userComplaints);
    } catch (error: any) {
      console.error('Error fetching complaints:', error);
    } finally {
      setLoading(false);
    }
  }, [communityId, currentUserId]);

  const fetchAllComplaints = useCallback(async () => {
    if (!communityId) return;
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      let url = `${API_BASE_URL}/complaints/${communityId}?filter=${dateFilter}`;
      if (dateFilter === 'particular_day') url += `&date=${filterDate}`;
      if (dateFilter === 'particular_month') url += `&month=${filterDate}`;

      const response = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const list = Array.isArray(response.data) ? response.data : response.data.complaints || [];
      setAllComplaints(list);
    } catch (error: any) {
      console.error('Error fetching all complaints:', error);
    } finally {
      setLoading(false);
    }
  }, [communityId, dateFilter, filterDate]);

  // Use focus effect to refresh whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'my_complaints') fetchMyComplaints();
      if (activeTab === 'review') fetchAllComplaints();
    }, [activeTab, fetchMyComplaints, fetchAllComplaints])
  );

  // Fetch whenever 'activeTab' changes
  useEffect(() => {
    if (activeTab === 'my_complaints') fetchMyComplaints();
    if (activeTab === 'review') fetchAllComplaints();
  }, [activeTab, fetchMyComplaints, fetchAllComplaints]);

  // Handle Form Submit
  const handleSubmit = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Error', 'Authentication required. Please log in again.');
        return;
      }

      if (!communityId) {
        Alert.alert('Error', 'Community ID is required to create a complaint.');
        return;
      }

      // Validate required fields
      if (!formData.title || !formData.description || !formData.category) {
        Alert.alert('Error', 'Please fill in all required fields (title, description, category).');
        return;
      }

      const complaintData = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        severity: formData.severity,
        is_urgent: formData.isUrgent,
        visibility: visibility,
        allow_follow_up: formData.allowFollowUp,
        preferred_contact_channel: formData.preferredContactChannel,
        contact_email: formData.contactEmail || null,
        contact_phone: formData.contactPhone || null,
        tags: formData.tags || [],
        community_id: Number(communityId),
      };

      const response = await axios.post(`${API_BASE_URL}/complaints`, complaintData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 201) {
        // Reset form immediately after successful submission
        setFormData({
          title: '',
          description: '',
          category: 'other',
          severity: 'medium',
          isUrgent: false,
          allowFollowUp: false,
          preferredContactChannel: 'chat',
          attachments: [],
          tags: [],
          contactEmail: '',
          contactPhone: '',
        });

        Alert.alert('Success', 'Complaint submitted successfully!', [
          {
            text: 'OK', onPress: () => {
              // Jump to My Complaints tab instead of going back
              fetchMyComplaints();
              setActiveTab('my_complaints');
            }
          }
        ]);
      }
    } catch (error: any) {
      console.error('Error creating complaint:', error);
      const errorMessage = error.response?.data?.error || 'Failed to create complaint. Please try again.';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleAIDecision = async (complaintId: number) => {
    try {
      setIsAiLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const response = await axios.post(
        `${API_BASE_URL}/complaints/${complaintId}/ai-process`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        Alert.alert(
          'AI Decision Complete',
          `Verdict: ${response.data.status}\n\n${response.data.analysis.llmSummary || ''}`
        );
        fetchAllComplaints();
      }
    } catch (error: any) {
      console.error('Error triggering AI decision:', error);
      const errMsg = error.response?.data?.error || 'Failed to process AI decision';
      Alert.alert('Error', errMsg);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAIReview = async (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setIsAiLoading(true);
    setAiModalVisible(true);
    try {
      const res = await nlpService.suggestAction(complaint.complaint_id, 'complaint', Number(communityId));
      if (res.success && res.data.suggestion) {
        const text = res.data.suggestion;
        const recommendation = text.match(/Recommendation:\s*(.*)/)?.[1] || "";
        const justification = text.match(/Justification:\s*(.*)/)?.[1] || "";
        const remarks = text.match(/Suggested Remarks:\s*(.*)/)?.[1] || "";
        setAiRecommendation({ recommendation, justification, remarks });
      }
    } catch (error) {
      console.error('AI Review error:', error);
      Alert.alert('Error', 'AI service is currently unavailable.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleUpdateStatus = async (complaintId: number, status: string, remarks: string = '') => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      await axios.put(`${API_BASE_URL}/complaints/${complaintId}/status`,
        { status, remarks },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Success', `Complaint ${status}`);
      setAiModalVisible(false);
      fetchAllComplaints();
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredComplaints = () => {
    const now = new Date();
    return allComplaints.filter(c => {
      const cDate = new Date(c.created_at);
      if (dateFilter === 'today') {
        return cDate.toDateString() === now.toDateString();
      }
      if (dateFilter === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        return cDate.toDateString() === yesterday.toDateString();
      }
      if (dateFilter === 'month') {
        return cDate.getMonth() === now.getMonth() && cDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  };

  const renderStatusBadge = (status: string) => {
    let bgColor = '#E5E7EB';
    let textColor = '#374151';
    let label = status;

    // Normalize and map statuses
    const normalized = (status || 'Pending').toUpperCase().replace(/\s/g, '_');

    switch (normalized) {
      case 'PENDING':
      case 'REVIEW':
      case 'OPEN':
      case 'IN_PROGRESS':
      case 'INPROGRESS':
        bgColor = '#FEF3C7';
        textColor = '#92400E';
        label = 'Pending';
        break;
      case 'APPROVED':
        bgColor = '#D1FAE5';
        textColor = '#065F46';
        label = 'Approved';
        break;
      case 'REJECTED':
        bgColor = '#FEE2E2';
        textColor = '#991B1B';
        label = 'Rejected';
        break;
      default:
        bgColor = '#FEF3C7';
        textColor = '#92400E';
        label = 'Pending';
    }

    return (
      <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
        <Text style={[styles.statusText, { color: textColor }]}>{label}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Community Complaints</Text>
        <Text style={styles.subtitle}>{communityName} • {visibility}</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'raise' && styles.activeTab]}
          onPress={() => setActiveTab('raise')}
        >
          <Text style={[styles.tabText, activeTab === 'raise' && styles.activeTabText]}>Raise Complaint</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my_complaints' && styles.activeTab]}
          onPress={() => setActiveTab('my_complaints')}
        >
          <Text style={[styles.tabText, activeTab === 'my_complaints' && styles.activeTabText]}>My Status</Text>
        </TouchableOpacity>
        {(userRole === 'HEAD' || userRole === 'ADMIN') && (
          <TouchableOpacity
            style={[styles.tab, activeTab === 'review' && styles.activeTab]}
            onPress={() => setActiveTab('review')}
          >
            <Text style={[styles.tabText, activeTab === 'review' && styles.activeTabText]}>Review Requests</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {activeTab === 'raise' ? (
        <ScrollView style={styles.content}>
          <View style={styles.form}>
            {/* Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>📝 What's your complaint about?</Text>
              <View style={styles.cardInput}>
                <TextInput
                  style={styles.cardTextInput}
                  placeholder="Enter a clear, concise title..."
                  value={formData.title}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                />
              </View>
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>💬 Tell us more details</Text>
              <View style={styles.cardInput}>
                <TextInput
                  style={[styles.cardTextInput, styles.cardTextArea]}
                  placeholder="Describe your complaint in detail. What happened? When? Who was involved?"
                  multiline
                  numberOfLines={4}
                  value={formData.description}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                />
              </View>
            </View>

            {/* Category */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>🏷️ What category does this fall under?</Text>
              <View style={styles.categoryContainer}>
                {([
                  { key: 'infrastructure', label: '🏗️ Infrastructure', color: '#3b82f6' },
                  { key: 'cleanliness', label: '🧹 Cleanliness', color: '#10b981' },
                  { key: 'safety', label: '🚨 Safety', color: '#ef4444' },
                  { key: 'food', label: '🍽️ Food', color: '#f59e0b' },
                  { key: 'noise', label: '🔊 Noise', color: '#8b5cf6' },
                  { key: 'finance', label: '💰 Finance', color: '#06b6d4' },
                  { key: 'behavior', label: '👥 Behavior', color: '#ec4899' },
                  { key: 'other', label: '❓ Other', color: '#6b7280' }
                ] as { key: ComplaintCategory; label: string; color: string }[]).map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      styles.categoryCard,
                      formData.category === cat.key && { ...styles.categoryCardActive, borderColor: cat.color, backgroundColor: cat.color + '10' }
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, category: cat.key }))}
                  >
                    <Text style={[
                      styles.categoryCardText,
                      formData.category === cat.key && { color: cat.color, fontWeight: '700' }
                    ]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Severity */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>⚠️ How urgent is this issue?</Text>
              <View style={styles.severityContainer}>
                {([
                  { key: 'low', label: '🟢 Low', color: '#10b981' },
                  { key: 'medium', label: '🟡 Medium', color: '#f59e0b' },
                  { key: 'high', label: '🟠 High', color: '#f97316' },
                  { key: 'critical', label: '🔴 Critical', color: '#ef4444' }
                ] as { key: SeverityLevel; label: string; color: string }[]).map((level) => (
                  <TouchableOpacity
                    key={level.key}
                    style={[
                      styles.severityCard,
                      formData.severity === level.key && { ...styles.severityCardActive, borderColor: level.color, backgroundColor: level.color + '10' }
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, severity: level.key }))}
                  >
                    <Text style={[
                      styles.severityCardText,
                      formData.severity === level.key && { color: level.color, fontWeight: '700' }
                    ]}>
                      {level.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Urgent Toggle */}
            <View style={styles.inputGroup}>
              <TouchableOpacity
                style={[
                  styles.urgentToggle,
                  formData.isUrgent && styles.urgentToggleActive
                ]}
                onPress={() => setFormData(prev => ({ ...prev, isUrgent: !prev.isUrgent }))}
              >
                <Text style={[
                  styles.urgentToggleIcon,
                  formData.isUrgent && styles.urgentToggleIconActive
                ]}>
                  {formData.isUrgent ? '🚨' : '⏰'}
                </Text>
                <Text style={[
                  styles.urgentToggleText,
                  formData.isUrgent && styles.urgentToggleTextActive
                ]}>
                  {formData.isUrgent ? 'Marked as Urgent' : 'Mark as Urgent if needed immediately'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Contact Information */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>📞 How can we follow up? (Optional)</Text>
              <View style={styles.contactContainer}>
                <View style={styles.contactCard}>
                  <Text style={styles.contactIcon}>📧</Text>
                  <TextInput
                    style={styles.contactInput}
                    placeholder="your.email@example.com"
                    keyboardType="email-address"
                    value={formData.contactEmail}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, contactEmail: text }))}
                  />
                </View>
                <View style={styles.contactCard}>
                  <Text style={styles.contactIcon}>📱</Text>
                  <TextInput
                    style={styles.contactInput}
                    placeholder="+1 (555) 123-4567"
                    keyboardType="phone-pad"
                    value={formData.contactPhone}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, contactPhone: text }))}
                  />
                </View>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
              <Text style={styles.submitText}>Submit Complaint</Text>
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      ) : activeTab === 'my_complaints' ? (
        <ScrollView style={styles.content}>
          {loading ? (
            <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 40 }} />
          ) : myComplaints.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateIcon}>📋</Text>
              <Text style={styles.emptyStateText}>You haven't raised any complaints yet.</Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {myComplaints.map(item => (
                <TouchableOpacity
                  key={item.complaint_id}
                  style={styles.itemCard}
                  onPress={() => navigation.navigate('ComplaintDetailsScreen', {
                    complaintId: item.complaint_id,
                    communityId: communityId
                  })}
                >
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    {renderStatusBadge(item.status || 'Pending')}
                  </View>
                  <Text style={styles.itemDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                  <View style={styles.itemFooter}>
                    <Text style={styles.itemCategory}>{item.category || 'other'}</Text>
                    <Text style={styles.itemDate}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <ScrollView style={styles.content}>
          <View style={styles.filterBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
              {(['all', 'today', 'yesterday', 'month', 'particular_day', 'particular_month'] as const).map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterBtn, dateFilter === f && styles.activeFilterBtn]}
                  onPress={() => setDateFilter(f)}
                >
                  <Text style={[styles.filterBtnText, dateFilter === f && styles.activeFilterBtnText]}>
                    {f === 'particular_day' ? 'Day' : f === 'particular_month' ? 'Month' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {(dateFilter === 'particular_day' || dateFilter === 'particular_month') && (
            <View style={styles.dateInputContainer}>
              <TextInput
                style={styles.dateInput}
                placeholder={dateFilter === 'particular_day' ? "YYYY-MM-DD" : "YYYY-MM"}
                value={filterDate}
                onChangeText={setFilterDate}
              />
              <TouchableOpacity style={styles.applyBtn} onPress={fetchAllComplaints}>
                <Text style={styles.applyBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          )}

          {loading ? (
            <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 40 }} />
          ) : getFilteredComplaints().length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateIcon}>📋</Text>
              <Text style={styles.emptyStateText}>No pending complaints found for this period.</Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {getFilteredComplaints().map(item => (
                <View key={item.complaint_id} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    {renderStatusBadge(item.status || 'Pending')}
                  </View>
                  <Text style={styles.itemDescription} numberOfLines={3}>{item.description}</Text>
                  {(!item.status || ['PENDING', 'REVIEW', 'IN_PROGRESS', 'INPROGRESS', 'OPEN'].includes(item.status.toUpperCase().replace(/\s/g, '_'))) && (
                    <View style={styles.headActions}>
                      <View style={{ flexDirection: 'row' }}>
                        <TouchableOpacity
                          style={styles.aiReviewBtn}
                          onPress={() => handleAIReview(item)}
                        >
                          <Text style={styles.aiReviewBtnText}>🤖 Insights</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.aiDecisionBtn}
                          onPress={() => handleAIDecision(item.complaint_id)}
                          disabled={isAiLoading}
                        >
                          <Text style={styles.aiDecisionBtnText}>⚡ AI Decision</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          style={[styles.statusBtn, styles.approveBtnMini]}
                          onPress={() => handleUpdateStatus(item.complaint_id, 'Approved')}
                        >
                          <Text style={styles.statusBtnSmallText}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.statusBtn, styles.rejectBtnMini]}
                          onPress={() => handleUpdateStatus(item.complaint_id, 'Rejected')}
                        >
                          <Text style={styles.statusBtnSmallText}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* AI Recommendation Modal */}
      <Modal
        visible={aiModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAiModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>AI review Recommendations</Text>
            <ScrollView style={styles.modalScroll}>
              {isAiLoading ? (
                <View style={styles.loadingAi}>
                  <ActivityIndicator size="large" color="#3b82f6" />
                  <Text style={styles.aiText}>Analyzing complaint...</Text>
                </View>
              ) : aiRecommendation ? (
                <View>
                  <Text style={styles.recTitle}>AI Recommendation: {aiRecommendation.recommendation}</Text>
                  <Text style={styles.recSection}>Justification:</Text>
                  <Text style={styles.recText}>{aiRecommendation.justification}</Text>
                  <Text style={styles.recSection}>Suggested Remarks:</Text>
                  <Text style={styles.recText}>{aiRecommendation.remarks}</Text>

                  <View style={styles.modalActionRow}>
                    <TouchableOpacity
                      style={[styles.modalActionBtn, styles.modalApproveBtn]}
                      onPress={() => selectedComplaint && handleUpdateStatus(selectedComplaint.complaint_id, 'Approved', aiRecommendation.remarks)}
                    >
                      <Text style={styles.modalActionText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalActionBtn, styles.modalRejectBtn]}
                      onPress={() => selectedComplaint && handleUpdateStatus(selectedComplaint.complaint_id, 'Rejected', aiRecommendation.remarks)}
                    >
                      <Text style={styles.modalActionText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setAiModalVisible(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    backgroundColor: 'rgba(59, 130, 246, 0.4)',
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#e0e7ff',
    textAlign: 'center',
    marginTop: 5,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabText: {
    color: '#3b82f6',
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  severityContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  submitButton: {
    backgroundColor: '#dc2626',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },

  // Card-based input styles
  cardInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTextInput: {
    padding: 16,
    fontSize: 16,
    color: '#374151',
    backgroundColor: 'transparent',
  },
  cardTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },

  // Category card styles
  categoryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 4,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryCardActive: {
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  categoryCardText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Severity card styles
  severityCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 4,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  severityCardActive: {
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  severityCardText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Contact styles
  contactContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  contactCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  contactIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  contactInput: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    backgroundColor: 'transparent',
  },

  // Urgent toggle styles
  urgentToggle: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  urgentToggleActive: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  urgentToggleIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  urgentToggleIconActive: {
    color: '#ef4444',
  },
  urgentToggleText: {
    fontSize: 16,
    color: '#6b7280',
    flex: 1,
  },
  urgentToggleTextActive: {
    color: '#ef4444',
    fontWeight: '600',
  },

  // Tab Lists
  listContainer: {
    padding: 16,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemDescription: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 12,
    lineHeight: 20,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  itemCategory: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  itemDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  emptyStateContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  // New Styles for Review Tab
  filterBar: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  activeFilterBtn: {
    backgroundColor: '#3b82f6',
  },
  filterBtnText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  activeFilterBtnText: {
    color: '#fff',
  },
  headActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  aiReviewBtn: {
    backgroundColor: '#f5f3ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  aiReviewBtnText: {
    color: '#7c3aed',
    fontWeight: '700',
    fontSize: 13,
  },
  statusBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  approveBtnMini: {
    backgroundColor: '#10b981',
  },
  rejectBtnMini: {
    backgroundColor: '#ef4444',
  },
  statusBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  statusBtnSmallText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalScroll: {
    marginBottom: 20,
  },
  loadingAi: {
    padding: 40,
    alignItems: 'center',
  },
  aiText: {
    marginTop: 12,
    color: '#64748b',
  },
  recTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  recSection: {
    fontWeight: '600',
    color: '#334155',
    marginTop: 12,
    fontSize: 14,
  },
  recText: {
    color: '#475569',
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalActionBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalApproveBtn: {
    backgroundColor: '#10b981',
  },
  modalRejectBtn: {
    backgroundColor: '#ef4444',
  },
  modalActionText: {
    color: '#fff',
    fontWeight: '700',
  },
  closeBtn: {
    padding: 12,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#64748b',
    fontWeight: '600',
  },
  dateInputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 8,
    marginRight: 10,
    backgroundColor: '#f9fafb',
  },
  applyBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  applyBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  aiDecisionBtn: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    marginLeft: 8,
  },
  aiDecisionBtnText: {
    color: '#4f46e5',
    fontWeight: '700',
    fontSize: 13,
  },
});

export default RaiseComplaintScreen;