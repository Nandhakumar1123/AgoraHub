import AsyncStorage from '@react-native-async-storage/async-storage';

export type TamilSummaryScope = 'chat' | 'complaints' | 'petitions';

function key(scope: TamilSummaryScope, communityId: number, historyId: number) {
  return `nlp_tamil_summary_v1:${scope}:${communityId}:${historyId}`;
}

export async function loadTamilSummaryCache(
  scope: TamilSummaryScope,
  communityId: number,
  historyId: number
): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key(scope, communityId, historyId));
  } catch {
    return null;
  }
}

export async function saveTamilSummaryCache(
  scope: TamilSummaryScope,
  communityId: number,
  historyId: number,
  text: string
): Promise<void> {
  try {
    const t = String(text || '').trim();
    if (!t) return;
    await AsyncStorage.setItem(key(scope, communityId, historyId), t);
  } catch {
    /* ignore storage errors */
  }
}
