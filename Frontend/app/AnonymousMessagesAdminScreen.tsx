import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
    RefreshControl,
    Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../lib/api';

interface AnonymousMessage {
    message_id: number;
    community_id: number;
    text: string;
    created_at: string;
    status: 'unread' | 'read' | 'replied';
    reply_count: number;
}

export default function AnonymousMessagesAdminScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { communityId, communityName } = route.params;

    const [messages, setMessages] = useState<AnonymousMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchMessages = useCallback(async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('authToken');
            if (!token) return;

            const response = await fetch(`${API_BASE_URL}/communities/${communityId}/anonymous-messages`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setMessages(data);
            } else {
                console.error('Failed to fetch messages');
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [communityId]);

    useEffect(() => {
        fetchMessages();
    }, [fetchMessages]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchMessages();
    };

    const handleMessagePress = (message: AnonymousMessage) => {
        navigation.navigate('AnonymousThreadScreen', {
            rootMessage: message,
            communityId,
            isAdmin: true,
        });
    };

    const renderItem = ({ item }: { item: AnonymousMessage }) => (
        <TouchableOpacity
            style={[styles.messageCard, item.status === 'unread' && styles.unreadCard]}
            onPress={() => handleMessagePress(item)}
        >
            <View style={styles.cardHeader}>
                <View style={[styles.statusBadge, item.status === 'replied' ? styles.repliedBadge : (item.status === 'unread' ? styles.unreadBadge : styles.readBadge)]}>
                    <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
                </View>
                <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>

            <Text style={styles.messagePreview} numberOfLines={2}>
                {item.text}
            </Text>

            <View style={styles.cardFooter}>
                <Text style={styles.replyCount}>
                    {item.reply_count} {item.reply_count === 1 ? 'reply' : 'replies'}
                </Text>
                <Text style={styles.viewThread}>View Thread →</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backArrow}>←</Text>
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>Anonymous Messages</Text>
                    <Text style={styles.headerSubtitle}>{communityName}</Text>
                </View>
            </View>

            {loading && !refreshing ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#007AFF" />
                </View>
            ) : (
                <FlatList
                    data={messages}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.message_id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No anonymous messages received yet.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    backButton: {
        marginRight: 16,
        padding: 4,
    },
    backArrow: {
        fontSize: 24,
        color: '#007AFF',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1A1A1A',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#666666',
    },
    listContent: {
        padding: 16,
    },
    messageCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#EEEEEE',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    unreadCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#007AFF',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    unreadBadge: {
        backgroundColor: '#E3F2FD',
    },
    readBadge: {
        backgroundColor: '#F5F5F5',
    },
    repliedBadge: {
        backgroundColor: '#E8F5E9',
    },
    statusText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#666666',
    },
    dateText: {
        fontSize: 12,
        color: '#999999',
    },
    messagePreview: {
        fontSize: 16,
        color: '#333333',
        lineHeight: 22,
        marginBottom: 12,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    replyCount: {
        fontSize: 12,
        color: '#666666',
    },
    viewThread: {
        fontSize: 14,
        color: '#007AFF',
        fontWeight: '600',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#999999',
        textAlign: 'center',
    },
});
