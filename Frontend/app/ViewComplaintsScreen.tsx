import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from "react-native";
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from '../lib/api';
const BASE_URL = API_BASE_URL;
const { width, height } = Dimensions.get('window');

const GOAL_TYPES = [
  "Policy Change",
  "Infrastructure Improvement",
  "Environmental Protection",
  "Community Safety",
  "Education Enhancement",
  "Economic Development",
  "Social Services",
  "Other"
];

const IMPACT_AREAS = [
  "All Community Members",
  "Specific Age Groups",
  "Local Businesses",
  "Educational Institutions",
  "Healthcare Facilities",
  "Public Spaces",
  "Transportation",
  "Environmental Areas"
];

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

export default function ViewComplaintsScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Petition creation states
  const [petitionModalVisible, setPetitionModalVisible] = useState<boolean>(false);
  const [selectedGoalType, setSelectedGoalType] = useState<string>("");
  const [selectedImpactArea, setSelectedImpactArea] = useState<string>("");
  const [goalTypeDropdownVisible, setGoalTypeDropdownVisible] = useState<boolean>(false);
  const [impactAreaDropdownVisible, setImpactAreaDropdownVisible] = useState<boolean>(false);

  // Get communityId from route params
  const communityId = route.params?.communityId || route.params?.community_id || 1;

  const fetchComplaints = React.useCallback(async () => {
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

      const response = await axios.get(`${BASE_URL}/complaints/${communityId}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      // Backend returns the array directly (res.json(result.rows)); backend uses creator_name
      const list = Array.isArray(response.data) ? response.data : response.data?.complaints || [];
      setComplaints(list.map((c: any) => ({
        ...c,
        created_by_name: c.creator_name ?? c.created_by_name ?? 'Unknown',
      })));
    } catch (err: any) {
      console.error("Error fetching complaints:", err);
      const errorMessage = err.response?.data?.error || err.message || "Failed to load complaints.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useFocusEffect(
    React.useCallback(() => {
      fetchComplaints();
    }, [fetchComplaints])
  );

  const filteredComplaints = complaints.filter(
    (complaint) =>
      (complaint.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (complaint.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (complaint.created_by_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate complaint statistics
  const totalComplaints = complaints.length;
  const resolvedComplaints = complaints.filter(c => c.status === "RESOLVED").length;
  const pendingComplaints = complaints.filter(c => c.status === "OPEN").length;

  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const handleClearComplaint = async () => {
    if (!selectedComplaint) return;
    setIsClearing(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }
      await axios.delete(`${BASE_URL}/complaints/${selectedComplaint.complaint_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setComplaints((prev) => prev.filter((c) => c.complaint_id !== selectedComplaint.complaint_id));
      setOptionsModalVisible(false);
      setSelectedComplaint(null);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to clear complaint';
      Alert.alert('Error', msg);
    } finally {
      setIsClearing(false);
    }
  };

  const openOptions = (item: Complaint) => {
    setSelectedComplaint(item);
    setOptionsModalVisible(true);
  };

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
              {new Date(item.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
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
        <View
          style={[
            styles.statusBadge,
            item.status === "OPEN"
              ? styles.pendingBadge
              : styles.resolvedBadge,
          ]}
        >
          <Text
            style={[
              styles.statusBadgeText,
              item.status === "OPEN"
                ? styles.pendingText
                : styles.resolvedText,
            ]}
          >
            {item.status}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.subjectText}>{item.title}</Text>
        <Text style={styles.descriptionText} numberOfLines={3}>
          {item.description}
        </Text>
        <Text style={styles.categoryText}>Category: {item.category}</Text>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.complaintId}>ID: #{item.complaint_id}</Text>
        <TouchableOpacity
          style={styles.viewButton}
          onPress={() => navigation.navigate('ComplaintDetailsScreen', {
            complaintId: item.complaint_id,
            communityId: communityId
          })}
        >
          <Text style={styles.viewButtonText}>View Details →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Complaints Dashboard</Text>
        <Text style={styles.subtitle}>
          Overview of all community complaints
        </Text>
      </View>

      {/* Statistics Section */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{totalComplaints}</Text>
          <Text style={styles.statLabel}>Total Complaints</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{resolvedComplaints}</Text>
          <Text style={styles.statLabel}>Resolved</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{pendingComplaints}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

  

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title, description, or creator..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Complaints List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E5A3F" />
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
          keyExtractor={(item) => item.complaint_id.toString()}
          renderItem={renderComplaint}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No complaints found</Text>
              <Text style={styles.emptySubtext}>
                {searchQuery ? "Try adjusting your search keywords" : "No complaints have been submitted yet"}
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Options Modal */}
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
                handleClearComplaint();
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

      {/* Petition Modal */}
      <Modal
        visible={petitionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPetitionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.petitionModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Raise a Petition</Text>
              <TouchableOpacity
                onPress={() => setPetitionModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* Goal Type Dropdown */}
              <View style={styles.dropdownContainer}>
                <Text style={styles.dropdownLabel}>Goal Type</Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setGoalTypeDropdownVisible(!goalTypeDropdownVisible)}
                >
                  <Text style={styles.dropdownButtonText}>
                    {selectedGoalType || "Select goal type"}
                  </Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>
                {goalTypeDropdownVisible && (
                  <View style={styles.dropdownList}>
                    {GOAL_TYPES.map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setSelectedGoalType(type);
                          setGoalTypeDropdownVisible(false);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{type}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Impact Area Dropdown */}
              <View style={styles.dropdownContainer}>
                <Text style={styles.dropdownLabel}>Impact Area</Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setImpactAreaDropdownVisible(!impactAreaDropdownVisible)}
                >
                  <Text style={styles.dropdownButtonText}>
                    {selectedImpactArea || "Select impact area"}
                  </Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>
                {impactAreaDropdownVisible && (
                  <View style={styles.dropdownList}>
                    {IMPACT_AREAS.map((area) => (
                      <TouchableOpacity
                        key={area}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setSelectedImpactArea(area);
                          setImpactAreaDropdownVisible(false);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{area}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!selectedGoalType || !selectedImpactArea) && styles.submitButtonDisabled
                ]}
                onPress={() => {
                  // Handle petition submission
                  Alert.alert(
                    "Petition Submitted",
                    `Goal Type: ${selectedGoalType}\nImpact Area: ${selectedImpactArea}`,
                    [
                      {
                        text: "OK",
                        onPress: () => {
                          setPetitionModalVisible(false);
                          setSelectedGoalType("");
                          setSelectedImpactArea("");
                        }
                      }
                    ]
                  );
                }}
                disabled={!selectedGoalType || !selectedImpactArea}
              >
                <Text style={styles.submitButtonText}>Submit Petition</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  title: { fontSize: 26, color: "#fff", fontWeight: "800", textAlign: "center" },
  subtitle: { color: "#e0e7ff", fontSize: 14, fontWeight: "500", textAlign: "center", marginTop: 5 },
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
  listContainer: { padding: 20, paddingTop: 10 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: "600", color: "#fff" },
  headerInfo: { flex: 1 },
  memberName: { fontWeight: "700", color: "#1e3a8a", fontSize: 15 },
  dateRow: { flexDirection: "row", alignItems: "center", marginTop: 2, gap: 8 },
  dateText: { fontSize: 13, color: "#6b7280" },
  optionsIcon: { padding: 4 },
  optionsIconText: { fontSize: 18, color: "#6b7280", fontWeight: "700" },
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
  statusBadge: {
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  pendingBadge: { backgroundColor: "#fef3c7" },
  resolvedBadge: { backgroundColor: "#dcfce7" },
  statusBadgeText: { fontWeight: "700", fontSize: 11 },
  pendingText: { color: "#d97706" },
  resolvedText: { color: "#16a34a" },
  cardBody: { marginBottom: 10 },
  subjectText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 6,
  },
  descriptionText: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 6,
    lineHeight: 20,
  },
  categoryText: {
    fontSize: 12,
    color: "#6b7280",
    fontStyle: "italic",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  complaintId: { fontSize: 12, color: "#9ca3af" },
  viewButton: { padding: 4 },
  viewButtonText: { color: "#2563eb", fontWeight: "700", fontSize: 13 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#6b7280", marginTop: 10 },
  emptyContainer: { alignItems: "center", padding: 60 },
  emptyIcon: { fontSize: 60, marginBottom: 10 },
  emptyText: { fontWeight: "700", fontSize: 18, color: "#1e293b", marginBottom: 5 },
  emptySubtext: { color: "#94a3b8", textAlign: "center" },

  // Statistics styles
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#fff",
    marginHorizontal: 15,
    marginTop: -10,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
  },
  statCard: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "600",
    textAlign: "center",
  },

  // Raise Petition Button
  raisePetitionButton: {
    backgroundColor: "#10b981",
    marginHorizontal: 15,
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
  },
  raisePetitionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  petitionModalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    margin: 20,
    maxHeight: height * 0.8,
    width: width - 40,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 10 },
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 20,
    color: "#6b7280",
  },
  modalBody: {
    padding: 20,
  },

  // Dropdown styles
  dropdownContainer: {
    marginBottom: 20,
  },
  dropdownLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  dropdownButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: "#374151",
  },
  dropdownArrow: {
    fontSize: 12,
    color: "#6b7280",
  },
  dropdownList: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 150,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  dropdownItemText: {
    fontSize: 16,
    color: "#374151",
  },

  // Submit button
  submitButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});