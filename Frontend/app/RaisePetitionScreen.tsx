import React, { useState } from 'react';
import { View, Alert, Platform, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, Dimensions } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
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

const RaisePetitionScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const communityId = route.params?.communityId || route.params?.community_id;
  const communityName = route.params?.communityName || 'Community';
  const visibility = route.params?.visibility || 'public';

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    summary: '',
    problemStatement: '',
    proposedAction: '',
    goalType: '',
    otherGoalType: '',
    impactArea: '',
    otherImpactArea: '',
    affectedGroups: [] as string[],
    priorityLevel: 'normal' as 'normal' | 'important' | 'critical',
    referenceContext: '',
  });

  // Dropdown states
  const [goalTypeDropdownVisible, setGoalTypeDropdownVisible] = useState<boolean>(false);
  const [impactAreaDropdownVisible, setImpactAreaDropdownVisible] = useState<boolean>(false);

  const handleSubmit = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Error', 'Authentication required. Please log in again.');
        return;
      }

      if (!communityId) {
        Alert.alert('Error', 'Community ID is required to create a petition.');
        return;
      }

      // Validate required fields
      if (!formData.title || !formData.problemStatement || !formData.proposedAction || !formData.goalType || !formData.impactArea) {
        Alert.alert('Error', 'Please fill in all required fields (title, problem statement, proposed action, goal type, impact area).');
        return;
      }

      const petitionData = {
        title: formData.title,
        summary: formData.summary || null,
        problem_statement: formData.problemStatement,
        proposed_action: formData.proposedAction,
        community_id: Number(communityId),
        goal_type: formData.goalType,
        other_goal_type: formData.otherGoalType || null,
        impact_area: formData.impactArea,
        other_impact_area: formData.otherImpactArea || null,
        affected_groups: formData.affectedGroups || [],
        priority_level: formData.priorityLevel,
        reference_context: formData.referenceContext || null,
        visibility: visibility,
      };

      const response = await axios.post(`${BASE_URL}/petitions`, petitionData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 201) {
        // Reset form immediately after successful submission (page refresh effect)
        setFormData({
          title: '',
          summary: '',
          problemStatement: '',
          proposedAction: '',
          goalType: '',
          otherGoalType: '',
          impactArea: '',
          otherImpactArea: '',
          affectedGroups: [],
          priorityLevel: 'normal',
          referenceContext: '',
        });

        // Show success message with a slight delay to ensure form reset is visible
        setTimeout(() => {
          Alert.alert(
            'Success',
            'Petition submitted successfully! Form has been refreshed.',
            [{ text: 'OK' }]
          );
        }, 200);
      }
    } catch (error: any) {
      console.error('Error creating petition:', error);
      const errorMessage = error.response?.data?.error || 'Failed to create petition. Please try again.';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleBack = () => {
    // Handle back navigation
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Raise Petition</Text>
        <Text style={styles.subtitle}>{communityName} • {visibility}</Text>
      </View>

      <View style={styles.form}>
        {/* Title */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter petition title"
            value={formData.title}
            onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
          />
        </View>

        {/* Summary */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Summary</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Brief summary of your petition"
            multiline
            numberOfLines={3}
            value={formData.summary}
            onChangeText={(text) => setFormData(prev => ({ ...prev, summary: text }))}
          />
        </View>

        {/* Problem Statement */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Problem Statement *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe the problem you want to address"
            multiline
            numberOfLines={4}
            value={formData.problemStatement}
            onChangeText={(text) => setFormData(prev => ({ ...prev, problemStatement: text }))}
          />
        </View>

        {/* Proposed Action */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Proposed Action *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="What action do you propose to solve this problem?"
            multiline
            numberOfLines={4}
            value={formData.proposedAction}
            onChangeText={(text) => setFormData(prev => ({ ...prev, proposedAction: text }))}
          />
        </View>

        {/* Goal Type */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Goal Type *</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setGoalTypeDropdownVisible(!goalTypeDropdownVisible)}
          >
            <Text style={styles.dropdownButtonText}>
              {formData.goalType || "Select goal type"}
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
                    setFormData(prev => ({ ...prev, goalType: type }));
                    setGoalTypeDropdownVisible(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Impact Area */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Impact Area *</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setImpactAreaDropdownVisible(!impactAreaDropdownVisible)}
          >
            <Text style={styles.dropdownButtonText}>
              {formData.impactArea || "Select impact area"}
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
                    setFormData(prev => ({ ...prev, impactArea: area }));
                    setImpactAreaDropdownVisible(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{area}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Priority Level */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Priority Level</Text>
          <View style={styles.priorityContainer}>
            {(['normal', 'important', 'critical'] as const).map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.priorityButton,
                  formData.priorityLevel === level && styles.priorityButtonActive
                ]}
                onPress={() => setFormData(prev => ({ ...prev, priorityLevel: level }))}
              >
                <Text style={[
                  styles.priorityText,
                  formData.priorityLevel === level && styles.priorityTextActive
                ]}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitText}>Submit Petition</Text>
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
  priorityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priorityButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginHorizontal: 4,
    alignItems: 'center',
  },
  priorityButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  priorityText: {
    fontSize: 14,
    color: '#6b7280',
  },
  priorityTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#10b981',
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

  // Dropdown styles
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
});

export default RaisePetitionScreen;
