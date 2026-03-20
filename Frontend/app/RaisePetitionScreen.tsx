import React, { useState, useEffect, useCallback } from 'react';
import { View, Alert, Platform, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Dimensions, Modal } from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { API_BASE_URL } from '../lib/api';
import nlpService from '../lib/nlpService';

const BASE_URL = API_BASE_URL;
const { width } = Dimensions.get('window');

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

interface Petition {
    petition_id: number;
    title: string;
    summary: string;
    proposed_action: string;
    goal_type: string;
    impact_area: string;
    priority_level: string;
    status: string;
    created_at: string;
    author_id: number;
}

const RaisePetitionScreen: React.FC = () => {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const communityId = route.params?.communityId || route.params?.community_id;
    const communityName = route.params?.communityName || 'Community';
    const visibility = route.params?.visibility || 'public';

    // Tabs
    const [activeTab, setActiveTab] = useState<'raise' | 'my_petitions' | 'review'>('raise');
    const [userRole, setUserRole] = useState<string | null>(null);

    // Review Tab State
    const [allPetitions, setAllPetitions] = useState<Petition[]>([]);
    const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'month' | 'all' | 'particular_day' | 'particular_month'>('all');
    const [filterDate, setFilterDate] = useState<string>('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiModalVisible, setAiModalVisible] = useState(false);
    const [selectedPetition, setSelectedPetition] = useState<Petition | null>(null);
    const [aiRecommendation, setAiRecommendation] = useState<{ recommendation: string; justification: string; remarks: string } | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        summary: '',
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

    // My Petitions State
    const [myPetitions, setMyPetitions] = useState<Petition[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);

    const fetchUserRole = async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            if (token && communityId) {
                const decoded: any = jwtDecode(token);
                const userId = decoded.user_id;
                setCurrentUserId(userId);

                const response = await fetch(`${API_BASE_URL}/community_members/${communityId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    const myMember = data.members.find((m: any) => m.user_id === userId);
                    if (myMember) {
                        setUserRole(myMember.role);
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching role:', err);
        }
    };

    useEffect(() => {
        fetchUserRole();
    }, [communityId]);

    const fetchMyPetitions = useCallback(async () => {
        if (!communityId) return;
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('authToken');
            if (!token) return;

            let uId = currentUserId;
            if (!uId) {
                const decoded: any = jwtDecode(token);
                uId = decoded.user_id;
                setCurrentUserId(uId);
            }

            const response = await axios.get(`${BASE_URL}/petitions/${communityId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const list = Array.isArray(response.data) ? response.data : response.data?.petitions || [];
            const userPetitions = list.filter((p: any) => p.author_id === uId);
            setMyPetitions(userPetitions);
        } catch (error: any) {
            console.error('Error fetching petitions:', error);
        } finally {
            setLoading(false);
        }
    }, [communityId, currentUserId]);

    const fetchAllPetitions = useCallback(async () => {
        if (!communityId) return;
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('authToken');
            let url = `${BASE_URL}/petitions/${communityId}?filter=${dateFilter}`;
            if (dateFilter === 'particular_day') url += `&date=${filterDate}`;
            if (dateFilter === 'particular_month') url += `&month=${filterDate}`;
            const response = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const list = Array.isArray(response.data) ? response.data : response.data?.petitions || [];
            setAllPetitions(list);
        } catch (error) {
            console.error('Error fetching all petitions:', error);
        } finally {
            setLoading(false);
        }
    }, [communityId, dateFilter, filterDate]);

    useFocusEffect(
        useCallback(() => {
            if (activeTab === 'my_petitions') fetchMyPetitions();
            if (activeTab === 'review') fetchAllPetitions();
        }, [activeTab, fetchMyPetitions, fetchAllPetitions])
    );

    useEffect(() => {
        if (activeTab === 'my_petitions') fetchMyPetitions();
        if (activeTab === 'review') fetchAllPetitions();
    }, [activeTab, fetchMyPetitions, fetchAllPetitions]);

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
            if (!formData.title || !formData.proposedAction || !formData.goalType || !formData.impactArea) {
                Alert.alert('Error', 'Please fill in all required fields (title, proposed action, goal type, impact area).');
                return;
            }

            const petitionData = {
                title: formData.title,
                summary: formData.summary || null,
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
                // Reset form immediately after successful submission
                setFormData({
                    title: '',
                    summary: '',
                    proposedAction: '',
                    goalType: '',
                    otherGoalType: '',
                    impactArea: '',
                    otherImpactArea: '',
                    affectedGroups: [],
                    priorityLevel: 'normal',
                    referenceContext: '',
                });

                Alert.alert('Success', 'Petition submitted successfully!', [
                    {
                        text: 'OK', onPress: () => {
                            fetchMyPetitions();
                            setActiveTab('my_petitions');
                        }
                    }
                ]);
            }
        } catch (error: any) {
            console.error('Error creating petition:', error);
            const errorMessage = error.response?.data?.error || 'Failed to create petition. Please try again.';
            Alert.alert('Error', errorMessage);
        }
    };

    const handleAIReview = async (petition: Petition) => {
        setSelectedPetition(petition);
        setIsAiLoading(true);
        setAiModalVisible(true);
        try {
            const res = await nlpService.suggestAction(petition.petition_id, 'petition', Number(communityId));
            if (res.success && res.data.suggestion) {
                const text = res.data.suggestion;
                const recommendation = text.match(/Recommendation:\s*(.*)/)?.[1] || "";
                const justification = text.match(/Justification:\s*(.*)/)?.[1] || "";
                const remarks = text.match(/Suggested Remarks:\s*(.*)/)?.[1] || "";
                setAiRecommendation({ recommendation, justification, remarks });
            }
        } catch (error) {
            console.error('AI Review error:', error);
            Alert.alert('Error', 'AI service is currently unavailable.');
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleUpdateStatus = async (petitionId: number, status: string, remarks: string = '') => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('authToken');
            await axios.put(`${BASE_URL}/petitions/${petitionId}/status`,
                { status, remarks },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            Alert.alert('Success', `Petition ${status}`);
            setAiModalVisible(false);
            fetchAllPetitions();
        } catch (error) {
            Alert.alert('Error', 'Failed to update status');
        } finally {
            setLoading(false);
        }
    };

    const handleAIDecision = async (petitionId: number) => {
        try {
            setIsAiLoading(true);
            const token = await AsyncStorage.getItem('authToken');
            const response = await axios.post(
                `${BASE_URL}/petitions/${petitionId}/ai-process`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                Alert.alert(
                    'AI Decision Complete',
                    `Verdict: ${response.data.status}\n\n${response.data.analysis.llmSummary || ''}`
                );
                fetchAllPetitions();
            }
        } catch (error: any) {
            console.error('Error triggering AI decision:', error);
            const errMsg = error.response?.data?.error || 'Failed to process AI decision';
            Alert.alert('Error', errMsg);
        } finally {
            setIsAiLoading(false);
        }
    };

    const getFilteredPetitions = () => {
        // Backend handles filtering now
        return allPetitions;
    };

    const renderStatusBadge = (status: string) => {
        let bgColor = '#E5E7EB';
        let textColor = '#374151';
        let label = status;

        // Normalize and map statuses
        const normalized = (status || 'Pending').toUpperCase().replace(/\s/g, '_');

        switch (normalized) {
            case 'REVIEW':
            case 'PENDING':
            case 'INPROGRESS':
            case 'IN_PROGRESS':
            case 'OPEN':
                bgColor = '#FEF3C7';
                textColor = '#92400E';
                label = 'Pending';
                break;
            case 'APPROVED':
                bgColor = '#D1FAE5';
                textColor = '#065F46';
                label = 'Approved';
                break;
            case 'REJECTED':
                bgColor = '#FEE2E2';
                textColor = '#991B1B';
                label = 'Rejected';
                break;
            default:
                bgColor = '#FEF3C7';
                textColor = '#92400E';
                label = 'Pending';
        }

        return (
            <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
                <Text style={[styles.statusText, { color: textColor }]}>{label}</Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Community Petitions</Text>
                <Text style={styles.subtitle}>{communityName} • {visibility}</Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'raise' && styles.activeTab]}
                    onPress={() => setActiveTab('raise')}
                >
                    <Text style={[styles.tabText, activeTab === 'raise' && styles.activeTabText]}>Raise Petition</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'my_petitions' && styles.activeTab]}
                    onPress={() => setActiveTab('my_petitions')}
                >
                    <Text style={[styles.tabText, activeTab === 'my_petitions' && styles.activeTabText]}>My Status</Text>
                </TouchableOpacity>
                {(userRole === 'HEAD' || userRole === 'ADMIN') && (
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'review' && styles.activeTab]}
                        onPress={() => setActiveTab('review')}
                    >
                        <Text style={[styles.tabText, activeTab === 'review' && styles.activeTabText]}>Review Requests</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Content */}
            {activeTab === 'raise' ? (
                <ScrollView style={styles.content}>
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
                        <View style={{ height: 40 }} />
                    </View>
                </ScrollView>
            ) : activeTab === 'my_petitions' ? (
                <ScrollView style={styles.content}>
                    {loading ? (
                        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 40 }} />
                    ) : myPetitions.length === 0 ? (
                        <View style={styles.emptyStateContainer}>
                            <Text style={styles.emptyStateIcon}>📋</Text>
                            <Text style={styles.emptyStateText}>You haven't raised any petitions yet.</Text>
                        </View>
                    ) : (
                        <View style={styles.listContainer}>
                            {myPetitions.map(item => (
                                <TouchableOpacity
                                    key={item.petition_id}
                                    style={styles.itemCard}
                                    onPress={() => navigation.navigate('PetitionDetailsScreen', {
                                        petitionId: item.petition_id,
                                        communityId: communityId
                                    })}
                                >
                                    <View style={styles.itemHeader}>
                                        <Text style={styles.itemTitle}>{item.title}</Text>
                                        {renderStatusBadge(item.status || 'Pending')}
                                    </View>
                                    <Text style={styles.itemDescription} numberOfLines={2}>
                                        {item.summary}
                                    </Text>
                                    <View style={styles.itemFooter}>
                                        <Text style={styles.itemCategory}>{item.goal_type || 'other'}</Text>
                                        <Text style={styles.itemDate}>
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                    <View style={{ height: 40 }} />
                </ScrollView>
            ) : (
                <ScrollView style={styles.content}>
                    <View style={styles.filterBar}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
                            {(['all', 'today', 'yesterday', 'month', 'particular_day', 'particular_month'] as const).map(f => (
                                <TouchableOpacity
                                    key={f}
                                    style={[styles.filterBtn, dateFilter === f && styles.activeFilterBtn]}
                                    onPress={() => setDateFilter(f)}
                                >
                                    <Text style={[styles.filterBtnText, dateFilter === f && styles.activeFilterBtnText]}>
                                        {f === 'particular_day' ? 'Day' : f === 'particular_month' ? 'Month' : f.charAt(0).toUpperCase() + f.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {(dateFilter === 'particular_day' || dateFilter === 'particular_month') && (
                        <View style={styles.dateInputContainer}>
                            <TextInput
                                style={styles.dateInput}
                                placeholder={dateFilter === 'particular_day' ? "YYYY-MM-DD" : "YYYY-MM"}
                                value={filterDate}
                                onChangeText={setFilterDate}
                            />
                            <TouchableOpacity style={styles.applyBtn} onPress={fetchAllPetitions}>
                                <Text style={styles.applyBtnText}>Apply</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {loading ? (
                        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 40 }} />
                    ) : getFilteredPetitions().length === 0 ? (
                        <View style={styles.emptyStateContainer}>
                            <Text style={styles.emptyStateIcon}>📋</Text>
                            <Text style={styles.emptyStateText}>No pending petitions found for this period.</Text>
                        </View>
                    ) : (
                        <View style={styles.listContainer}>
                            {getFilteredPetitions().map(item => (
                                <View key={item.petition_id} style={styles.itemCard}>
                                    <View style={styles.itemHeader}>
                                        <Text style={styles.itemTitle}>{item.title}</Text>
                                        {renderStatusBadge(item.status || 'Pending')}
                                    </View>
                                    <Text style={styles.itemDescription} numberOfLines={3}>{item.summary}</Text>

                                    {(!item.status || !['APPROVED', 'REJECTED'].includes(item.status.toUpperCase().replace(/\s/g, '_'))) && (
                                        <View style={styles.headActions}>
                                            <View style={{ flexDirection: 'row' }}>
                                                <TouchableOpacity
                                                    style={styles.aiReviewBtn}
                                                    onPress={() => handleAIReview(item)}
                                                >
                                                    <Text style={styles.aiReviewBtnText}>🤖 Insights</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.aiDecisionBtn}
                                                    onPress={() => handleAIDecision(item.petition_id)}
                                                    disabled={isAiLoading}
                                                >
                                                    <Text style={styles.aiDecisionBtnText}>⚡ AI Decision</Text>
                                                </TouchableOpacity>
                                            </View>
                                            <View style={{ flexDirection: 'row', gap: 6 }}>
                                                <TouchableOpacity
                                                    style={[styles.statusBtn, styles.approveBtnMini]}
                                                    onPress={() => handleUpdateStatus(item.petition_id, 'Approved')}
                                                >
                                                    <Text style={styles.statusBtnSmallText}>Approve</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.statusBtn, styles.rejectBtnMini]}
                                                    onPress={() => handleUpdateStatus(item.petition_id, 'Rejected')}
                                                >
                                                    <Text style={styles.statusBtnSmallText}>Reject</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            ))}
                        </View>
                    )}
                </ScrollView>
            )}

            {/* AI Recommendation Modal */}
            <Modal
                visible={aiModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setAiModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>AI review Recommendations</Text>
                        <ScrollView style={styles.modalScroll}>
                            {isAiLoading ? (
                                <View style={styles.loadingAi}>
                                    <ActivityIndicator size="large" color="#3b82f6" />
                                    <Text style={styles.aiText}>Analyzing petition...</Text>
                                </View>
                            ) : aiRecommendation ? (
                                <View>
                                    <Text style={styles.recTitle}>AI Recommendation: {aiRecommendation.recommendation}</Text>
                                    <Text style={styles.recSection}>Justification:</Text>
                                    <Text style={styles.recText}>{aiRecommendation.justification}</Text>
                                    <Text style={styles.recSection}>Suggested Remarks:</Text>
                                    <Text style={styles.recText}>{aiRecommendation.remarks}</Text>

                                    <View style={styles.modalActionRow}>
                                        <TouchableOpacity
                                            style={[styles.modalActionBtn, styles.modalApproveBtn]}
                                            onPress={() => selectedPetition && handleUpdateStatus(selectedPetition.petition_id, 'Approved', aiRecommendation.remarks)}
                                        >
                                            <Text style={styles.modalActionText}>Approve</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.modalActionBtn, styles.modalRejectBtn]}
                                            onPress={() => selectedPetition && handleUpdateStatus(selectedPetition.petition_id, 'Rejected', aiRecommendation.remarks)}
                                        >
                                            <Text style={styles.modalActionText}>Reject</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : null}
                        </ScrollView>
                        <TouchableOpacity style={styles.closeBtn} onPress={() => setAiModalVisible(false)}>
                            <Text style={styles.closeBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    header: {
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        padding: 20,
        paddingTop: 55,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#f8fafc',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
        marginTop: 6,
        fontWeight: '500',
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(30, 41, 59, 0.7)',
        marginTop: 20,
        marginHorizontal: 16,
        borderRadius: 16,
        padding: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 12,
    },
    activeTab: {
        backgroundColor: '#6366f1',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#94a3b8',
    },
    activeTabText: {
        color: '#ffffff',
        fontWeight: '700',
    },
    content: {
        flex: 1,
    },
    form: {
        padding: 20,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 15,
        fontWeight: '600',
        color: '#e2e8f0',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: 16,
        fontSize: 15,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        color: '#f8fafc',
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    priorityContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    priorityButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        alignItems: 'center',
    },
    priorityButtonActive: {
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderColor: '#818cf8',
    },
    priorityText: {
        fontSize: 14,
        color: '#94a3b8',
        fontWeight: '600',
    },
    priorityTextActive: {
        color: '#818cf8',
        fontWeight: '700',
    },
    submitButton: {
        backgroundColor: '#6366f1',
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 24,
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    submitText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    dateInputContainer: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: 'transparent',
        alignItems: 'center',
    },
    dateInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 12,
        marginRight: 12,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        color: '#f8fafc',
        fontSize: 15,
    },
    applyBtn: {
        backgroundColor: '#6366f1',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 12,
    },
    applyBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
    dropdownButton: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: 16,
    },
    dropdownButtonText: {
        fontSize: 15,
        color: '#f8fafc',
    },
    dropdownArrow: {
        fontSize: 12,
        color: "#6b7280",
    },
    dropdownList: {
        backgroundColor: "#1e293b",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        borderTopWidth: 0,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        maxHeight: 200,
        overflow: 'hidden',
    },
    dropdownItem: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.05)",
    },
    dropdownItemText: {
        fontSize: 15,
        color: "#e2e8f0",
    },
    listContainer: {
        padding: 20,
    },
    itemCard: {
        backgroundColor: 'rgba(30, 41, 59, 0.7)',
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    itemTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#f8fafc',
        flex: 1,
        marginRight: 12,
        lineHeight: 24,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '800',
    },
    itemDescription: {
        fontSize: 14,
        color: '#cbd5e1',
        marginBottom: 16,
        lineHeight: 22,
    },
    itemFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
        paddingTop: 16,
    },
    itemCategory: {
        fontSize: 12,
        color: '#818cf8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontWeight: '700',
    },
    itemDate: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
    emptyStateContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
    },
    emptyStateIcon: {
        fontSize: 56,
        marginBottom: 20,
        opacity: 0.8,
    },
    emptyStateText: {
        fontSize: 16,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 24,
    },
    // New Styles for Review Tab
    filterBar: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: 'transparent',
    },
    filterBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginRight: 8,
        borderRadius: 20,
        alignItems: 'center',
        backgroundColor: 'rgba(30, 41, 59, 0.7)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    activeFilterBtn: {
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderColor: 'rgba(99, 102, 241, 0.3)',
    },
    filterBtnText: {
        fontSize: 13,
        color: '#94a3b8',
        fontWeight: '600',
    },
    activeFilterBtnText: {
        color: '#818cf8',
        fontWeight: '700',
    },
    headActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    aiReviewBtn: {
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.3)',
    },
    aiReviewBtnText: {
        color: '#a78bfa',
        fontSize: 13,
        fontWeight: '700',
    },
    aiDecisionBtn: {
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.3)',
        marginLeft: 8,
    },
    aiDecisionBtnText: {
        color: '#818cf8',
        fontSize: 13,
        fontWeight: '700',
    },
    statusBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        justifyContent: 'center',
    },
    approveBtnMini: {
        backgroundColor: '#10b981',
    },
    rejectBtnMini: {
        backgroundColor: '#ef4444',
    },
    statusBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    statusBtnSmallText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1e293b',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '90%',
        paddingBottom: 40,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#f8fafc',
        marginBottom: 20,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    modalScroll: {
        marginBottom: 20,
    },
    loadingAi: {
        padding: 40,
        alignItems: 'center',
    },
    aiText: {
        marginTop: 16,
        color: '#94a3b8',
        fontSize: 15,
        fontWeight: '500',
    },
    recTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#f8fafc',
        marginBottom: 16,
        lineHeight: 24,
    },
    recSection: {
        fontWeight: '700',
        color: '#818cf8',
        marginTop: 16,
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    recText: {
        color: '#cbd5e1',
        fontSize: 15,
        marginTop: 6,
        lineHeight: 24,
    },
    modalActionRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 32,
    },
    modalActionBtn: {
        flex: 1,
        padding: 16,
        borderRadius: 14,
        alignItems: 'center',
    },
    modalApproveBtn: {
        backgroundColor: '#10b981',
    },
    modalRejectBtn: {
        backgroundColor: '#ef4444',
    },
    modalActionText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 15,
    },
    closeBtn: {
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
        backgroundColor: 'rgba(30, 41, 59, 0.8)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    closeBtnText: {
        color: '#94a3b8',
        fontWeight: '700',
        fontSize: 15,
    }
});

export default RaisePetitionScreen;
