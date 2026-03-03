import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
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
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from '../lib/api';
const BASE_URL = API_BASE_URL;
const { width } = Dimensions.get('window');

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
  affected_groups: string[];
  priority_level: 'normal' | 'important' | 'critical';
  reference_context?: string;
  visibility: 'public' | 'private';
  status: PetitionStatus;
  reviewed_by?: number;
  remarks?: string;
}

export default function ViewPetitionsScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const [petitions, setPetitions] = useState<Petition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Get communityId from route params, with fallback
  const communityId = route.params?.communityId || route.params?.community_id || null;

  const fetchPetitions = useCallback(async () => {
    if (!communityId) {
      setError("Community ID is required. Please navigate from a community screen.");
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

      const response = await axios.get(`${BASE_URL}/petitions/${communityId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Backend returns the array directly (res.json(result.rows)), not { petitions: [...] }
      const list = Array.isArray(response.data) ? response.data : response.data?.petitions || [];
      setPetitions(list);
    } catch (err: any) {
      console.error("Error fetching petitions:", err);
      const errorMessage = err.response?.data?.error || err.message || "Failed to load petitions.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useFocusEffect(
    useCallback(() => {
      fetchPetitions();
    }, [fetchPetitions])
  );

  const getStatusStyles = (status: PetitionStatus) => {
    switch (status) {
      case 'Review':
        return { dot: styles.reviewDot, tag: styles.reviewTag, text: styles.reviewText };
      case 'Pending':
        return { dot: styles.pendingDot, tag: styles.pendingTag, text: styles.pendingText };
      case 'InProgress':
        return { dot: styles.inProgressDot, tag: styles.inProgressTag, text: styles.inProgressText };
      case 'Approved':
        return { dot: styles.approvedDot, tag: styles.approvedTag, text: styles.approvedText };
      case 'Rejected':
        return { dot: styles.rejectedDot, tag: styles.rejectedTag, text: styles.rejectedText };
    }
  };

  const filteredPetitions = petitions.filter(
    (p) =>
      (p.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.summary || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.problem_statement || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.author_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [selectedPetition, setSelectedPetition] = useState<Petition | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const handleClearPetition = async () => {
    if (!selectedPetition) return;
    setIsClearing(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }
      await axios.delete(`${BASE_URL}/petitions/${selectedPetition.petition_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPetitions((prev) => prev.filter((p) => p.petition_id !== selectedPetition.petition_id));
      setOptionsModalVisible(false);
      setSelectedPetition(null);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to clear petition';
      Alert.alert('Error', msg);
    } finally {
      setIsClearing(false);
    }
  };

  const openOptions = (item: Petition) => {
    setSelectedPetition(item);
    setOptionsModalVisible(true);
  };

  const renderPetition = ({ item }: { item: Petition }) => (
    (() => {
      const s = getStatusStyles(item.status);
      return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineLine} />
      <View
        style={[
          styles.timelineDot,
          s.dot,
        ]}
      />
      <View style={styles.petitionCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.memberName}>Author: {item.author_name}</Text>
          <View style={styles.cardHeaderRight}>
            <Text style={styles.dateText}>
              {new Date(item.created_at).toLocaleDateString("en-GB")}
            </Text>
            <TouchableOpacity
              style={styles.optionsIcon}
              onPress={() => openOptions(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.optionsIconText}>⋮</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.petitionTitle}>{item.title}</Text>
        <Text style={styles.petitionDesc}>{item.summary}</Text>

        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusTag,
              s.tag,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                s.text,
              ]}
            >
              {item.status}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.viewBtn}
            onPress={() => navigation.navigate('PetitionDetailsScreen', {
              petitionId: item.petition_id,
              communityId: communityId
            })}
          >
            <Text style={styles.viewText}>View Details →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
      );
    })()
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🗳️ Petitions Dashboard</Text>
        <Text style={styles.subtitle}>Track all community petitions</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title, description, or author..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

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
          keyExtractor={(item) => item.petition_id.toString()}
          renderItem={renderPetition}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No petitions found</Text>
              <Text style={styles.emptySubtext}>
                Try adjusting your search keywords or raise a new petition!
              </Text>
            </View>
          }
          contentContainerStyle={styles.timelineContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={optionsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setOptionsModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.optionsModalContent}
            activeOpacity={1}
            onPress={() => {}}
          >
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setOptionsModalVisible(false);
                handleClearPetition();
              }}
              disabled={isClearing}
            >
              <Text style={[styles.optionText, styles.clearOptionText]}>
                {isClearing ? 'Clearing...' : 'Clear'}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    backgroundColor: "#3b82f6",
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  title: { fontSize: 26, color: "#fff", fontWeight: "800" },
  subtitle: { color: "#e0e7ff", fontSize: 14, fontWeight: "500" },
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

  timelineContainer: {
    padding: 20,
    paddingTop: 10,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 25,
    position: "relative",
  },
  timelineLine: {
    position: "absolute",
    top: 25,
    left: 10,
    width: 2,
    height: "100%",
    backgroundColor: "#d1d5db",
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginTop: 10,
    marginRight: 15,
    zIndex: 2,
  },
  reviewDot: { backgroundColor: "#3b82f6" },
  inProgressDot: { backgroundColor: "#8b5cf6" },
  approvedDot: { backgroundColor: "#16a34a" },
  rejectedDot: { backgroundColor: "#dc2626" },
  pendingDot: { backgroundColor: "#f59e0b" },

  petitionCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  memberName: { fontWeight: "700", color: "#1e3a8a", fontSize: 15 },
  dateText: { fontSize: 13, color: "#6b7280" },
  optionsIcon: {
    padding: 4,
    marginLeft: 4,
  },
  optionsIconText: { fontSize: 18, color: "#6b7280", fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  optionsModalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    minWidth: width * 0.4,
    paddingVertical: 8,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
  },
  optionItem: { paddingVertical: 12, paddingHorizontal: 20 },
  optionText: { fontSize: 16, color: "#1e293b" },
  clearOptionText: { color: "#dc2626", fontWeight: "600" },
  petitionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 6,
  },
  petitionDesc: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 10,
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusTag: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  reviewTag: { backgroundColor: "#dbeafe" },
  inProgressTag: { backgroundColor: "#ede9fe" },
  approvedTag: { backgroundColor: "#dcfce7" },
  rejectedTag: { backgroundColor: "#fee2e2" },
  pendingTag: { backgroundColor: "#fef9c3" },
  statusText: { fontWeight: "700", fontSize: 13 },
  reviewText: { color: "#1d4ed8" },
  inProgressText: { color: "#6d28d9" },
  approvedText: { color: "#15803d" },
  rejectedText: { color: "#b91c1c" },
  pendingText: { color: "#b45309" },
  viewBtn: { padding: 4 },
  viewText: { color: "#2563eb", fontWeight: "700", fontSize: 13 },
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loaderText: { color: "#6b7280", marginTop: 10 },
  emptyBox: { alignItems: "center", padding: 60 },
  emptyIcon: { fontSize: 60 },
  emptyText: { fontWeight: "700", fontSize: 18, color: "#1e293b" },
  emptySubtext: { color: "#94a3b8", textAlign: "center", marginTop: 5 },
});