import React from 'react';

const AIBrainIcon = ({ className = "" }: { className?: string }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Glow effect */}
      <div className="absolute inset-0 bg-indigo-500/30 rounded-full blur-xl pulse-glow" />
      
      {/* Main icon container */}
      <div className="relative z-10 w-12 h-12 rounded-xl chat-gradient flex items-center justify-center shadow-lg transform transition-transform hover:scale-110">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-7 h-7"
        >
          <path d="M12 2a10 10 0 0 0-10 10c0 1.25.23 2.45.65 3.55a1 1 0 0 0 .52.52C4.1 16.77 5.25 17 6.5 17a1 1 0 0 0 .86-.5c.8-1.4 2.1-2.4 3.64-2.4h2c1.54 0 2.84 1 3.64 2.4a1 1 0 0 0 .86.5c1.25 0 2.4-.23 3.33-.93a1 1 0 0 0 .52-.52c.42-1.1.65-2.3.65-3.55A10 10 0 0 0 12 2z" />
          <circle cx="9" cy="9" r="1" fill="white" />
          <circle cx="15" cy="9" r="1" fill="white" />
          <path d="M8 13c1.5 1 3.5 1 5 0" />
          <path d="M12 2v2" />
          <path d="M12 18v2" />
          <path d="M4.93 4.93l1.41 1.41" />
          <path d="M17.66 17.66l1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="M4.93 19.07l1.41-1.41" />
          <path d="M17.66 6.34l1.41-1.41" />
        </svg>
      </div>
    </div>
  );
};

export default AIBrainIcon;
