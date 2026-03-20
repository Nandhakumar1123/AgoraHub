import { useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../lib/api'; // Common API base URL
import React, { useState, useEffect, useMemo } from "react";
import { useNavigation } from "@react-navigation/native";
import { Calendar } from "react-native-calendars";
import {
  Ionicons
} from "@expo/vector-icons";
import {
  Alert,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
  Image,
  Dimensions,
  StatusBar
} from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get("window");

interface Event {
  event_id?: number;
  title: string;
  details: string;
  effective_from: string;
  valid_until: string;
  applicable_to: string;
  attachment_url?: string | null;
  posted_by: string;
  community_id: number;
}

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const navigation = useNavigation<any>();
  const router = useRouter();

  // FIX 1: Default to 1 (as seen in your logs) and capture communityId from all possible param keys
  const communityId =
    params?.communityId || 
    (params as any)?.community?.id || 
    (params as any)?.community?.community_id || 
    params?.community_id || 1;

  // --- FORM & EDIT STATE ---
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [title, setTitle] = useState<string>("");
  const [details, setDetails] = useState<string>("");
  const [effectiveFrom, setEffectiveFrom] = useState<string>("");
  const [validUntil, setValidUntil] = useState<string>("");
  const [applicableTo, setApplicableTo] = useState<string>("");
  const [attachment, setAttachment] =
    useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [slideAnim] = useState(new Animated.Value(0));

  // --- PREVIEW STATE ---
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Calendar state
  const [showCalendar, setShowCalendar] = useState(false);
  const [markedDates, setMarkedDates] = useState<{ [key: string]: any }>({});
  const [selectedRange, setSelectedRange] = useState<{ startDate?: string; endDate?: string }>({});

  // --- LIST & FETCHING STATE ---
  const [activeTab, setActiveTab] = useState<"create" | "list">("create");
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // --- FILTER STATE ---
  const [statusFilter, setStatusFilter] = useState<"all" | "upcoming" | "past">("all");
  const [showFilterOptions, setShowFilterOptions] = useState(false);

  // --- FETCH LOGIC ---
  const fetchEvents = async () => {
    try {
      setLoadingEvents(true);
      const token = await AsyncStorage.getItem("authToken");
      
      // FIX 2: Removed extra '/api' from URL path because API_BASE_URL already contains it.
      // This prevents the /api/api/ error found in your logs.
      const response = await fetch(`${API_BASE_URL}/communities/${communityId}/events`, {
        headers: {
          "Authorization": `Bearer ${token}`
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoadingEvents(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [communityId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents();
  };

  const formatDateReadable = (dateStr: string) => {
    if (!dateStr) return "TBA";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const filteredEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    return events.filter(event => {
      const matchesSearch = event.title?.toLowerCase().includes(searchQuery.toLowerCase());
      const eventDate = new Date(event.effective_from || event.created_at);
      const eventTime = eventDate.getTime();
      
      let matchesFilter = true;
      if (statusFilter === "upcoming") {
        matchesFilter = eventTime >= todayTime;
      } else if (statusFilter === "past") {
        matchesFilter = eventTime < todayTime;
      }

      return matchesSearch && matchesFilter;
    });
  }, [events, searchQuery, statusFilter]);

  const handleEditPress = (item: any) => {
    setEditingEventId(item.event_id);
    setTitle(item.title);
    setDetails(item.content);
    setEffectiveFrom(item.effective_from || "");
    setValidUntil(item.valid_until || "");
    setApplicableTo(item.applicable_to || "");
    setActiveTab("create");
    setCurrentStep(0);
  };

const handleDeleteEvent = async (eventId: number) => {
  console.log("🟦 [FRONTEND] Step 1: Logic Started for ID:", eventId);

  // Alert-ah temporary-ah remove pannitu direct-ah test pannuvom
  try {
    const token = await AsyncStorage.getItem("authToken");
    const fullUrl = `${API_BASE_URL}/communities/${communityId}/events/${eventId}`;
    
    console.log("🟦 [FRONTEND] Step 2: URL check ->", fullUrl);

    const response = await fetch(fullUrl, {
      method: "DELETE", // <--- Ethu DELETE-nu uruthiya check pannu
      headers: { 
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    console.log("🟦 [FRONTEND] Step 3: Server Status ->", response.status);

    if (response.ok) {
      console.log("✅ [FRONTEND] Success!");
      fetchEvents(); 
    } else {
      const err = await response.json();
      console.error("❌ [FRONTEND] Error from Server:", err);
    }
  } catch (e: any) {
    console.error("❌ [FRONTEND] Crash:", e.message);
  }
};

  const onDayPress = (day: any) => {
    const dateString = day.dateString;

    if (!selectedRange.startDate) {
      const newRange = { startDate: dateString };
      setSelectedRange(newRange);
      setMarkedDates({
        [dateString]: {
          selected: true,
          startingDay: true,
          color: '#3b82f6',
          textColor: 'white'
        }
      });
    } else if (!selectedRange.endDate) {
      if (dateString < (selectedRange.startDate || "")) {
        const newRange = { startDate: dateString };
        setSelectedRange(newRange);
        setMarkedDates({
          [dateString]: {
            selected: true,
            startingDay: true,
            color: '#3b82f6',
            textColor: 'white'
          }
        });
      } else {
        const newRange = { ...selectedRange, endDate: dateString };
        setSelectedRange(newRange);

        const rangeMarkedDates: { [key: string]: any } = {};
        let currentDate = new Date(selectedRange.startDate!);
        const endDate = new Date(dateString);

        while (currentDate <= endDate) {
          const dateStr = currentDate.toISOString().split('T')[0];
          rangeMarkedDates[dateStr] = {
            selected: true,
            color: '#3b82f6',
            textColor: 'white'
          };

          if (dateStr === selectedRange.startDate) {
            rangeMarkedDates[dateStr].startingDay = true;
          }
          if (dateStr === dateString) {
            rangeMarkedDates[dateStr].endingDay = true;
          }

          currentDate.setDate(currentDate.getDate() + 1);
        }

        setMarkedDates(rangeMarkedDates);
        setEffectiveFrom(selectedRange.startDate!);
        setValidUntil(dateString);
        setShowCalendar(false);
      }
    } else {
      const newRange = { startDate: dateString };
      setSelectedRange(newRange);
      setMarkedDates({
        [dateString]: {
          selected: true,
          startingDay: true,
          color: '#3b82f6',
          textColor: 'white'
        }
      });
    }
  };

  const steps = [
    { id: 0, title: "What's the event?", emoji: "📝", subtitle: "Give it a catchy title" },
    { id: 1, title: "Tell us more", emoji: "💬", subtitle: "Share the details" },
    { id: 2, title: "When is it active?", emoji: "📅", subtitle: "Set the timeline" },
    { id: 3, title: "Add extras", emoji: "📎", subtitle: "Attachments & final touches" },
    { id: 4, title: "Preview & Post", emoji: "🚀", subtitle: "Review before publishing" },
  ];

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({});
      if (result.assets && result.assets.length > 0) {
        setAttachment(result.assets[0]);
      }
    } catch (error) {
      console.error("Error picking file:", error);
      Alert.alert("Error", "Could not open file picker.");
    }
  };

  const handlePost = async () => {
    if (!title.trim() || !details.trim()) {
      Alert.alert("Oops!", "Title and details are required!");
      return;
    }

    const data = {
      title,
      content: details,
      effective_from: effectiveFrom || null,
      valid_until: validUntil || null,
      applicable_to: applicableTo || null,
      attachment_url: attachment?.uri || null,
      attachment_type: attachment ? (attachment.mimeType?.includes('image') ? 'image' :
        attachment.mimeType?.includes('video') ? 'video' : 'file') : null,
      isPinned: false,
      isImportant: false,
    };

    try {
      const token = await AsyncStorage.getItem("authToken");
      
      // FIX 4: Corrected URL path by removing extra /api
      const url = editingEventId 
        ? `${API_BASE_URL}/communities/${communityId}/events/${editingEventId}`
        : `${API_BASE_URL}/communities/${communityId}/events`;
      
      const method = editingEventId ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        Alert.alert("✨ Success!", editingEventId ? "Event updated!" : "Event posted!");
        resetForm();
        fetchEvents();
        setActiveTab("list");
      } else {
        const errData = await response.json();
        Alert.alert("❌ Error", errData.error || "Action failed!");
      }
    } catch (error) {
      console.error("Error posting event:", error);
      Alert.alert("Network Error", "Unable to connect to the server.");
    }
  };

  const resetForm = () => {
    setTitle("");
    setDetails("");
    setEffectiveFrom("");
    setValidUntil("");
    setApplicableTo("");
    setAttachment(null);
    setEditingEventId(null);
    setSelectedRange({});
    setMarkedDates({});
    setCurrentStep(0);
  };

  const goToNextStep = () => {
    if (currentStep === 0 && !title.trim()) {
      Alert.alert("Hold on!", "Please add a title first");
      return;
    }
    if (currentStep === 1 && !details.trim()) {
      Alert.alert("Hold on!", "Please add some details first");
      return;
    }
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const openPreview = (url: string) => {
    setPreviewUrl(url);
    setPreviewVisible(true);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>📝</Text>
            <Text style={styles.stepTitle}>What's the event?</Text>
            <Text style={styles.stepSubtitle}>Give it a catchy title</Text>
            <TextInput
              style={styles.bigInput}
              placeholder="e.g., Summer Event Registration Open!"
              placeholderTextColor="#9ca3af"
              value={title}
              onChangeText={setTitle}
              autoFocus
            />
            <View style={styles.charCount}>
              <Text style={styles.charCountText}>{title.length} characters</Text>
            </View>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>💬</Text>
            <Text style={styles.stepTitle}>Tell us more</Text>
            <Text style={styles.stepSubtitle}>Share the details that matter</Text>
            <TextInput
              style={[styles.bigInput, styles.textArea]}
              placeholder="Describe your event in detail..."
              placeholderTextColor="#9ca3af"
              value={details}
              multiline
              numberOfLines={8}
              onChangeText={setDetails}
              textAlignVertical="top"
            />
            <View style={styles.charCount}>
              <Text style={styles.charCountText}>{details.length} characters</Text>
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>📅</Text>
            <Text style={styles.stepTitle}>When is it active?</Text>
            <Text style={styles.stepSubtitle}>Set the timeline (optional)</Text>

            <View style={styles.calendarCard}>
              <Text style={styles.dateLabel}>📅 Select Date Range</Text>
              <TouchableOpacity
                style={styles.calendarButton}
                onPress={() => setShowCalendar(true)}
              >
                <View style={styles.dateRangeDisplay}>
                  <View style={styles.dateRangeItem}>
                    <Text style={styles.dateRangeLabel}>From:</Text>
                    <Text style={[styles.dateRangeValue, { color: effectiveFrom ? '#1e293b' : '#9ca3af' }]}>
                      {effectiveFrom || "Select start date"}
                    </Text>
                  </View>
                  <View style={styles.dateRangeItem}>
                    <Text style={styles.dateRangeLabel}>To:</Text>
                    <Text style={[styles.dateRangeValue, { color: validUntil ? '#1e293b' : '#9ca3af' }]}>
                      {validUntil || "Select end date"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.calendarButtonText}>
                  {effectiveFrom && validUntil ? "Change dates" : "Tap to select dates"}
                </Text>
              </TouchableOpacity>
            </View>

            <Modal
              visible={showCalendar}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowCalendar(false)}
            >
              <View style={styles.calendarModalOverlay}>
                <View style={styles.calendarModalContent}>
                  <View style={styles.calendarHeader}>
                    <Text style={styles.calendarTitle}>Select Date Range</Text>
                    <TouchableOpacity
                      onPress={() => setShowCalendar(false)}
                      style={styles.closeCalendarButton}
                    >
                      <Text style={styles.closeCalendarText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.calendarInstructions}>
                    <Text style={styles.instructionText}>
                      Tap once for start date, tap again for end date
                    </Text>
                  </View>

                  <Calendar
                    markingType="period"
                    markedDates={markedDates}
                    onDayPress={onDayPress}
                    minDate={new Date().toISOString().split('T')[0]}
                    theme={{
                      selectedDayBackgroundColor: '#3b82f6',
                      selectedDayTextColor: 'white',
                      todayTextColor: '#3b82f6',
                      dayTextColor: '#1e293b',
                      textDisabledColor: '#9ca3af',
                      dotColor: '#3b82f6',
                      selectedDotColor: 'white',
                      arrowColor: '#3b82f6',
                      disabledArrowColor: '#9ca3af',
                      monthTextColor: '#1e293b',
                      indicatorColor: '#3b82f6',
                      textDayFontFamily: 'System',
                      textMonthFontFamily: 'System',
                      textDayHeaderFontFamily: 'System',
                      textDayFontSize: 14,
                      textMonthFontSize: 16,
                      textDayHeaderFontSize: 12
                    }}
                    style={styles.calendar}
                  />
                </View>
              </View>
            </Modal>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => {
                setEffectiveFrom("");
                setValidUntil("");
                setSelectedRange({});
                setMarkedDates({});
                goToNextStep();
              }}
            >
              <Text style={styles.skipText}>Skip timeline →</Text>
            </TouchableOpacity>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>📎</Text>
            <Text style={styles.stepTitle}>Add extras</Text>
            <Text style={styles.stepSubtitle}>Attachments & audience (optional)</Text>

            <TouchableOpacity
              style={[
                styles.attachmentCard,
                attachment && styles.attachmentCardActive,
              ]}
              onPress={pickDocument}
            >
              {attachment ? (
                <>
                  <Text style={styles.attachmentIcon}>✅</Text>
                  <Text style={styles.attachmentName}>{attachment.name}</Text>
                  <Text style={styles.attachmentSize}>
                    {(attachment.size! / 1024).toFixed(1)} KB
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.attachmentIcon}>📁</Text>
                  <Text style={styles.attachmentPlaceholder}>
                    Tap to attach a file
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.audienceCard}>
              <Text style={styles.audienceLabel}>👥 Target Audience</Text>
              <TextInput
                style={styles.audienceInput}
                placeholder="e.g., All Members, Seniors, Youth"
                placeholderTextColor="#9ca3af"
                value={applicableTo}
                onChangeText={setApplicableTo}
              />
            </View>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>🚀</Text>
            <Text style={styles.stepTitle}>Preview & Post</Text>
            <Text style={styles.stepSubtitle}>Review before publishing</Text>

            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <Text style={styles.previewTitle}>{title}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>NEW</Text>
                </View>
              </View>

              <Text style={styles.previewDetails}>{details}</Text>

              {(effectiveFrom || validUntil) && (
                <View style={styles.previewDates}>
                  {effectiveFrom && (
                    <Text style={styles.previewDate}>📅 From: {formatDateReadable(effectiveFrom)}</Text>
                  )}
                  {validUntil && (
                    <Text style={styles.previewDate}>⏰ Until: {formatDateReadable(validUntil)}</Text>
                  )}
                </View>
              )}

              {applicableTo && (
                <View style={styles.previewAudience}>
                  <Text style={styles.previewAudienceText}>👥 {applicableTo}</Text>
                </View>
              )}

              {attachment && (
                <TouchableOpacity 
                  style={styles.previewAttachment} 
                  onPress={() => openPreview(attachment.uri)}
                >
                  <Text style={styles.previewAttachmentText}>
                    📎 {attachment.name} (Tap to Preview)
                  </Text>
                </TouchableOpacity>
              )}

              <View style={styles.previewFooter}>
                <Text style={styles.previewAuthor}>Posted by Admin</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.publishButton} onPress={handlePost}>
              <Text style={styles.publishButtonText}>
                  {editingEventId ? "✨ Update Now" : "✨ Publish Now"}
              </Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <LinearGradient
        colors={['rgba(15, 23, 42, 0.5)', 'rgba(30, 41, 59, 0.5)', 'rgba(15, 23, 42, 0.5)']}
        style={styles.background}
      >
        <View style={styles.container}>
      <View style={styles.tabHeader}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "create" && styles.tabButtonActive]}
          onPress={() => setActiveTab("create")}
        >
          <Text style={[styles.tabText, activeTab === "create" && styles.tabTextActive]}>
              {editingEventId ? "Edit Event" : "Create Event"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "list" && styles.tabButtonActive]}
          onPress={() => {
            setActiveTab("list");
            fetchEvents();
          }}
        >
          <Text style={[styles.tabText, activeTab === "list" && styles.tabTextActive]}>All Events</Text>
        </TouchableOpacity>
      </View>

      {activeTab === "create" && (
        <>
          <View style={styles.progressContainer}>
            {steps.map((step, index) => (
              <View key={step.id} style={styles.progressStep}>
                <View
                  style={[
                    styles.progressDot,
                    index <= currentStep && styles.progressDotActive,
                  ]}
                >
                  {index < currentStep ? (
                    <Text style={styles.progressCheck}>✓</Text>
                  ) : (
                    <Text style={styles.progressNumber}>{index + 1}</Text>
                  )}
                </View>
                {index < steps.length - 1 && (
                  <View
                    style={[
                      styles.progressLine,
                      index < currentStep && styles.progressLineActive,
                    ]}
                  />
                )}
              </View>
            ))}
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {renderStepContent()}
          </ScrollView>

          <View style={styles.navigationContainer}>
            {currentStep > 0 && (
              <TouchableOpacity style={styles.backButton} onPress={goToPrevStep}>
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
                style={styles.cancelFormBtn}
                onPress={resetForm}
            >
                <Text style={styles.cancelFormText}>Cancel</Text>
            </TouchableOpacity>
            {currentStep < 4 && (
              <TouchableOpacity
                style={[styles.nextButton, currentStep === 0 && styles.nextButtonFull]}
                onPress={goToNextStep}
              >
                <Text style={styles.nextButtonText}>
                  {currentStep === 0 ? "Let's Start" : "Continue"} →
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {activeTab === "list" && (
        <View style={{ flex: 1, padding: 16 }}>
          <View style={styles.headerActionRow}>
             <View style={styles.searchContainer}>
                <Ionicons name="search-outline" size={20} color="#94a3b8" />
                <TextInput
                    style={styles.searchBarInput}
                    placeholder="Search events..."
                    placeholderTextColor="#94a3b8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
             </View>
             <TouchableOpacity 
                style={[styles.filterIconButton, statusFilter !== 'all' && styles.filterIconActive]}
                onPress={() => setShowFilterOptions(!showFilterOptions)}
             >
                <Ionicons name="funnel-outline" size={20} color={statusFilter !== 'all' ? "#fff" : "#1e293b"} />
             </TouchableOpacity>
          </View>

          {showFilterOptions && (
            <View style={styles.filterDropdown}>
               {['all', 'upcoming', 'past'].map((opt: any) => (
                   <TouchableOpacity 
                    key={opt} 
                    style={styles.filterDropdownItem}
                    onPress={() => {
                        setStatusFilter(opt);
                        setShowFilterOptions(false);
                    }}
                   >
                     <Text style={[styles.filterDropdownText, statusFilter === opt && styles.filterDropdownTextActive]}>
                         {opt.charAt(0).toUpperCase() + opt.slice(1)} Events
                     </Text>
                     {statusFilter === opt && <Ionicons name="checkmark" size={16} color="#6366f1" />}
                   </TouchableOpacity>
               ))}
            </View>
          )}

          {loadingEvents && !refreshing ? (
            <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 20 }} />
          ) : (
            <ScrollView 
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {filteredEvents.map((item, index) => {
                  const todayMidnight = new Date();
                  todayMidnight.setHours(0,0,0,0);
                  const itemDate = new Date(item.effective_from || item.created_at);
                  const isPast = itemDate.getTime() < todayMidnight.getTime();

                  return (
                    <View key={item.event_id || index} style={styles.eventListItem}>
                      <View style={styles.listHeaderRow}>
                         <View style={[styles.statusBadge, isPast ? styles.pastBadge : styles.upcomingBadge]}>
                            <Text style={[styles.statusBadgeText, isPast ? styles.pastBadgeText : styles.upcomingBadgeText]}>
                                {isPast ? "PAST" : "UPCOMING"}
                            </Text>
                         </View>
                         <View style={styles.itemActionGroup}>
                            {item.attachment_url && (
                               <TouchableOpacity onPress={() => openPreview(item.attachment_url)}>
                                  <Ionicons name="eye-outline" size={20} color="#6366f1" />
                               </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => handleEditPress(item)}>
                                <Ionicons name="create-outline" size={20} color="#6366f1" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDeleteEvent(item.event_id)}>
                                <Ionicons name="trash-outline" size={20} color="#ef4444" />
                            </TouchableOpacity>
                         </View>
                      </View>
                      
                      <Text style={styles.listTitle}>{item.title}</Text>
                      <Text style={styles.listContent} numberOfLines={2}>{item.content}</Text>
                      
                      <View style={styles.listFooter}>
                        {/* FIX 5: UI UPDATED TO SHOW BOTH DATES */}
                        <View style={styles.footerRow}>
                          <Ionicons name="calendar-outline" size={14} color="#6366f1" />
                          <Text style={styles.listDate}>Starts: {formatDateReadable(item.effective_from)}</Text>
                        </View>

                        {item.valid_until && (
                           <View style={styles.footerRow}>
                              <Ionicons name="time-outline" size={14} color="#ef4444" />
                              <Text style={styles.listDate}>Ends: {formatDateReadable(item.valid_until)}</Text>
                           </View>
                        )}

                        <View style={styles.footerRow}>
                          <Ionicons name="people-outline" size={14} color="#0369a1" />
                          <Text style={styles.listAudience}>{item.applicable_to || "All members"}</Text>
                        </View>
                      </View>
                    </View>
                  )
                })}
              {filteredEvents.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No events found.</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* FILE PREVIEW MODAL */}
      <Modal
        visible={previewVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>File Preview</Text>
              <TouchableOpacity onPress={() => setPreviewVisible(false)} style={styles.closeButton}>
                <Ionicons name="close-circle" size={30} color="#ef4444" />
              </TouchableOpacity>
            </View>
            <View style={styles.imageContainer}>
              {previewUrl ? (
                <Image 
                  source={{ uri: previewUrl }} 
                  style={styles.previewImage} 
                  resizeMode="contain" 
                />
              ) : (
                <Text style={styles.noPreviewText}>Unable to load file</Text>
              )}
            </View>
          </View>
        </View>
      </Modal>

        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#0f172a" },
  background: { flex: 1 },
  tabHeader: {
    flexDirection: "row",
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    paddingTop: 55,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 15,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabButtonActive: {
    borderBottomColor: "#6366f1",
  },
  tabText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#94a3b8",
  },
  tabTextActive: {
    color: "#6366f1",
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    height: 48,
  },
  searchBarInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#f8fafc'
  },
  filterIconButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  filterIconActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1'
  },
  filterDropdown: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  filterDropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8
  },
  filterDropdownText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600'
  },
  filterDropdownTextActive: {
    color: '#6366f1'
  },
  eventListItem: {
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    elevation: 2,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  upcomingBadge: { backgroundColor: 'rgba(22, 163, 74, 0.2)' },
  pastBadge: { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  upcomingBadgeText: { color: '#4ade80' },
  pastBadgeText: { color: '#f87171' },
  itemActionGroup: {
    flexDirection: 'row',
    gap: 15,
    alignItems: 'center'
  },
  listTitle: { fontSize: 17, fontWeight: "800", color: "#f8fafc" },
  listContent: { fontSize: 14, color: "#94a3b8", marginVertical: 8 },
  listFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(255, 255, 255, 0.05)', 
    paddingTop: 10 
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  listDate: { fontSize: 12, color: "#6366f1", fontWeight: "600" },
  listAudience: { fontSize: 12, color: "#38bdf8", fontWeight: "600" },
  progressContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  progressStep: { flex: 1, flexDirection: "row", alignItems: "center" },
  progressDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  progressDotActive: { backgroundColor: "#6366f1" },
  progressNumber: { color: "#94a3b8", fontSize: 14, fontWeight: "700" },
  progressCheck: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  progressLine: { flex: 1, height: 3, backgroundColor: "rgba(255, 255, 255, 0.1)", marginHorizontal: 4 },
  progressLineActive: { backgroundColor: "#6366f1" },
  scrollView: { flex: 1 },
  stepContent: { padding: 25, paddingTop: 40, minHeight: 500 },
  stepEmoji: { fontSize: 64, textAlign: "center", marginBottom: 20 },
  stepTitle: { fontSize: 28, fontWeight: "800", color: "#f8fafc", textAlign: "center", marginBottom: 8 },
  stepSubtitle: { fontSize: 16, color: "#94a3b8", textAlign: "center", marginBottom: 30 },
  bigInput: {
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 16,
    padding: 20,
    fontSize: 18,
    color: "#f8fafc",
    fontWeight: "600",
  },
  textArea: { minHeight: 180, textAlignVertical: "top" },
  charCount: { alignItems: "flex-end", marginTop: 8 },
  charCountText: { fontSize: 13, color: "#94a3b8", fontWeight: "500" },
  dateLabel: { fontSize: 16, fontWeight: "700", color: "#94a3b8", marginBottom: 12 },
  calendarCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  calendarButton: {
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 8,
    padding: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
  },
  dateRangeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateRangeItem: {
    flex: 1,
  },
  dateRangeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 4,
  },
  dateRangeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f8fafc'
  },
  calendarButtonText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
    textAlign: 'center',
  },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarModalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  closeCalendarButton: {
    padding: 5,
  },
  closeCalendarText: {
    fontSize: 18,
    color: '#94a3b8',
  },
  calendar: {
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: '#1e293b',
  },
  calendarInstructions: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  instructionText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  skipButton: { alignSelf: "center", paddingVertical: 12, paddingHorizontal: 24, marginTop: 15 },
  skipText: { fontSize: 15, color: "#6366f1", fontWeight: "600" },
  attachmentCard: {
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderStyle: "dashed",
  },
  attachmentCardActive: { borderColor: "#6366f1", borderStyle: "solid", backgroundColor: "rgba(99, 102, 241, 0.1)" },
  attachmentIcon: { fontSize: 48, marginBottom: 12 },
  attachmentPlaceholder: { fontSize: 16, color: "#94a3b8", fontWeight: "500" },
  attachmentName: { fontSize: 16, color: "#f8fafc", fontWeight: "700", textAlign: "center", marginBottom: 4 },
  attachmentSize: { fontSize: 14, color: "#94a3b8" },
  audienceCard: { backgroundColor: "rgba(30, 41, 59, 0.5)", borderRadius: 16, padding: 20, borderWidth: 2, borderColor: "rgba(255, 255, 255, 0.1)" },
  audienceLabel: { fontSize: 16, fontWeight: "700", color: "#94a3b8", marginBottom: 12 },
  audienceInput: { fontSize: 17, color: "#f8fafc", fontWeight: "600" },
  previewCard: {
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  previewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 15 },
  previewTitle: { flex: 1, fontSize: 20, fontWeight: "800", color: "#f8fafc", marginRight: 10 },
  badge: { backgroundColor: "#6366f1", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: "#ffffff", fontSize: 11, fontWeight: "800" },
  previewDetails: { fontSize: 15, color: "#cbd5e1", lineHeight: 22, marginBottom: 15 },
  previewDates: { backgroundColor: "rgba(255, 255, 255, 0.05)", borderRadius: 12, padding: 12, marginBottom: 12 },
  previewDate: { fontSize: 14, color: "#94a3b8", fontWeight: "600", marginBottom: 4 },
  previewAudience: { backgroundColor: "rgba(99, 102, 241, 0.1)", borderRadius: 12, padding: 12, marginBottom: 12 },
  previewAudienceText: { fontSize: 14, color: "#38bdf8", fontWeight: "600" },
  previewAttachment: { backgroundColor: "rgba(245, 158, 11, 0.1)", borderRadius: 12, padding: 12, marginBottom: 12 },
  previewAttachmentText: { fontSize: 14, color: "#fbbf24", fontWeight: "600" },
  previewFooter: { borderTopWidth: 1, borderTopColor: "rgba(255, 255, 255, 0.1)", paddingTop: 12, marginTop: 8 },
  previewAuthor: { fontSize: 13, color: "#94a3b8", fontWeight: "500" },
  publishButton: {
    backgroundColor: "#6366f1",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 20,
    shadowColor: "#6366f1",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  publishButtonText: { color: "#ffffff", fontSize: 18, fontWeight: "800" },
  navigationContainer: {
    flexDirection: "row",
    padding: 20,
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
    gap: 12,
  },
  backButton: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  backButtonText: { color: "#cbd5e1", fontSize: 16, fontWeight: "700" },
  cancelFormBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  cancelFormText: { color: '#f87171', fontWeight: '700' },
  nextButton: {
    flex: 2,
    backgroundColor: "#6366f1",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  nextButtonFull: { flex: 1 },
  nextButtonText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  emptyContainer: {
    alignItems: 'center',
    padding: 40
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.9,
    height: height * 0.7,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc'
  },
  closeButton: {
    padding: 2
  },
  imageContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center'
  },
  previewImage: {
    width: '100%',
    height: '100%'
  },
  noPreviewText: {
    color: '#94a3b8',
    fontWeight: '600'
  }
});