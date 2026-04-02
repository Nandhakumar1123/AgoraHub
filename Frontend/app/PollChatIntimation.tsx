import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, SOCKET_BASE_URL } from '../lib/api';

const { width } = Dimensions.get('window');

type Props = {
  communityId: number;
  pollId: number;
  isAdmin?: boolean;
  onOpenPoll: (pollId: number) => void;
};

const PollChatIntimation: React.FC<Props> = ({
  communityId,
  pollId,
  isAdmin,
  onOpenPoll,
}) => {
  const [loading, setLoading] = useState(true);
  const [poll, setPoll] = useState<null | {
    title: string;
    closes_at?: string | null;
    effectively_active: boolean;
    total_voters: number;
    options: Array<{ option_id: number; label: string }>;
    my_voted_option_ids?: number[];
  }>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) return;
        const r = await fetch(
          `${API_BASE_URL}/communities/${communityId}/polls/${pollId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (r.ok) {
          const d = await r.json();
          if (!cancelled) {
            setPoll({
              title: d.title ?? '',
              closes_at: d.closes_at ?? null,
              effectively_active:
                d.effectively_active === true ||
                d.effectively_active === 't' ||
                d.effectively_active === 'true' ||
                d.effectively_active === 1,
              total_voters: Number(d.total_voters ?? 0),
              options: Array.isArray(d.options)
                ? d.options.map((o: any) => ({
                    option_id: Number(o.option_id),
                    label: String(o.label ?? ''),
                  }))
                : [],
              my_voted_option_ids: Array.isArray(d.my_voted_option_ids)
                ? d.my_voted_option_ids.map((x: any) => Number(x))
                : [],
            });
          }
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [communityId, pollId]);

  // Socket-driven updates so the chat badge switches to "Voted/Ended" quickly.
  useEffect(() => {
    const socket = io(SOCKET_BASE_URL, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join_community', communityId);
    });

    socket.on('poll_updated', (data: { pollId: number }) => {
      if (Number(data.pollId) !== Number(pollId)) return;
      (async () => {
        try {
          const token = await AsyncStorage.getItem('authToken');
          if (!token) return;
          const r = await fetch(
            `${API_BASE_URL}/communities/${communityId}/polls/${pollId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (r.ok) {
            const d = await r.json();
            setPoll({
              title: d.title ?? '',
              closes_at: d.closes_at ?? null,
              effectively_active:
                d.effectively_active === true ||
                d.effectively_active === 't' ||
                d.effectively_active === 'true' ||
                d.effectively_active === 1,
              total_voters: Number(d.total_voters ?? 0),
              options: Array.isArray(d.options)
                ? d.options.map((o: any) => ({
                    option_id: Number(o.option_id),
                    label: String(o.label ?? ''),
                  }))
                : [],
              my_voted_option_ids: Array.isArray(d.my_voted_option_ids)
                ? d.my_voted_option_ids.map((x: any) => Number(x))
                : [],
            });
          }
        } catch {
          /* ignore */
        }
      })();
    });

    return () => {
      socket.disconnect();
    };
  }, [communityId, pollId]);

  // Refresh status so chat cards update to "Ended" at expiry time.
  useEffect(() => {
    if (!poll?.closes_at || !poll.effectively_active) return;
    const intervalId = setInterval(() => {
      (async () => {
        try {
          const token = await AsyncStorage.getItem('authToken');
          if (!token) return;
          const r = await fetch(
            `${API_BASE_URL}/communities/${communityId}/polls/${pollId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (r.ok) {
            const d = await r.json();
            setPoll({
              title: d.title ?? '',
              closes_at: d.closes_at ?? null,
              effectively_active:
                d.effectively_active === true ||
                d.effectively_active === 't' ||
                d.effectively_active === 'true' ||
                d.effectively_active === 1,
              total_voters: Number(d.total_voters ?? 0),
              options: Array.isArray(d.options)
                ? d.options.map((o: any) => ({
                    option_id: Number(o.option_id),
                    label: String(o.label ?? ''),
                  }))
                : [],
              my_voted_option_ids: Array.isArray(d.my_voted_option_ids)
                ? d.my_voted_option_ids.map((x: any) => Number(x))
                : [],
            });
          }
        } catch {
          /* ignore */
        }
      })();
    }, 30000); // 30s
    return () => clearInterval(intervalId);
  }, [poll?.effectively_active, poll?.closes_at, communityId, pollId]);

  const computed = useMemo(() => {
    const isEnded = poll ? !poll.effectively_active : false;
    const hasVoted = poll ? (poll.my_voted_option_ids?.length ?? 0) > 0 : false;
    const status: 'Open' | 'Voted' | 'Ended' = isEnded
      ? 'Ended'
      : hasVoted
        ? 'Voted'
        : 'Open';

    const primaryButton =
      status === 'Open' ? 'Open Poll' : status === 'Voted' ? 'View Poll' : 'View Results';

    const selectedOptionId = poll?.my_voted_option_ids?.[0];
    const selectedOption = poll?.options.find((o) => o.option_id === selectedOptionId)?.label;

    const endText = poll?.closes_at
      ? new Date(poll.closes_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'No expiry';

    return { status, primaryButton, selectedOption, endText, totalVotes: poll?.total_voters ?? 0 };
  }, [poll]);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => onOpenPoll(pollId)}
      style={styles.touchWrap}
    >
      <LinearGradient
        colors={['#7c3aed', '#a855f7', '#c026d3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBorder}
      >
        <View style={styles.inner}>
          <View style={styles.topHeader}>
            <View style={styles.badgeRow}>
              <Text style={styles.badge}>NEW POLL</Text>
              {isAdmin ? <Text style={styles.adminTag}>HEAD</Text> : null}
            </View>
            {!loading ? (
              <View
                style={[
                  styles.statusChip,
                  computed.status === 'Open'
                    ? styles.statusChipActive
                    : computed.status === 'Voted'
                      ? styles.statusChipVoted
                      : styles.statusChipEnded,
                ]}
              >
                <Text
                  style={
                    computed.status === 'Open'
                      ? styles.statusTextActive
                      : computed.status === 'Voted'
                        ? styles.statusTextVoted
                        : styles.statusTextEnded
                  }
                  numberOfLines={1}
                >
                  {computed.status === 'Open' ? 'Open' : computed.status === 'Voted' ? 'Voted ✅' : 'Ended'}
                </Text>
              </View>
            ) : null}
          </View>

          {loading ? (
            <ActivityIndicator color="#e9d5ff" style={{ marginVertical: 8 }} />
          ) : (
            <>
              <Text style={styles.pollTitle} numberOfLines={2}>
                {poll?.title}
              </Text>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Ends:</Text>
                <Text style={styles.metaValue}>{computed.endText}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Votes:</Text>
                <Text style={styles.metaValue}>{computed.totalVotes}</Text>
              </View>

              {computed.selectedOption ? (
                <View style={styles.selectedRow}>
                  <Text style={styles.selectedLabel}>Your pick:</Text>
                  <Text style={styles.selectedValue} numberOfLines={1}>
                    {computed.selectedOption}
                  </Text>
                </View>
              ) : null}

              <View style={styles.actionRow}>
                <TouchableOpacity
                  activeOpacity={0.95}
                  onPress={() => onOpenPoll(pollId)}
                  style={[
                    styles.actionBtn,
                    computed.status === 'Open'
                      ? styles.actionBtnOpen
                      : computed.status === 'Voted'
                        ? styles.actionBtnVoted
                        : styles.actionBtnEnded,
                  ]}
                >
                  <Text style={styles.actionBtnText}>{computed.primaryButton}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const maxW = Math.min(width * 0.92, 420);

const styles = StyleSheet.create({
  touchWrap: {
    alignSelf: 'center',
    maxWidth: maxW,
    width: '100%',
    marginVertical: 10,
    borderRadius: 16,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
  },
  gradientBorder: {
    borderRadius: 16,
    padding: 3,
  },
  inner: {
    backgroundColor: '#0f172a',
    borderRadius: 13,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 0,
    marginTop: 1,
  },
  statusChipActive: {
    backgroundColor: 'rgba(34,197,94,0.22)',
    borderColor: 'rgba(34,197,94,0.65)',
  },
  statusChipEnded: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderColor: 'rgba(248,113,113,0.7)',
  },
  statusChipVoted: {
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderColor: 'rgba(59,130,246,0.55)',
  },
  statusTextActive: {
    fontSize: 11,
    fontWeight: '800',
    color: '#86efac',
    letterSpacing: 0.4,
  },
  statusTextEnded: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fca5a5',
    letterSpacing: 0.4,
  },
  statusTextVoted: {
    fontSize: 11,
    fontWeight: '800',
    color: '#93c5fd',
    letterSpacing: 0.4,
  },
  badge: {
    fontSize: 11,
    fontWeight: '900',
    color: '#faf5ff',
    letterSpacing: 1.2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  adminTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fde68a',
    backgroundColor: 'rgba(250,204,21,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  pollTitle: {
    color: '#f5f3ff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  metaLabel: {
    color: '#e9d5ff',
    fontSize: 12,
    fontWeight: '700',
    marginRight: 6,
  },
  metaValue: {
    color: '#e9d5ff',
    fontSize: 12,
    fontWeight: '800',
  },
  selectedRow: {
    marginTop: 8,
    marginBottom: 2,
    padding: 10,
    backgroundColor: 'rgba(15,23,42,0.35)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.25)',
  },
  selectedLabel: {
    color: '#d8b4fe',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  selectedValue: {
    color: '#f5f3ff',
    fontSize: 13,
    fontWeight: '800',
  },
  actionRow: {
    marginTop: 12,
  },
  actionBtn: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnOpen: {
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderColor: 'rgba(34,197,94,0.6)',
  },
  actionBtnVoted: {
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderColor: 'rgba(59,130,246,0.6)',
  },
  actionBtnEnded: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderColor: 'rgba(239,68,68,0.6)',
  },
  actionBtnText: {
    color: '#f5f3ff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});

export default PollChatIntimation;
