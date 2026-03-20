import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from "react-native";
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from "react-native";
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../lib/api';
import { jwtDecode } from 'jwt-decode';

const BASE_URL = API_BASE_URL;
const { width, height } = Dimensions.get('window');

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
  created_by_name: string;
  community_id: number;
}

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

export default function ViewComplaintsScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const communityId = route.params?.communityId || route.params?.community_id || 1;
  const [userRole, setUserRole] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all' | 'particular_day' | 'particular_month' | 'range'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [filterDate, setFilterDate] = useState<string>('');


  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<{ recommendation: string; justification: string; remarks: string } | null>(null);

  // --- AI CHAT STATE ---
  const [aiChatVisible, setAiChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // --- PER-CARD AI STATE ---
  const [cardAiVisible, setCardAiVisible] = useState(false);
  const [cardAiComplaint, setCardAiComplaint] = useState<Complaint | null>(null);
  const [cardAiMessages, setCardAiMessages] = useState<ChatMessage[]>([]);
  const [cardAiInput, setCardAiInput] = useState('');
  const [cardAiLoading, setCardAiLoading] = useState(false);
  const cardScrollRef = useRef<ScrollView>(null);

  // --- OPTIONS MODAL STATE ---
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  // --- MESSAGE ACTION MENU STATE ---
  const [msgActionVisible, setMsgActionVisible] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<{ index: number; role: 'user' | 'ai'; text: string; chatType: 'main' | 'card' } | null>(null);

  const fetchComplaints = React.useCallback(async () => {
    if (!communityId) {
      setError("Community ID is required.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        setError("Authentication required. Please log in again.");
        setLoading(false);
        return;
      }
      let url = `${BASE_URL}/complaints/${communityId}?filter=${dateFilter}`;
      if (dateFilter === 'particular_day') url += `&date=${filterDate}`;
      if (dateFilter === 'particular_month') url += `&month=${filterDate}`;
      if (dateFilter === 'range') url += `&startDate=${startDate}&endDate=${endDate}`;


      const response = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const list = Array.isArray(response.data) ? response.data : response.data?.complaints || [];
      setComplaints(list.map((c: any) => ({
        ...c,
        created_by_name: c.creator_name ?? c.created_by_name ?? 'Unknown',
      })));
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to load complaints.");
    } finally {
      setLoading(false);
    }
  }, [communityId, dateFilter, filterDate, startDate, endDate]);

  const fetchUserRole = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        const decoded: any = jwtDecode(token);
        const userId = decoded.user_id;

        const response = await fetch(
          `${API_BASE_URL}/community_members/${communityId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.ok) {
          const data = await response.json();
          const userMembership = data.members.find(
            (m: any) => m.user_id === userId
          );
          if (userMembership) {
            setUserRole(userMembership.role);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
    }
  }, [communityId]);

  const handleUpdateStatus = async (complaintId: number, status: string, remarks: string = '') => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      await axios.put(`${BASE_URL}/complaints/${complaintId}/status`,
        { status, remarks },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Success', `Complaint updated to ${status}`);
      await fetchComplaints();
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleAIDecision = async (complaintId: number) => {
    try {
      setIsAiLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      const response = await axios.post(
        `${BASE_URL}/complaints/${complaintId}/ai-process`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        Alert.alert(
          'AI Decision Complete',
          `Verdict: ${response.data.status}\n\n${response.data.analysis?.llmSummary || ''}`
        );
        fetchComplaints();
      }
    } catch (error: any) {
      console.error('Error triggering AI decision:', error);
      const errMsg = error.response?.data?.error || 'Failed to process AI decision';
      Alert.alert('Error', errMsg);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleBatchUpdate = async (status: string) => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      const res = await axios.post(`${BASE_URL}/complaints/batch-status`, {
        communityId,
        status,
        filter: dateFilter,
        date: dateFilter === 'particular_day' ? filterDate : undefined,
        month: dateFilter === 'particular_month' ? filterDate : undefined,
        startDate: dateFilter === 'range' ? startDate : undefined,
        endDate: dateFilter === 'range' ? endDate : undefined,
        currentStatus: statusFilter !== 'all' ? statusFilter : undefined,
        remarks: `Batch ${status}`
      }, { headers: { Authorization: `Bearer ${token}` } });



      if (res.data.success) {
        Alert.alert('Success', `Batch update complete: ${res.data.count} items ${status.toLowerCase()}`);
        fetchComplaints();
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Batch update failed');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    fetchComplaints();
    fetchUserRole();
  }, [fetchComplaints, fetchUserRole]));


  // --- AI CHAT FUNCTIONS ---
  const loadAiHistory = async () => {
    try {
      setAiLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.warn('No auth token for AI history');
        return;
      }
      const res = await axios.get(`${BASE_URL}/bot/ask/complaints/history?community_id=${communityId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const historyMsg = (res.data?.data || []).flatMap((h: any) => [
        { role: 'user', text: h.question },
        { role: 'ai', text: h.answer }
      ]);
      setChatMessages(historyMsg);
    } catch (e: any) {
      console.error('Failed to load history', e.response?.data || e.message);
      // Fallback empty if fail
      setChatMessages([]);
    } finally {
      setAiLoading(false);
    }
  };

  const openMainAiChat = () => {
    setAiChatVisible(true);
    // Always fetch history when clicked if empty
    if (chatMessages.length === 0) {
      loadAiHistory();
    }
  };

  const sendAiMessage = async () => {
    if (!chatInput.trim() || aiLoading) return;
    const question = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: question }]);
    setAiLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const res = await axios.post(`${BASE_URL}/bot/ask/complaints`, {
        question,
        community_id: communityId,
      }, { headers: { Authorization: `Bearer ${token}` } });
      const answer = res.data?.data?.answer || res.data?.answer || "No response from AI.";
      setChatMessages(prev => [...prev, { role: 'ai', text: answer }]);
    } catch (e: any) {
      const errorMsg = e.response?.data?.error || e.message || 'AI unavailable.';
      setChatMessages(prev => [...prev, { role: 'ai', text: `⚠️ ${errorMsg}` }]);
    } finally {
      setAiLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const openAiChatForComplaint = (complaint: Complaint) => {
    setCardAiComplaint(complaint);
    setCardAiMessages([{
      role: 'ai',
      text: `👋 Hi! I'm analyzing complaint #${complaint.complaint_id}: "${complaint.title}". What would you like to know about it?`,
    }]);
    setCardAiInput('');
    setCardAiVisible(true);
  };

  const sendCardAiMessage = async () => {
    if (!cardAiInput.trim() || cardAiLoading || !cardAiComplaint) return;
    const question = cardAiInput.trim();
    setCardAiInput('');
    setCardAiMessages(prev => [...prev, { role: 'user', text: question }]);
    setCardAiLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const context = `Complaint Title: ${cardAiComplaint.title}\nDescription: ${cardAiComplaint.description}\nCategory: ${cardAiComplaint.category}\nSeverity: ${cardAiComplaint.severity}\nStatus: ${cardAiComplaint.status}`;
      const fullQuestion = `For this specific complaint:\n${context}\n\nUser question: ${question}`;
      const res = await axios.post(`${BASE_URL}/bot/ask/complaints`, {
        question: fullQuestion,
        community_id: communityId,
      }, { headers: { Authorization: `Bearer ${token}` } });
      const answer = res.data?.data?.answer || res.data?.answer || "No response from AI.";
      setCardAiMessages(prev => [...prev, { role: 'ai', text: answer }]);
    } catch (e: any) {
      const errorMsg = e.response?.data?.error || e.message || 'AI unavailable.';
      setCardAiMessages(prev => [...prev, { role: 'ai', text: `⚠️ ${errorMsg}` }]);
    } finally {
      setCardAiLoading(false);
      setTimeout(() => cardScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // --- DELETE ---
  const handleClearComplaint = async () => {
    if (!selectedComplaint) return;
    setIsClearing(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) { Alert.alert('Error', 'Authentication required'); return; }
      await axios.delete(`${BASE_URL}/complaints/${selectedComplaint.complaint_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setComplaints(prev => prev.filter(c => c.complaint_id !== selectedComplaint.complaint_id));
      setOptionsModalVisible(false);
      setSelectedComplaint(null);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || err.message || 'Failed to clear complaint');
    } finally {
      setIsClearing(false);
    }
  };

  const openOptions = (item: Complaint) => { setSelectedComplaint(item); setOptionsModalVisible(true); };

  // --- MESSAGE ACTION HELPERS ---
  const onLongPressMsg = (index: number, msg: { role: 'user' | 'ai'; text: string }, chatType: 'main' | 'card') => {
    setSelectedMsg({ index, role: msg.role, text: msg.text, chatType });
    setMsgActionVisible(true);
  };

  const handleCopyMsg = () => {
    if (!selectedMsg) return;
    Clipboard.setString(selectedMsg.text);
    setMsgActionVisible(false);
  };

  const handleEditMsg = () => {
    if (!selectedMsg || selectedMsg.role !== 'user') return;
    if (selectedMsg.chatType === 'main') {
      setChatInput(selectedMsg.text);
    } else {
      setCardAiInput(selectedMsg.text);
    }
    setMsgActionVisible(false);
  };

  const handleDeleteMsg = () => {
    if (!selectedMsg) return;
    if (selectedMsg.chatType === 'main') {
      setChatMessages(prev => prev.filter((_, i) => i !== selectedMsg.index));
    } else {
      setCardAiMessages(prev => prev.filter((_, i) => i !== selectedMsg.index));
    }
    setMsgActionVisible(false);
  };

  const filteredComplaints = complaints.filter(c => {
    const matchesSearch = (c.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.created_by_name || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;

    const status = (c.status || '').toUpperCase().replace(/\s/g, '_');
    if (statusFilter === 'pending') return ['OPEN', 'PENDING', 'REVIEW', 'IN_PROGRESS', 'INPROGRESS'].includes(status);
    if (statusFilter === 'approved') return status === 'APPROVED';
    if (statusFilter === 'rejected') return status === 'REJECTED';


    return true;
  });


  const totalComplaints = complaints.length;
  const approvedComplaintsCount = complaints.filter(c => c.status?.toUpperCase() === "APPROVED").length;
  const pendingComplaintsCount = complaints.filter(c => ['OPEN', 'PENDING', 'REVIEW', 'IN_PROGRESS', 'INPROGRESS'].includes(c.status?.toUpperCase().replace(/\s/g, '_'))).length;

  const renderComplaint = ({ item }: { item: Complaint }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{item.created_by_name.charAt(0)}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.memberName}>{item.created_by_name}</Text>
          <View style={styles.dateRow}>
            <Text style={styles.dateText}>
              {new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </Text>
            {/* AI Icon per card */}
            {(userRole === 'HEAD' || userRole === 'ADMIN') && (
              <TouchableOpacity
                style={styles.cardAiBtn}
                onPress={() => openAiChatForComplaint(item)}
              >
                <Text style={styles.cardAiBtnText}>🤖</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.optionsIcon}
              onPress={() => openOptions(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.optionsIconText}>⋮</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={[
          styles.statusBadge,
          (item.status?.toUpperCase() === "APPROVED") ? styles.approvedBadge :
            (item.status?.toUpperCase() === "REJECTED") ? styles.rejectedBadge :
              styles.pendingBadge
        ]}>
          <Text style={[
            styles.statusBadgeText,
            (item.status?.toUpperCase() === "APPROVED") ? styles.approvedText :
              (item.status?.toUpperCase() === "REJECTED") ? styles.rejectedText :
                styles.pendingText
          ]}>
            {(item.status?.toUpperCase() === "APPROVED") ? "Approved" :
              (item.status?.toUpperCase() === "REJECTED") ? "Rejected" :
                "Pending"}
          </Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.subjectText}>{item.title}</Text>

        <Text style={styles.descriptionText} numberOfLines={3}>{item.description}</Text>
        <Text style={styles.categoryText}>Category: {item.category}</Text>
      </View>

      {(userRole === 'HEAD' || userRole === 'ADMIN') && (!['APPROVED', 'REJECTED'].includes(item.status.toUpperCase().replace(/\s/g, '_'))) && (
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveActionButton]}
            onPress={() => handleUpdateStatus(item.complaint_id, 'Approved')}
          >
            <Text style={styles.actionButtonSmallText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectActionButton]}
            onPress={() => handleUpdateStatus(item.complaint_id, 'Rejected')}
          >
            <Text style={styles.actionButtonSmallText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}


      <View style={styles.cardFooter}>
        <Text style={styles.complaintId}>ID: #{item.complaint_id}</Text>
        <TouchableOpacity
          style={styles.viewButton}
          onPress={() => navigation.navigate('ComplaintDetailsScreen', { complaintId: item.complaint_id, communityId })}
        >
          <Text style={styles.viewButtonText}>View Details →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={styles.background}
      >
        <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Complaints Dashboard</Text>
        <Text style={styles.subtitle}>Overview of all community complaints</Text>
      </View>

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}><Text style={styles.statNumber}>{totalComplaints}</Text><Text style={styles.statLabel}>Total</Text></View>
        <View style={styles.statCard}><Text style={styles.statNumber}>{approvedComplaintsCount}</Text><Text style={styles.statLabel}>Approved</Text></View>
        <View style={styles.statCard}><Text style={styles.statNumber}>{pendingComplaintsCount}</Text><Text style={styles.statLabel}>Pending</Text></View>
      </View>

      {/* AI Banner */}
      {(userRole === 'HEAD' || userRole === 'ADMIN') && (
        <TouchableOpacity style={styles.aiBanner} onPress={openMainAiChat}>
          <Text style={styles.aiBannerIcon}>🤖</Text>
          <View style={styles.aiBannerTextGroup}>
            <Text style={styles.aiBannerTitle}>AI Complaints Analyst</Text>
            <Text style={styles.aiBannerSub}>Ask about trends, summaries & solutions</Text>
          </View>
          <Text style={styles.aiBannerArrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* Search */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search complaints..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Date Filters */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15 }}>
          {(['all', 'today', 'yesterday', 'week', 'month', 'particular_day', 'particular_month', 'range'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterBtn, dateFilter === f && styles.activeFilterBtn]}
              onPress={() => setDateFilter(f)}
            >
              <Text style={[styles.filterBtnText, dateFilter === f && styles.activeFilterBtnText]}>
                {f === 'particular_day' ? 'Day' : f === 'particular_month' ? 'Month' : f === 'range' ? 'Date Range' : f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Status Filters */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15 }}>
          {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.statusFilterBtn, statusFilter === s && styles.activeStatusFilterBtn]}
              onPress={() => setStatusFilter(s)}
            >
              <Text style={[styles.statusFilterBtnText, statusFilter === s && styles.activeStatusFilterBtnText]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
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
          <TouchableOpacity style={styles.applyBtn} onPress={fetchComplaints}>
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
        </View>
      )}

      {dateFilter === 'range' && (
        <View style={styles.dateInputContainer}>
          <TextInput
            style={styles.dateInput}
            placeholder="Start: YYYY-MM-DD"
            value={startDate}
            onChangeText={setStartDate}
          />
          <TextInput
            style={styles.dateInput}
            placeholder="End: YYYY-MM-DD"
            value={endDate}
            onChangeText={setEndDate}
          />
          <TouchableOpacity style={styles.applyBtn} onPress={fetchComplaints}>
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Batch Actions */}
      {(userRole === 'HEAD' || userRole === 'ADMIN') && filteredComplaints.length > 0 && (
        <View style={styles.batchContainer}>
          <TouchableOpacity style={[styles.batchBtn, styles.approveBatchBtn, { paddingVertical: 10 }]} onPress={() => handleBatchUpdate('Approved')}>
            <Text style={[styles.batchBtnText, { fontSize: 13 }]}>Approve All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.batchBtn, styles.rejectBatchBtn, { paddingVertical: 10 }]} onPress={() => handleBatchUpdate('Rejected')}>
            <Text style={[styles.batchBtnText, { fontSize: 13 }]}>Reject All</Text>
          </TouchableOpacity>
        </View>
      )}



      {/* Complaints List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading complaints...</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyText}>Error loading complaints</Text>
          <Text style={styles.emptySubtext}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredComplaints}
          keyExtractor={item => item.complaint_id.toString()}
          renderItem={renderComplaint}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No complaints found</Text>
            </View>
          }
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ======= Community AI Chat Modal ======= */}
      <Modal visible={(userRole === 'HEAD' || userRole === 'ADMIN') && aiChatVisible} animationType="slide" onRequestClose={() => setAiChatVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#f0f4ff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Modal Header */}
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={() => setAiChatVisible(false)} style={styles.chatBackBtn}>
              <Text style={styles.chatBackText}>✕</Text>
            </TouchableOpacity>
            <View>
              <Text style={styles.chatHeaderTitle}>🤖 Complaints AI</Text>
              <Text style={styles.chatHeaderSub}>Ask for summaries, trends & recommendations</Text>
            </View>
          </View>

          {chatMessages.length === 0 && (
            <View style={styles.chatPlaceholder}>
              <Text style={styles.chatPlaceholderIcon}>🤖</Text>
              <Text style={styles.chatPlaceholderTitle}>AI Complaints Analyst</Text>
              <Text style={styles.chatPlaceholderSub}>Try asking:</Text>
              {["What are the complaints this month?", "Which category has the most issues?", "Summarize today's complaints"].map(q => (
                <TouchableOpacity key={q} style={styles.quickAsk} onPress={() => { setChatInput(q); }}>
                  <Text style={styles.quickAskText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <ScrollView
            ref={scrollRef}
            style={styles.chatScroll}
            contentContainerStyle={{ padding: 16, paddingBottom: 10 }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {chatMessages.map((msg, i) => (
              <View key={i} style={[styles.msgRow, msg.role === 'user' ? styles.msgRowUser : styles.msgRowAi]}>
                <View style={[styles.msgBubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                  <Text style={msg.role === 'user' ? styles.userMsgText : styles.aiMsgText}>{msg.text}</Text>
                </View>
                <View style={[styles.msgActions, msg.role === 'user' ? styles.msgActionsUser : styles.msgActionsAi]}>
                  {msg.role === 'user' && (
                    <TouchableOpacity style={styles.msgActionBtn} onPress={() => { setChatInput(msg.text); }}>
                      <Text style={styles.msgActionBtnText}>✏️</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.msgActionBtn, styles.msgDeleteBtn]} onPress={() => {
                    setChatMessages(prev => prev.filter((_, idx) => idx !== i));
                  }}>
                    <Text style={styles.msgActionBtnText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {aiLoading && (
              <View style={styles.aiBubble}>
                <ActivityIndicator size="small" color="#6366f1" />
                <Text style={styles.aiMsgText}> AI is thinking...</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatTextInput}
              placeholder="Ask about complaints..."
              placeholderTextColor="#9ca3af"
              value={chatInput}
              onChangeText={setChatInput}
              onSubmitEditing={sendAiMessage}
              returnKeyType="send"
            />
            <TouchableOpacity style={[styles.sendBtn, (!chatInput.trim() || aiLoading) && styles.sendBtnDisabled]} onPress={sendAiMessage} disabled={!chatInput.trim() || aiLoading}>
              <Text style={styles.sendBtnText}>➤</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ======= Per-Card AI Chat Modal ======= */}
      <Modal visible={cardAiVisible} animationType="slide" onRequestClose={() => setCardAiVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#f0f4ff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.chatHeader, { backgroundColor: '#7c3aed' }]}>
            <TouchableOpacity onPress={() => setCardAiVisible(false)} style={styles.chatBackBtn}>
              <Text style={styles.chatBackText}>✕</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.chatHeaderTitle}>🤖 Complaint AI Analysis</Text>
              <Text style={styles.chatHeaderSub} numberOfLines={1}>{cardAiComplaint?.title}</Text>
            </View>
          </View>

          <ScrollView
            ref={cardScrollRef}
            style={styles.chatScroll}
            contentContainerStyle={{ padding: 16, paddingBottom: 10 }}
            onContentSizeChange={() => cardScrollRef.current?.scrollToEnd({ animated: true })}
          >
            {cardAiMessages.map((msg, i) => (
              <View key={i} style={[styles.msgRow, msg.role === 'user' ? styles.msgRowUser : styles.msgRowAi]}>
                <View style={[styles.msgBubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                  <Text style={msg.role === 'user' ? styles.userMsgText : styles.aiMsgText}>{msg.text}</Text>
                </View>
                <View style={[styles.msgActions, msg.role === 'user' ? styles.msgActionsUser : styles.msgActionsAi]}>
                  {msg.role === 'user' && (
                    <TouchableOpacity style={styles.msgActionBtn} onPress={() => { setCardAiInput(msg.text); }}>
                      <Text style={styles.msgActionBtnText}>✏️</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.msgActionBtn, styles.msgDeleteBtn]} onPress={() => {
                    setCardAiMessages(prev => prev.filter((_, idx) => idx !== i));
                  }}>
                    <Text style={styles.msgActionBtnText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {cardAiLoading && (
              <View style={styles.aiBubble}>
                <ActivityIndicator size="small" color="#6366f1" />
                <Text style={styles.aiMsgText}> AI is thinking...</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatTextInput}
              placeholder="Ask about this complaint..."
              placeholderTextColor="#9ca3af"
              value={cardAiInput}
              onChangeText={setCardAiInput}
              onSubmitEditing={sendCardAiMessage}
              returnKeyType="send"
            />
            <TouchableOpacity style={[styles.sendBtn, { backgroundColor: '#7c3aed' }, (!cardAiInput.trim() || cardAiLoading) && styles.sendBtnDisabled]} onPress={sendCardAiMessage} disabled={!cardAiInput.trim() || cardAiLoading}>
              <Text style={styles.sendBtnText}>➤</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Options Modal */}
      <Modal visible={optionsModalVisible} transparent animationType="fade" onRequestClose={() => setOptionsModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOptionsModalVisible(false)}>
          <TouchableOpacity style={styles.optionsModalContent} activeOpacity={1} onPress={() => { }}>
            <TouchableOpacity style={styles.optionItem} onPress={() => { setOptionsModalVisible(false); handleClearComplaint(); }} disabled={isClearing}>
              <Text style={[styles.optionText, styles.clearOptionText]}>{isClearing ? 'Clearing...' : 'Clear'}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Message Action Menu */}
      <Modal visible={msgActionVisible} transparent animationType="fade" onRequestClose={() => setMsgActionVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMsgActionVisible(false)}>
          <View style={styles.msgActionSheet}>
            <Text style={styles.msgActionTitle} numberOfLines={2}>{selectedMsg?.text}</Text>
            <View style={styles.msgActionDivider} />
            <TouchableOpacity style={styles.msgActionItem} onPress={handleCopyMsg}>
              <Text style={styles.msgActionIcon}>📋</Text>
              <Text style={styles.msgActionText}>Copy</Text>
            </TouchableOpacity>
            {selectedMsg?.role === 'user' && (
              <TouchableOpacity style={styles.msgActionItem} onPress={handleEditMsg}>
                <Text style={styles.msgActionIcon}>✏️</Text>
                <Text style={styles.msgActionText}>Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.msgActionItem, styles.msgActionDelete]} onPress={handleDeleteMsg}>
              <Text style={styles.msgActionIcon}>🗑️</Text>
              <Text style={[styles.msgActionText, { color: '#ef4444' }]}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.msgActionItem, { borderTopWidth: 1, borderTopColor: '#f3f4f6' }]} onPress={() => setMsgActionVisible(false)}>
              <Text style={[styles.msgActionText, { color: '#6b7280', textAlign: 'center', width: '100%' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "transparent" },
  background: { flex: 1 },
  container: { flex: 1 },
  header: {
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  title: { fontSize: 26, color: "#f8fafc", fontWeight: "800", textAlign: "center" },
  subtitle: { color: "#94a3b8", fontSize: 14, fontWeight: "500", textAlign: "center", marginTop: 5 },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    marginHorizontal: 15,
    marginTop: -15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  statCard: { alignItems: "center", flex: 1 },
  statNumber: { fontSize: 24, fontWeight: "800", color: "#f8fafc", marginBottom: 4 },
  statLabel: { fontSize: 12, color: "#94a3b8", fontWeight: "600", textAlign: "center" },
  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    marginHorizontal: 15,
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  aiBannerIcon: { fontSize: 28, marginRight: 12 },
  aiBannerTextGroup: { flex: 1 },
  aiBannerTitle: { fontSize: 16, fontWeight: '700', color: '#a5b4fc' },
  aiBannerSub: { fontSize: 13, color: '#818cf8', marginTop: 2 },
  aiBannerArrow: { fontSize: 24, color: '#818cf8', fontWeight: '700' },
  searchContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    margin: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  searchIcon: { fontSize: 18, marginRight: 12, marginTop: 2 },
  searchInput: { flex: 1, fontSize: 15, color: "#f8fafc" },
  listContainer: { padding: 15, paddingTop: 5 },
  card: {
    backgroundColor: "rgba(30, 41, 59, 0.5)", borderRadius: 16, padding: 16, marginBottom: 15,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.05)",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  avatarContainer: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#6366f1",
    alignItems: "center", justifyContent: "center", marginRight: 10,
  },
  avatarText: { fontSize: 16, fontWeight: "800", color: "#fff" },
  headerInfo: { flex: 1 },
  memberName: { fontWeight: "700", color: "#818cf8", fontSize: 15 },
  dateRow: { flexDirection: "row", alignItems: "center", marginTop: 2, gap: 8 },
  dateText: { fontSize: 12, color: "#94a3b8" },
  cardAiBtn: { padding: 4, backgroundColor: 'rgba(99, 102, 241, 0.2)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  cardAiBtnText: { fontSize: 14 },
  optionsIcon: { padding: 4, marginLeft: 4 },
  optionsIconText: { fontSize: 18, color: "#94a3b8", fontWeight: "700" },
  statusBadge: { borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10 },
  statusBadgeText: { fontWeight: "700", fontSize: 12 },
  pendingBadge: { backgroundColor: "rgba(245, 158, 11, 0.2)" },
  pendingText: { color: "#fbbf24" },
  approvedBadge: { backgroundColor: "rgba(16, 185, 129, 0.2)" },
  approvedText: { color: "#34d399" },
  rejectedBadge: { backgroundColor: "rgba(239, 68, 68, 0.2)" },
  rejectedText: { color: "#f87171" },

  cardBody: { marginBottom: 12 },
  subjectText: { fontSize: 18, fontWeight: "700", color: "#f8fafc", marginBottom: 8 },
  descriptionText: { fontSize: 14, color: "#cbd5e1", marginBottom: 8, lineHeight: 22 },
  categoryText: { fontSize: 13, color: "#94a3b8", fontStyle: "italic" },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  complaintId: { fontSize: 13, color: "#64748b", fontWeight: "600" },
  viewButton: { padding: 4 },
  viewButtonText: { color: "#818cf8", fontWeight: "700", fontSize: 14 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#94a3b8", marginTop: 12 },
  emptyContainer: { alignItems: "center", padding: 60 },
  emptyIcon: { fontSize: 60, marginBottom: 10 },
  emptyText: { fontWeight: "700", fontSize: 18, color: "#f8fafc", marginBottom: 5 },
  emptySubtext: { color: "#94a3b8", textAlign: "center", lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.6)", justifyContent: "center", alignItems: "center" },
  optionsModalContent: {
    backgroundColor: "#1e293b", borderRadius: 16, minWidth: width * 0.5,
    paddingVertical: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  optionItem: { paddingVertical: 14, paddingHorizontal: 20 },
  optionText: { fontSize: 16, color: "#f8fafc" },
  clearOptionText: { color: "#ef4444", fontWeight: "600" },

  // Chat styles
  chatHeader: {
    backgroundColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 55 : 30,
    paddingBottom: 16,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  chatBackBtn: { padding: 8 },
  chatBackText: { fontSize: 20, color: '#f8fafc', fontWeight: '700' },
  chatHeaderTitle: { fontSize: 18, fontWeight: '800', color: '#f8fafc' },
  chatHeaderSub: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  chatScroll: { flex: 1, backgroundColor: '#0f172a' },
  chatPlaceholder: { alignItems: 'center', padding: 30, backgroundColor: '#0f172a', flex: 1 },
  chatPlaceholderIcon: { fontSize: 50, marginBottom: 12 },
  chatPlaceholderTitle: { fontSize: 20, fontWeight: '800', color: '#f8fafc', marginBottom: 6 },
  chatPlaceholderSub: { fontSize: 14, color: '#94a3b8', marginBottom: 16 },
  quickAsk: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 10, width: '100%', alignItems: 'center',
  },
  quickAskText: { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
  msgBubble: { borderRadius: 18, padding: 14, marginBottom: 10, maxWidth: '85%' },
  userBubble: { backgroundColor: '#6366f1', alignSelf: 'flex-end' },
  aiBubble: { backgroundColor: 'rgba(30, 41, 59, 1)', alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  userMsgText: { color: '#ffffff', fontSize: 15, lineHeight: 22 },
  aiMsgText: { color: '#f8fafc', fontSize: 15, flex: 1, flexWrap: 'wrap', lineHeight: 22 },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  chatTextInput: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    fontSize: 15,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sendBtn: {
    backgroundColor: '#6366f1',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  // Message action menu styles
  msgActionSheet: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    width: width * 0.85,
    paddingTop: 16,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  msgActionTitle: {
    fontSize: 13,
    color: '#94a3b8',
    paddingHorizontal: 20,
    paddingBottom: 12,
    fontStyle: 'italic',
  },
  msgActionDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 4 },
  msgActionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, gap: 14 },
  msgActionDelete: {},
  msgActionIcon: { fontSize: 18 },
  msgActionText: { fontSize: 16, color: '#f8fafc', fontWeight: '500' },

  // Visible Edit/Delete button styles per message
  msgRow: { marginBottom: 12 },
  msgRowUser: { alignItems: 'flex-end' },
  msgRowAi: { alignItems: 'flex-start' },

  // New action styles
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    marginTop: 8,
    gap: 12,
  },
  actionButton: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  aiActionButton: { backgroundColor: '#8b5cf6' },
  approveActionButton: { backgroundColor: '#10b981' },
  rejectActionButton: { backgroundColor: '#ef4444' },

  // Filter styles
  filterBar: { marginBottom: 12 },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  activeFilterBtn: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  filterBtnText: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },
  activeFilterBtnText: { color: '#ffffff' },

  statusFilterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  activeStatusFilterBtn: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  statusFilterBtnText: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },
  activeStatusFilterBtnText: { color: '#ffffff' },

  dateInputContainer: { flexDirection: 'row', marginHorizontal: 15, marginBottom: 15, gap: 12 },
  dateInput: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#f8fafc',
  },
  applyBtn: { backgroundColor: '#6366f1', paddingHorizontal: 20, justifyContent: 'center', borderRadius: 12 },
  applyBtnText: { color: '#fff', fontWeight: '700' },

  // Batch actions
  batchContainer: { flexDirection: 'row', marginHorizontal: 15, marginBottom: 15, gap: 12 },
  batchBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  approveBatchBtn: { backgroundColor: '#10b981' },
  rejectBatchBtn: { backgroundColor: '#ef4444' },
  batchBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  actionButtonSmallText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  msgActions: { flexDirection: 'row', gap: 8, marginTop: 4, paddingHorizontal: 6 },
  msgActionsUser: { justifyContent: 'flex-end' },
  msgActionsAi: { justifyContent: 'flex-start' },

  msgActionBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  msgDeleteBtn: { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
  msgActionBtnText: { fontSize: 14 },
});