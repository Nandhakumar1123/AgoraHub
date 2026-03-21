// lib/nlpService.ts - NLP API client (moved from app/ to avoid route pickup)
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ROOT } from './api';

const NLP_SERVICE_URL = process.env.EXPO_PUBLIC_NLP_SERVICE_URL || process.env.NLP_SERVICE_URL || API_ROOT;
const BOT_REQUEST_TIMEOUT_MS = 60000;

class NLPService {
  private baseURL: string;

  constructor() {
    this.baseURL = NLP_SERVICE_URL;
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('authToken');
    } catch {
      return null;
    }
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const authToken = await this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    };
  }

  async analyzeText(text: string, communityId: number) {
    const headers = await this.getHeaders();
    const response = await axios.post(
      `${this.baseURL}/api/nlp/analyze`,
      { text, community_id: communityId },
      { headers }
    );
    return response.data;
  }

  async moderateContent(
    text: string,
    communityId: number,
    messageType: 'chat' | 'complaint' | 'petition' | 'announcement'
  ) {
    const headers = await this.getHeaders();
    const response = await axios.post(
      `${this.baseURL}/api/nlp/moderate`,
      { text, community_id: communityId, message_type: messageType },
      { headers }
    );
    return response.data;
  }

  async askBot(
    question: string,
    communityId: number,
    sessionHash?: string,
    context?: { type: 'petition' | 'complaint'; data: Record<string, unknown> }
  ) {
    const headers = await this.getHeaders();
    const response = await axios.post(
      `${this.baseURL}/api/bot/ask`,
      {
        question,
        community_id: communityId,
        session_hash: sessionHash,
        item_context: context ? { type: context.type, data: context.data } : undefined,
      },
      { headers, timeout: BOT_REQUEST_TIMEOUT_MS }
    );
    return response.data;
  }

  async askBotComplaints(question: string, communityId: number) {
    const headers = await this.getHeaders();
    const response = await axios.post(
      `${this.baseURL}/api/bot/ask/complaints`,
      { question, community_id: communityId },
      { headers, timeout: BOT_REQUEST_TIMEOUT_MS }
    );
    return response.data;
  }

  async askBotPetitions(question: string, communityId: number) {
    const headers = await this.getHeaders();
    const response = await axios.post(
      `${this.baseURL}/api/bot/ask/petitions`,
      { question, community_id: communityId },
      { headers, timeout: BOT_REQUEST_TIMEOUT_MS }
    );
    return response.data;
  }

  async getBotComplaintsHistory(communityId: number) {
    const headers = await this.getHeaders();
    const response = await axios.get(
      `${this.baseURL}/api/bot/ask/complaints/history?community_id=${communityId}`,
      { headers, timeout: BOT_REQUEST_TIMEOUT_MS }
    );
    return response.data;
  }

  async getBotPetitionsHistory(communityId: number) {
    const headers = await this.getHeaders();
    const response = await axios.get(
      `${this.baseURL}/api/bot/ask/petitions/history?community_id=${communityId}`,
      { headers, timeout: BOT_REQUEST_TIMEOUT_MS }
    );
    return response.data;
  }

  async uploadDocument(title: string, content: string, communityId: number) {
    const headers = await this.getHeaders();
    const response = await axios.post(
      `${this.baseURL}/api/bot/docs`,
      { title, content, community_id: communityId },
      { headers }
    );
    return response.data;
  }

  async getBotHistory(communityId: number, limit: number = 50, type: string = 'chat') {
    const headers = await this.getHeaders();
    const response = await axios.get(
      `${this.baseURL}/api/bot/history/${communityId}?limit=${limit}&type=${type}`,
      { headers, timeout: BOT_REQUEST_TIMEOUT_MS }
    );
    return response.data;
  }

  async updateBotHistoryItem(communityId: number, historyId: number, question: string, type: string = 'chat') {
    const headers = await this.getHeaders();
    const response = await axios.put(
      `${this.baseURL}/api/bot/history/${communityId}/${historyId}?type=${type}`,
      { question },
      { headers, timeout: BOT_REQUEST_TIMEOUT_MS }
    );
    return response.data;
  }

  async deleteBotHistoryItem(communityId: number, historyId: number, type: string = 'chat') {
    const headers = await this.getHeaders();
    const response = await axios.delete(
      `${this.baseURL}/api/bot/history/${communityId}/${historyId}?type=${type}`,
      { headers, timeout: BOT_REQUEST_TIMEOUT_MS }
    );
    return response.data;
  }

  async clearBotHistory(communityId: number, type: string = 'chat') {
    const headers = await this.getHeaders();
    const response = await axios.delete(
      `${this.baseURL}/api/bot/history/${communityId}?type=${type}`,
      { headers, timeout: BOT_REQUEST_TIMEOUT_MS }
    );
    return response.data;
  }

  async getModerationStats(communityId: number, days: number = 7) {
    const headers = await this.getHeaders();
    const response = await axios.get(
      `${this.baseURL}/api/nlp/stats/${communityId}?days=${days}`,
      { headers }
    );
    return response.data;
  }

  async getQuarantinedContent(communityId: number, status: string = 'pending') {
    const headers = await this.getHeaders();
    const response = await axios.get(
      `${this.baseURL}/api/admin/quarantine/${communityId}?status=${status}`,
      { headers }
    );
    return response.data;
  }

  async reviewQuarantine(
    holdId: number,
    decision: 'approved' | 'rejected' | 'deleted',
    notes?: string
  ) {
    const headers = await this.getHeaders();
    const response = await axios.post(
      `${this.baseURL}/api/admin/quarantine/${holdId}/review`,
      { decision, notes },
      { headers }
    );
    return response.data;
  }

  async suggestAction(itemId: number, itemType: 'petition' | 'complaint', communityId: number) {
    const headers = await this.getHeaders();
    const response = await axios.post(
      `${this.baseURL}/api/bot/suggest-action`,
      { item_id: itemId, item_type: itemType, community_id: communityId },
      { headers, timeout: BOT_REQUEST_TIMEOUT_MS }
    );
    return response.data;
  }
}

export default new NLPService();
