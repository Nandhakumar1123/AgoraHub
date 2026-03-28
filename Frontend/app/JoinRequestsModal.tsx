import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../lib/api';

interface RequestModel {
  user_id: number;
  name: string;
  email: string;
  mobile: string;
  location: string;
  profile_details: string;
  request_date: string;
}

interface JoinRequestsModalProps {
  communityId: number;
  visible: boolean;
  onClose: () => void;
  onCountUpdate: (count: number) => void;
}

export default function JoinRequestsModal({ communityId, visible, onClose, onCountUpdate }: JoinRequestsModalProps) {
  const [requests, setRequests] = useState<RequestModel[]>([]);
  const [loading, setLoading] = useState(true);

  // Poll for requests periodically
  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 15000); // 15s polling
    return () => clearInterval(interval);
  }, [communityId]);

  const fetchRequests = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/community/${communityId}/join_requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
        onCountUpdate(data.length);
      }
    } catch (err) {
      console.error("Error fetching join requests:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (endpoint: string, userIds: number[], successMessage: string) => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/community/${communityId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ user_ids: userIds })
      });
      if (response.ok) {
        await fetchRequests();
        if (Platform.OS === 'web') {
          window.alert(successMessage);
        } else {
          Alert.alert("Success", successMessage);
        }
      } else {
        const err = await response.json();
        if (Platform.OS === 'web') {
          window.alert(err.error || "Failed to process request");
        } else {
          Alert.alert("Error", err.error || "Failed to process request");
        }
      }
    } catch (error) {
      console.error(error);
      if (Platform.OS === 'web') {
        window.alert("A network error occurred.");
      } else {
        Alert.alert("Error", "A network error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  const approveOne = (userId: number) => {
    if (Platform.OS === 'web') {
      if (window.confirm("Approve this user?")) {
        handleAction('approve_requests', [userId], "User approved.");
      }
    } else {
      Alert.alert("Approve", "Approve this user?", [
        { text: "Cancel", style: "cancel" },
        { text: "Approve", onPress: () => handleAction('approve_requests', [userId], "User approved.") }
      ]);
    }
  };

  const rejectOne = (userId: number) => {
    if (Platform.OS === 'web') {
      if (window.confirm("Reject this user?")) {
        handleAction('reject_requests', [userId], "User rejected.");
      }
    } else {
      Alert.alert("Reject", "Reject this user?", [
        { text: "Cancel", style: "cancel" },
        { text: "Reject", style: "destructive", onPress: () => handleAction('reject_requests', [userId], "User rejected.") }
      ]);
    }
  };

  const approveAll = () => {
    if (requests.length === 0) return;
    if (Platform.OS === 'web') {
      if (window.confirm(`Approve all ${requests.length} pending requests?`)) {
        handleAction('approve_requests', requests.map(r => r.user_id), "All users approved.");
      }
    } else {
      Alert.alert("Approve All", `Approve all ${requests.length} pending requests?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Approve All", onPress: () => handleAction('approve_requests', requests.map(r => r.user_id), "All users approved.") }
      ]);
    }
  };

  const approveByDate = () => {
    if (requests.length === 0) return;
    // We group by date string
    const dates = [...new Set(requests.map(r => new Date(r.request_date).toDateString()))];
    if (dates.length === 0) return;
    
    // Simplistic choice: we just alert the most recent date as an option, or allow user to pick.
    // For React Native without extensive pickers, let's just approve "Today's" requests if any, else prompt.
    const todayStr = new Date().toDateString();
    let targetDate = todayStr;
    let targetRequests = requests.filter(r => new Date(r.request_date).toDateString() === targetDate);
    
    if (targetRequests.length === 0) {
      targetDate = dates[0];
      targetRequests = requests.filter(r => new Date(r.request_date).toDateString() === targetDate);
    }

    if (Platform.OS === 'web') {
      if (window.confirm(`Approve ${targetRequests.length} requests from ${targetDate}?`)) {
        handleAction('approve_requests', targetRequests.map(r => r.user_id), `Approved requests for ${targetDate}`);
      }
    } else {
      Alert.alert("Approve By Date", `Approve ${targetRequests.length} requests from ${targetDate}?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Approve", onPress: () => handleAction('approve_requests', targetRequests.map(r => r.user_id), `Approved requests for ${targetDate}`) }
      ]);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Join Requests</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>X</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={approveAll}>
              <Text style={styles.actionBtnText}>✅ Approve All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnDate} onPress={approveByDate}>
              <Text style={styles.actionBtnText}>📅 Approve by Date</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 20 }} />
          ) : (
            <ScrollView style={styles.list}>
              {requests.length === 0 ? (
                <Text style={styles.emptyText}>No pending join requests.</Text>
              ) : (
                requests.map(req => (
                  <View key={req.user_id} style={styles.card}>
                    <Text style={styles.name}>{req.name}</Text>
                    <Text style={styles.info}>Email: {req.email}</Text>
                    <Text style={styles.info}>Mobile: {req.mobile || 'N/A'}</Text>
                    <Text style={styles.info}>Location/Profile: {req.location || req.profile_details || 'N/A'}</Text>
                    <Text style={styles.info}>Date: {new Date(req.request_date).toLocaleString()}</Text>
                    <View style={styles.cardActions}>
                      <TouchableOpacity style={styles.approveBtn} onPress={() => approveOne(req.user_id)}>
                        <Text style={styles.btnText}>✅ Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectOne(req.user_id)}>
                        <Text style={styles.btnText}>❌ Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  closeButton: {
    fontSize: 18,
    color: '#94a3b8',
    padding: 5,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  actionBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    flex: 1,
    marginRight: 5,
    alignItems: 'center'
  },
  actionBtnDate: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    flex: 1,
    marginLeft: 5,
    alignItems: 'center'
  },
  actionBtnText: {
    color: 'white',
    fontWeight: 'bold',
  },
  list: {
    marginBottom: 10,
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 20,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  info: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 2,
  },
  cardActions: {
    flexDirection: 'row',
    marginTop: 10,
    justifyContent: 'flex-end'
  },
  approveBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 6,
    marginLeft: 10,
  },
  rejectBtn: {
    backgroundColor: '#ef4444',
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 6,
    marginLeft: 10,
  },
  btnText: {
    color: 'white',
    fontWeight: 'bold',
  }
});
