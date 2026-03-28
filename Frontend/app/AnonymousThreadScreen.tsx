import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    StatusBar,
    Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../lib/api';

interface Message {
    message_id: number;
    text: string;
    created_at: string;
    is_from_head: boolean;
    head_name?: string;
}

export default function AnonymousThreadScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { rootMessage, isAdmin } = route.params;

    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    const fetchThread = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            if (!token) return;

            const response = await fetch(`${API_BASE_URL}/anonymous-messages/${rootMessage.message_id}/thread`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setMessages(data);
            } else {
                Alert.alert('Error', 'Failed to fetch conversation thread');
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    }, [rootMessage.message_id]);

    useEffect(() => {
        fetchThread();
    }, [fetchThread]);

    const handleSendReply = async () => {
        if (!replyText.trim() || sending) return;

        try {
            setSending(true);
            const token = await AsyncStorage.getItem('authToken');
            if (!token) return;

            const response = await fetch(`${API_BASE_URL}/anonymous-messages/${rootMessage.message_id}/reply`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    text: replyText.trim(),
                }),
            });

            if (response.ok) {
                setReplyText('');
                fetchThread(); // Refresh thread
            } else {
                Alert.alert('Error', 'Failed to send reply');
            }
        } catch (error) {
            console.error('Error:', error);
            Alert.alert('Error', 'Something went wrong');
        } finally {
            setSending(false);
        }
    };

    const renderMessage = ({ item, index }: { item: Message; index: number }) => {
        const isMe = isAdmin ? item.is_from_head : !item.is_from_head;
        const messageDate = new Date(item.created_at);
        const currentDateStr = messageDate.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });

        let showDateHeader = false;
        if (index === 0) {
            showDateHeader = true;
        } else {
            const previousDateStr = new Date(messages[index - 1].created_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
            showDateHeader = currentDateStr !== previousDateStr;
        }

        return (
            <View>
                {showDateHeader && (
                    <View style={styles.dateHeaderContainer}>
                        <Text style={styles.dateHeaderText}>{currentDateStr}</Text>
                    </View>
                )}
                <View style={[styles.messageWrapper, isMe ? styles.myMessageWrapper : styles.otherMessageWrapper]}>
                    <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.otherBubble]}>
                        {!isMe && item.is_from_head && (
                            <Text style={styles.senderName}>{item.head_name || 'Community Head'}</Text>
                        )}
                        {!isMe && !item.is_from_head && isAdmin && (
                            <Text style={styles.senderName}>Anonymous Member</Text>
                        )}
                        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>
                            {item.text}
                        </Text>
                        <Text style={[styles.messageTime, isMe ? styles.myTime : styles.otherTime]}>
                            {messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backArrow}>←</Text>
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>Anonymous Chat</Text>
                    <Text style={styles.headerStatus}>
                        {isAdmin ? 'Replying to Member' : 'Chat with Heads'}
                    </Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#007AFF" />
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.message_id.toString()}
                    contentContainerStyle={styles.listContent}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                />
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View style={styles.inputArea}>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Type your message..."
                        value={replyText}
                        onChangeText={setReplyText}
                        multiline
                        maxLength={1000}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, !replyText.trim() && styles.sendButtonDisabled]}
                        onPress={handleSendReply}
                        disabled={!replyText.trim() || sending}
                    >
                        {sending ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <Text style={styles.sendButtonText}>Send</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE',
    },
    backButton: {
        marginRight: 16,
    },
    backArrow: {
        fontSize: 24,
        color: '#007AFF',
    },
    headerInfo: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1A1A1A',
    },
    headerStatus: {
        fontSize: 12,
        color: '#2ECC71',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 16,
        paddingBottom: 32,
    },
    messageWrapper: {
        marginBottom: 12,
        maxWidth: '85%',
    },
    myMessageWrapper: {
        alignSelf: 'flex-end',
    },
    otherMessageWrapper: {
        alignSelf: 'flex-start',
    },
    messageBubble: {
        padding: 12,
        borderRadius: 16,
    },
    myBubble: {
        backgroundColor: '#007AFF',
        borderBottomRightRadius: 4,
    },
    otherBubble: {
        backgroundColor: '#FFFFFF',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: '#EEEEEE',
    },
    senderName: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 4,
        color: '#666666',
    },
    messageText: {
        fontSize: 16,
        lineHeight: 20,
    },
    myMessageText: {
        color: '#FFFFFF',
    },
    otherMessageText: {
        color: '#333333',
    },
    messageTime: {
        fontSize: 10,
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    myTime: {
        color: 'rgba(255,255,255,0.7)',
    },
    otherTime: {
        color: '#999999',
    },
    inputArea: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 8,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
    },
    textInput: {
        flex: 1,
        backgroundColor: '#F0F0F0',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
        fontSize: 16,
        maxHeight: 120,
        marginRight: 8,
    },
    sendButton: {
        backgroundColor: '#007AFF',
        width: 60,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 2,
    },
    sendButtonDisabled: {
        backgroundColor: '#B0D4FF',
    },
    sendButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    dateHeaderContainer: {
        alignItems: 'center',
        marginVertical: 16,
    },
    dateHeaderText: {
        backgroundColor: '#E5E7EB',
        color: '#4B5563',
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 'bold',
        overflow: 'hidden',
    },
});
