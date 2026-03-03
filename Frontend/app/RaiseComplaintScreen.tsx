import React, { useState } from 'react';
import { View, Alert, Platform, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from '../lib/api';

// Types
type ComplaintVisibility = 'public' | 'private';
type ComplaintCategory = 'infrastructure' | 'cleanliness' | 'safety' | 'food' | 'noise' | 'finance' | 'behavior' | 'other';
type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

// ============================================================
// MAIN COMPONENT
// ============================================================

const RaiseComplaintScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const communityId = route.params?.communityId || route.params?.community_id;
  const communityName = route.params?.communityName || 'Community';
  const visibility = route.params?.visibility || 'public';

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
          { text: 'OK', onPress: () => {
            navigation.goBack();
          }}
        ]);
      }
    } catch (error: any) {
      console.error('Error creating complaint:', error);
      const errorMessage = error.response?.data?.error || 'Failed to create complaint. Please try again.';
      Alert.alert('Error', errorMessage);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Raise Complaint</Text>
        <Text style={styles.subtitle}>{communityName} • {visibility}</Text>
      </View>

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
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#3b82f6',
    padding: 20,
    paddingTop: 40,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
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
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
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
});

export default RaiseComplaintScreen;