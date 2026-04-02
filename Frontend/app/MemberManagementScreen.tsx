import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, SafeAreaView, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../lib/api';
import { LinearGradient } from 'expo-linear-gradient';
import { Trash2 } from 'lucide-react-native';
import { jwtDecode } from 'jwt-decode';

interface Member {
  user_id: number;
  full_name: string;
  email: string;
  mobile_number: string;
  role: string;
  profile_type: string;
  joined_at: string;
}

export default function MemberManagementScreen() {
  const { communityId } = useLocalSearchParams();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [userRoleInCommunity, setUserRoleInCommunity] = useState<'HEAD' | 'MEMBER' | null>(null);
  const [communityCreatorId, setCommunityCreatorId] = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, [communityId]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/community_members/${communityId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setMembers(data.members || []);
        setFilteredMembers(data.members || []);
        setUserRoleInCommunity(data.user_role || null);
        setCommunityCreatorId(data.creator_user_id ?? null);

        try {
          if (token) {
            const decodedToken: any = jwtDecode(token);
            setCurrentUserId(decodedToken.user_id ?? null);
          }
        } catch (e) {
          // If decoding fails, we can still function (only self-demote hiding will be affected)
          setCurrentUserId(null);
        }
      } else {
        Alert.alert('Error', data.error || 'Failed to fetch members');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to connect to the server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredMembers(members);
      return;
    }
    const filtered = members.filter(member => 
      member.full_name.toLowerCase().includes(query.toLowerCase()) ||
      member.email.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredMembers(filtered);
  };

  const removeMember = async (userId: number, userName: string) => {
    const performRemove = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/community_members/${communityId}/${userId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        if (response.ok) {
          if (Platform.OS === 'web') {
            window.alert('Member removed successfully');
          } else {
            Alert.alert('Success', 'Member removed successfully');
          }
          fetchMembers();
        } else {
          Alert.alert('Error', data.error || 'Failed to remove member');
        }
      } catch (error) {
        console.error(error);
        Alert.alert('Error', 'A network error occurred');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to remove ${userName} from this community?`)) {
        performRemove();
      }
    } else {
      Alert.alert(
        'Remove Member',
        `Are you sure you want to remove ${userName} from this community?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: performRemove }
        ]
      );
    }
  };

  const promoteMember = async (userId: number, userName: string) => {
    if (userRoleInCommunity !== 'HEAD') return;
    if (communityCreatorId == null || currentUserId == null) return;
    if (currentUserId !== communityCreatorId) return; // only permanent head
    const isCreator = communityCreatorId != null && userId === communityCreatorId;
    if (isCreator) return; // already permanent head

    const performPromote = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/communities/${communityId}/promote_member`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ member_id: userId }),
        });
        const data = await response.json();
        if (response.ok) {
          Alert.alert('Success', `${userName} promoted to Head.`);
          fetchMembers();
        } else {
          Alert.alert('Error', data.error || 'Failed to promote member');
        }
      } catch (error) {
        console.error(error);
        Alert.alert('Error', 'A network error occurred');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Promote ${userName} to Head?`)) performPromote();
    } else {
      Alert.alert(
        'Promote to Head',
        `Promote ${userName} to Head?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Promote', onPress: performPromote },
        ]
      );
    }
  };

  const demoteHead = async (userId: number, userName: string) => {
    if (userRoleInCommunity !== 'HEAD') return;
    if (communityCreatorId == null || currentUserId == null) return;
    if (currentUserId !== communityCreatorId) return; // only permanent head
    const isCreator = communityCreatorId != null && userId === communityCreatorId;
    if (isCreator) return;
    if (currentUserId != null && userId === currentUserId) return; // "demote another head"

    const performDemote = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/communities/${communityId}/demote_member`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ member_id: userId }),
        });
        const data = await response.json();
        if (response.ok) {
          Alert.alert('Success', `${userName} demoted to Member.`);
          fetchMembers();
        } else {
          Alert.alert('Error', data.error || 'Failed to demote head');
        }
      } catch (error) {
        console.error(error);
        Alert.alert('Error', 'A network error occurred');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Demote ${userName} to Member?`)) performDemote();
    } else {
      Alert.alert(
        'Demote Head',
        `Demote ${userName} to Member?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Demote', style: 'destructive', onPress: performDemote },
        ]
      );
    }
  };

  const renderMember = ({ item }: { item: Member }) => (
    <View style={styles.memberCard}>
      <View style={styles.memberAvatar}>
        <Text style={styles.avatarText}>{item.full_name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.full_name}</Text>
        <Text style={styles.memberEmail}>{item.email}</Text>
        <Text style={styles.memberRole}>{item.role}</Text>
        <Text style={styles.joinDate}>Joined: {new Date(item.joined_at).toLocaleDateString()}</Text>
      </View>
      <View style={styles.actionsColumn}>
        {userRoleInCommunity === 'HEAD' &&
         communityCreatorId != null &&
         currentUserId != null &&
         currentUserId === communityCreatorId &&
         item.role === 'MEMBER' && (
          <TouchableOpacity
            onPress={() => promoteMember(item.user_id, item.full_name)}
            style={styles.promoteButton}
          >
            <Text style={styles.promoteButtonText}>Make Head</Text>
          </TouchableOpacity>
        )}

        {userRoleInCommunity === 'HEAD' &&
         communityCreatorId != null &&
         currentUserId != null &&
         currentUserId === communityCreatorId &&
         item.role === 'HEAD' &&
         item.user_id !== communityCreatorId &&
         item.user_id !== currentUserId && (
          <TouchableOpacity
            onPress={() => demoteHead(item.user_id, item.full_name)}
            style={styles.demoteButton}
          >
            <Text style={styles.demoteButtonText}>Demote</Text>
          </TouchableOpacity>
        )}

        {userRoleInCommunity === 'HEAD' &&
         communityCreatorId != null &&
         currentUserId != null &&
         currentUserId === communityCreatorId &&
         item.role !== 'HEAD' && (
          item.user_id === communityCreatorId ? null : (
            <TouchableOpacity
              onPress={() => removeMember(item.user_id, item.full_name)}
              style={styles.removeButton}
            >
              <Trash2 size={24} color="#ef4444" />
            </TouchableOpacity>
          )
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Manage Members</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchBar}
            placeholder="Search members..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : (
          <FlatList
            data={filteredMembers}
            keyExtractor={(item) => item.user_id.toString()}
            renderItem={renderMember}
            contentContainerStyle={styles.listContent}
            onRefresh={fetchMembers}
            refreshing={refreshing}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No members found</Text>
              </View>
            }
          />
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    margin: 16,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchBar: {
    flex: 1,
    color: '#fff',
    paddingVertical: 10,
    fontSize: 16,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderBottomColor: '#334155',
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  memberEmail: {
    color: '#94a3b8',
    fontSize: 14,
  },
  memberRole: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  joinDate: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  removeButton: {
    padding: 8,
  },
  actionsColumn: {
    width: 120,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  promoteButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: 'rgba(99, 102, 241, 0.35)',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  promoteButtonText: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '700',
  },
  demoteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  demoteButtonText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
  },
});
