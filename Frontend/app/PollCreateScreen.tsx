import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface PollCreateScreenProps {
  communityId: string;
  onCancel: () => void;
  onCreated: (poll: any) => void;
}

type PollDuration = '1h' | '6h' | '1d' | '3d' | '7d' | '30d' | 'unlimited';
type ResultVisibility = 'immediate' | 'after_vote' | 'after_close';
type VotingRequirement = 'none' | 'verified' | 'tenure';

const PollCreateScreen: React.FC<PollCreateScreenProps> = ({
  communityId,
  onCancel,
  onCreated,
}) => {
  // Basic fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  
  // Advanced fields
  const [duration, setDuration] = useState<PollDuration>('7d');
  const [resultVisibility, setResultVisibility] = useState<ResultVisibility>('after_vote');
  const [votingRequirement, setVotingRequirement] = useState<VotingRequirement>('none');
  const [allowChangeVote, setAllowChangeVote] = useState(true);
  const [showVoterCount, setShowVoterCount] = useState(true);
  const [anonymousVoting, setAnonymousVoting] = useState(false);
  const [requireComment, setRequireComment] = useState(false);
  const [minVotesToShow, setMinVotesToShow] = useState('0');
  const [allowSuggestions, setAllowSuggestions] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic');
  
  // Animations
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();

    // Pulse animation for submit button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    } else {
      Alert.alert('Limit Reached', 'Maximum 10 options allowed');
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    } else {
      Alert.alert('Minimum Required', 'At least 2 options are required');
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const isValid = () => {
    if (!title.trim()) return false;
    const validOptions = options.filter(opt => opt.trim());
    if (validOptions.length < 2) return false;
    if (minVotesToShow && parseInt(minVotesToShow) < 0) return false;
    return true;
  };

  const getDurationText = (dur: PollDuration): string => {
    const map = {
      '1h': '1 Hour',
      '6h': '6 Hours',
      '1d': '1 Day',
      '3d': '3 Days',
      '7d': '7 Days',
      '30d': '30 Days',
      'unlimited': 'No Limit',
    };
    return map[dur];
  };

  const handleCreate = async () => {
    if (!isValid()) {
      Alert.alert('Incomplete', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const validOptions = options.filter(opt => opt.trim());

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        options: validOptions,
        allowMultipleAnswers: allowMultiple,
        duration,
        resultVisibility,
        votingRequirement,
        allowChangeVote,
        showVoterCount,
        anonymousVoting,
        requireComment,
        minVotesToShow: parseInt(minVotesToShow) || 0,
        allowSuggestions,
      };

      const response = await fetch(
        `http://YOUR_API_URL/api/communities/${communityId}/polls`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', '🎉 Poll launched successfully!');
        onCreated(data);
      } else {
        Alert.alert('Error', data.error || 'Failed to create poll');
      }
    } catch (error) {
      console.error('Error creating poll:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Animated Gradient Header */}
      <LinearGradient
        colors={['#667eea', '#764ba2', '#f093fb']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerEmoji}>🗳️</Text>
            <Text style={styles.headerTitle}>Create Poll</Text>
          </View>
          <View style={styles.placeholder} />
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'basic' && styles.tabActive]}
            onPress={() => setActiveTab('basic')}
          >
            <Text style={[styles.tabText, activeTab === 'basic' && styles.tabTextActive]}>
              ✨ Basic
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'advanced' && styles.tabActive]}
            onPress={() => setActiveTab('advanced')}
          >
            <Text style={[styles.tabText, activeTab === 'advanced' && styles.tabTextActive]}>
              ⚙️ Advanced
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {activeTab === 'basic' ? (
          <Animated.View
            style={[
              styles.tabContent,
              {
                transform: [
                  {
                    translateX: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-width, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Title Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.iconBadge}>
                  <Text style={styles.iconBadgeText}>📝</Text>
                </View>
                <Text style={styles.label}>Poll Question</Text>
              </View>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.titleInput}
                  placeholder="What would you like to ask the community?"
                  placeholderTextColor="#9CA3AF"
                  value={title}
                  onChangeText={setTitle}
                  multiline
                  maxLength={200}
                />
                <Text style={styles.charCount}>{title.length}/200</Text>
              </View>
            </View>

            {/* Description Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.iconBadge}>
                  <Text style={styles.iconBadgeText}>📋</Text>
                </View>
                <Text style={styles.label}>Context (Optional)</Text>
              </View>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.descriptionInput}
                  placeholder="Add more details to help members decide..."
                  placeholderTextColor="#9CA3AF"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  maxLength={500}
                />
                <Text style={styles.charCount}>{description.length}/500</Text>
              </View>
            </View>

            {/* Options Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.iconBadge}>
                  <Text style={styles.iconBadgeText}>🎯</Text>
                </View>
                <Text style={styles.label}>Voting Options</Text>
              </View>

              {options.map((option, index) => (
                <View key={index} style={styles.optionContainer}>
                  <View style={styles.optionRow}>
                    <LinearGradient
                      colors={getGradientColors(index)}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.optionBullet}
                    >
                      <Text style={styles.optionNumber}>{index + 1}</Text>
                    </LinearGradient>
                    <TextInput
                      style={styles.optionInput}
                      placeholder={`Option ${index + 1}`}
                      placeholderTextColor="#9CA3AF"
                      value={option}
                      onChangeText={(text) => updateOption(index, text)}
                      maxLength={100}
                    />
                    {options.length > 2 && (
                      <TouchableOpacity
                        onPress={() => removeOption(index)}
                        style={styles.removeButton}
                      >
                        <LinearGradient
                          colors={['#ef4444', '#dc2626']}
                          style={styles.removeButtonGradient}
                        >
                          <Text style={styles.removeText}>✕</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </View>
                  {option.trim() && (
                    <View style={styles.optionPreview}>
                      <Text style={styles.optionPreviewText}>✓ Ready</Text>
                    </View>
                  )}
                </View>
              ))}

              {options.length < 10 && (
                <TouchableOpacity onPress={addOption} style={styles.addOptionButton}>
                  <LinearGradient
                    colors={['#10b981', '#059669']}
                    style={styles.addOptionGradient}
                  >
                    <Text style={styles.addOptionIcon}>+</Text>
                    <Text style={styles.addOptionText}>Add Another Option</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>

            {/* Quick Settings */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.iconBadge}>
                  <Text style={styles.iconBadgeText}>⚡</Text>
                </View>
                <Text style={styles.label}>Quick Settings</Text>
              </View>

              <TouchableOpacity
                style={styles.settingCard}
                onPress={() => setAllowMultiple(!allowMultiple)}
              >
                <View style={styles.settingLeft}>
                  <Text style={styles.settingEmoji}>☑️</Text>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Multiple Answers</Text>
                    <Text style={styles.settingHint}>
                      Let members choose more than one option
                    </Text>
                  </View>
                </View>
                <View style={[styles.customSwitch, allowMultiple && styles.customSwitchOn]}>
                  <View style={[styles.switchThumb, allowMultiple && styles.switchThumbOn]} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingCard}
                onPress={() => setAllowChangeVote(!allowChangeVote)}
              >
                <View style={styles.settingLeft}>
                  <Text style={styles.settingEmoji}>🔄</Text>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Allow Vote Changes</Text>
                    <Text style={styles.settingHint}>
                      Members can modify their vote before poll ends
                    </Text>
                  </View>
                </View>
                <View style={[styles.customSwitch, allowChangeVote && styles.customSwitchOn]}>
                  <View style={[styles.switchThumb, allowChangeVote && styles.switchThumbOn]} />
                </View>
              </TouchableOpacity>
            </View>
          </Animated.View>
        ) : (
          <Animated.View
            style={[
              styles.tabContent,
              {
                transform: [
                  {
                    translateX: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [width, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Duration Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.iconBadge}>
                  <Text style={styles.iconBadgeText}>⏱️</Text>
                </View>
                <Text style={styles.label}>Poll Duration</Text>
              </View>
              <View style={styles.durationGrid}>
                {(['1h', '6h', '1d', '3d', '7d', '30d', 'unlimited'] as PollDuration[]).map((dur) => (
                  <TouchableOpacity
                    key={dur}
                    style={[
                      styles.durationChip,
                      duration === dur && styles.durationChipActive,
                    ]}
                    onPress={() => setDuration(dur)}
                  >
                    {duration === dur && (
                      <LinearGradient
                        colors={['#667eea', '#764ba2']}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <Text
                      style={[
                        styles.durationChipText,
                        duration === dur && styles.durationChipTextActive,
                      ]}
                    >
                      {getDurationText(dur)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Result Visibility */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.iconBadge}>
                  <Text style={styles.iconBadgeText}>👁️</Text>
                </View>
                <Text style={styles.label}>When to Show Results</Text>
              </View>
              <View style={styles.visibilityOptions}>
                <TouchableOpacity
                  style={[
                    styles.visibilityCard,
                    resultVisibility === 'immediate' && styles.visibilityCardActive,
                  ]}
                  onPress={() => setResultVisibility('immediate')}
                >
                  <Text style={styles.visibilityEmoji}>⚡</Text>
                  <Text style={styles.visibilityTitle}>Immediately</Text>
                  <Text style={styles.visibilityDesc}>
                    Show live results to everyone
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.visibilityCard,
                    resultVisibility === 'after_vote' && styles.visibilityCardActive,
                  ]}
                  onPress={() => setResultVisibility('after_vote')}
                >
                  <Text style={styles.visibilityEmoji}>✅</Text>
                  <Text style={styles.visibilityTitle}>After Voting</Text>
                  <Text style={styles.visibilityDesc}>
                    Show results after member votes
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.visibilityCard,
                    resultVisibility === 'after_close' && styles.visibilityCardActive,
                  ]}
                  onPress={() => setResultVisibility('after_close')}
                >
                  <Text style={styles.visibilityEmoji}>🔒</Text>
                  <Text style={styles.visibilityTitle}>After Close</Text>
                  <Text style={styles.visibilityDesc}>
                    Show results when poll ends
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Advanced Options */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.iconBadge}>
                  <Text style={styles.iconBadgeText}>🎛️</Text>
                </View>
                <Text style={styles.label}>Privacy & Requirements</Text>
              </View>

              <TouchableOpacity
                style={styles.settingCard}
                onPress={() => setAnonymousVoting(!anonymousVoting)}
              >
                <View style={styles.settingLeft}>
                  <Text style={styles.settingEmoji}>🕵️</Text>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Anonymous Voting</Text>
                    <Text style={styles.settingHint}>
                      Hide voter identities from everyone
                    </Text>
                  </View>
                </View>
                <View style={[styles.customSwitch, anonymousVoting && styles.customSwitchOn]}>
                  <View style={[styles.switchThumb, anonymousVoting && styles.switchThumbOn]} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingCard}
                onPress={() => setShowVoterCount(!showVoterCount)}
              >
                <View style={styles.settingLeft}>
                  <Text style={styles.settingEmoji}>📊</Text>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Show Voter Count</Text>
                    <Text style={styles.settingHint}>
                      Display total number of voters
                    </Text>
                  </View>
                </View>
                <View style={[styles.customSwitch, showVoterCount && styles.customSwitchOn]}>
                  <View style={[styles.switchThumb, showVoterCount && styles.switchThumbOn]} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingCard}
                onPress={() => setRequireComment(!requireComment)}
              >
                <View style={styles.settingLeft}>
                  <Text style={styles.settingEmoji}>💬</Text>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Require Comment</Text>
                    <Text style={styles.settingHint}>
                      Ask members to explain their vote
                    </Text>
                  </View>
                </View>
                <View style={[styles.customSwitch, requireComment && styles.customSwitchOn]}>
                  <View style={[styles.switchThumb, requireComment && styles.switchThumbOn]} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingCard}
                onPress={() => setAllowSuggestions(!allowSuggestions)}
              >
                <View style={styles.settingLeft}>
                  <Text style={styles.settingEmoji}>💡</Text>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Allow Suggestions</Text>
                    <Text style={styles.settingHint}>
                      Members can propose new options
                    </Text>
                  </View>
                </View>
                <View style={[styles.customSwitch, allowSuggestions && styles.customSwitchOn]}>
                  <View style={[styles.switchThumb, allowSuggestions && styles.switchThumbOn]} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Minimum Votes */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.iconBadge}>
                  <Text style={styles.iconBadgeText}>🎯</Text>
                </View>
                <Text style={styles.label}>Minimum Votes to Show Results</Text>
              </View>
              <TextInput
                style={styles.numberInput}
                placeholder="0 = No minimum"
                placeholderTextColor="#9CA3AF"
                value={minVotesToShow}
                onChangeText={setMinVotesToShow}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Text style={styles.inputHint}>
                Results will be hidden until this many members vote
              </Text>
            </View>

            {/* Voting Requirement */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.iconBadge}>
                  <Text style={styles.iconBadgeText}>🎫</Text>
                </View>
                <Text style={styles.label}>Who Can Vote</Text>
              </View>
              <View style={styles.requirementOptions}>
                <TouchableOpacity
                  style={[
                    styles.requirementCard,
                    votingRequirement === 'none' && styles.requirementCardActive,
                  ]}
                  onPress={() => setVotingRequirement('none')}
                >
                  <Text style={styles.requirementEmoji}>🌐</Text>
                  <Text style={styles.requirementTitle}>Everyone</Text>
                  <Text style={styles.requirementDesc}>All members can vote</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.requirementCard,
                    votingRequirement === 'verified' && styles.requirementCardActive,
                  ]}
                  onPress={() => setVotingRequirement('verified')}
                >
                  <Text style={styles.requirementEmoji}>✓</Text>
                  <Text style={styles.requirementTitle}>Head Only</Text>
                  <Text style={styles.requirementDesc}>heads of community only</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.requirementCard,
                    votingRequirement === 'tenure' && styles.requirementCardActive,
                  ]}
                  onPress={() => setVotingRequirement('tenure')}
                >
                  <Text style={styles.requirementEmoji}>⭐</Text>
                  <Text style={styles.requirementTitle}>Tenured</Text>
                  <Text style={styles.requirementDesc}>Members 30+ days</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.infoCardGradient}
          >
            <Text style={styles.infoIcon}>💡</Text>
            <Text style={styles.infoText}>
              {activeTab === 'basic'
                ? 'Tip: Use clear, unbiased language in your poll question'
                : 'Pro tip: Combine settings to create engaging, fair polls'}
            </Text>
          </LinearGradient>
        </View>
      </ScrollView>

      {/* Floating Submit Button */}
      <View style={styles.footer}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[styles.submitButton, !isValid() && styles.submitButtonDisabled]}
            onPress={handleCreate}
            disabled={!isValid() || loading}
          >
            <LinearGradient
              colors={
                isValid()
                  ? ['#667eea', '#764ba2']
                  : ['#9CA3AF', '#6B7280']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitButtonGradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.submitButtonIcon}>🚀</Text>
                  <Text style={styles.submitButtonText}>Launch Poll</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${
                    ((title.trim() ? 1 : 0) +
                      (options.filter(o => o.trim()).length >= 2 ? 1 : 0)) *
                    50
                  }%`,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {title.trim() && options.filter(o => o.trim()).length >= 2
              ? '✓ Ready to launch'
              : `${2 - (title.trim() ? 0 : 1) - (options.filter(o => o.trim()).length >= 2 ? 0 : 1)} steps remaining`}
          </Text>
        </View>
      </View>
    </View>
  );
};

const getGradientColors = (index: number): [string, string] => {
  const gradients: [string, string][] = [
    ['#667eea', '#764ba2'],
    ['#f093fb', '#f5576c'],
    ['#4facfe', '#00f2fe'],
    ['#43e97b', '#38f9d7'],
    ['#fa709a', '#fee140'],
    ['#30cfd0', '#330867'],
    ['#a8edea', '#fed6e3'],
    ['#ff9a9e', '#fecfef'],
    ['#ffecd2', '#fcb69f'],
    ['#ff6e7f', '#bfe9ff'],
  ];
  return gradients[index % gradients.length];
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  cancelButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  placeholder: {
    width: 36,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  tabTextActive: {
    color: '#667eea',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 200,
  },
  tabContent: {
    width: '100%',
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  iconBadgeText: {
    fontSize: 18,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  inputWrapper: {
    position: 'relative',
  },
  titleInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    fontSize: 16,
    color: '#1F2937',
    minHeight: 100,
    textAlignVertical: 'top',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  descriptionInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    fontSize: 15,
    color: '#1F2937',
    minHeight: 120,
    textAlignVertical: 'top',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  charCount: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  optionContainer: {
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionBullet: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  optionNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  optionInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: '#1F2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  removeButton: {
    marginLeft: 8,
  },
  removeButtonGradient: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  optionPreview: {
    marginLeft: 48,
    marginTop: 4,
  },
  optionPreviewText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  addOptionButton: {
    marginTop: 8,
  },
  addOptionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  addOptionIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  addOptionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingEmoji: {
    fontSize: 24,
    marginRight: 14,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  settingHint: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  customSwitch: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#D1D5DB',
    padding: 3,
    justifyContent: 'center',
  },
  customSwitchOn: {
    backgroundColor: '#10b981',
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  switchThumbOn: {
    alignSelf: 'flex-end',
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  durationChip: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  durationChipActive: {
    borderColor: '#667eea',
  },
  durationChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  durationChipTextActive: {
    color: '#FFFFFF',
  },
  visibilityOptions: {
    gap: 12,
  },
  visibilityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  visibilityCardActive: {
    borderColor: '#667eea',
    backgroundColor: '#F5F3FF',
  },
  visibilityEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  visibilityTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  visibilityDesc: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  numberInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    color: '#1F2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputHint: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
    lineHeight: 18,
  },
  requirementOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  requirementCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  requirementCardActive: {
    borderColor: '#667eea',
    backgroundColor: '#F5F3FF',
  },
  requirementEmoji: {
    fontSize: 32,
    marginBottom: 10,
  },
  requirementTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
    textAlign: 'center',
  },
  requirementDesc: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  infoCard: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  infoCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  infoIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#FFFFFF',
    lineHeight: 20,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  submitButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  submitButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  submitButtonIcon: {
    fontSize: 22,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  progressContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#667eea',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
});

export default PollCreateScreen;