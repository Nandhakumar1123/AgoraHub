import React, { useState } from 'react';
import { Search, MessageSquare, FileText, AlertCircle, Plus, Command } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatHistoryItem {
  id: string;
  type: 'chat' | 'complaint' | 'petition';
  title: string;
  timestamp: Date;
}

interface SidebarProps {
  chats: ChatHistoryItem[];
  activeChatId: string;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ chats, activeChatId, onSelectChat, onNewChat }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const groupChats = (items: ChatHistoryItem[]) => {
    const now = new Date();
    const groups: Record<string, ChatHistoryItem[]> = {
      'Today': [],
      'Yesterday': [],
      'Last 7 Days': [],
      'Older': []
    };

    items.forEach(chat => {
      const diffDays = Math.floor((now.getTime() - chat.timestamp.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) groups['Today'].push(chat);
      else if (diffDays === 1) groups['Yesterday'].push(chat);
      else if (diffDays < 7) groups['Last 7 Days'].push(chat);
      else groups['Older'].push(chat);
    });

    return groups;
  };

  const filteredChats = chats.filter(chat => 
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedChats = groupChats(filteredChats);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'complaint': return <AlertCircle className="w-4 h-4 text-orange-400" />;
      case 'petition': return <FileText className="w-4 h-4 text-blue-400" />;
      default: return <MessageSquare className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <div className="w-80 h-screen bg-chat-sidebar flex flex-col border-r border-white/5 transition-all duration-300">
      {/* Search Header */}
      <div className="p-4 space-y-4">
        <button 
          onClick={onNewChat}
          className="w-full flex items-center justify-between p-3 rounded-xl border border-white/10 glass hover:bg-white/5 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg chat-gradient shadow-lg group-hover:scale-110 transition-transform">
              <Plus className="w-4 h-4 text-white" />
            </div>
            <span className="font-medium text-sm">New Conversation</span>
          </div>
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-white/40">
            <Command className="w-2.5 h-2.5" />
            <span>N</span>
          </div>
        </button>

        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-indigo-400 transition-colors" />
          <input
            type="text"
            placeholder="Search history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-white/20"
          />
        </div>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-6">
        {Object.entries(groupedChats).map(([group, items]) => (
          items.length > 0 && (
            <div key={group} className="space-y-1">
              <h3 className="px-3 text-[11px] font-bold text-white/20 uppercase tracking-widest mb-2">
                {group}
              </h3>
              {items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => onSelectChat(chat.id)}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 rounded-xl transition-all group relative overflow-hidden",
                    activeChatId === chat.id 
                      ? "bg-indigo-500/10 border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.05)]" 
                      : "hover:bg-white/[0.03] border border-transparent"
                  )}
                >
                  {activeChatId === chat.id && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                  )}
                  
                  <div className="mt-0.5">
                    {getTypeIcon(chat.type)}
                  </div>
                  
                  <div className="flex-1 text-left min-w-0">
                    <p className={cn(
                      "text-sm font-medium truncate mb-0.5",
                      activeChatId === chat.id ? "text-white" : "text-white/70 group-hover:text-white/90"
                    )}>
                      {chat.title}
                    </p>
                    <p className="text-[10px] text-white/30">
                      {chat.timestamp.toLocaleDateString(undefined, { 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )
        ))}
        
        {filteredChats.length === 0 && searchQuery && (
          <div className="p-8 text-center">
            <p className="text-sm text-white/30 italic">No matches found</p>
          </div>
        )}
      </div>

      {/* Footer Profile Mock */}
      <div className="p-4 border-t border-white/5 bg-black/20 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-bold border border-white/10 shadow-lg">
            JD
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium">John Doe</p>
            <p className="text-[10px] text-white/30 truncate">john@example.com</p>
          </div>
          <div className="p-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/10">
            <svg className="w-4 h-4 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 12V8M12 16h.01"/></svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
