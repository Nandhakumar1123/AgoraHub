import React, { useCallback, useState, useRef } from "react";
import {
  ActivityIndicator,
  Clipboard,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  Modal,
  Dimensions,
} from "react-native";
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from "react-native";
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../lib/api';
import { jwtDecode } from 'jwt-decode';
import { AppContext } from './_layout';
import { useContext } from 'react';
import nlpService from '../lib/nlpService';


const BASE_URL = API_BASE_URL;
const { width } = Dimensions.get('window');

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
  priority_level: 'normal' | 'important' | 'critical';
  visibility: 'public' | 'private';
  status: PetitionStatus;
}

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

export default function ViewPetitionsScreen() {
  const { theme } = useContext(AppContext);
  const isDark = theme === 'dark';
  const themeStyles = isDark ? darkTheme : lightTheme;

  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const [petitions, setPetitions] = useState<Petition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const communityId = route.params?.communityId || route.params?.community_id || null;
  const [userRole, setUserRole] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all' | 'particular_day' | 'particular_month' | 'range'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [filterDate, setFilterDate] = useState<string>('');


  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [aiRecommendation, setAiRecommendation] = useState<{ recommendation: string; justification: string; remarks: string } | null>(null);


  // --- Community AI Chat State ---
  const [aiChatVisible, setAiChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // --- Per-Card AI State ---
  const [cardAiVisible, setCardAiVisible] = useState(false);
  const [cardAiPetition, setCardAiPetition] = useState<Petition | null>(null);
  const [cardAiMessages, setCardAiMessages] = useState<ChatMessage[]>([]);
  const [cardAiInput, setCardAiInput] = useState('');
  const [cardAiLoading, setCardAiLoading] = useState(false);
  const cardScrollRef = useRef<ScrollView>(null);

  // --- Options Modal ---
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [selectedPetition, setSelectedPetition] = useState<Petition | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  // --- Message Action Menu State ---
  const [msgActionVisible, setMsgActionVisible] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<{ index: number; role: 'user' | 'ai'; text: string; chatType: 'main' | 'card' } | null>(null);

  const fetchPetitions = useCallback(async () => {
    if (!communityId) {
      setError("Community ID is required.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const token = await AsyncStorage.getItem('authToken');
      if (!token) { setError("Authentication required."); setLoading(false); return; }

      let url = `${BASE_URL}/petitions/${communityId}?filter=${dateFilter}`;
      if (dateFilter === 'particular_day') url += `&date=${filterDate}`;
      if (dateFilter === 'particular_month') url += `&month=${filterDate}`;
      if (dateFilter === 'range') url += `&startDate=${startDate}&endDate=${endDate}`;


      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = Array.isArray(response.data) ? response.data : response.data?.petitions || [];
      setPetitions(list);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to load petitions.");
    } finally {
      setLoading(false);
    }
  }, [communityId, dateFilter, filterDate]);


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

  const handleUpdateStatus = async (petitionId: number, status: string, remarks: string = '') => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      await axios.put(`${BASE_URL}/petitions/${petitionId}/status`,
        { status, remarks },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Success', `Petition updated to ${status}`);
      await fetchPetitions();
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleAIDecision = async (petitionId: number) => {
    try {
      setIsAiLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      const response = await axios.post(
        `${BASE_URL}/petitions/${petitionId}/ai-process`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        Alert.alert(
          'AI Decision Complete',
          `Verdict: ${response.data.status}\n\n${response.data.analysis?.llmSummary || ''}`
        );
        fetchPetitions();
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
      const res = await axios.post(`${BASE_URL}/petitions/batch-status`, {
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
        fetchPetitions();
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Batch update failed');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {

    fetchPetitions();
    fetchUserRole();
  }, [fetchPetitions, fetchUserRole]));

  const openMainAiChat = () => {
    navigation.navigate('PetitionAIChatScreen', {
      communityId,
      communityName: 'Community' // Ideally pass actual name if available
    });
  };

  // --- PER-CARD AI CHAT ---
  const openAiChatForPetition = (petition: Petition) => {
    setCardAiPetition(petition);
    setCardAiMessages([{
      role: 'ai',
      text: `👋 Hi! I'm analyzing petition #${petition.petition_id}: "${petition.title}". What would you like to know about it?`,
    }]);
    setCardAiInput('');
    setCardAiVisible(true);
  };

  const sendCardAiMessage = async () => {
    if (!cardAiInput.trim() || cardAiLoading || !cardAiPetition) return;
    const question = cardAiInput.trim();
    setCardAiInput('');
    setCardAiMessages(prev => [...prev, { role: 'user', text: question }]);
    setCardAiLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const context = `Petition Title: ${cardAiPetition.title}\nSummary: ${cardAiPetition.summary}\nProposed Action: ${cardAiPetition.proposed_action}\nGoal: ${cardAiPetition.goal_type}\nImpact: ${cardAiPetition.impact_area}\nStatus: ${cardAiPetition.status}`;
      const fullQuestion = `For this specific petition:\n${context}\n\nUser question: ${question}`;
      const res = await axios.post(`${BASE_URL}/bot/ask/petitions`, {
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

  const handleClearPetition = async () => {
    if (!selectedPetition) return;
    setIsClearing(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) { Alert.alert('Error', 'Authentication required'); return; }
      await axios.delete(`${BASE_URL}/petitions/${selectedPetition.petition_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPetitions(prev => prev.filter(p => p.petition_id !== selectedPetition.petition_id));
      setOptionsModalVisible(false);
      setSelectedPetition(null);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || err.message || 'Failed to clear petition');
    } finally {
      setIsClearing(false);
    }
  };

  const openOptions = (item: Petition) => { setSelectedPetition(item); setOptionsModalVisible(true); };

  // --- Message Action Helpers ---
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

  const getStatusStyles = (status: string) => {
    const s = (status || 'Pending').toUpperCase().replace(/\s/g, '_');
    switch (s) {
      case 'REVIEW':
      case 'PENDING':
      case 'OPEN':
        return { dot: styles.pendingDot, tag: styles.pendingTag, text: styles.pendingText };
      case 'INPROGRESS':
      case 'IN_PROGRESS':
        return { dot: styles.inProgressDot, tag: styles.inProgressTag, text: styles.inProgressText };
      case 'APPROVED':
        return { dot: styles.approvedDot, tag: styles.approvedTag, text: styles.approvedText };
      case 'REJECTED':
        return { dot: styles.rejectedDot, tag: styles.rejectedTag, text: styles.rejectedText };
      default:
        return { dot: styles.pendingDot, tag: styles.pendingTag, text: styles.pendingText };
    }
  };

  const totalPetitions = petitions.length;
  const approvedPetitionsCount = petitions.filter(p => p.status?.toUpperCase() === "APPROVED").length;
  const pendingPetitionsCount = petitions.filter(p => ['REVIEW', 'PENDING', 'INPROGRESS', 'IN_PROGRESS', 'OPEN'].includes(p.status?.toUpperCase().replace(/\s/g, '_'))).length;

  const filteredPetitions = petitions.filter(p => {
    const matchesSearch = (p.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.summary || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.author_name || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;

    const status = (p.status || '').toUpperCase().replace(/\s/g, '_');
    if (statusFilter === 'pending') return ['PENDING', 'REVIEW', 'INPROGRESS', 'IN_PROGRESS'].includes(status);
    if (statusFilter === 'approved') return status === 'APPROVED';
    if (statusFilter === 'rejected') return status === 'REJECTED';


    return true;
  });


  const renderPetition = ({ item }: { item: Petition }) => {
    const s = getStatusStyles(item.status);
    return (
      <View style={[styles.timelineItem, themeStyles.root]}>
        <View style={styles.timelineLine} />
        <View style={[styles.timelineDot, s.dot]} />
        <View style={[styles.petitionCard, themeStyles.card]}>
          <View style={styles.cardHeader}>
            <Text style={styles.memberName}>Author: {item.author_name}</Text>
            <View style={styles.cardHeaderRight}>
              <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString("en-GB")}</Text>
              {/* Per-card AI icon */}
              {(userRole === 'HEAD' || userRole === 'ADMIN') && (
                <TouchableOpacity style={styles.cardAiBtn} onPress={() => openAiChatForPetition(item)}>
                  <Text style={styles.cardAiBtnText}>🤖</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.optionsIcon} onPress={() => openOptions(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.optionsIconText}>⋮</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[styles.petitionTitle, themeStyles.text]}>{item.title}</Text>
          <Text style={[styles.petitionDesc, themeStyles.subText]}>{item.summary}</Text>

          {(userRole === 'HEAD' || userRole === 'ADMIN') && (!['APPROVED', 'REJECTED'].includes(item.status.toUpperCase().replace(/\s/g, '_'))) && (
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.approveActionButton]}
                onPress={() => handleUpdateStatus(item.petition_id, 'Approved')}
              >
                <Text style={styles.actionButtonSmallText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectActionButton]}
                onPress={() => handleUpdateStatus(item.petition_id, 'Rejected')}
              >
                <Text style={styles.actionButtonSmallText}>Reject</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.statusRow}>
            <View style={[
              styles.statusTag,
              (item.status?.toUpperCase() === "APPROVED") ? styles.approvedTag :
                (item.status?.toUpperCase() === "REJECTED") ? styles.rejectedTag :
                  styles.pendingTag,
              { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }
            ]}>
              <Text style={[
                styles.statusText,
                (item.status?.toUpperCase() === "APPROVED") ? styles.approvedText :
                  (item.status?.toUpperCase() === "REJECTED") ? styles.rejectedText :
                    styles.pendingText,
                { fontWeight: '700', fontSize: 9 }
              ]}>
                {(item.status?.toUpperCase() === "APPROVED") ? "Approved" :
                  (item.status?.toUpperCase() === "REJECTED") ? "Rejected" :
                    "Pending"}
              </Text>
            </View>


            <TouchableOpacity
              style={styles.viewBtn}
              onPress={() => navigation.navigate('PetitionDetailsScreen', { petitionId: item.petition_id, communityId })}
            >
              <Text style={styles.viewText}>View Details →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderListHeader = () => (
    <>
      <View style={[styles.header, themeStyles.header]}>
        <Text style={[styles.title, themeStyles.headerText]}>🗳️ Petitions Dashboard</Text>
        <Text style={[styles.subtitle, themeStyles.headerText]}>Track all community petitions</Text>
      </View>

      <View style={[styles.statsContainer, themeStyles.card]}>
        <View style={styles.statCard}><Text style={[styles.statNumber, themeStyles.text]}>{totalPetitions}</Text><Text style={[styles.statLabel, themeStyles.subText]}>Total</Text></View>
        <View style={styles.statCard}><Text style={[styles.statNumber, themeStyles.text]}>{approvedPetitionsCount || 0}</Text><Text style={[styles.statLabel, themeStyles.subText]}>Approved</Text></View>
        <View style={styles.statCard}><Text style={[styles.statNumber, themeStyles.text]}>{pendingPetitionsCount || 0}</Text><Text style={[styles.statLabel, themeStyles.subText]}>Pending</Text></View>
      </View>

      {(userRole === 'HEAD' || userRole === 'ADMIN') && (
        <TouchableOpacity style={styles.aiBanner} onPress={openMainAiChat}>
          <Text style={styles.aiBannerIcon}>🤖</Text>
          <View style={styles.aiBannerTextGroup}>
            <Text style={styles.aiBannerTitle}>AI Petitions Analyst</Text>
            <Text style={styles.aiBannerSub}>Ask for summaries, trends & insights</Text>
          </View>
          <Text style={styles.aiBannerArrow}>›</Text>
        </TouchableOpacity>
      )}

      <View style={[styles.searchContainer, themeStyles.card]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, themeStyles.text]}
          placeholder="Search by title, description, or author..."
          placeholderTextColor={isDark ? "#9ca3af" : "#64748b"}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

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
          <TouchableOpacity style={styles.applyBtn} onPress={fetchPetitions}>
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
          <TouchableOpacity style={styles.applyBtn} onPress={fetchPetitions}>
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
        </View>
      )}

      {(userRole === 'HEAD' || userRole === 'ADMIN') && filteredPetitions.length > 0 && (
        <View style={styles.batchContainer}>
          <TouchableOpacity style={[styles.batchBtn, styles.approveBatchBtn, { paddingVertical: 10 }]} onPress={() => handleBatchUpdate('Approved')}>
            <Text style={[styles.batchBtnText, { fontSize: 13 }]}>Approve All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.batchBtn, styles.rejectBatchBtn, { paddingVertical: 10 }]} onPress={() => handleBatchUpdate('Rejected')}>
            <Text style={[styles.batchBtnText, { fontSize: 13 }]}>Reject All</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View style={styles.container}>
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loaderText}>Loading petitions...</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyText}>Error loading petitions</Text>
          <Text style={styles.emptySubtext}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredPetitions}
          keyExtractor={item => item.petition_id.toString()}
          renderItem={renderPetition}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No petitions found</Text>
              <Text style={styles.emptySubtext}>Try adjusting your search keywords or raise a new petition!</Text>
            </View>
          }
          contentContainerStyle={styles.timelineContainer}
          showsVerticalScrollIndicator={false}
        />
      )}



      {/* ======= Per-Card AI Chat Modal ======= */}
      <Modal visible={cardAiVisible} animationType="slide" onRequestClose={() => setCardAiVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#f0fdf4' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.chatHeader, { backgroundColor: '#059669' }]}>
            <TouchableOpacity onPress={() => setCardAiVisible(false)} style={styles.chatBackBtn}>
              <Text style={styles.chatBackText}>✕</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.chatHeaderTitle}>🤖 Petition AI Analysis</Text>
              <Text style={styles.chatHeaderSub} numberOfLines={1}>{cardAiPetition?.title}</Text>
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
                <ActivityIndicator size="small" color="#10b981" />
                <Text style={styles.aiMsgText}> AI is thinking...</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatTextInput}
              placeholder="Ask about this petition..."
              placeholderTextColor="#9ca3af"
              value={cardAiInput}
              onChangeText={setCardAiInput}
              onSubmitEditing={sendCardAiMessage}
              returnKeyType="send"
            />
            <TouchableOpacity style={[styles.sendBtn, { backgroundColor: '#059669' }, (!cardAiInput.trim() || cardAiLoading) && styles.sendBtnDisabled]} onPress={sendCardAiMessage} disabled={!cardAiInput.trim() || cardAiLoading}>
              <Text style={styles.sendBtnText}>➤</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Options Modal */}
      <Modal visible={optionsModalVisible} transparent animationType="fade" onRequestClose={() => setOptionsModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOptionsModalVisible(false)}>
          <TouchableOpacity style={styles.optionsModalContent} activeOpacity={1} onPress={() => { }}>
            <TouchableOpacity style={styles.optionItem} onPress={() => { setOptionsModalVisible(false); handleClearPetition(); }} disabled={isClearing}>
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
            <TouchableOpacity style={styles.msgActionItem} onPress={handleDeleteMsg}>
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
  statNumber: { fontSize: 24, fontWeight: "800", color: "#1e293b", marginBottom: 4 },
  statLabel: { fontSize: 12, color: "#6b7280", fontWeight: "600", textAlign: "center" },
  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    marginHorizontal: 15,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    elevation: 2,
  },
  aiBannerIcon: { fontSize: 28, marginRight: 12 },
  aiBannerTextGroup: { flex: 1 },
  aiBannerTitle: { fontSize: 15, fontWeight: '700', color: '#065f46' },
  aiBannerSub: { fontSize: 12, color: '#10b981', marginTop: 2 },
  aiBannerArrow: { fontSize: 24, color: '#10b981', fontWeight: '700' },
  searchContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    margin: 15,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    elevation: 2,
  },
  searchIcon: { fontSize: 18, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: "#1e293b" },
  timelineContainer: { padding: 20, paddingTop: 10 },
  timelineItem: { flexDirection: "row", marginBottom: 25, position: "relative" },
  timelineLine: { position: "absolute", top: 25, left: 10, width: 2, height: "100%", backgroundColor: "#d1d5db" },
  timelineDot: { width: 16, height: 16, borderRadius: 8, marginTop: 10, marginRight: 15, zIndex: 2 },
  reviewDot: { backgroundColor: "#3b82f6" },
  inProgressDot: { backgroundColor: "#8b5cf6" },
  approvedDot: { backgroundColor: "#16a34a" },
  rejectedDot: { backgroundColor: "#dc2626" },
  pendingDot: { backgroundColor: "#f59e0b" },
  petitionCard: {
    flex: 1, backgroundColor: "rgba(30, 41, 59, 0.5)", borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.05)",
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  cardHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  memberName: { fontWeight: "700", color: "#818cf8", fontSize: 15 },
  dateText: { fontSize: 13, color: "#94a3b8" },
  cardAiBtn: { padding: 4, backgroundColor: 'rgba(99, 102, 241, 0.2)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  cardAiBtnText: { fontSize: 14 },
  optionsIcon: { padding: 4, marginLeft: 4 },
  optionsIconText: { fontSize: 18, color: "#94a3b8", fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.6)", justifyContent: "center", alignItems: "center" },
  optionsModalContent: {
    backgroundColor: "#1e293b", borderRadius: 16, minWidth: width * 0.5,
    paddingVertical: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  optionItem: { paddingVertical: 14, paddingHorizontal: 20 },
  optionText: { fontSize: 16, color: "#f8fafc" },
  clearOptionText: { color: "#ef4444", fontWeight: "600" },
  petitionTitle: { fontSize: 18, fontWeight: "700", color: "#f8fafc", marginBottom: 6 },
  petitionDesc: { fontSize: 14, color: "#cbd5e1", marginBottom: 12, lineHeight: 22 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusTag: { borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10 },
  reviewTag: { backgroundColor: "rgba(59, 130, 246, 0.2)" },
  inProgressTag: { backgroundColor: "rgba(139, 92, 246, 0.2)" },
  approvedTag: { backgroundColor: "rgba(16, 185, 129, 0.2)" },
  rejectedTag: { backgroundColor: "rgba(239, 68, 68, 0.2)" },
  pendingTag: { backgroundColor: "rgba(245, 158, 11, 0.2)" },
  statusText: { fontWeight: "700", fontSize: 12 },
  reviewText: { color: "#60a5fa" },
  inProgressText: { color: "#a78bfa" },
  approvedText: { color: "#34d399" },
  rejectedText: { color: "#f87171" },
  pendingText: { color: "#fbbf24" },
  viewBtn: { padding: 4 },
  viewText: { color: "#818cf8", fontWeight: "700", fontSize: 13 },
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loaderText: { color: "#94a3b8", marginTop: 12 },
  emptyBox: { alignItems: "center", padding: 60 },
  emptyIcon: { fontSize: 60, marginBottom: 10 },
  emptyText: { fontWeight: "700", fontSize: 18, color: "#f8fafc", marginBottom: 5 },
  emptySubtext: { color: "#94a3b8", textAlign: "center", lineHeight: 20 },

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
  msgActionIcon: { fontSize: 18 },
  msgActionText: { fontSize: 16, color: '#f8fafc', fontWeight: '500' },

  // Visible Edit/Delete buttons per message
  msgRow: { marginBottom: 12 },
  msgRowUser: { alignItems: 'flex-end' },
  msgRowAi: { alignItems: 'flex-start' },
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

  batchContainer: { flexDirection: 'row', marginHorizontal: 15, marginBottom: 15, gap: 12 },
  batchBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  approveBatchBtn: { backgroundColor: '#10b981' },
  rejectBatchBtn: { backgroundColor: '#ef4444' },
  batchBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

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
  actionButtonSmallText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});

const lightTheme = StyleSheet.create({
    root: { backgroundColor: 'transparent' },
    header: { backgroundColor: 'rgba(255, 255, 255, 0.8)', borderBottomColor: 'rgba(0,0,0,0.1)' },
    headerText: { color: '#1e293b' },
    card: { backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: 'rgba(0,0,0,0.1)' },
    text: { color: '#1e293b' },
    subText: { color: '#475569' },
});

const darkTheme = StyleSheet.create({
    root: { backgroundColor: 'transparent' },
    header: { backgroundColor: 'rgba(15, 23, 42, 0.8)', borderBottomColor: 'rgba(255,255,255,0.05)' },
    headerText: { color: '#f8fafc' },
    card: { backgroundColor: 'rgba(30, 41, 59, 0.7)', borderColor: 'rgba(255,255,255,0.08)' },
    text: { color: '#f8fafc' },
    subText: { color: '#cbd5e1' },
});
