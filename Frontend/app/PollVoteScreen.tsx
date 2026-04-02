import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
    StatusBar,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PollMessageCard from './PollMessageCard';

type Params = {
    PollVoteScreen: {
        communityId: number;
        pollId: number;
        isAdmin?: boolean;
    };
};

export default function PollVoteScreen() {
    const route = useRoute<RouteProp<Params, 'PollVoteScreen'>>();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const communityId = Number(route.params?.communityId);
    const pollId = Number(route.params?.pollId);
    const isAdmin = !!route.params?.isAdmin;

    const [userId, setUserId] = useState<number | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const token = await AsyncStorage.getItem('authToken');
                if (!token) return;
                const payload = JSON.parse(atob(token.split('.')[1]));
                if (payload?.user_id != null) setUserId(Number(payload.user_id));
            } catch {
                /* ignore */
            }
        })();
    }, []);

    if (!communityId || !pollId) {
        return (
            <View style={[styles.centered, { paddingTop: insets.top }]}>
                <Text style={styles.err}>Missing poll information.</Text>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.back}>Go back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.safe}>
            <StatusBar barStyle="light-content" />
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backArrow}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Poll</Text>
                <View style={{ width: 40 }} />
            </View>
            <ScrollView
                contentContainerStyle={styles.scrollPad}
                keyboardShouldPersistTaps="handled"
            >
                {userId == null ? (
                    <ActivityIndicator color="#a78bfa" style={{ marginTop: 24 }} />
                ) : (
                    <PollMessageCard
                        communityId={communityId}
                        pollId={pollId}
                        currentUserId={userId}
                        isAdmin={isAdmin}
                    />
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#0f172a' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(148,163,184,0.2)',
    },
    backBtn: { padding: 8 },
    backArrow: { color: '#e2e8f0', fontSize: 22, fontWeight: '700' },
    headerTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '800' },
    scrollPad: { padding: 16, paddingBottom: 40 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
    err: { color: '#fca5a5', marginBottom: 12 },
    back: { color: '#a78bfa', fontWeight: '700' },
});
