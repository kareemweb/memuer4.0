/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  status?: string;
  publicKey?: string;
  isOnline?: boolean;
  lastSeen?: string;
  currentPeerId?: string;
  vaultSynced?: boolean;
  role?: string;
  email?: string;
  bannedUntil?: string;
  preferences?: {
    theme?: string;
    chatBackground?: string;
  };
}

export interface ChatSession {
  id: string;
  name?: string;
  type: 'direct' | 'group';
  ownerId?: string;
  participants: string[];
  participantKeys?: Record<string, string>;
  groupKey?: string; // Symmetric key, only used in memory after decryption
  groupKeys?: Record<string, { content: string; nonce: string }>; // userId -> Encrypted symmetric key
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
  typing?: Record<string, boolean>;
  activeCall?: {
    callerId: string;
    callerName?: string;
    type: 'voice' | 'video';
    status: 'active' | 'ended';
    createdAt: string;
  };
  archivedBy?: string[];
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string; // Encrypted base64
  nonce: string; // Encryption nonce base64
  type: 'text' | 'file' | 'call' | 'audio';
  fileMetadata?: {
    name: string;
    size: number;
    mimeType: string;
    storagePath: string;
  };
  duration?: number;
  reactions?: Record<string, string[]>; // emoji -> list of user uids
  createdAt: string;
}

export interface FriendRequest {
  id: string;
  from: string;
  to: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  senderProfile?: UserProfile;
}

export interface AuthState {
  user: UserProfile | null;
  loading: boolean;
}
