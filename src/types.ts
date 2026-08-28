export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  status?: string;
  publicKey?: string;
  isOnline?: boolean;
  lastSeen?: string;
  isAdmin?: boolean;
  role?: string;
  email?: string;
  currentPeerId?: string | null;
  preferences?: {
    theme?: string;
    animatedTheme?: boolean;
    animationLook?: string;
    starsSpeed?: number;
    chatBackground?: string;
    customChatBg?: string;
    blockedUsers?: string[];
    mutedChats?: string[];
    pinnedChats?: string[];
    hasSeenDemo?: boolean;
  };
  bannedUntil?: string;
  isHiddenFromDirectory?: boolean;
  canMessageAnyone?: boolean;
}

export interface ChatSession {
  id: string;
  name?: string;
  type: 'direct' | 'group';
  participants: string[];
  participantKeys?: Record<string, string>;
  createdAt?: any;
  updatedAt?: any;
  lastMessage?: string;
  typing?: Record<string, boolean>;
  archivedBy?: string[];
  activeCall?: any;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  nonce: string;
  type: 'text' | 'file' | 'call' | 'audio';
  duration?: number;
  fileMetadata?: {
    name: string;
    size: number;
    mimeType: string;
    storagePath: string;
  };
  reactions?: Record<string, string[]>;
  isRead?: boolean;
  createdAt: any;
}

export interface FriendRequest {
  id: string;
  from: string;
  to: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: any;
  senderProfile?: UserProfile;
}
