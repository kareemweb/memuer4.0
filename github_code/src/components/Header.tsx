import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Settings, LogOut, Search, Menu, X, ChevronDown, Bell, User } from 'lucide-react';
import { cn } from '../lib/utils';

interface HeaderProps {
  /** Current user display name */
  userName?: string;
  /** Current user avatar URL */
  userAvatar?: string;
  /** User role for badge display */
  userRole?: string;
  /** Callback when logout is clicked */
  onLogout?: () => void;
  /** Callback when profile/settings is clicked */
  onSettings?: () => void;
  /** Callback when search is submitted */
  onSearch?: (query: string) => void;
  /** Whether to show the mobile menu toggle */
  isMobile?: boolean;
  /** Callback when mobile menu is toggled */
  onToggleMobileMenu?: () => void;
  /** Whether the mobile sidebar is open */
  isMobileMenuOpen?: boolean;
  /** Theme accent class for sidebar tabs */
  accentText?: string;
  /** Theme accent bg class */
  accentBg?: string;
  /** Notification count badge */
  notificationCount?: number;
  /** Whether the user is connected / online */
  isOnline?: boolean;
}

export function Header({
  userName,
  userAvatar,
  userRole,
  onLogout,
  onSettings,
  onSearch,
  isMobile = false,
  onToggleMobileMenu,
  isMobileMenuOpen = false,
  accentText = 'text-indigo-300',
  accentBg = 'bg-indigo-600/40',
  notificationCount = 0,
  isOnline = true,
}: HeaderProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch && searchQuery.trim()) {
      onSearch(searchQuery.trim());
    }
  };

  const normalizedRole = userRole?.toLowerCase();
  const isHeadOwner = normalizedRole === 'headowner';

  return (
    <header className="h-16 sm:h-20 border-b border-white/5 flex items-center justify-between px-4 sm:px-8 bg-black/10 backdrop-blur-md relative z-20 shrink-0">
      {/* Left Section: Logo + Brand */}
      <div className="flex items-center gap-3 sm:gap-5">
        {/* Mobile menu toggle */}
        {isMobile && onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="p-2 hover:bg-white/10 rounded-xl text-indigo-200 transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        )}

        {/* Memuer Logo */}
        <div className="flex items-center gap-2 sm:gap-3">
          <motion.div
            whileHover={{ scale: 1.05, rotate: -2 }}
            whileTap={{ scale: 0.95 }}
            className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-pink-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-pink-500/20 cursor-pointer select-none"
          >
            <span className="font-black text-lg sm:text-xl text-white">M</span>
          </motion.div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <h1 className="text-base sm:text-xl font-black tracking-tight flex items-center gap-0.5 select-none">
                <span className="text-pink-500">M</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-cyan-300">emuer</span>
              </h1>
              <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-cyan-400/80 select-none">
                social +
              </span>
            </div>
            <p className={cn("hidden sm:block text-[9px] font-bold uppercase tracking-[0.15em] select-none", accentText)}>
              Encrypted &middot; Decentralized &middot; Yours
            </p>
          </div>
        </div>
      </div>

      {/* Center Section: Search (desktop) */}
      {!isMobile && (
        <div className="flex-1 max-w-md mx-8">
          <AnimatePresence>
            {isSearchOpen ? (
              <motion.form
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleSearchSubmit}
                className="relative"
              >
                <input
                  autoFocus
                  type="text"
                  placeholder="Search people, chats, groups..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onBlur={() => {
                    if (!searchQuery.trim()) setIsSearchOpen(false);
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-10 text-xs focus:ring-1 ring-cyan-400/50 outline-none text-white placeholder:text-white/30"
                />
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <button
                  type="button"
                  onClick={() => {
                    setIsSearchOpen(false);
                    setSearchQuery('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.form>
            ) : (
              <button
                onClick={() => setIsSearchOpen(true)}
                className="w-full flex items-center gap-2.5 bg-white/5 hover:bg-white/8 border border-white/5 hover:border-white/10 rounded-full py-2 px-4 transition-all group"
              >
                <Search className="w-4 h-4 text-white/25 group-hover:text-white/40 transition-colors" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/20 group-hover:text-white/35 transition-colors select-none">
                  Search the network...
                </span>
                <kbd className="hidden lg:inline-flex ml-auto px-1.5 py-0.5 bg-white/5 rounded text-[8px] font-mono text-white/15 border border-white/5">
                  ⌘K
                </kbd>
              </button>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Right Section: Actions + Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Online Status Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 mr-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            isOnline ? "bg-green-500 shadow-sm shadow-green-500/50" : "bg-zinc-600"
          )} />
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/30 select-none">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Notifications */}
        {notificationCount > 0 && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="relative p-2.5 hover:bg-white/10 rounded-full text-indigo-200 transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="absolute top-1 right-1 w-4 h-4 bg-pink-500 text-white text-[8px] font-black flex items-center justify-center rounded-full animate-bounce shadow-lg shadow-pink-500/30">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          </motion.button>
        )}

        {/* Settings */}
        <button
          onClick={onSettings}
          className="hidden sm:flex p-2.5 hover:bg-white/10 rounded-full text-indigo-200 hover:text-white transition-all"
          title="Settings"
        >
          <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Profile / Avatar Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className={cn(
              "flex items-center gap-2 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl transition-all",
              isProfileOpen ? "bg-white/10" : "hover:bg-white/5"
            )}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-green-400/80 p-0.5 relative overflow-hidden shadow-sm">
              <img
                src={userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=memuer-user`}
                alt={userName || 'User'}
                className="w-full h-full rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            {!isMobile && (
              <>
                <div className="hidden lg:flex flex-col items-start">
                  <span className="text-xs font-bold text-white/90 truncate max-w-[120px] select-none">
                    {userName || 'User'}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-green-400 select-none">
                    Secure
                  </span>
                </div>
                <ChevronDown className={cn(
                  "hidden lg:block w-3.5 h-3.5 text-white/30 transition-transform",
                  isProfileOpen && "rotate-180"
                )} />
              </>
            )}
          </button>

          {/* Profile Dropdown */}
          <AnimatePresence>
            {isProfileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-56 bg-slate-950/95 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden z-[90]"
              >
                <div className="fixed inset-0 z-[-1]" onClick={() => setIsProfileOpen(false)} />

                {/* Profile Card */}
                <div className="p-4 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10">
                      <img
                        src={userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=memuer-user`}
                        alt={userName || 'User'}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold text-white truncate select-none">{userName || 'User'}</p>
                      <div className="flex items-center gap-1.5">
                        <Shield className="w-2.5 h-2.5 text-green-400" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-green-400 select-none">Encrypted Session</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="p-1.5 flex flex-col gap-0.5">
                  <button
                    onClick={() => {
                      onSettings?.();
                      setIsProfileOpen(false);
                    }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-left text-xs hover:bg-white/10 text-white font-bold transition-all"
                  >
                    <User className="w-4 h-4 text-indigo-400" />
                    <span>Profile & Settings</span>
                  </button>

                  <button
                    onClick={() => {
                      onLogout?.();
                      setIsProfileOpen(false);
                    }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-left text-xs hover:bg-red-500/15 text-white font-bold transition-all group"
                  >
                    <LogOut className="w-4 h-4 text-red-400 group-hover:text-red-300" />
                    <span className="group-hover:text-red-300 transition-colors">Disconnect &amp; Logout</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
