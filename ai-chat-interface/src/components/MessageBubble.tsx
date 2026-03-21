import React from 'react';
import { Bot, User, Copy, ThumbsUp, ThumbsDown, RotateCw } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface MessageBubbleProps {
  message: Message;
  isLast: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isLast }) => {
  const isAI = message.role === 'assistant';

  return (
    <div className={cn(
      "group flex w-full flex-col gap-2 mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500",
      isAI ? "items-start" : "items-end"
    )}>
      <div className={cn(
        "flex max-w-[85%] sm:max-w-[75%] gap-3",
        isAI ? "flex-row" : "flex-row-reverse"
      )}>
        {/* Avatar */}
        <div className={cn(
          "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110 mt-1",
          isAI ? "chat-gradient" : "bg-white/10 border border-white/10"
        )}>
          {isAI ? (
            <Bot className="w-5 h-5 text-white" />
          ) : (
            <User className="w-5 h-5 text-white/70" />
          )}
        </div>

        {/* Content */}
        <div className={cn(
          "flex flex-col gap-2 min-w-0",
          isAI ? "items-start" : "items-end"
        )}>
          <div 
            className={cn(
              "relative p-4 rounded-2xl text-sm leading-relaxed shadow-xl",
              isAI 
                ? "bg-chat-ai border border-white/10" 
                : "bg-indigo-600/90 border border-indigo-400/30 text-white shadow-[0_0_30px_rgba(99,102,241,0.1)]"
            )}
            style={isAI ? { color: 'var(--ai-text)' } : {}}
          >
            {/* Message Text */}
            <div className="whitespace-pre-wrap break-words">
              {message.content}
            </div>
            
            {/* Timestamp */}
            <div className={cn(
              "text-[10px] text-white/40 mt-2 font-medium uppercase tracking-tighter",
              isAI ? "text-left" : "text-right"
            )}>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          {/* Action Buttons (only for AI) */}
          {isAI && (
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
              <button className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors border border-transparent hover:border-white/5" title="Copy">
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors border border-transparent hover:border-white/5">
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>
              <button className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors border border-transparent hover:border-white/5">
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>
              <button className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors border border-transparent hover:border-white/5">
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
