import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Share, StyleSheet, Alert, Switch, Platform, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import { useRouter } from 'expo-router';
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

type CommunityMember = {
  user_id: number;
  full_name: string;
  email?: string;
  mobile_number?: string;
  profile_type: 'transparent' | 'private';
  role: 'HEAD' | 'MEMBER';
  joined_at: string;
};

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const router = useRouter();
  const route = useRoute<any>();

  // User info
  const [currentUser, setCurrentUser] = useState<{ user_id: number | null; full_name: string }>({ user_id: null, full_name: 'Guest' });

  // Screen states
  const [activeTab, setActiveTab] = useState<'created' | 'joined'>('created');
  const [view, setView] = useState<'main' | 'create' | 'shareDetails' | 'joinCommunity' | 'memberList' | 'memberDetails'>('main');
  const [communities, setCommunities] = useState<UserCommunity[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<UserCommunity | null>(null);
  const [communityMembers, setCommunityMembers] = useState<CommunityMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<CommunityMember | null>(null);
  const [userRoleInCommunity, setUserRoleInCommunity] = useState<'HEAD' | 'MEMBER' | null>(null);
  const [newCommunityName, setNewCommunityName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [description, setDescription] = useState('');

  // Feature toggles
  const [complaintsEnabled, setComplaintsEnabled] = useState(true);
  const [petitionsEnabled, setPetitionsEnabled] = useState(true);
  const [votingEnabled, setVotingEnabled] = useState(true);
  const [groupChatEnabled, setGroupChatEnabled] = useState(false);
  const [anonymousEnabled, setAnonymousEnabled] = useState(false);

  const createdCommunities = communities.filter(c => c.role === 'HEAD');
  const joinedCommunities = communities.filter(c => c.role === 'MEMBER');

  useEffect(() => {
    const loadUserData = async () => {
      // Prioritize user data from navigation params if available (e.g., after login/registration)
      if (route.params?.user) {
        setCurrentUser(route.params.user);
      } else {
        // Otherwise, try to load from AsyncStorage for persistent session
        try {
          const token = await AsyncStorage.getItem('authToken');
          if (token) {
            const decodedToken: any = jwtDecode(token);
            setCurrentUser({ user_id: decodedToken.user_id, full_name: decodedToken.full_name || decodedToken.email });
          }
        } catch (error) {
          console.error('Failed to load user data from AsyncStorage', error);
        }
      }
    };
    loadUserData();
  }, [route.params?.user]); // Re-run effect if route.params.user changes

  useEffect(() => {
    if (currentUser?.user_id) fetchCommunities(currentUser.user_id);
  }, [currentUser]);

  async function fetchCommunities(userId: number) {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.error('No auth token found');
        return null;
      }

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const [createdRes, joinedRes] = await Promise.all([
        fetch(`${BASE_URL}/created_communities/${userId}`, { headers }),
        fetch(`${BASE_URL}/joined_communities/${userId}`, { headers })
      ]);

      if (!createdRes.ok || !joinedRes.ok) {
        console.error('Failed to fetch communities:', createdRes.status, joinedRes.status);
        return null;
      }

      const createdData = await createdRes.json();
      const joinedData = await joinedRes.json();
      console.log('Fetched created communities:', createdData.length, 'joined communities:', joinedData.length);
      const all = [
        ...createdData.map((c: any) => ({ ...c, role: 'HEAD' })),
        ...joinedData.map((c: any) => ({ ...c, role: 'MEMBER' }))
      ];
      console.log('Total communities after fetch:', all.length);
      setCommunities(all);
      return all;
    } catch (error) {
      console.error('Error fetching communities:', error);
      return null;
    }
  }

  // 🔹 Fetch Community Members
  // ✅ Correct & Cleaned fetchCommunityMembers function
  async function fetchCommunityMembers(communityId: number) {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.error('No auth token found');
        return;
      }

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const response = await fetch(`${BASE_URL}/community_members/${communityId}`, { headers });

      if (!response.ok) {
        console.error('Failed to fetch community members:', response.status);
        return;
      }

      const data = await response.json();
      console.log(
        'Fetched community members:',
        data.members.length,
        'User role:',
        data.user_role
      );

      // ✅ Properly update both members and user role in one place
      setCommunityMembers(data.members);
      setUserRoleInCommunity(data.user_role);
      console.log('✅ userRoleInCommunity updated to:', data.user_role);
    } catch (error) {
      console.error('Error fetching community members:', error);
    }
  }







  // 🔹 Create Community
  async function handleCreateCommunity() {
    if (!currentUser?.user_id) return Alert.alert('Error', 'Please login first');
    if (!newCommunityName.trim()) return Alert.alert('Error', 'Enter a community name');

    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      Alert.alert('Error', 'Authentication token not found. Please log in again.');
      return;
    }

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
          community_type: 'Club', // Assuming 'Club' as a default type, can be dynamic later
          created_by: currentUser.user_id,
          complaints_enabled: complaintsEnabled,
          petitions_enabled: petitionsEnabled,
          voting_enabled: votingEnabled,
          group_chat_enabled: groupChatEnabled,
          anonymous_enabled: anonymousEnabled
        })
      });

      const data = await response.json();
      if (!response.ok) return Alert.alert('Error', data.error || 'Failed to create community');

      const newComm: UserCommunity = {
        id: data.community.community_id,
        code: data.community.code,
        name: data.community.name,
        head_name: currentUser.full_name, // Assuming current user is head
        description: data.community.description,
        created_at: data.community.created_at,
        role: 'HEAD',
        member_count: 1 // Initially 1 member (the creator)
      };

      setCommunities([...communities, newComm]);
      setSelectedCommunity(newComm);
      setNewCommunityName('');
      setDescription('');
      // Reset feature toggles to default for the next creation
      setComplaintsEnabled(true);
      setPetitionsEnabled(true);
      setVotingEnabled(true);
      setGroupChatEnabled(false);
      setAnonymousEnabled(false);
      setView('shareDetails');
      fetchCommunities(currentUser.user_id); // Refresh with current user's ID
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
    if (!token) {
      Alert.alert('Error', 'Authentication token not found. Please log in again.');
      return;
    }

    try {
      // Verify community exists and get its details
      const res = await fetch(`${BASE_URL}/community/${joinCode.trim().toUpperCase()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return Alert.alert('Error', err.error || 'Community not found');
      }
      const comm = await res.json();

      // Join the community
      const joinRes = await fetch(`${BASE_URL}/join_community`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: currentUser.user_id,
          community_id: comm.id
        })
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
        member_count: data.community.member_count || 1 // Assuming member_count might be returned or default to 1
      };

      setCommunities([...communities, joined]);
      setJoinCode('');
      setActiveTab('joined');
      setView('main');
      fetchCommunities(currentUser.user_id); // Refresh with current user's ID
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



  // 🔹 Navigate to Community App
  function openCommunityApp(community: UserCommunity) {
    if (community.role === 'HEAD') {
      navigation.navigate("AdminCommunityApp", { community });
    } else if (community.role === 'MEMBER') {
      navigation.navigate("MemberCommunityApp", { community });
    }
  }

  // 🔹 Open Member List
  function openMemberList(community: UserCommunity) {
    setSelectedCommunity(community);
    fetchCommunityMembers(community.id);
    setView('memberList');
  }

  // 🔹 Open Member Details
  function openMemberDetails(member: CommunityMember) {
    setSelectedMember(member);
    setView('memberDetails');
  }

  // ================= MAIN SCREEN =================
  if (view === 'main') {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <LinearGradient
          colors={['rgba(15, 23, 42, 0.5)', 'rgba(30, 41, 59, 0.5)', 'rgba(15, 23, 42, 0.5)']}
          style={[styles.background, { paddingTop: insets.top }]}
        >
        <View style={styles.header}>
          <Text style={styles.headerIcon}>👥</Text>
          <Text style={styles.headerTitle}>Community Manager</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              onPress={() => router.push('/ProfileScreen')} 
              style={styles.headerButton}
            >
              <Icon name="user" size={20} color="#cbd5e1" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setView('joinCommunity')} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Join</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setView('create')} style={[styles.headerButton, styles.createHeaderButton]}>
              <Text style={styles.createButtonText}>+ Create</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tab, activeTab === 'created' && styles.activeTab]} onPress={() => setActiveTab('created')}>
            <Text style={[styles.tabText, activeTab === 'created' && styles.activeTabText]}>Created</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'joined' && styles.activeTab]} onPress={() => setActiveTab('joined')}>
            <Text style={[styles.tabText, activeTab === 'joined' && styles.activeTabText]}>Joined</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollContent}>
          <View style={styles.content}>
            {activeTab === 'created'
              ? createdCommunities.length === 0
                ? <View style={styles.emptyState}><Text>No Created Communities</Text></View>
                : createdCommunities.map((community, index) => (
                  <TouchableOpacity key={community.id} style={[styles.communityCard, index > 0 && styles.communityCardMargin]} onPress={() => openCommunityApp(community)}>
                    <Text style={styles.communityName}>{community.name}</Text>
                    <Text style={{ color: '#6B7280', marginBottom: 6 }}>{community.description || 'No description'}</Text>
                    <View style={styles.badgeRow}>
                      <Text style={styles.codeText}>Code: {community.code}</Text>
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); openMemberList(community); }}>
                          <Icon name="users" size={22} color="#10B981" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); openInfoCard(community); }}>
                          <Icon name="settings" size={22} color="#4F46E5" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              : joinedCommunities.length === 0
                ? <View style={styles.emptyState}><Text>No Joined Communities</Text></View>
                : joinedCommunities.map((community, index) => (
                  <TouchableOpacity key={community.id} style={[styles.communityCard, index > 0 && styles.communityCardMargin]} onPress={() => openCommunityApp(community)}>
                    <Text style={styles.communityName}>{community.name}</Text>
                    <View style={styles.badgeRow}>
                      <Text style={styles.headInfo}>Head: {community.head_name}</Text>
                      <TouchableOpacity onPress={(e) => { e.stopPropagation(); openMemberList(community); }}>
                        <Icon name="users" size={22} color="#10B981" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))
            }
          </View>
        </ScrollView>
        </LinearGradient>
      </View>
    );
  }

  // ================= CREATE COMMUNITY SCREEN =================
  if (view === 'create') {
    return (
      <View style={styles.safeArea}>
        <LinearGradient
          colors={['rgba(15, 23, 42, 0.5)', 'rgba(30, 41, 59, 0.5)', 'rgba(15, 23, 42, 0.5)']}
          style={[styles.background, { paddingTop: insets.top, flex: 1 }]}
        >
        <ScrollView style={styles.scrollContent}>
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

          {/* 🌟 Feature Settings */}
          <Text style={styles.sectionTitle}>Feature Settings</Text>
          <View style={styles.featureCard}>
            {[
              { title: 'Complaints', desc: 'Submit and track complaints', state: complaintsEnabled, set: setComplaintsEnabled },
              { title: 'Petitions', desc: 'Create or sign community petitions', state: petitionsEnabled, set: setPetitionsEnabled },
              { title: 'Voting', desc: 'Participate in tamper-proof voting', state: votingEnabled, set: setVotingEnabled },
              { title: 'Group Chat', desc: 'Real-time chat between all members and admins', state: groupChatEnabled, set: setGroupChatEnabled },
              { title: 'Anonymous Message', desc: 'Send anonymous messages within the community', state: anonymousEnabled, set: setAnonymousEnabled },
            ].map((item, i) => (
              <View key={i} style={styles.featureItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{item.title}</Text>
                  <Text style={styles.featureDesc}>{item.desc}</Text>
                  <Text style={styles.featureStatus}>
                    {item.title === 'Anonymous Message'
                      ? 'Private'
                      : item.title === 'Group Chat'
                        ? (item.state ? 'Enabled' : 'Disabled')
                        : (item.state ? 'Private' : 'Public')}
                  </Text>
                </View>
                {item.title === 'Anonymous Message' ? (
                  <View style={styles.privateBadge}>
                    <Text style={styles.privateBadgeText}>Private</Text>
                  </View>
                ) : item.title === 'Group Chat' ? (
                  <TouchableOpacity
                    style={[styles.chatButton, { backgroundColor: item.state ? '#10b981' : '#9ca3af' }]}
                    onPress={() => {
                      if (item.state) {
                        navigation.navigate('ChatScreen', { communityId: community?.id });
                      } else {
                        Alert.alert('Chat Disabled', 'Group chat is currently disabled for this community.');
                      }
                    }}
                  >
                    <Text style={styles.chatButtonText}>Open Chat</Text>
                  </TouchableOpacity>
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
      </LinearGradient>
      </View>
    );
  }

  // ================= SHARE DETAILS =================
  if (view === 'shareDetails' && selectedCommunity) {
    return (
      <View style={styles.safeArea}>
        <LinearGradient
          colors={['rgba(15, 23, 42, 0.5)', 'rgba(30, 41, 59, 0.5)', 'rgba(15, 23, 42, 0.5)']}
          style={[styles.background, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}
        >
          <Text style={styles.headerTitle}>🎉 Community Created!</Text>
          <Text style={styles.communityName}>{selectedCommunity.name}</Text>
          <Text style={styles.codeText}>Code: {selectedCommunity.code}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => handleShare(selectedCommunity)}>
            <Text style={styles.primaryButtonText}>Share Invite Code</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setView('main')} style={[styles.headerButton, { marginTop: 20 }]}>
            <Text style={styles.headerButtonText}>Go to Main</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  // ================= JOIN COMMUNITY =================
  if (view === 'joinCommunity') {
    return (
      <View style={styles.safeArea}>
        <LinearGradient
          colors={['rgba(15, 23, 42, 0.5)', 'rgba(30, 41, 59, 0.5)', 'rgba(15, 23, 42, 0.5)']}
          style={[styles.background, { paddingTop: insets.top, flex: 1 }]}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Join Community</Text>
            <TouchableOpacity onPress={() => setView('main')} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Back</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.label}>Enter Community Code</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., ABC123"
              placeholderTextColor="#64748b"
              value={joinCode}
              onChangeText={setJoinCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.primaryButton} onPress={handleJoinCommunity}>
              <Text style={styles.primaryButtonText}>Join</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // ================= MEMBER LIST =================
  if (view === 'memberList' && selectedCommunity) {
    return (
      <View style={styles.safeArea}>
        <LinearGradient
          colors={['rgba(15, 23, 42, 0.5)', 'rgba(30, 41, 59, 0.5)', 'rgba(15, 23, 42, 0.5)']}
          style={[styles.background, { paddingTop: insets.top, flex: 1 }]}
        >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setView('main')} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectedCommunity.name} Members</Text>
          <TouchableOpacity onPress={async () => {
             // ... [keeping existing logic]
          }} style={{ padding: 8 }}>
            <Text style={{ color: '#818cf8', fontSize: 12 }}>Test API</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollContent}>
          <View style={styles.content}>
            <Text style={styles.memberCountText}>
              {communityMembers.length} member{communityMembers.length !== 1 ? 's' : ''}
            </Text>

            {communityMembers.map((member, index) => (
              <View key={member.user_id} style={[styles.memberCard, index > 0 && styles.memberCardMargin]}>
                <TouchableOpacity
                  style={styles.memberMainContent}
                  onPress={() => {
                    if (userRoleInCommunity === 'HEAD' || member.profile_type === 'transparent') {
                      openMemberDetails(member);
                    }
                  }}
                >
                  <View style={styles.memberInfo}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>
                        {member.full_name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{member.full_name}</Text>
                      <Text style={styles.memberRole}>
                        {member.role === 'HEAD' ? '👑 Community Head' : '👤 Member'}
                      </Text>
                    </View>
                  </View>

                  {(userRoleInCommunity === 'HEAD' || member.profile_type === 'transparent') && (
                    <Icon name="chevron-right" size={20} color="#94a3b8" />
                  )}
                </TouchableOpacity>

                {userRoleInCommunity === 'HEAD' && member.role === 'MEMBER' && (
                  <TouchableOpacity
                    style={styles.promoteButton}
                    onPress={() => promoteMember(member)}
                  >
                    <Icon name="user-plus" size={16} color="#FFF" />
                    <Text style={styles.promoteButtonText}>Make Head</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
        </LinearGradient>
      </View>
    );
  }

  // ================= MEMBER DETAILS =================
  if (view === 'memberDetails' && selectedMember) {
    return (
      <View style={styles.safeArea}>
        <LinearGradient
          colors={['rgba(15, 23, 42, 0.5)', 'rgba(30, 41, 59, 0.5)', 'rgba(15, 23, 42, 0.5)']}
          style={[styles.background, { paddingTop: insets.top, flex: 1 }]}
        >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setView('memberList')} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Member Details</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.scrollContent}>
          <View style={styles.content}>
            <View style={styles.memberDetailCard}>
              <View style={styles.memberDetailAvatar}>
                <Text style={styles.memberDetailAvatarText}>
                  {selectedMember.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>

              <Text style={styles.memberDetailName}>{selectedMember.full_name}</Text>
              <Text style={styles.memberDetailRole}>
                {selectedMember.role === 'HEAD' ? '👑 Community Head' : '👤 Member'}
              </Text>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Profile Type</Text>
                <Text style={styles.detailValue}>
                  {selectedMember.profile_type === 'transparent' ? '🔓 Transparent' : '🔒 Private'}
                </Text>
              </View>

              {selectedMember.email && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Email</Text>
                  <Text style={styles.detailValue}>{selectedMember.email}</Text>
                </View>
              )}

              {selectedMember.mobile_number && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Mobile</Text>
                  <Text style={styles.detailValue}>{selectedMember.mobile_number}</Text>
                </View>
              )}

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Joined</Text>
                <Text style={styles.detailValue}>
                  {new Date(selectedMember.joined_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
        </LinearGradient>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  background: { flex: 1 },
  headerIcon: { fontSize: 24 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#f8fafc' },
  headerRight: { flexDirection: 'row' },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginLeft: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerButtonText: { color: '#cbd5e1', fontWeight: '600' },
  createHeaderButton: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
  },
  createButtonText: { color: '#FFF', fontWeight: '700' },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 16,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  activeTab: { backgroundColor: '#6366f1' },
  tabText: { color: '#94a3b8', fontWeight: '600' },
  activeTabText: { color: '#ffffff', fontWeight: '700' },
  scrollContent: { flex: 1 },
  content: { padding: 20 },
  communityCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  communityCardMargin: { marginTop: 0 },
  communityName: { fontSize: 20, fontWeight: '800', color: '#f8fafc', marginBottom: 6 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  codeText: { fontSize: 14, color: '#818cf8', fontWeight: '700', letterSpacing: 0.5 },
  headInfo: { marginTop: 6, color: '#94a3b8', fontWeight: '500' },
  formContainer: { padding: 20 },
  label: { marginBottom: 8, color: '#e2e8f0', fontWeight: '600', fontSize: 15 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    color: '#f8fafc',
    fontSize: 16,
  },
  sectionTitle: {
    marginTop: 24,
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 16,
  },
  featureCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 24,
    overflow: 'hidden',
  },
  featureItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  featureDesc: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    lineHeight: 18,
  },
  featureStatus: {
    fontSize: 12,
    color: '#818cf8',
    marginTop: 6,
    fontWeight: '600',
  },
  privateBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  privateBadgeText: {
    color: '#818cf8',
    fontWeight: '700',
    fontSize: 12,
  },
  createButtonFull: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 12,
    alignItems: 'center',
    marginBottom: 40,
  },
  createButtonTextFull: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
  },
  primaryButtonText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  emptyState: { alignItems: 'center', marginTop: 60 },

  // Member List Styles
  backButton: { padding: 8, marginLeft: -8 },
  memberCountText: { fontSize: 15, color: '#94a3b8', marginBottom: 20, textAlign: 'center', fontWeight: '600' },
  memberCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 0,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  memberCardMargin: { marginTop: 6 },
  memberMainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  memberAvatarText: { color: '#818cf8', fontSize: 20, fontWeight: '800' },
  memberName: { fontSize: 16, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
  memberRole: { fontSize: 13, color: '#10b981', fontWeight: '700' },
  promoteButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  promoteButtonText: {
    color: '#818cf8',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },

  memberPrivacy: { fontSize: 12, color: '#10b981', fontWeight: '600' },

  // Member Details Styles
  memberDetailCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  memberDetailAvatar: {
    width: 100,
    height: 100,
    borderRadius: 32,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  memberDetailAvatarText: { color: '#818cf8', fontSize: 40, fontWeight: '800' },
  memberDetailName: { fontSize: 24, fontWeight: '800', color: '#f8fafc', marginBottom: 8 },
  memberDetailRole: { fontSize: 16, color: '#10b981', marginBottom: 32, fontWeight: '700' },
  detailSection: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  detailLabel: { fontSize: 15, color: '#94a3b8', fontWeight: '600' },
  detailValue: { fontSize: 15, color: '#e2e8f0', fontWeight: '500' },

  // Chat button styles
  chatButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});