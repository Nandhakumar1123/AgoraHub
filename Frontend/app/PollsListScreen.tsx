import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    SafeAreaView,
    Dimensions,
    Modal,
    Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL } from '../lib/api';
import PollChatIntimation from './PollChatIntimation';
import PollCreateScreen from './PollCreateScreen';

const { width } = Dimensions.get('window');

const PollsListScreen = () => {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { communityId, community, isAdmin } = route.params;

    const [polls, setPolls] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pollModalVisible, setPollModalVisible] = useState(false);

    useEffect(() => {
        fetchPolls();
    }, []);

    const fetchPolls = async () => {
        try {
            if (!refreshing) setLoading(true);
            const token = await AsyncStorage.getItem('authToken');
            const response = await fetch(`${API_BASE_URL}/communities/${communityId}/polls`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setPolls(data);
            } else {
                console.error('Failed to fetch polls:', response.status);
            }
        } catch (error) {
            console.error('Error fetching polls:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchPolls();
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.pollCardContainer}>
            <PollChatIntimation
                communityId={Number(communityId)}
                pollId={item.poll_id}
                isAdmin={isAdmin}
                onOpenPoll={(pId) => {
                    navigation.navigate('PollVoteScreen' as any, {
                        communityId: Number(communityId),
                        pollId: pId,
                        isAdmin: isAdmin,
                    });
                }}
            />
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient
                colors={['#075E54', '#128C7E']}
                style={styles.header}
            >
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backArrow}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Polling</Text>
                <View style={{ width: 40 }} />
            </LinearGradient>

            {loading && !refreshing ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#128C7E" />
                    <Text style={styles.loadingText}>Fetching polls...</Text>
                </View>
            ) : (
                <FlatList
                    data={polls}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.poll_id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#128C7E']} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No polls available in this community yet.</Text>
                        </View>
                    }
                />
            )}

            {isAdmin && (
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => setPollModalVisible(true)}
                >
                    <Text style={styles.fabIcon}>+</Text>
                </TouchableOpacity>
            )}

            <Modal
                visible={pollModalVisible}
                animationType="slide"
                onRequestClose={() => setPollModalVisible(false)}
            >
                <PollCreateScreen
                    communityId={String(communityId)}
                    onCancel={() => setPollModalVisible(false)}
                    onCreated={(newPoll) => {
                        setPollModalVisible(false);
                        fetchPolls();
                    }}
                />
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ECE5DD',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    backButton: {
        padding: 8,
    },
    backArrow: {
        fontSize: 24,
        color: 'white',
        fontWeight: 'bold',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: 'white',
    },
    listContent: {
        paddingBottom: 80,
        paddingTop: 10,
    },
    pollCardContainer: {
        marginBottom: 10,
        paddingHorizontal: 10,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#25D366',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    fabIcon: {
        fontSize: 30,
        color: 'white',
        fontWeight: 'bold',
    },
});

export default PollsListScreen;
