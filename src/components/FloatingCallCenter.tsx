import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, X, Maximize2 } from 'lucide-react';
import { CallCenterAdminPanel } from './CallCenterAdminPanel';
import { UserProfile } from '../types';

interface Props {
  currentUser: UserProfile;
  isAr: boolean;
  onClose: () => void;
}

export function FloatingCallCenter({ currentUser, isAr, onClose }: Props) {
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      drag
      dragConstraints={{ top: -500, bottom: 500, left: -500, right: 500 }}
      className={`fixed z-[200] bottom-4 right-4 flex flex-col overflow-hidden shadow-[0_10px_40px_rgba(236,72,153,0.3)] border border-pink-500/30 bg-zinc-950 rounded-2xl transition-all ${
        isMinimized ? 'w-64 h-14' : 'w-[90vw] sm:w-[800px] h-[80vh] max-h-[800px]'
      }`}
    >
      {/* Header (Drag Handle) */}
      <div className="bg-pink-900/40 border-b border-pink-500/20 p-3 flex items-center justify-between cursor-move shrink-0 touch-none">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
          <span className="text-xs font-black tracking-widest text-pink-300 uppercase">Call Center Workspace</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsMinimized(!isMinimized)} className="p-1 hover:bg-white/10 rounded-lg text-pink-300 transition-colors">
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
          </button>
          <button onClick={onClose} className="p-1 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 overflow-hidden relative bg-gradient-to-b from-zinc-950 to-pink-950/20 flex flex-col"
          >
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <CallCenterAdminPanel currentUser={currentUser} isAr={isAr} isFloating={true} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
