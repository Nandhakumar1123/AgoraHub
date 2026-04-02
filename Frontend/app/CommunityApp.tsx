import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Share,
  StyleSheet,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { API_BASE_URL } from '../lib/api';

const BASE_URL = API_BASE_URL;

type Community = {
  id: number;
  code: string;
  name: string;
  head_name: string;
  member_count?: number;
  description?: string;
  created_at: string;
};

type UserCommunity = Community & { role: 'HEAD' | 'MEMBER' };

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  // User info
  const [currentUser, setCurrentUser] = useState<{ user_id: number | null; full_name: string }>({
    user_id: null,
    full_name: 'Guest',
  });

  // Screen states
  const [activeTab, setActiveTab] = useState<'created' | 'joined'>('created');
  const [view, setView] = useState<'main' | 'create' | 'shareDetails' | 'joinCommunity'>('main');
  const [communities, setCommunities] = useState<UserCommunity[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<UserCommunity | null>(null);
  const [newCommunityName, setNewCommunityName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [description, setDescription] = useState('');

  // Feature toggles
  const [complaintsEnabled, setComplaintsEnabled] = useState(true);
  const [petitionsEnabled, setPetitionsEnabled] = useState(true);
  const [votingEnabled, setVotingEnabled] = useState(true);
  const [groupChatEnabled, setGroupChatEnabled] = useState(false);
  const [anonymousEnabled, setAnonymousEnabled] = useState(false);

  const createdCommunities = communities.filter((c) => c.role === 'HEAD');
  const joinedCommunities = communities.filter((c) => c.role === 'MEMBER');

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      if (route.params?.user) {
        setCurrentUser(route.params.user);
      } else {
        try {
          const token = await AsyncStorage.getItem('authToken');
          if (token) {
            const decodedToken: any = jwtDecode(token);
            setCurrentUser({
              user_id: decodedToken.user_id,
              full_name: decodedToken.full_name || decodedToken.email,
            });
          }
        } catch (error) {
          console.error('Failed to load user data from AsyncStorage', error);
        }
      }
    };
    loadUserData();
  }, [route.params?.user]);

  // Fetch communities when user is loaded
  useEffect(() => {
    if (currentUser?.user_id) fetchCommunities(currentUser.user_id);
  }, [currentUser]);

  // 🔹 Fetch Communities
  async function fetchCommunities(userId: number) {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return console.error('No auth token found');

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const [createdRes, joinedRes] = await Promise.all([
        fetch(`${BASE_URL}/created_communities/${userId}`, { headers }),
        fetch(`${BASE_URL}/joined_communities/${userId}`, { headers }),
      ]);

      if (!createdRes.ok || !joinedRes.ok)
        return console.error('Failed to fetch communities:', createdRes.status, joinedRes.status);

      const createdData = await createdRes.json();
      const joinedData = await joinedRes.json();

      const all = [
        ...createdData.map((c: any) => ({ ...c, role: 'HEAD' })),
        ...joinedData.map((c: any) => ({ ...c, role: 'MEMBER' })),
      ];
      setCommunities(all);
    } catch (error) {
      console.error('Error fetching communities:', error);
    }
  }

  // 🔹 Create Community
  async function handleCreateCommunity() {
    if (!currentUser?.user_id) return Alert.alert('Error', 'Please login first');
    if (!newCommunityName.trim()) return Alert.alert('Error', 'Enter a community name');

    const token = await AsyncStorage.getItem('authToken');
    if (!token) return Alert.alert('Error', 'Authentication token not found.');

    try {
      const response = await fetch(`${BASE_URL}/create_community`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newCommunityName,
          description,
          community_type: 'Club',
          created_by: currentUser.user_id,
          complaints_enabled: complaintsEnabled,
          petitions_enabled: petitionsEnabled,
          voting_enabled: votingEnabled,
          group_chat_enabled: groupChatEnabled,
          anonymous_enabled: anonymousEnabled,
        }),
      });

      const data = await response.json();
      if (!response.ok) return Alert.alert('Error', data.error || 'Failed to create community');

      const newComm: UserCommunity = {
        id: data.community.community_id,
        code: data.community.code,
        name: data.community.name,
        head_name: currentUser.full_name,
        description: data.community.description,
        created_at: data.community.created_at,
        role: 'HEAD',
        member_count: 1,
      };

      setCommunities([...communities, newComm]);
      setSelectedCommunity(newComm);
      setNewCommunityName('');
      setDescription('');
      setComplaintsEnabled(true);
      setPetitionsEnabled(true);
      setVotingEnabled(true);
      setGroupChatEnabled(false);
      setAnonymousEnabled(false);
      setView('shareDetails');
      fetchCommunities(currentUser.user_id);
    } catch (error: any) {
      console.error('Error creating community:', error);
      Alert.alert('Error', error.message || 'Failed to create community.');
    }
  }

  // 🔹 Join Community
  async function handleJoinCommunity() {
    if (!currentUser?.user_id) return Alert.alert('Error', 'Please login first');
    if (!joinCode.trim()) return Alert.alert('Error', 'Enter a valid code');

    const token = await AsyncStorage.getItem('authToken');
    if (!token) return Alert.alert('Error', 'Authentication token not found.');

    try {
      const res = await fetch(`${BASE_URL}/community/${joinCode.trim().toUpperCase()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return Alert.alert('Error', err.error || 'Community not found');
      }
      const comm = await res.json();

      const joinRes = await fetch(`${BASE_URL}/join_community`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: currentUser.user_id,
          community_id: comm.id,
        }),
      });

      const data = await joinRes.json();
      if (!joinRes.ok) return Alert.alert('Error', data.error || 'Failed to join');

      const joined: UserCommunity = {
        id: comm.id,
        code: comm.code,
        name: comm.name,
        head_name: comm.head_name,
        description: comm.description,
        created_at: comm.created_at || new Date().toISOString(),
        role: 'MEMBER',
        member_count: data.community.member_count || 1,
      };

      setCommunities([...communities, joined]);
      setJoinCode('');
      setActiveTab('joined');
      setView('main');
      fetchCommunities(currentUser.user_id);
    } catch (error: any) {
      console.error('Join error:', error);
      Alert.alert('Error', error.message || 'Failed to join community.');
    }
  }

  // 🔹 Share Code
  async function handleShare(community: UserCommunity) {
    try {
      await Share.share({
        message: `Join my community "${community.name}" using code: ${community.code}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  }

  // 🔹 Navigate to Info
  function openInfoCard(community: UserCommunity) {
    if (community.role === 'HEAD') navigation.navigate('InfoCard', { community });
  }

  // ================= MAIN SCREEN =================
  if (view === 'main') {
    return (
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerIcon}>👥</Text>
          <Text style={styles.headerTitle}>Community Manager</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => setView('joinCommunity')} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Join</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setView('create')}
              style={[styles.headerButton, styles.createHeaderButton]}>
              <Text style={styles.createButtonText}>+ Create</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'created' && styles.activeTab]}
            onPress={() => setActiveTab('created')}>
            <Text style={[styles.tabText, activeTab === 'created' && styles.activeTabText]}>
              Created
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'joined' && styles.activeTab]}
            onPress={() => setActiveTab('joined')}>
            <Text style={[styles.tabText, activeTab === 'joined' && styles.activeTabText]}>
              Joined
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollContent}>
          <View style={styles.content}>
            {activeTab === 'created'
              ? createdCommunities.length === 0
                ? (
                  <View style={styles.emptyState}>
                    <Text>No Created Communities</Text>
                  </View>
                  )
                : createdCommunities.map((community, index) => (
                    <View
                      key={community.id}
                      style={[styles.communityCard, index > 0 && styles.communityCardMargin]}>
                      <Text style={styles.communityName}>{community.name}</Text>
                      <Text style={{ color: '#6B7280', marginBottom: 6 }}>
                        {community.description || 'No description'}
                      </Text>
                      <View style={styles.badgeRow}>
                        <Text style={styles.codeText}>Code: {community.code}</Text>
                        <TouchableOpacity onPress={() => openInfoCard(community)}>
                          <Icon name="settings" size={22} color="#4F46E5" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
              : joinedCommunities.length === 0
                ? (
                  <View style={styles.emptyState}>
                    <Text>No Joined Communities</Text>
                  </View>
                  )
                : joinedCommunities.map((community, index) => (
                    <View
                      key={community.id}
                      style={[styles.communityCard, index > 0 && styles.communityCardMargin]}>
                      <Text style={styles.communityName}>{community.name}</Text>
                      <Text style={{ color: '#6B7280', marginBottom: 6 }}>
                        {community.description || 'No description'}
                      </Text>
                      <View style={styles.badgeRow}>
                        <Text style={styles.codeText}>Code: {community.code}</Text>
                        <Text style={styles.headInfo}>Head: {community.head_name}</Text>
                      </View>
                      {community.member_count != null && (
                        <Text style={{ color: '#6B7280', marginTop: 6 }}>
                          Members: {Number(community.member_count)}
                        </Text>
                      )}
                    </View>
                  ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ================= CREATE COMMUNITY SCREEN =================
  if (view === 'create') {
    return (
      <ScrollView style={[styles.safeArea, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Create Community</Text>
          <TouchableOpacity onPress={() => setView('main')} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.label}>Community Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Tech Enthusiasts"
            value={newCommunityName}
            onChangeText={setNewCommunityName}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, { height: 80 }]}
            placeholder="Briefly describe your community"
            multiline
            value={description}
            onChangeText={setDescription}
          />

          <Text style={styles.sectionTitle}>Feature Settings</Text>
          <View style={styles.featureCard}>
            {[
              { title: 'Complaints', desc: 'Submit and track complaints', state: complaintsEnabled, set: setComplaintsEnabled },
              { title: 'Petitions', desc: 'Create or sign petitions', state: petitionsEnabled, set: setPetitionsEnabled },
              { title: 'Voting', desc: 'Participate in voting', state: votingEnabled, set: setVotingEnabled },
              { title: 'Group Chat', desc: 'Real-time group chat', state: groupChatEnabled, set: setGroupChatEnabled },
              { title: 'Anonymous Message', desc: 'Send anonymous messages', state: anonymousEnabled, set: setAnonymousEnabled },
            ].map((item, i) => (
              <View key={i} style={styles.featureItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{item.title}</Text>
                  <Text style={styles.featureDesc}>{item.desc}</Text>
                </View>
                {item.title === 'Anonymous Message' ? (
                  <View style={styles.privateBadge}>
                    <Text style={styles.privateBadgeText}>Private</Text>
                  </View>
                ) : (
                  <Switch
                    trackColor={{ false: '#d1d5db', true: '#6366f1' }}
                    thumbColor="#ffffff"
                    ios_backgroundColor="#e5e7eb"
                    onValueChange={item.set}
                    value={item.state}
                  />
                )}
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.createButtonFull} onPress={handleCreateCommunity}>
            <Text style={styles.createButtonTextFull}>Create</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ================= SHARE DETAILS =================
  if (view === 'shareDetails' && selectedCommunity) {
    return (
      <View
        style={[
          styles.safeArea,
          { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' },
        ]}>
        <Text style={styles.headerTitle}>🎉 Community Created!</Text>
        <Text style={styles.communityName}>{selectedCommunity.name}</Text>
        <Text style={styles.codeText}>Code: {selectedCommunity.code}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => handleShare(selectedCommunity)}>
          <Text style={styles.primaryButtonText}>Share Invite Code</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setView('main')}
          style={[styles.headerButton, { marginTop: 20 }]}>
          <Text style={styles.headerButtonText}>Go to Main</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ================= JOIN COMMUNITY =================
  if (view === 'joinCommunity') {
    return (
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>Join Community</Text>
        <View style={styles.formContainer}>
          <Text style={styles.label}>Enter Community Code</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., ABC123"
            value={joinCode}
            onChangeText={setJoinCode}
          />
          <TouchableOpacity style={styles.primaryButton} onPress={handleJoinCommunity}>
            <Text style={styles.primaryButtonText}>Join</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setView('main')}
            style={[styles.headerButton, { marginTop: 10 }]}>
            <Text style={styles.headerButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return null;
}

// ---------- STYLES ----------
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerIcon: { fontSize: 28 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  headerRight: { flexDirection: 'row' },
  headerButton: { padding: 10, backgroundColor: '#E5E7EB', borderRadius: 10, marginLeft: 10 },
  headerButtonText: { color: '#111827' },
  createHeaderButton: { backgroundColor: '#4F46E5' },
  createButtonText: { color: '#FFF' },
  tabContainer: { flexDirection: 'row' },
  tab: { flex: 1, padding: 12, alignItems: 'center' },
  activeTab: { backgroundColor: '#EEF2FF' },
  tabText: { color: '#6B7280' },
  activeTabText: { color: '#4F46E5' },
  scrollContent: { flex: 1 },
  content: { padding: 20 },
  communityCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 16 },
  communityCardMargin: { marginTop: 16 },
  communityName: { fontSize: 18, fontWeight: 'bold' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeText: { fontSize: 14, color: '#4F46E5' },
  headInfo: { marginTop: 6, color: '#6B7280' },
  formContainer: { padding: 20 },
  label: { marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 10, marginBottom: 16 },
  sectionTitle: { marginTop: 24, fontSize: 18, fontWeight: '700', color: '#1e3a8a', marginBottom: 12 },
  featureCard: { backgroundColor: '#fffefb', borderRadius: 12, borderWidth: 1, borderColor: '#c7d2fe', marginBottom: 20 },
  featureItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 16, paddingHorizontal: 18 },
  featureTitle: { fontSize: 16, fontWeight: '600', color: '#1e3a8a' },
  featureDesc: { fontSize: 12, color: '#2563eb', marginTop: 2 },
  privateBadge: { backgroundColor: '#4F46E5', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  privateBadgeText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  createButtonFull: { backgroundColor: '#4F46E5', paddingVertical: 14, borderRadius: 12, marginTop: 24, alignItems: 'center' },
  createButtonTextFull: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
  primaryButton: { backgroundColor: '#4F46E5', padding: 12, borderRadius: 10, alignItems: 'center' },
  primaryButtonText: { color: '#FFF', fontWeight: 'bold' },
  emptyState: { alignItems: 'center', marginTop: 50 },
});
