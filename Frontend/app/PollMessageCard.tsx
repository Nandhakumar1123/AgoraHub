import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    Animated, ActivityIndicator, Alert, Dimensions, ScrollView,
} from 'react-native';
import { Svg, Rect, Text as SvgText, G } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import io from 'socket.io-client';
import { API_BASE_URL, SOCKET_BASE_URL } from '../lib/api';

const { width } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────
interface PollOption {
    option_id: number;
    label: string;
    position: number;
    vote_count: number;
    vote_percentage: number;
}

interface PollData {
    poll_id: number;
    title: string;
    description?: string;
    options: PollOption[];
    total_voters: number;
    allow_multiple_answers: boolean;
    result_visibility: 'immediate' | 'after_vote' | 'after_close';
    anonymous_voting: boolean;
    allow_change_vote: boolean;
    require_comment: boolean;
    show_voter_count: boolean;
    min_votes_to_show: number;
    closes_at?: string;
    duration_code: string;
    is_active: boolean;
    effectively_active: boolean;
    creator_name: string;
    created_at: string;
    my_voted_option_ids?: number[];
}

export interface PollMessageCardProps {
    communityId: number;
    pollId: number;
    currentUserId: number;
    isAdmin?: boolean;
    sentByMe?: boolean;
    createdAt?: string;
}

// ─── Gradient palette per option index ───────────────────────────
const GRAD: [string, string][] = [
    ['#667eea', '#764ba2'],
    ['#f093fb', '#f5576c'],
    ['#4facfe', '#00f2fe'],
    ['#43e97b', '#38f9d7'],
    ['#fa709a', '#fee140'],
    ['#a18cd1', '#fbc2eb'],
    ['#fccb90', '#d57eeb'],
    ['#a1c4fd', '#c2e9fb'],
    ['#fd7943', '#fd3d67'],
    ['#0ba360', '#3cba92'],
];

// ─── Helpers ──────────────────────────────────────────────────────
function timeLeft(closesAt?: string, isActive?: boolean): string {
    if (!isActive) return 'Closed';
    if (!closesAt) return 'No expiry';
    const diff = new Date(closesAt).getTime() - Date.now();
    if (diff <= 0) return 'Closed';
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h left`;
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

// ─── Animated progress bar ────────────────────────────────────────
const Bar: React.FC<{ pct: number; colors: [string, string]; delay: number }> = ({
    pct, colors, delay,
}) => {
    const w = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(w, {
            toValue: pct,
            duration: 800,
            delay,
            useNativeDriver: false,
        }).start();
    }, [pct]);
    const barW = w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
    return (
        <View style={s.barTrack}>
            <Animated.View style={[s.barFill, { width: barW as any }]}>
                <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
        </View>
    );
};

// ─── Premium SVG Chart ────────────────────────────────────────────
const ResultsChart: React.FC<{ options: PollOption[] }> = ({ options }) => {
    const chartHeight = 220;
    const barWidth = 40;
    const gap = 20;
    const margin = 40;
    const chartWidth = options.length * (barWidth + gap) + margin;

    const maxVotes = Math.max(...options.map(o => o.vote_count), 1);

    return (
        <View style={s.chartContainer}>
            <Text style={s.chartTitle}>Vote Distribution</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Svg width={chartWidth} height={chartHeight}>
                    {options.map((opt, i) => {
                        const h = (opt.vote_count / maxVotes) * (chartHeight - 60);
                        const x = margin / 2 + i * (barWidth + gap);
                        const y = chartHeight - 40 - h;
                        const colors = GRAD[i % GRAD.length];

                        return (
                            <G key={opt.option_id}>
                                {/* Bar */}
                                <Rect
                                    x={x}
                                    y={y}
                                    width={barWidth}
                                    height={h}
                                    fill={colors[0]}
                                    rx={6}
                                />
                                {/* Percentage Label */}
                                <SvgText
                                    x={x + barWidth / 2}
                                    y={y - 8}
                                    fill="#4A5568"
                                    fontSize="10"
                                    fontWeight="bold"
                                    textAnchor="middle"
                                >
                                    {Math.round(opt.vote_percentage)}%
                                </SvgText>
                                {/* Option Label (Truncated) */}
                                <SvgText
                                    x={x + barWidth / 2}
                                    y={chartHeight - 20}
                                    fill="#718096"
                                    fontSize="9"
                                    textAnchor="middle"
                                >
                                    {opt.label.length > 8 ? opt.label.substring(0, 6) + '..' : opt.label}
                                </SvgText>
                                {/* Vote Count */}
                                <SvgText
                                    x={x + barWidth / 2}
                                    y={chartHeight - 5}
                                    fill="#A0AEC0"
                                    fontSize="8"
                                    textAnchor="middle"
                                >
                                    {opt.vote_count} votes
                                </SvgText>
                            </G>
                        );
                    })}
                </Svg>
            </ScrollView>
        </View>
    );
};


// ─── Main component ───────────────────────────────────────────────
const PollMessageCard: React.FC<PollMessageCardProps> = ({
    communityId, pollId, currentUserId, isAdmin, sentByMe, createdAt,
}) => {
    const [poll, setPoll] = useState<PollData | null>(null);
    const [loading, setLoading] = useState(true);
    const [voting, setVoting] = useState(false);
    const [selected, setSelected] = useState<number[]>([]);
    const [hasVoted, setHasVoted] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    const fadeIn = useRef(new Animated.Value(0)).current;
    const pulse = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1.04, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ])
        ).start();

        // ── Real-time synchronization ──
        const socket = io(SOCKET_BASE_URL, {
            transports: ['websocket', 'polling'],
        });

        socket.on('connect', () => {
            socket.emit('join_community', communityId);
        });

        socket.on('poll_updated', (data: { pollId: number }) => {
            if (Number(data.pollId) === Number(pollId)) {
                load();
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [pollId, communityId]);

    useEffect(() => { load(); }, [pollId]);

    const load = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('authToken');

            const r = await fetch(
                `${API_BASE_URL}/communities/${communityId}/polls/${pollId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!r.ok) throw new Error();
            const data: PollData = await r.json();

            const vr = await fetch(
                `${API_BASE_URL}/communities/${communityId}/polls/${pollId}/my-vote`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (vr.ok) {
                const vd = await vr.json();
                const ids: number[] = (vd.votes || []).map((v: any) => v.option_id);
                data.my_voted_option_ids = ids;
                if (ids.length > 0) {
                    setHasVoted(true);
                    setSelected(ids);
                }
            }
            setPoll(data);
        } catch { /* silent */ }
        finally { setLoading(false); }
    };

    // Ensure poll expiry is reflected even if no vote-close websocket event arrives.
    useEffect(() => {
        if (!poll?.closes_at || !poll.effectively_active) return;
        const intervalId = setInterval(() => {
            load();
        }, 30000); // refresh every 30s
        return () => clearInterval(intervalId);
    }, [poll?.closes_at, poll?.effectively_active, pollId, communityId]);

    const toggle = (id: number) => {
        if (!poll || hasVoted) return;
        // Requirement: single-vote polls (one selected option).
        setSelected([id]);
    };

    const castVote = async () => {
        if (!poll || selected.length === 0 || voting) return;
        try {
            setVoting(true);
            const token = await AsyncStorage.getItem('authToken');
            const r = await fetch(
                `${API_BASE_URL}/communities/${communityId}/polls/${pollId}/vote`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ option_ids: selected }),
                }
            );
            if (!r.ok) {
                const e = await r.json();
                Alert.alert('Could not vote', e.error || 'Try again.');
                return;
            }
            setHasVoted(true);
            // After voting, we should check if the poll closed automatically
            await load();
        } catch { Alert.alert('Network error', 'Please try again.'); }
        finally { setVoting(false); }
    };

    const closePoll = () =>
        Alert.alert('Close poll', 'End this poll early?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Close', style: 'destructive', onPress: async () => {
                    const token = await AsyncStorage.getItem('authToken');
                    await fetch(`${API_BASE_URL}/communities/${communityId}/polls/${pollId}/close`, {
                        method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
                    });
                    load();
                },
            },
        ]);

    // ─── Loading skeleton ────────────────────────────────────────────
    if (loading) {
        return (
            <View style={[s.wrapper, sentByMe ? s.wrapperRight : s.wrapperLeft]}>
                <View style={[s.card, sentByMe ? s.cardRight : s.cardLeft]}>
                    <ActivityIndicator color="#667eea" style={{ margin: 16 }} />
                </View>
            </View>
        );
    }

    if (!poll) return null;

    const isOpen = poll.effectively_active;
    const canVote = isOpen && !hasVoted;
    // Requirement: on the voting page, show vote distribution only after poll ends.
    const showPct = !isOpen;
    const maxPct = Math.max(...poll.options.map(o => o.vote_percentage || 0));
    const votedSet = new Set(poll.my_voted_option_ids || []);
    const timerLabel = timeLeft(poll.closes_at, poll.effectively_active);
    const firstSelectedId = selected[0] ?? (poll.my_voted_option_ids?.[0] ?? null);
    const selectedOptionLabel =
        firstSelectedId != null
            ? poll.options.find(o => o.option_id === firstSelectedId)?.label
            : null;

    return (
        <Animated.View
            style={[
                s.wrapper,
                sentByMe ? s.wrapperRight : s.wrapperLeft,
                { opacity: fadeIn },
            ]}
        >
            {/* ── Outer card shell ──────────────────────────────────────── */}
            <View style={[s.card, sentByMe ? s.cardRight : s.cardLeft]}>

                {/* ── Neon accent top bar ──────────────────────────────────── */}
                <LinearGradient
                    colors={isOpen ? ['#667eea', '#f093fb', '#4facfe'] : ['#374151', '#4b5563', '#374151']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={s.accentBar}
                />

                {/* ── Collapsed header (tap to expand) ─────────────────────── */}
                <TouchableOpacity
                    style={s.headerRow}
                    onPress={() => setCollapsed(v => !v)}
                    activeOpacity={0.8}
                >
                    {/* left: icon + status */}
                    <View style={s.headerLeft}>
                        <View style={[s.iconRing, { borderColor: isOpen ? '#667eea' : '#4b5563' }]}>
                            <Text style={s.iconEmoji}>🗳️</Text>
                        </View>
                        <View>
                            <Text style={s.statusLabel}>
                                {isOpen ? '● LIVE POLL' : '■ ENDED'}
                            </Text>
                            <Text style={s.timerText}>{timerLabel}</Text>
                        </View>
                    </View>

                    {/* right: voter count chip + collapse arrow */}
                    <View style={s.headerRight}>
                        {poll.show_voter_count && (
                            <View style={s.voterChip}>
                                <Text style={s.voterNum}>{poll.total_voters}</Text>
                                <Text style={s.voterWord}>voters</Text>
                            </View>
                        )}
                        <Text style={s.collapseArrow}>{collapsed ? '▶' : '▼'}</Text>
                    </View>
                </TouchableOpacity>

                {/* ── Title always visible ──────────────────────────────────── */}
                <Text style={s.title} numberOfLines={collapsed ? 1 : undefined}>
                    {poll.title}
                </Text>

                {/* ── Body (collapsible) ────────────────────────────────────── */}
                {!collapsed && (
                    <>
                        {poll.description ? (
                            <Text style={s.desc}>{poll.description}</Text>
                        ) : null}

                        {/* feature pills */}
                        {(poll.anonymous_voting || poll.allow_multiple_answers || poll.require_comment) && (
                            <View style={s.pillRow}>
                                {poll.anonymous_voting && <Text style={s.pill}>🕵️ Anon</Text>}
                                {poll.allow_multiple_answers && <Text style={s.pill}>☑️ Multi</Text>}
                                {poll.require_comment && <Text style={s.pill}>💬 Comment</Text>}
                            </View>
                        )}

                        {hasVoted && isOpen && (
                            <View style={s.votedSummaryBox}>
                                <Text style={s.votedSummaryTitle}>✅ You have already voted</Text>
                                {selectedOptionLabel ? (
                                    <Text style={s.votedSummarySub}>Selected option: {selectedOptionLabel}</Text>
                                ) : null}
                                <Text style={s.votedSummaryStatus}>Status: Vote Casted</Text>
                            </View>
                        )}

                        {/* ── Options ─────────────────────────────────────────── */}
                        <View style={s.optionsBox}>
                            {poll.options
                                .sort((a, b) => a.position - b.position)
                                .map((opt, idx) => {
                                    const grad = GRAD[idx % GRAD.length];
                                    const isSel = selected.includes(opt.option_id);
                                    const isVoted = votedSet.has(opt.option_id);
                                    const isWinner = showPct && (opt.vote_percentage || 0) === maxPct && maxPct > 0;
                                    const pct = opt.vote_percentage || 0;

                                    return (
                                        <TouchableOpacity
                                            key={opt.option_id}
                                            style={[
                                                s.optRow,
                                                isSel && s.optSel,
                                                isVoted && s.optVoted,
                                                isWinner && !canVote && s.optWinner,
                                            ]}
                                            onPress={() => toggle(opt.option_id)}
                                            activeOpacity={canVote ? 0.7 : 1}
                                            disabled={!canVote}
                                        >
                                            {/* bullet */}
                                            <LinearGradient
                                                colors={isSel || isVoted ? grad : ['#1e293b', '#334155']}
                                                style={s.bullet}
                                            >
                                                <Text style={s.bulletTxt}>
                                                    {isVoted ? '✓' : isSel ? '●' : `${opt.position}`}
                                                </Text>
                                            </LinearGradient>

                                            {/* label + bar */}
                                            <View style={s.optContent}>
                                                <View style={s.optTopRow}>
                                                    <Text
                                                        style={[s.optLabel, (isSel || isVoted) && s.optLabelOn]}
                                                        numberOfLines={2}
                                                    >
                                                        {opt.label}
                                                    </Text>
                                                    {showPct && (
                                                        <Text style={[s.pct, isWinner && s.pctWinner]}>
                                                            {pct.toFixed(0)}%
                                                        </Text>
                                                    )}
                                                </View>
                                                {showPct && (
                                                    <Bar pct={pct} colors={grad} delay={idx * 100} />
                                                )}
                                                {showPct && poll.show_voter_count && (
                                                    <Text style={s.voteSmall}>{opt.vote_count} vote{opt.vote_count !== 1 ? 's' : ''}</Text>
                                                )}
                                            </View>

                                            {isWinner && !canVote && (
                                                <Text style={s.crown}>👑</Text>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                        </View>

                        {/* ── Results Chart ───────────────────────────────────── */}
                        {!isOpen && (
                            <ResultsChart options={poll.options} />
                        )}

                        {/* ── Action row ─────────────────────────────────────── */}
                        <View style={s.actionRow}>

                            {/* Vote button */}
                            {canVote && (
                                <Animated.View style={[s.voteBtnWrap, selected.length > 0 && { transform: [{ scale: pulse }] }]}>
                                    <TouchableOpacity
                                        style={[s.voteBtn, (selected.length === 0 || voting) && s.voteBtnOff]}
                                        onPress={castVote}
                                        disabled={selected.length === 0 || voting}
                                    >
                                        <LinearGradient
                                            colors={selected.length > 0 ? ['#667eea', '#764ba2'] : ['#1e293b', '#334155']}
                                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                            style={s.voteBtnGrad}
                                        >
                                            {voting
                                                ? <ActivityIndicator color="#fff" size="small" />
                                                : <>
                                                    <Text style={s.voteBtnIcon}>🗳️</Text>
                                                    <Text style={s.voteBtnTxt}>
                                                        Submit Vote
                                                    </Text>
                                                </>
                                            }
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </Animated.View>
                            )}

                            {/* Admin close button */}
                            {isAdmin && isOpen && (
                                <TouchableOpacity style={s.closeBtn} onPress={closePoll}>
                                    <Text style={s.closeBtnTxt}>⏹ End</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </>
                )}

                {/* ── Footer ───────────────────────────────────────────────── */}
                <View style={s.footer}>
                    <Text style={s.footerTxt}>By {poll.creator_name}</Text>
                    <Text style={s.dot}>·</Text>
                    <Text style={s.footerTxt}>
                        {new Date(poll.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                    {createdAt && (
                        <>
                            <Text style={s.dot}>·</Text>
                            <Text style={s.footerTxt}>
                                {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </>
                    )}
                </View>

                {/* ── Tail (chat bubble pointer) ────────────────────────────── */}
                <View style={[s.tail, sentByMe ? s.tailRight : s.tailLeft]} />
            </View>
        </Animated.View>
    );
};

export default PollMessageCard;

// ─── Styles ───────────────────────────────────────────────────────
const CARD_W = width * 0.82;

const s = StyleSheet.create({
    wrapper: { marginVertical: 6, marginHorizontal: 8 },
    wrapperRight: { alignItems: 'flex-end' },
    wrapperLeft: { alignItems: 'flex-start' },

    card: {
        width: CARD_W,
        backgroundColor: '#0f172a',
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#1e293b',
        shadowColor: '#667eea',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 7,
    },
    cardRight: { borderBottomRightRadius: 4 },
    cardLeft: { borderBottomLeftRadius: 4 },

    accentBar: { height: 3, width: '100%' },

    // header
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, paddingBottom: 6 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconRing: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b' },
    iconEmoji: { fontSize: 18 },
    statusLabel: { color: '#a5f3fc', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
    timerText: { color: '#94a3b8', fontSize: 11, marginTop: 1 },
    voterChip: { alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
    voterNum: { color: '#fff', fontSize: 16, fontWeight: '800' },
    voterWord: { color: '#64748b', fontSize: 9 },
    collapseArrow: { color: '#64748b', fontSize: 12, paddingLeft: 4 },

    title: { color: '#f1f5f9', fontSize: 14, fontWeight: '700', paddingHorizontal: 12, paddingBottom: 6, lineHeight: 20 },
    desc: { color: '#94a3b8', fontSize: 12, paddingHorizontal: 12, paddingBottom: 8, lineHeight: 17 },

    votedSummaryBox: {
        marginHorizontal: 12,
        marginBottom: 10,
        padding: 12,
        backgroundColor: 'rgba(16,185,129,0.12)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(16,185,129,0.35)',
    },
    votedSummaryTitle: {
        color: '#a7f3d0',
        fontSize: 13,
        fontWeight: '900',
        marginBottom: 4,
    },
    votedSummarySub: {
        color: '#e5e7eb',
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 4,
    },
    votedSummaryStatus: {
        color: '#34d399',
        fontSize: 12,
        fontWeight: '900',
    },

    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
    pill: { backgroundColor: 'rgba(102,126,234,0.15)', color: '#a5b4fc', fontSize: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(102,126,234,0.25)' },

    // options
    optionsBox: { paddingHorizontal: 10, paddingBottom: 8, gap: 7 },
    optRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, padding: 10, borderWidth: 1.5, borderColor: 'transparent', gap: 10 },
    optSel: { borderColor: '#667eea', backgroundColor: '#1a2340' },
    optVoted: { borderColor: '#10b981', backgroundColor: '#0a2018' },
    optWinner: { borderColor: '#f59e0b', backgroundColor: '#1a1500' },

    bullet: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    bulletTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },

    optContent: { flex: 1, gap: 5 },
    optTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    optLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '500', flex: 1, lineHeight: 18 },
    optLabelOn: { color: '#e2e8f0', fontWeight: '700' },
    pct: { color: '#94a3b8', fontSize: 12, fontWeight: '700', marginLeft: 6 },
    pctWinner: { color: '#f59e0b' },
    voteSmall: { color: '#475569', fontSize: 10, marginTop: 2 },
    crown: { fontSize: 16, marginLeft: 4 },

    barTrack: { height: 6, borderRadius: 3, backgroundColor: '#0f172a', overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 3, overflow: 'hidden' },

    // actions
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 10, paddingBottom: 10, alignItems: 'center' },
    voteBtnWrap: { flex: 1 },
    voteBtn: { borderRadius: 10, overflow: 'hidden' },
    voteBtnOff: { opacity: 0.5 },
    voteBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 6 },
    voteBtnIcon: { fontSize: 14 },
    voteBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },

    resToggle: { backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
    resToggleTxt: { color: '#a5b4fc', fontSize: 12, fontWeight: '600' },

    lockedPill: { backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
    lockedTxt: { color: '#64748b', fontSize: 11 },

    closeBtn: { backgroundColor: '#450a0a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
    closeBtnTxt: { color: '#fca5a5', fontSize: 12, fontWeight: '600' },

    minVoteHint: { color: '#475569', fontSize: 11, textAlign: 'center', paddingHorizontal: 12, paddingBottom: 8 },

    changeVoteBtn: { backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: '#667eea' },
    changeVoteBtnTxt: { color: '#a5b4fc', fontSize: 12, fontWeight: '600' },

    // footer
    footer: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingBottom: 10 },
    footerTxt: { color: '#475569', fontSize: 10 },
    dot: { color: '#334155', fontSize: 10 },

    // bubble tail
    tail: { position: 'absolute', bottom: 0, width: 12, height: 12 },
    tailRight: { right: -6, borderTopLeftRadius: 12, backgroundColor: '#0f172a' },
    tailLeft: { left: -6, borderTopRightRadius: 12, backgroundColor: '#0f172a' },
    chartContainer: {
        marginTop: 20,
        marginBottom: 10,
        padding: 10,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    chartTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#2D3748',
        marginBottom: 10,
        textAlign: 'center',
    },
});