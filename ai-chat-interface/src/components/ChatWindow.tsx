import React, { useState, useRef, useEffect } from 'react';
import { Send, Image, Mic, Paperclip, MoreHorizontal, Sparkles } from 'lucide-react';
import MessageBubble, { Message } from './MessageBubble';
import AIBrainIcon from './AIBrainIcon';

interface ChatWindowProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  chatType: 'chat' | 'complaint' | 'petition';
}

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, onSendMessage, chatType }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  const getWelcomeMessage = () => {
    switch (chatType) {
      case 'complaint': return "How can I help you resolve your complaint today?";
      case 'petition': return "Let's draft a powerful petition together. What's the main goal?";
      default: return "Hello! I'm your AI assistant. How can I help you today?";
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-chat-bg relative overflow-hidden font-inter">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] -z-10 -translate-x-1/2 translate-y-1/2" />

      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 glass border-b border-white/5 z-20">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse" />
          <div>
            <h2 className="text-sm font-semibold text-white/90">AI Assistant</h2>
            <p className="text-[10px] text-white/30 uppercase tracking-widest">{chatType} Mode</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg hover:bg-white/5 text-white/40 transition-colors border border-transparent hover:border-white/5">
            <Sparkles className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-lg hover:bg-white/5 text-white/40 transition-colors border border-transparent hover:border-white/5">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-8 custom-scrollbar">
        <div className="max-w-4xl mx-auto w-full flex flex-col">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-in fade-in zoom-in duration-700">
              <AIBrainIcon className="mb-4" />
              <div className="space-y-2">
                <h1 className="text-3xl font-bold chat-gradient-text">How can I help you today?</h1>
                <p className="text-white/40 text-sm max-w-sm mx-auto">
                  {getWelcomeMessage()}
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg mt-8">
                {['Explain quantum computing', 'Write a professional email', 'Analyze this data', 'Summarize a long text'].map((suggest, i) => (
                  <button 
                    key={i} 
                    onClick={() => onSendMessage(suggest)}
                    className="p-4 rounded-xl glass border border-white/5 hover:border-indigo-500/30 hover:bg-white/[0.05] transition-all text-sm text-white/70 text-left group"
                  >
                    <span className="opacity-60 group-hover:opacity-100 transition-opacity">{suggest}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <MessageBubble 
                key={msg.id} 
                message={msg} 
                isLast={i === messages.length - 1} 
              />
            ))
          )}
          <div ref={messagesEndRef} className="h-10" />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-6 pt-0 z-20">
        <div className="max-w-4xl mx-auto w-full relative">
          <form 
            onSubmit={handleSubmit}
            className="glass rounded-2xl p-2 border border-white/10 shadow-2xl focus-within:border-indigo-500/50 transition-all group"
          >
            <div className="flex items-end gap-2 px-2 py-1">
              <button type="button" className="p-2 rounded-xl hover:bg-white/5 text-white/30 transition-colors">
                <Paperclip className="w-5 h-5" />
              </button>
              
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Message AI..."
                className="flex-1 bg-transparent border-none outline-none resize-none py-2 px-2 text-sm text-white/90 placeholder:text-white/20 min-h-[40px] max-h-48"
                rows={1}
              />
              
              <div className="flex items-center gap-1">
                <button type="button" className="p-2 rounded-xl hover:bg-white/5 text-white/30 transition-colors hidden sm:block">
                  <Mic className="w-5 h-5" />
                </button>
                <button 
                  type="submit" 
                  disabled={!input.trim()}
                  className="p-2.5 rounded-xl chat-gradient text-white disabled:opacity-30 disabled:grayscale transition-all shadow-lg hover:scale-105 active:scale-95 group"
                >
                  <Send className="w-4 h-4 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>
              </div>
            </div>
          </form>
          <p className="text-[10px] text-center text-white/20 mt-3 font-medium">
            AI can make mistakes. Verify important info.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
