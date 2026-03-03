import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Image,
  Dimensions,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams } from "expo-router";
import { API_BASE_URL } from "../lib/api";

const { width, height } = Dimensions.get("window");

export default function UserEventsScreen() {
  const params = useLocalSearchParams();
  const communityId = params?.communityId || params?.community_id || 36;

  const [activeTab, setActiveTab] = useState<"list" | "calendar">("list");
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "upcoming" | "completed">("all");
  const [showFilterOptions, setShowFilterOptions] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const today = new Date().toISOString().split('T')[0];

  // State for File Preview
  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();
  }, [communityId]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(`${API_BASE_URL}/communities/${communityId}/events`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await response.json();
      setEvents(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "TBA";
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const markedDates = useMemo(() => {
    const marks: any = {};
    events.forEach(ev => {
      if (ev.effective_from) {
        const dateKey = ev.effective_from.split('T')[0];
        marks[dateKey] = { marked: true, dotColor: '#6366f1' };
      }
    });
    marks[selectedDate] = { ...(marks[selectedDate] || {}), selected: true, selectedColor: '#6366f1' };
    return marks;
  }, [events, selectedDate]);

  const listFilteredEvents = useMemo(() => {
    return events.filter(ev => {
      const matchesSearch = ev.title?.toLowerCase().includes(searchQuery.toLowerCase());
      const isCompleted = ev.valid_until && ev.valid_until < today;
      if (statusFilter === "upcoming") return matchesSearch && !isCompleted;
      if (statusFilter === "completed") return matchesSearch && isCompleted;
      return matchesSearch;
    });
  }, [events, searchQuery, statusFilter]);

  const calendarEvents = useMemo(() => {
    return events.filter(ev => ev.effective_from?.split('T')[0] === selectedDate);
  }, [events, selectedDate]);

  const handlePreviewFile = (url: string) => {
    setSelectedFileUrl(url);
    setPreviewVisible(true);
  };

  const renderEventItem = (item: any, index: number) => {
    const isDone = item.valid_until && item.valid_until < today;
    const d = new Date(item.effective_from || today);
    const day = d.getDate();
    const month = d.toLocaleString('default', { month: 'short' }).toUpperCase();

    return (
      <View key={index} style={[styles.card, isDone && styles.cardDone]}>
        {/* Left Side: Date Badge */}
        <View style={styles.dateBadge}>
          <View style={styles.dateBadgeTop}>
            <Text style={styles.monthText}>{month}</Text>
          </View>
          <View style={styles.dateBadgeBottom}>
             <Text style={styles.dayText}>{day}</Text>
          </View>
        </View>

        {/* Right Side: Content */}
        <View style={styles.contentSide}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, isDone && styles.strikethrough]} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={[styles.statusBadge, isDone ? styles.pastBadge : styles.upcomingBadge]}>
              <View style={[styles.statusDot, { backgroundColor: isDone ? '#ef4444' : '#16a34a' }]} />
              <Text style={[styles.statusText, isDone ? styles.pastText : styles.upcomingText]}>
                {isDone ? "PAST" : "UPCOMING"}
              </Text>
            </View>
          </View>

          <Text style={styles.details} numberOfLines={2}>{item.content}</Text>

          {/* Timeline Section */}
          <View style={styles.timelineContainer}>
            <View style={styles.timelineItem}>
              <Ionicons name="calendar-outline" size={14} color="#6366f1" />
              <Text style={styles.timelineText}>{formatDate(item.effective_from)}</Text>
            </View>
            
            {item.valid_until && (
              <>
                <Ionicons name="arrow-forward" size={12} color="#cbd5e1" style={{ marginHorizontal: 4 }} />
                <View style={styles.timelineItem}>
                  <Ionicons name="time-outline" size={14} color="#ef4444" />
                  <Text style={styles.timelineText}>{formatDate(item.valid_until)}</Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.footerRow}>
            {/* Attachment Link */}
            {item.attachment_url ? (
              <TouchableOpacity 
                style={styles.attachmentLink} 
                onPress={() => handlePreviewFile(item.attachment_url)}
              >
                <Ionicons name="document-text-outline" size={16} color="#6366f1" />
                <Text style={styles.attachmentLinkText}>View Files</Text>
              </TouchableOpacity>
            ) : <View style={{ flex: 1 }} />}

            {/* Audience Badge */}
            <View style={styles.audienceBadge}>
              <Ionicons name="people-outline" size={14} color="#64748b" />
              <Text style={styles.audienceText}>{item.applicable_to || "Everyone"}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === "list" && styles.activeTab]} 
          onPress={() => setActiveTab("list")}
        >
          <Ionicons name="list" size={18} color={activeTab === "list" ? "#6366f1" : "#94a3b8"} />
          <Text style={[styles.tabLabel, activeTab === "list" && styles.activeTabLabel]}>List View</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === "calendar" && styles.activeTab]} 
          onPress={() => setActiveTab("calendar")}
        >
          <Ionicons name="calendar" size={18} color={activeTab === "calendar" ? "#6366f1" : "#94a3b8"} />
          <Text style={[styles.tabLabel, activeTab === "calendar" && styles.activeTabLabel]}>Calendar</Text>
        </TouchableOpacity>
      </View>

      {/* Search & Filter Header */}
      {activeTab === "list" && (
        <View style={styles.headerActions}>
          <View style={styles.searchWrapper}>
            <Ionicons name="search-outline" size={20} color="#94a3b8" />
            <TextInput 
              placeholder="Search events..." 
              style={styles.searchInput} 
              value={searchQuery} 
              onChangeText={setSearchQuery} 
              placeholderTextColor="#94a3b8"
            />
          </View>
          <TouchableOpacity 
            style={[styles.filterIconButton, statusFilter !== 'all' && styles.filterIconActive]} 
            onPress={() => setShowFilterOptions(!showFilterOptions)}
          >
            <Ionicons name="options-outline" size={22} color={statusFilter !== 'all' ? "#fff" : "#1e293b"} />
          </TouchableOpacity>
        </View>
      )}

      {/* Filter Dropdown */}
      {showFilterOptions && activeTab === "list" && (
        <View style={styles.filterDropdown}>
          {['all', 'upcoming', 'completed'].map((f: any) => (
            <TouchableOpacity 
              key={f} 
              style={styles.filterOption} 
              onPress={() => { setStatusFilter(f); setShowFilterOptions(false); }}
            >
              <Text style={[styles.filterOptionText, statusFilter === f && styles.activeFilterText]}>
                {f.charAt(0).toUpperCase() + f.slice(1)} Events
              </Text>
              {statusFilter === f && <Ionicons name="checkmark" size={18} color="#6366f1" />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchEvents} />}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        {activeTab === "calendar" ? (
          <View>
            <Calendar 
              markedDates={markedDates} 
              onDayPress={(day) => setSelectedDate(day.dateString)} 
              theme={{ 
                selectedDayBackgroundColor: '#6366f1', 
                todayTextColor: '#6366f1', 
                dotColor: '#6366f1',
                arrowColor: '#6366f1',
                monthTextColor: '#1e293b',
                textMonthFontWeight: '800',
              }} 
              style={styles.calendarStyle}
            />
            <View style={styles.sectionHeaderRow}>
               <View style={styles.sectionLine} />
               <Text style={styles.sectionHeader}>Events for {formatDate(selectedDate)}</Text>
               <View style={styles.sectionLine} />
            </View>
            <View style={{ paddingHorizontal: 16 }}>
              {calendarEvents.length > 0 ? calendarEvents.map(renderEventItem) : (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-clear-outline" size={48} color="#cbd5e1" />
                  <Text style={styles.noEventsText}>No events scheduled for this day</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
            {loading ? (
              <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
            ) : listFilteredEvents.length > 0 ? (
              listFilteredEvents.map(renderEventItem)
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={48} color="#cbd5e1" />
                <Text style={styles.noEventsText}>No matching events found</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* MODAL FOR FILE PREVIEW */}
      <Modal
        visible={previewVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Attachment Preview</Text>
              <TouchableOpacity onPress={() => setPreviewVisible(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#1e293b" />
              </TouchableOpacity>
            </View>
            <View style={styles.imageContainer}>
              {selectedFileUrl ? (
                <Image 
                  source={{ uri: selectedFileUrl }} 
                  style={styles.previewImage} 
                  resizeMode="contain" 
                />
              ) : (
                <Text style={styles.noPreviewText}>File preview not available</Text>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  
  // Tab Bar
  tabBar: { 
    flexDirection: "row", 
    backgroundColor: "#fff", 
    paddingTop: 50, 
    paddingHorizontal: 10,
    borderBottomWidth: 1, 
    borderColor: "#f1f5f9",
    elevation: 2
  },
  tab: { 
    flex: 1, 
    paddingVertical: 14, 
    alignItems: "center", 
    flexDirection: 'row', 
    justifyContent: 'center',
    gap: 8,
    borderBottomWidth: 3, 
    borderBottomColor: "transparent" 
  },
  activeTab: { borderBottomColor: "#6366f1" },
  tabLabel: { fontWeight: "700", color: "#94a3b8", fontSize: 14 },
  activeTabLabel: { color: "#6366f1" },
  
  // Header Actions
  headerActions: { 
    flexDirection: 'row', 
    padding: 16, 
    gap: 12, 
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  searchWrapper: { 
    flex: 1, 
    flexDirection: 'row', 
    backgroundColor: '#f1f5f9', 
    borderRadius: 14, 
    paddingHorizontal: 12, 
    height: 48, 
    alignItems: 'center' 
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: '#1e293b' },
  filterIconButton: { 
    width: 48, 
    height: 48, 
    backgroundColor: '#f1f5f9', 
    borderRadius: 14, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  filterIconActive: { backgroundColor: '#6366f1' },

  // Filter Dropdown
  filterDropdown: { 
    position: 'absolute', 
    top: 115, 
    right: 16, 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    elevation: 10, 
    zIndex: 100, 
    width: 200,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  filterOption: { 
    padding: 16, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderBottomWidth: 1, 
    borderColor: '#f8fafc' 
  },
  filterOptionText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  activeFilterText: { color: '#6366f1', fontWeight: '700' },

  // Card UI
  card: { 
    backgroundColor: "#fff", 
    borderRadius: 20, 
    padding: 14, 
    flexDirection: "row", 
    marginBottom: 16, 
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#64748b', 
    shadowOpacity: 0.08, 
    shadowRadius: 12,
    elevation: 4
  },
  cardDone: { backgroundColor: '#f8fafc', opacity: 0.7 },
  
  // Date Badge
  dateBadge: { 
    width: 60, 
    height: 70, 
    backgroundColor: "#fff", 
    borderRadius: 12, 
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    alignSelf: 'flex-start'
  },
  dateBadgeTop: { 
    backgroundColor: '#6366f1', 
    paddingVertical: 4, 
    alignItems: 'center' 
  },
  monthText: { fontSize: 10, fontWeight: "900", color: "#fff" },
  dateBadgeBottom: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  dayText: { fontSize: 22, fontWeight: "900", color: "#1e293b" },

  contentSide: { flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  title: { fontSize: 17, fontWeight: "800", color: "#1e293b", flex: 1, marginRight: 8 },
  strikethrough: { textDecorationLine: 'line-through', color: '#94a3b8' },
  
  // Status Badges
  statusBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 20,
    gap: 5
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  pastBadge: { backgroundColor: '#fee2e2' },
  upcomingBadge: { backgroundColor: '#dcfce7' },
  statusText: { fontSize: 10, fontWeight: '800' },
  pastText: { color: '#ef4444' },
  upcomingText: { color: '#16a34a' },

  details: { color: "#64748b", fontSize: 13, marginBottom: 12, lineHeight: 18 },

  // Timeline
  timelineContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f8fafc', 
    padding: 8, 
    borderRadius: 10,
    marginBottom: 12
  },
  timelineItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timelineText: { fontSize: 11, color: "#475569", fontWeight: "700" },

  footerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10
  },
  attachmentLink: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  attachmentLinkText: { fontSize: 12, color: '#6366f1', fontWeight: '700' },
  
  audienceBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f1f5f9', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6,
    gap: 4 
  },
  audienceText: { fontSize: 11, color: "#64748b", fontWeight: "700" },

  // Calendar & Sectioning
  calendarStyle: { borderRadius: 20, margin: 16, elevation: 4, shadowOpacity: 0.1 },
  sectionHeaderRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 10 
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  sectionHeader: { 
    fontSize: 14, 
    fontWeight: '800', 
    paddingHorizontal: 15, 
    color: '#64748b',
    textTransform: 'uppercase'
  },
  
  emptyState: { alignItems: 'center', marginTop: 40, gap: 10 },
  noEventsText: { textAlign: 'center', color: '#94a3b8', fontSize: 14, fontWeight: '600' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    height: height * 0.8,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  closeButton: { width: 36, height: 36, backgroundColor: '#f1f5f9', borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  imageContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  previewImage: { width: '100%', height: '100%' },
  noPreviewText: { color: '#fff', fontWeight: '600' }
});