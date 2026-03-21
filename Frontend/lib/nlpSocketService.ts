// lib/nlpSocketService.ts - Socket.io moderation client (moved from app/ to avoid route pickup)
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ROOT } from './api';

const NLP_SERVICE_URL = process.env.EXPO_PUBLIC_NLP_SERVICE_URL || process.env.NLP_SERVICE_URL || API_ROOT;

class NLPSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  async connect() {
    if (typeof window === 'undefined') return;
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) throw new Error('No auth token found');

      this.socket = io(NLP_SERVICE_URL, {
        auth: { token: authToken },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
      this.setupEventHandlers();
    } catch (e) {
      console.warn('NLP Socket connect skipped:', e);
    }
  }

  private setupEventHandlers() {
    if (!this.socket) return;
    this.socket.on('connect', () => this.emit('connected'));
    this.socket.on('disconnect', (r: string) => this.emit('disconnected', r));
    this.socket.on('moderation:result', (d: any) => this.emit('moderation:result', d));
    this.socket.on('moderation:flag', (d: any) => this.emit('moderation:flag', d));
    this.socket.on('moderation:reviewed', (d: any) => this.emit('moderation:reviewed', d));
    this.socket.on('moderation:error', (d: any) => this.emit('moderation:error', d));
    this.socket.on('error', (e: any) => this.emit('error', e));
  }

  moderateMessage(text: string, messageType: string = 'chat') {
    this.socket?.emit('moderate:message', { text, messageType });
  }

  adminReview(holdId: number, decision: string) {
    this.socket?.emit('admin:review', { holdId, decision });
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function) {
    const cbs = this.listeners.get(event);
    if (cbs) {
      const i = cbs.indexOf(callback);
      if (i > -1) cbs.splice(i, 1);
    }
  }

  private emit(event: string, data?: any) {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export default new NLPSocketService();
