import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Heart, MessageCircle, Send, Bookmark, User, Grid, 
  Tv, PlusSquare, MoreHorizontal, Settings, Edit3, Camera, 
  Video, Compass, Sparkles, Smile, Share2, Check, Volume2, 
  VolumeX, Eye, X, Home, MapPin, Image, Maximize2, Minimize2,
  Play, Pause, Trash2, Info, Shield, Lock, Bell, Flag
} from 'lucide-react';
import { 
  collection, doc, getDoc, setDoc, addDoc, updateDoc, onSnapshot, query, orderBy, limit, deleteDoc
} from 'firebase/firestore';
import { isDefaultSandbox } from '../lib/firebase';
import { createClient } from '@supabase/supabase-js';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  encryptMessage, getStoredKeyPair, generateKeyPair, storeKeyPair 
} from '../lib/crypto';

interface MemuerSocialProps {
  user: any;
  onClose: () => void;
  currentTheme: any;
  themeName: string;
  contacts?: any[];
  db?: any;
  deepLinkShortId?: string | null;
  clearDeepLink?: () => void;
}

interface SocialPost {
  id: string;
  username: string;
  userAvatar: string;
  image: string;
  caption: string;
  location?: string;
  likes: number;
  likedBy: string[];
  comments: Array<{ id: string; username: string; text: string; createdAt: string }>;
  createdAt: string;
  isCustom?: boolean;
  ownerId?: string;
  views?: number;
}

interface MShort {
  id: string;
  username: string;
  userAvatar: string;
  videoUrl: string;
  caption: string;
  musicTitle: string;
  likes: number;
  likedBy: string[];
  commentsCount: number;
  isCustom?: boolean;
  createdAt?: string;
  ownerId?: string;
  views?: number;
}

interface UserStory {
  id: string;
  username: string;
  avatar: string;
  imageUrl: string;
  hasViewed: boolean;
  text?: string;
  ownerId?: string;
  createdAt?: string;
}

const PRESET_IMAGES = [
  { name: "Cyber Tokyo", url: "https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?auto=format&fit=crop&w=800&q=80" },
  { name: "Giza Pyramids", url: "https://images.unsplash.com/photo-1539650116574-8efeb43e2750?auto=format&fit=crop&w=800&q=80" },
  { name: "Liquid Glass Art", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80" },
  { name: "Maldives Sunrise", url: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=800&q=80" },
  { name: "AI Cyberpunk City", url: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80" }
];

const PRESET_SHORTS = [
  { name: "Cyber City Night", url: "https://player.vimeo.com/external/371433846.sd.mp4?s=236da2f3c054f4d8d3ec004753e0286de7c4a170&profile_id=139&oauth2_token_id=57447761" },
  { name: "Egypt Desert Dune", url: "https://player.vimeo.com/external/435674703.sd.mp4?s=7f5a216db493cb0c19a9075cd66d3f02e604f7b6&profile_id=139&oauth2_token_id=57447761" },
  { name: "Ocean Waves Loop", url: "https://player.vimeo.com/external/517602419.sd.mp4?s=d0a2fdf07eb54d6eb75467e2a9b2b5275e7a9f8b&profile_id=139&oauth2_token_id=57447761" },
  { name: "Neon Abstract", url: "https://player.vimeo.com/external/538571822.sd.mp4?s=694432168972ecaf0e8d5bf306fa0dbd7beecb44&profile_id=139&oauth2_token_id=57447761" }
];

export const MemuerSocial: React.FC<MemuerSocialProps> = ({ 
  user, onClose, currentTheme, themeName, contacts = [], db, deepLinkShortId, clearDeepLink 
}) => {
  const { language, setLanguage } = useLanguage();
  const isAr = language === 'ar';
  const [activeTab, setActiveTab] = useState<'feed' | 'shorts' | 'create' | 'profile'>('feed');
  const [feedFilter, setFeedFilter] = useState<'all' | 'trending' | 'following'>('all');
  const [likedHeartEffect, setLikedHeartEffect] = useState<string | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>(() => {
    const saved = localStorage.getItem('social_posts');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      {
        id: 'post_seed_1',
        username: 'cyber.wave',
        userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=cyber.wave',
        image: "https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?auto=format&fit=crop&w=800&q=80",
        caption: 'Late night walk in beautiful cyber Tokyo! 🏮✨',
        location: 'Tokyo, Japan',
        likes: 42,
        likedBy: [],
        comments: [
          { id: 'c1', username: 'egypt.explorer', text: 'This looks incredibly unreal! 😍', createdAt: '2h ago' }
        ],
        createdAt: new Date(Date.now() - 3600000 * 3).toISOString()
      },
      {
        id: 'post_seed_2',
        username: 'egypt.explorer',
        userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=egypt.explorer',
        image: "https://images.unsplash.com/photo-1539650116574-8efeb43e2750?auto=format&fit=crop&w=800&q=80",
        caption: 'Standing before the timeless pyramids of Giza. Absolute magic. 🇪🇬🐪',
        location: 'Giza, Egypt',
        likes: 128,
        likedBy: [],
        comments: [],
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
      }
    ];
  });
  const [shorts, setShorts] = useState<MShort[]>(() => {
    const saved = localStorage.getItem('social_shorts');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      {
        id: 'short_seed_1',
        username: 'neon.runner',
        userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=neon.runner',
        videoUrl: "https://player.vimeo.com/external/371433846.sd.mp4?s=236da2f3c054f4d8d3ec004753e0286de7c4a170&profile_id=139&oauth2_token_id=57447761",
        caption: 'Cyberpunk nights in the digital realm 🌌✨',
        musicTitle: 'Cyber Aesthetics Lo-Fi',
        likes: 234,
        likedBy: [],
        commentsCount: 5,
        isCustom: false
      },
      {
        id: 'short_seed_2',
        username: 'sand.storm',
        userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sand.storm',
        videoUrl: "https://player.vimeo.com/external/435674703.sd.mp4?s=7f5a216db493cb0c19a9075cd66d3f02e604f7b6&profile_id=139&oauth2_token_id=57447761",
        caption: 'Sailing across the golden Egyptian desert sands 🏜️🌬️',
        musicTitle: 'Arabian Night Vibes',
        likes: 512,
        likedBy: [],
        commentsCount: 12,
        isCustom: false
      }
    ];
  });
  const [stories, setStories] = useState<UserStory[]>([]);
  const [selectedStory, setSelectedStory] = useState<UserStory | null>(null);
  const [storyProgress, setStoryProgress] = useState(0);

  // Profile Edit State
  const [bio, setBio] = useState<string>(() => localStorage.getItem('social_bio') || 'Living in the digital glass world. 🥂✨ #memuer');
  const [profilePic, setProfilePic] = useState<string>(user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid || 'default'}`);
  const [displayName, setDisplayName] = useState<string>(user?.displayName || 'Memuer Citizen');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [uploadingProfilePic, setUploadingProfilePic] = useState(false);
  const [tempBio, setTempBio] = useState(bio);
  const [tempPic, setTempPic] = useState(profilePic);
  const [tempName, setTempName] = useState(displayName);

  // Creation State
  const [createType, setCreateType] = useState<'post' | 'short' | 'story'>('post');
  const [captionInput, setCaptionInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [selectedImageTemplate, setSelectedImageTemplate] = useState(0);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [selectedVideoTemplate, setSelectedVideoTemplate] = useState(0);
  const [musicInput, setMusicInput] = useState('Chill Aesthetic Lo-Fi');

  // Media uploading state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Followed users and follower counts states
  const [followedUsers, setFollowedUsers] = useState<string[]>([]);
  const [followerCount, setFollowerCount] = useState<number>(0);

  // Sharing state
  const [sharingContent, setSharingContent] = useState<{ type: 'post' | 'short'; id: string; caption: string; url: string } | null>(null);
  const [sharedStatus, setSharedStatus] = useState<Record<string, 'idle' | 'sending' | 'success'>>({});
  
  // Custom interaction overlays (Delete confirm & Info overlay)
  const [deletingContent, setDeletingContent] = useState<{ type: 'post' | 'short'; id: string } | null>(null);
  const [reportingItem, setReportingItem] = useState<{ type: 'post' | 'short'; id: string; item: any } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [infoContent, setInfoContent] = useState<{ type: 'post' | 'short'; id?: string; item?: any; caption: string; date: string; views: number; likes: number } | null>(null);

  const handleDeleteContent = async (type: 'post' | 'short', id: string) => {
    try {
      if (type === 'post') {
        if (db) {
          await deleteDoc(doc(db, 'social_posts', id));
        } else {
          const updated = posts.filter(p => p.id !== id);
          setPosts(updated);
          localStorage.setItem('social_posts', JSON.stringify(updated));
        }
      } else {
        if (db) {
          await deleteDoc(doc(db, 'social_shorts', id));
        } else {
          const updated = shorts.filter(s => s.id !== id);
          setShorts(updated);
          localStorage.setItem('social_shorts', JSON.stringify(updated));
        }
      }
      setDeletingContent(null);
    } catch (err) {
      console.error("Error deleting content:", err);
    }
  };

  const handleReportSubmit = async () => {
    if (!reportingItem) return;
    if (!reportReason.trim()) {
      alert("Please provide a reason for the report.");
      return;
    }

    const reportPayload = {
      itemId: reportingItem.id,
      itemType: reportingItem.type,
      itemCaption: reportingItem.item.caption || '',
      itemImage: reportingItem.item.image || reportingItem.item.videoUrl || '',
      itemUsername: reportingItem.item.username || '',
      itemOwnerId: reportingItem.item.ownerId || '',
      reporterUsername: user?.displayName || user?.email || 'Anonymous',
      reporterId: user?.uid || 'guest',
      reason: reportReason.trim(),
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    if (db) {
      try {
        await addDoc(collection(db, 'social_reports'), reportPayload);
        alert("Content reported successfully. Administrators have been notified.");
      } catch (err) {
        console.error("Error submitting report to Firestore:", err);
        alert("Report could not be uploaded to Firestore. Using offline fallback.");
      }
    } else {
      const savedReports = JSON.parse(localStorage.getItem('social_reports') || '[]');
      savedReports.push({ id: 'report_' + Date.now(), ...reportPayload });
      localStorage.setItem('social_reports', JSON.stringify(savedReports));
      alert("Content reported (Local storage fallback).");
    }

    setReportingItem(null);
    setReportReason('');
  };

  const handleToggleFollow = async (authorUsername: string, authorId?: string) => {
    const targetId = authorId || authorUsername;
    const isFollowing = followedUsers.includes(targetId);

    if (db) {
      const followDocId = `follow_${user?.uid}_${targetId}`;
      try {
        if (isFollowing) {
          await deleteDoc(doc(db, 'social_follows', followDocId));
        } else {
          await setDoc(doc(db, 'social_follows', followDocId), {
            followerId: user?.uid,
            followedId: targetId,
            followedUsername: authorUsername,
            createdAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error("Error toggling follow in Firestore:", err);
      }
    } else {
      let updated;
      if (isFollowing) {
        updated = followedUsers.filter(id => id !== targetId);
      } else {
        updated = [...followedUsers, targetId];
      }
      setFollowedUsers(updated);
      localStorage.setItem('social_follows', JSON.stringify(updated));
      // Simulate follow count
      setFollowerCount(updated.length);
    }
  };

  // Shorts state
  const [currentShortIndex, setCurrentShortIndex] = useState(0);
  const [activeShortIndex, setActiveShortIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [profileSubTab, setProfileSubTab] = useState<'photos' | 'shorts' | 'playlists'>('photos');
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [savingItem, setSavingItem] = useState<{ type: 'post' | 'short'; id: string; item: any } | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedPlaylistIdForView, setSelectedPlaylistIdForView] = useState<string | null>(null);
  const selectedPlaylistForView = playlists.find(p => p.id === selectedPlaylistIdForView) || null;
  const [isMuted, setIsMuted] = useState(true);
  const [doubleTapHeart, setDoubleTapHeart] = useState<{ id: string; x: number; y: number } | null>(null);
  const [commentOpenPostId, setCommentOpenPostId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [videoFitMap, setVideoFitMap] = useState<Record<string, 'contain' | 'cover'>>({});
  const [pausedMap, setPausedMap] = useState<Record<string, boolean>>({});
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  // Story Creation UI Option
  const [storyTextInput, setStoryTextInput] = useState('');
  const [storyGradientIndex, setStoryGradientIndex] = useState(0);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const clientHeight = containerRef.current.clientHeight;
    if (clientHeight === 0) return;
    const index = Math.round(scrollTop / clientHeight);
    if (index !== activeShortIndex && index >= 0 && index < shorts.length) {
      setActiveShortIndex(index);
    }
  };

  // Dynamic media upload handler supporting ImgBB for images and Supabase Storage for videos with robust fallbacks
  const uploadFileInChunks = async (file: File, onProgress?: (pct: number) => void): Promise<string> => {
    const isImage = file.type.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(file.name);
    const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name);

    if (isImage) {
      console.log("Initiating ImgBB upload for image:", file.name);

      // 1. Try server-side proxy upload first
      try {
        console.log("Attempting server-side ImgBB proxy upload for social image...");
        const fileToBase64 = (f: File): Promise<string> => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(f);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (e) => reject(e);
          });
        };
        const fileData = await fileToBase64(file);
        const res = await fetch("/api/upload-imgbb", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, fileData }),
        });
        if (res.ok) {
          const resJson = await res.json();
          if (resJson && resJson.url) {
            console.log("Server-side ImgBB proxy upload succeeded for social image:", resJson.url);
            if (onProgress) onProgress(100);
            return resJson.url;
          }
        }
      } catch (err) {
        console.warn("Server-side ImgBB proxy upload failed for social image, attempting client direct upload:", err);
      }

      // 2. Fall back to client-side direct upload
      const apiKey = import.meta.env.VITE_IMGBB_API_KEY;
      if (!apiKey) {
        console.warn("Neither server nor client VITE_IMGBB_API_KEY is configured! Using local Base64 fallback.");
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
            if (onProgress) onProgress(100);
            resolve(reader.result as string);
          };
          reader.onerror = (err) => reject(err);
        });
      }

      const formData = new FormData();
      formData.append("image", file);

      return new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `https://api.imgbb.com/1/upload?key=${apiKey}`);

        if (xhr.upload && onProgress) {
          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              const pct = Math.round((event.loaded / event.total) * 100);
              onProgress(pct);
            }
          });
        }

        xhr.onload = () => {
          try {
            if (xhr.status >= 200 && xhr.status < 300) {
              const res = JSON.parse(xhr.responseText);
              if (res && res.success && res.data && res.data.url) {
                console.log("ImgBB upload succeeded:", res.data.url);
                resolve(res.data.url);
              } else {
                reject(new Error("ImgBB did not return a valid direct image URL."));
              }
            } else {
              const errRes = JSON.parse(xhr.responseText || "{}");
              reject(new Error(errRes?.error?.message || `ImgBB returned status ${xhr.status}`));
            }
          } catch (e: any) {
            reject(new Error(`Failed to parse ImgBB response: ${e.message}`));
          }
        };

        xhr.onerror = () => reject(new Error("ImgBB network error."));
        xhr.send(formData);
      });

    } else if (isVideo) {
      console.log("Initiating Supabase Storage upload for video:", file.name);
      
      // 1. Try server-side proxy upload first
      try {
        console.log("Attempting server-side Supabase video proxy upload...");
        const fileToBase64 = (f: File): Promise<string> => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(f);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (e) => reject(e);
          });
        };
        const fileData = await fileToBase64(file);
        if (onProgress) onProgress(30);
        const res = await fetch("/api/upload-supabase-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, fileData, mimeType: file.type }),
        });
        if (res.ok) {
          const resJson = await res.json();
          if (resJson && resJson.url) {
            console.log("Server-side Supabase video proxy upload succeeded for social video:", resJson.url);
            if (onProgress) onProgress(100);
            return resJson.url;
          }
        }
      } catch (err) {
        console.warn("Server-side Supabase video proxy upload failed, attempting client direct upload:", err);
      }

      // 2. Fall back to client-side direct upload
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Supabase is not configured! Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.");
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const uniquePath = `${Date.now()}_${file.name}`;

      if (onProgress) onProgress(50);

      try {
        const { data, error } = await supabase.storage
          .from('videos')
          .upload(uniquePath, file);

        if (error) {
          throw error;
        }

        if (onProgress) onProgress(85);

        const publicUrlResult = supabase.storage.from('videos').getPublicUrl(data.path);
        const publicUrl = publicUrlResult?.data?.publicUrl;
        if (!publicUrl) {
          throw new Error("Could not retrieve a valid public URL for the uploaded video.");
        }

        if (onProgress) onProgress(100);
        return publicUrl;
      } catch (err: any) {
        console.error("Supabase video upload failed:", err);
        throw err;
      }

    } else {
      console.warn("Unsupported file type for dual-upload. Falling back to local ObjectURL.");
      if (onProgress) onProgress(100);
      return URL.createObjectURL(file);
    }
  };

  // Upload Handlers
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setUploadProgress(0);
      setUploadError(null);

      // Check file size (e.g. 150MB limit)
      if (file.size > 150 * 1024 * 1024) {
        throw new Error("File is too large. Please select an image smaller than 150MB.");
      }

      const fileUrl = await uploadFileInChunks(file, (pct) => setUploadProgress(pct));
      setImageUrlInput(fileUrl);
      setSelectedImageTemplate(-1);
      setUploadError(null);
    } catch (err: any) {
      console.error("Photo upload error:", err);
      setUploadError(err.message || "Failed to upload photo to server.");
      // Fallback: use an object URL so it still displays and works in the current session
      const fallbackUrl = URL.createObjectURL(file);
      setImageUrlInput(fallbackUrl);
      setSelectedImageTemplate(-1);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setUploadProgress(0);
      setUploadError(null);

      // Check file size (e.g. 150MB limit)
      if (file.size > 150 * 1024 * 1024) {
        throw new Error("File is too large. Please select a video smaller than 150MB.");
      }

      const fileUrl = await uploadFileInChunks(file, (pct) => setUploadProgress(pct));
      setVideoUrlInput(fileUrl);
      setSelectedVideoTemplate(-1);
      setUploadError(null);
    } catch (err: any) {
      console.error("Video upload error:", err);
      setUploadError(err.message || "Failed to upload video to server.");
      // Strictly do not fall back to local blob URL to avoid publishing broken links
      setSelectedVideoTemplate(-1);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Direct DM Sharing Handler
  const handleShareToContact = async (contact: any) => {
    if (!user?.uid || !db || !sharingContent) return;
    
    setSharedStatus(prev => ({ ...prev, [contact.uid]: 'sending' }));

    // Deterministic ID for direct chats to avoid duplicates
    const participants = [user.uid, contact.uid].sort();
    const dmId = `dm_${participants[0]}_${participants[1]}`;
    
    try {
      // 1. Ensure DM Chat exists, or create it
      const chatDocRef = doc(db, 'chats', dmId);
      const chatDoc = await getDoc(chatDocRef);
      
      if (!chatDoc.exists()) {
        const chatData = {
          type: 'direct',
          participants,
          participantKeys: {
            [user.uid]: user.publicKey || 'mock-primary-key',
            [contact.uid]: contact.publicKey || 'mock-target-key'
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(chatDocRef, chatData);
      }

      // 2. Encrypt and Send Message
      const messageText = sharingContent.type === 'short' 
        ? `🎥 Shared from Memuer Social+: "${sharingContent.caption}"\n[short_id:${sharingContent.id}]\n${sharingContent.url}`
        : `🖼️ Shared from Memuer Social+: "${sharingContent.caption}"\n${sharingContent.url}`;

      // Get key pair for encryption
      let localKeys = getStoredKeyPair(user.uid);
      if (!localKeys) {
        localKeys = generateKeyPair();
        storeKeyPair(user.uid, localKeys);
      }

      let encryptedData = { content: messageText, nonce: '' };
      if (contact.publicKey && localKeys) {
        encryptedData = encryptMessage(messageText, contact.publicKey, localKeys.secretKey);
      } else {
        encryptedData = encryptMessage(messageText, '', '');
      }

      // Add to messages subcollection
      await addDoc(collection(db, `chats/${dmId}/messages`), {
        chatId: dmId,
        senderId: user.uid,
        content: encryptedData.content,
        nonce: encryptedData.nonce,
        type: 'text',
        createdAt: new Date().toISOString()
      });

      // Update last message in chat list
      await updateDoc(chatDocRef, {
        lastMessage: sharingContent.type === 'short' ? `🎥 Shared video` : `🖼️ Shared photo`,
        updatedAt: new Date().toISOString()
      });

      setSharedStatus(prev => ({ ...prev, [contact.uid]: 'success' }));
      setTimeout(() => {
        setSharedStatus(prev => ({ ...prev, [contact.uid]: 'idle' }));
      }, 2000);
    } catch (err) {
      console.error("Error sharing to contact:", err);
      setSharedStatus(prev => ({ ...prev, [contact.uid]: 'idle' }));
    }
  };

  const GRADIENTS = [
    'from-indigo-600 to-purple-600',
    'from-pink-500 via-red-500 to-yellow-500',
    'from-teal-400 to-cyan-500',
    'from-blue-600 to-indigo-900',
    'from-slate-800 to-slate-950'
  ];

  // One-time database seeding check
  useEffect(() => {
    if (!db) return;
    const runSeeding = async () => {
      try {
        const seedingRef = doc(db, 'system', 'seeding');
        const seedingSnap = await getDoc(seedingRef);
        if (!seedingSnap.exists() || !seedingSnap.data().social_seeded) {
          const defaultPosts: SocialPost[] = [
            {
              id: 'post_seed_1',
              username: 'cyber.wave',
              userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=cyber.wave',
              image: PRESET_IMAGES[0].url,
              caption: 'Late night walk in beautiful cyber Tokyo! 🏮✨',
              location: 'Tokyo, Japan',
              likes: 42,
              likedBy: [],
              comments: [
                { id: 'c1', username: 'egypt.explorer', text: 'This looks incredibly unreal! 😍', createdAt: '2h ago' }
              ],
              createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
              isCustom: false,
              ownerId: 'system-seed',
              views: 20
            },
            {
              id: 'post_seed_2',
              username: 'egypt.explorer',
              userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=egypt.explorer',
              image: PRESET_IMAGES[1].url,
              caption: 'Standing before the timeless pyramids of Giza. Absolute magic. 🇪🇬🐪',
              location: 'Giza, Egypt',
              likes: 128,
              likedBy: [],
              comments: [],
              createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
              isCustom: false,
              ownerId: 'system-seed',
              views: 128
            }
          ];

          for (const p of defaultPosts) {
            await setDoc(doc(db, 'social_posts', p.id), p);
          }

          const defaultShorts: MShort[] = [
            {
              id: 'short_seed_1',
              username: 'neon.runner',
              userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=neon.runner',
              videoUrl: PRESET_SHORTS[0].url,
              caption: 'Cyberpunk nights in the digital realm 🌌✨',
              musicTitle: 'Cyber Aesthetics Lo-Fi',
              likes: 234,
              likedBy: [],
              commentsCount: 5,
              isCustom: false,
              createdAt: new Date().toISOString(),
              ownerId: 'system-seed',
              views: 45
            },
            {
              id: 'short_seed_2',
              username: 'sand.storm',
              userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sand.storm',
              videoUrl: PRESET_SHORTS[1].url,
              caption: 'Sailing across the golden Egyptian desert sands 🏜️🌬️',
              musicTitle: 'Arabian Night Vibes',
              likes: 512,
              likedBy: [],
              commentsCount: 12,
              isCustom: false,
              createdAt: new Date().toISOString(),
              ownerId: 'system-seed',
              views: 78
            }
          ];

          for (const s of defaultShorts) {
            await setDoc(doc(db, 'social_shorts', s.id), s);
          }

          await setDoc(seedingRef, { social_seeded: true });
        }
      } catch (err) {
        console.error("Failed to seed database:", err);
      }
    };
    runSeeding();
  }, [db]);

  // Initialize Data from Firestore
  useEffect(() => {
    if (!db) {
      // Fallback to local storage if Firestore is not available
      const savedPosts = localStorage.getItem('social_posts') || '[]';
      const savedShorts = localStorage.getItem('social_shorts') || '[]';
      const savedStories = localStorage.getItem('social_stories') || '[]';
      const savedFollows = localStorage.getItem('social_follows') || '[]';
      const savedPlaylists = localStorage.getItem('social_playlists') || '[]';
      setPosts(JSON.parse(savedPosts));
      setShorts(JSON.parse(savedShorts));
      const parsedStories = JSON.parse(savedStories);
      const now = Date.now();
      const filteredStories = parsedStories.filter((s: any) => {
        const createdAt = s.createdAt || '';
        const isExpired = createdAt && (now - new Date(createdAt).getTime() > 24 * 60 * 60 * 1000);
        return !isExpired;
      });
      setStories(filteredStories);
      setPlaylists(JSON.parse(savedPlaylists));
      const parsedFollows = JSON.parse(savedFollows);
      setFollowedUsers(parsedFollows);
      setFollowerCount(parsedFollows.length);
      return;
    }

    // Subscribe to posts (sorted in-memory to prevent indexing failures and missing createdAt field issues)
    const postsQuery = collection(db, 'social_posts');
    const unsubscribePosts = onSnapshot(postsQuery, (snapshot) => {
      const postsData: SocialPost[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        postsData.push({
          id: doc.id,
          username: data.username || '',
          userAvatar: data.userAvatar || '',
          image: data.image || '',
          caption: data.caption || '',
          location: data.location || '',
          likes: data.likes || 0,
          likedBy: data.likedBy || [],
          comments: data.comments || [],
          createdAt: data.createdAt || '',
          isCustom: data.isCustom ?? true,
          ownerId: data.ownerId || '',
          views: data.views || Math.floor(Math.random() * 25) + 5
        });
      });

      // Sort in memory desc
      postsData.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      setPosts(postsData);
    }, (error: any) => {
      if (error?.code === 'resource-exhausted' || error?.message?.includes('Quota limit exceeded') || error?.message?.includes('Quota exceeded')) {
        console.warn("social_posts sync paused due to environment limits.");
      } else {
        console.warn("Error reading social_posts from Firestore:", error);
      }
    });

    // Subscribe to shorts (sorted in-memory to prevent indexing failures and ensure all load properly)
    const shortsQuery = collection(db, 'social_shorts');
    const unsubscribeShorts = onSnapshot(shortsQuery, (snapshot) => {
      const shortsData: MShort[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        shortsData.push({
          id: doc.id,
          username: data.username || '',
          userAvatar: data.userAvatar || '',
          videoUrl: data.videoUrl || '',
          caption: data.caption || '',
          musicTitle: data.musicTitle || '',
          likes: data.likes || 0,
          likedBy: data.likedBy || [],
          commentsCount: data.commentsCount || 0,
          isCustom: data.isCustom ?? true,
          createdAt: data.createdAt || '',
          ownerId: data.ownerId || '',
          views: data.views || Math.floor(Math.random() * 45) + 8
        });
      });

      // Sort in-memory by id or index to maintain consistency
      shortsData.sort((a, b) => b.id.localeCompare(a.id));

      setShorts(shortsData);
    }, (error: any) => {
      if (error?.code === 'resource-exhausted' || error?.message?.includes('Quota limit exceeded') || error?.message?.includes('Quota exceeded')) {
        console.warn("social_shorts sync paused due to environment limits.");
      } else {
        console.warn("Error reading social_shorts from Firestore:", error);
      }
    });

    // Subscribe to stories
    const storiesQuery = collection(db, 'social_stories');
    const unsubscribeStories = onSnapshot(storiesQuery, (snapshot) => {
      const storiesData: UserStory[] = [];
      const now = Date.now();
      snapshot.forEach((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt || '';
        const isExpired = createdAt && (now - new Date(createdAt).getTime() > 24 * 60 * 60 * 1000);
        if (!isExpired) {
          storiesData.push({
            id: doc.id,
            username: data.username || '',
            avatar: data.avatar || '',
            imageUrl: data.imageUrl || '',
            text: data.text || '',
            hasViewed: data.hasViewed || false,
            ownerId: data.ownerId || '',
            createdAt: createdAt
          });
        }
      });
      setStories(storiesData);
    }, (error: any) => {
      if (error?.code === 'resource-exhausted' || error?.message?.includes('Quota limit exceeded') || error?.message?.includes('Quota exceeded')) {
        console.warn("social_stories sync paused due to environment limits.");
      } else {
        console.warn("Error reading social_stories from Firestore:", error);
      }
    });

    // Subscribe to social follows
    const followsQuery = collection(db, 'social_follows');
    const unsubscribeFollows = onSnapshot(followsQuery, (snapshot) => {
      const list: string[] = [];
      let myFollowersCount = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.followerId === user?.uid) {
          list.push(data.followedId || data.followedUsername);
        }
        if (data.followedId === user?.uid || (data.followedUsername && data.followedUsername === (displayName || 'Memuer Citizen').toLowerCase().replace(/\s+/g, '.'))) {
          myFollowersCount++;
        }
      });
      setFollowedUsers(list);
      setFollowerCount(myFollowersCount);
    }, (error: any) => {
      if (error?.code === 'resource-exhausted' || error?.message?.includes('Quota limit exceeded') || error?.message?.includes('Quota exceeded')) {
        console.warn("social_follows sync paused due to environment limits.");
      } else {
        console.warn("Error reading social_follows from Firestore:", error);
      }
    });

    // Subscribe to social playlists
    const playlistsQuery = collection(db, 'social_playlists');
    const unsubscribePlaylists = onSnapshot(playlistsQuery, (snapshot) => {
      const plist: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.ownerId === user?.uid) {
          plist.push({
            id: doc.id,
            ...data
          });
        }
      });
      setPlaylists(plist);
    }, (error: any) => {
      if (error?.code === 'resource-exhausted' || error?.message?.includes('Quota limit exceeded') || error?.message?.includes('Quota exceeded')) {
        console.warn("social_playlists sync paused due to environment limits.");
      } else {
        console.warn("Error reading social_playlists from Firestore:", error);
      }
    });

    return () => {
      unsubscribePosts();
      unsubscribeShorts();
      unsubscribeStories();
      unsubscribeFollows();
      unsubscribePlaylists();
    };
  }, [db, user, displayName]);

  // Deep linking to specific short
  useEffect(() => {
    if (deepLinkShortId && shorts.length > 0) {
      const index = shorts.findIndex(s => s.id === deepLinkShortId);
      if (index !== -1) {
        setActiveTab('shorts');
        setActiveShortIndex(index);
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = index * containerRef.current.clientHeight;
          }
        }, 300);
      }
      clearDeepLink?.();
    }
  }, [deepLinkShortId, shorts, clearDeepLink]);

  // Video playback active controller
  useEffect(() => {
    if (activeTab !== 'shorts') {
      // Pause all videos when exiting shorts tab
      Object.keys(videoRefs.current).forEach(id => {
        const videoEl = videoRefs.current[id];
        if (videoEl) {
          try { videoEl.pause(); } catch (e) {}
        }
      });
      return;
    }

    shorts.forEach((short, idx) => {
      const videoEl = videoRefs.current[short.id];
      if (videoEl) {
        if (idx === activeShortIndex) {
          if (!pausedMap[short.id]) {
            videoEl.play().catch(err => {
              console.log("Auto play prevented by browser:", err);
            });
          } else {
            videoEl.pause();
          }
        } else {
          videoEl.pause();
        }
      }
    });
  }, [activeShortIndex, activeTab, shorts, pausedMap]);

  // Story Progress Effect
  useEffect(() => {
    let timer: any;
    if (selectedStory) {
      setStoryProgress(0);
      timer = setInterval(() => {
        setStoryProgress(prev => {
          if (prev >= 100) {
            handleStoryNext();
            return 0;
          }
          return prev + 2.5; // Tick up
        });
      }, 100);
    }
    return () => clearInterval(timer);
  }, [selectedStory]);

  const handleStoryNext = () => {
    if (!selectedStory) return;
    const currentIndex = stories.findIndex(s => s.id === selectedStory.id);
    if (currentIndex < stories.length - 1) {
      // Mark viewed
      setStories(prev => {
        const updated = prev.map(s => s.id === selectedStory.id ? { ...s, hasViewed: true } : s);
        localStorage.setItem('social_stories', JSON.stringify(updated));
        return updated;
      });
      setSelectedStory(stories[currentIndex + 1]);
    } else {
      // Close
      setStories(prev => {
        const updated = prev.map(s => s.id === selectedStory.id ? { ...s, hasViewed: true } : s);
        localStorage.setItem('social_stories', JSON.stringify(updated));
        return updated;
      });
      setSelectedStory(null);
    }
  };

  const handleStoryPrev = () => {
    if (!selectedStory) return;
    const currentIndex = stories.findIndex(s => s.id === selectedStory.id);
    if (currentIndex > 0) {
      setSelectedStory(stories[currentIndex - 1]);
    }
  };

  // Double Tap Like Animation Handler
  const handleDoubleTap = (postId: string, e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setDoubleTapHeart({ id: postId, x, y });
    setTimeout(() => setDoubleTapHeart(null), 800);

    // Trigger Like
    handleLikePost(postId);
  };

  // Like Handlers
  const handleLikePost = async (postId: string) => {
    const userUid = user?.uid || 'guest';
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const isLiked = post.likedBy.includes(userUid);
    const newLikedBy = isLiked 
      ? post.likedBy.filter(uid => uid !== userUid) 
      : [...post.likedBy, userUid];
    const newLikes = isLiked ? Math.max(0, post.likes - 1) : post.likes + 1;

    // Optimistic UI
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: newLikes, likedBy: newLikedBy } : p));

    if (db) {
      try {
        const postRef = doc(db, 'social_posts', postId);
        await updateDoc(postRef, {
          likes: newLikes,
          likedBy: newLikedBy
        });
      } catch (err) {
        console.error("Error liking post in Firestore:", err);
      }
    } else {
      localStorage.setItem('social_posts', JSON.stringify(posts.map(p => p.id === postId ? { ...p, likes: newLikes, likedBy: newLikedBy } : p)));
    }
  };

  const handleLikeShort = async (shortId: string) => {
    const userUid = user?.uid || 'guest';
    const short = shorts.find(s => s.id === shortId);
    if (!short) return;

    const isLiked = short.likedBy.includes(userUid);
    const newLikedBy = isLiked 
      ? short.likedBy.filter(uid => uid !== userUid) 
      : [...short.likedBy, userUid];
    const newLikes = isLiked ? Math.max(0, short.likes - 1) : short.likes + 1;

    // Optimistic UI
    setShorts(prev => prev.map(s => s.id === shortId ? { ...s, likes: newLikes, likedBy: newLikedBy } : s));

    if (db) {
      try {
        const shortRef = doc(db, 'social_shorts', shortId);
        await updateDoc(shortRef, {
          likes: newLikes,
          likedBy: newLikedBy
        });
      } catch (err) {
        console.error("Error liking short in Firestore:", err);
      }
    } else {
      localStorage.setItem('social_shorts', JSON.stringify(shorts.map(s => s.id === shortId ? { ...s, likes: newLikes, likedBy: newLikedBy } : s)));
    }
  };

  // Comment Handlers
  const handleAddComment = async (postId: string) => {
    if (!newCommentText.trim()) return;
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const newComment = {
      id: 'comment_' + Date.now(),
      username: displayName,
      text: newCommentText.trim(),
      createdAt: 'Just now'
    };

    const updatedComments = [...post.comments, newComment];

    // Optimistic UI
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: updatedComments } : p));
    setNewCommentText('');

    if (db) {
      try {
        const postRef = doc(db, 'social_posts', postId);
        await updateDoc(postRef, {
          comments: updatedComments
        });
      } catch (err) {
        console.error("Error adding comment in Firestore:", err);
      }
    } else {
      localStorage.setItem('social_posts', JSON.stringify(posts.map(p => p.id === postId ? { ...p, comments: updatedComments } : p)));
    }
  };

  // Create Post/Short/Story Handler
  const handlePublish = async () => {
    const authorUsername = (displayName || 'Memuer Citizen').toLowerCase().replace(/\s+/g, '.');

    // Validation to prevent publishing broken local blob URLs to the database
    if (createType === 'short') {
      const finalVideo = videoUrlInput.trim() || PRESET_SHORTS[selectedVideoTemplate].url;
      if (finalVideo.startsWith('blob:')) {
        setUploadError("This video is stored locally in your browser and could not be uploaded to the server. Please check the upload error above or select a smaller video to publish it globally.");
        return;
      }
    } else if (createType === 'post') {
      const finalImage = imageUrlInput.trim() || PRESET_IMAGES[selectedImageTemplate].url;
      if (finalImage.startsWith('blob:')) {
        setUploadError("This image is stored locally in your browser and could not be uploaded to the server. Please try uploading a smaller image to publish it globally.");
        return;
      }
    }
    
    if (createType === 'post') {
      const finalImage = imageUrlInput.trim() || PRESET_IMAGES[selectedImageTemplate].url;
      const newPost = {
        username: authorUsername,
        userAvatar: profilePic,
        image: finalImage,
        caption: captionInput || 'Living in the moment. ✨',
        location: locationInput || 'Memuer Space',
        likes: 0,
        likedBy: [],
        comments: [],
        createdAt: new Date().toISOString(),
        isCustom: true,
        ownerId: user?.uid || '',
        views: 0
      };

      if (db) {
        try {
          await addDoc(collection(db, 'social_posts'), newPost);
        } catch (err) {
          console.error("Error writing post to Firestore:", err);
        }
      } else {
        const localPost: SocialPost = { ...newPost, id: 'post_' + Date.now() };
        const updated = [localPost, ...posts];
        setPosts(updated);
        localStorage.setItem('social_posts', JSON.stringify(updated));
      }
    } else if (createType === 'short') {
      const finalVideo = videoUrlInput.trim() || PRESET_SHORTS[selectedVideoTemplate].url;
      const newShort = {
        username: authorUsername,
        userAvatar: profilePic,
        videoUrl: finalVideo,
        caption: captionInput || 'No caption provided.',
        musicTitle: musicInput || 'Original Audio',
        likes: 0,
        likedBy: [],
        commentsCount: 0,
        createdAt: new Date().toISOString(),
        isCustom: true,
        ownerId: user?.uid || '',
        views: 0
      };

      if (db) {
        try {
          await addDoc(collection(db, 'social_shorts'), newShort);
        } catch (err) {
          console.error("Error writing short to Firestore:", err);
        }
      } else {
        const localShort: MShort = { ...newShort, id: 'short_' + Date.now() };
        const updated = [localShort, ...shorts];
        setShorts(updated);
        localStorage.setItem('social_shorts', JSON.stringify(updated));
      }
    } else if (createType === 'story') {
      const bgGradientClass = GRADIENTS[storyGradientIndex];
      const newStory = {
        username: authorUsername,
        avatar: profilePic,
        imageUrl: bgGradientClass,
        text: storyTextInput || 'Hello world! 👋',
        hasViewed: false,
        createdAt: new Date().toISOString(),
        ownerId: user?.uid || 'guest'
      };

      if (db) {
        try {
          await addDoc(collection(db, 'social_stories'), newStory);
        } catch (err) {
          console.error("Error writing story to Firestore:", err);
        }
      } else {
        const localStory: UserStory = { ...newStory, id: 'story_' + Date.now() };
        const updated = [localStory, ...stories];
        setStories(updated);
        localStorage.setItem('social_stories', JSON.stringify(updated));
      }
    }

    // Reset fields & swap tab
    setCaptionInput('');
    setLocationInput('');
    setImageUrlInput('');
    setVideoUrlInput('');
    setStoryTextInput('');
    if (createType === 'short') {
      setActiveTab('shorts');
      setActiveShortIndex(0);
    } else {
      setActiveTab('feed');
    }
  };

  // Playlist management helper functions
  const handleSaveToPlaylist = async (playlistId: string) => {
    if (!savingItem) return;
    const targetPlaylist = playlists.find(p => p.id === playlistId);
    if (!targetPlaylist) return;

    // Check for duplicate items
    const alreadyExists = targetPlaylist.items?.some((i: any) => i.id === savingItem.id);
    if (alreadyExists) {
      alert(`This item is already saved in "${targetPlaylist.name}"!`);
      setSavingItem(null);
      return;
    }

    const itemPayload = {
      id: savingItem.id,
      type: savingItem.type,
      username: savingItem.item.username || '',
      userAvatar: savingItem.item.userAvatar || '',
      caption: savingItem.item.caption || '',
      createdAt: savingItem.item.createdAt || '',
      ownerId: savingItem.item.ownerId || '',
      ...(savingItem.type === 'post' 
        ? { image: savingItem.item.image || '', location: savingItem.item.location || '', likes: savingItem.item.likes || 0, comments: savingItem.item.comments || [] } 
        : { videoUrl: savingItem.item.videoUrl || '', musicTitle: savingItem.item.musicTitle || '', likes: savingItem.item.likes || 0, commentsCount: savingItem.item.commentsCount || 0 }
      )
    };

    const updatedItems = [...(targetPlaylist.items || []), itemPayload];

    if (db) {
      try {
        const playlistRef = doc(db, 'social_playlists', playlistId);
        await updateDoc(playlistRef, {
          items: updatedItems
        });
      } catch (err) {
        console.error("Error updating playlist in Firestore:", err);
      }
    } else {
      const updatedPlaylists = playlists.map(p => {
        if (p.id === playlistId) {
          return { ...p, items: updatedItems };
        }
        return p;
      });
      setPlaylists(updatedPlaylists);
      localStorage.setItem('social_playlists', JSON.stringify(updatedPlaylists));
    }

    alert(`Saved to "${targetPlaylist.name}" successfully!`);
    setSavingItem(null);
  };

  const handleCreateAndSavePlaylist = async (name: string) => {
    if (!name.trim()) return;

    const itemPayload = savingItem ? {
      id: savingItem.id,
      type: savingItem.type,
      username: savingItem.item.username || '',
      userAvatar: savingItem.item.userAvatar || '',
      caption: savingItem.item.caption || '',
      createdAt: savingItem.item.createdAt || '',
      ownerId: savingItem.item.ownerId || '',
      ...(savingItem.type === 'post' 
        ? { image: savingItem.item.image || '', location: savingItem.item.location || '', likes: savingItem.item.likes || 0, comments: savingItem.item.comments || [] } 
        : { videoUrl: savingItem.item.videoUrl || '', musicTitle: savingItem.item.musicTitle || '', likes: savingItem.item.likes || 0, commentsCount: savingItem.item.commentsCount || 0 }
      )
    } : null;
    
    const newPlaylist = {
      name: name.trim(),
      ownerId: user?.uid || 'guest',
      createdAt: new Date().toISOString(),
      items: itemPayload ? [itemPayload] : []
    };

    if (db) {
      try {
        await addDoc(collection(db, 'social_playlists'), newPlaylist);
      } catch (err) {
        console.error("Error creating playlist in Firestore:", err);
      }
    } else {
      const localPlaylist = {
        id: 'playlist_' + Date.now(),
        ...newPlaylist
      };
      const updated = [...playlists, localPlaylist];
      setPlaylists(updated);
      localStorage.setItem('social_playlists', JSON.stringify(updated));
    }

    alert(savingItem ? `Playlist "${name.trim()}" created and saved successfully!` : `Playlist "${name.trim()}" created!`);
    setNewPlaylistName('');
    setSavingItem(null);
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    if (!confirm("Are you sure you want to delete this playlist? This action cannot be undone.")) return;

    if (db) {
      try {
        await deleteDoc(doc(db, 'social_playlists', playlistId));
      } catch (err) {
        console.error("Error deleting playlist from Firestore:", err);
      }
    } else {
      const updated = playlists.filter(p => p.id !== playlistId);
      setPlaylists(updated);
      localStorage.setItem('social_playlists', JSON.stringify(updated));
    }
    
    if (selectedPlaylistIdForView === playlistId) {
      setSelectedPlaylistIdForView(null);
    }
    alert("Playlist deleted successfully.");
  };

  const handleRemoveFromPlaylist = async (playlistId: string, itemId: string) => {
    const targetPlaylist = playlists.find(p => p.id === playlistId);
    if (!targetPlaylist) return;

    const updatedItems = (targetPlaylist.items || []).filter((item: any) => item.id !== itemId);

    if (db) {
      try {
        const playlistRef = doc(db, 'social_playlists', playlistId);
        await updateDoc(playlistRef, {
          items: updatedItems
        });
      } catch (err) {
        console.error("Error updating playlist in Firestore:", err);
      }
    } else {
      const updatedPlaylists = playlists.map(p => {
        if (p.id === playlistId) {
          return { ...p, items: updatedItems };
        }
        return p;
      });
      setPlaylists(updatedPlaylists);
      localStorage.setItem('social_playlists', JSON.stringify(updatedPlaylists));
    }

    alert("Item removed from playlist.");
  };

  // Profile Edit Save
  const handleSaveProfile = async () => {
    setBio(tempBio);
    setProfilePic(tempPic);
    setDisplayName(tempName);
    localStorage.setItem('social_bio', tempBio);
    setIsEditingProfile(false);

    if (user?.uid && db) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          displayName: tempName,
          photoURL: tempPic
        });
      } catch (err) {
        console.error("Failed to sync profile changes with Firestore:", err);
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', damping: 26, stiffness: 220 }}
      className="fixed inset-0 z-[90] bg-slate-950 text-white flex flex-col overflow-hidden select-none font-sans"
    >
      {/* Dynamic Background Mesh Grid */}
      <div className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-20 z-0" style={{ backgroundImage: 'radial-gradient(circle at top right, rgba(236, 72, 153, 0.2), transparent 50%), radial-gradient(circle at bottom left, rgba(6, 182, 212, 0.15), transparent 50%)' }} />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0" />

      {/* Header Bar */}
      <div className="h-16 shrink-0 border-b border-white/10 backdrop-blur-md bg-black/40 flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/10 rounded-full transition-all text-slate-400 hover:text-white"
            title="Go back to chat"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 select-none" dir="ltr">
            <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
            <span className="text-xl font-black bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent tracking-tight font-display whitespace-nowrap">Memuer <span className="font-sans font-medium text-slate-300">Social+</span></span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-bold transition-all border border-white/10 flex items-center gap-1.5"
          >
            <span>{isAr ? 'English' : 'العربية'}</span>
          </button>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-bold text-slate-300">
            <span className="w-2 h-2 bg-pink-500 rounded-full animate-ping" />
            {isAr ? 'متصل الآن' : 'Live Network'}
          </div>
        </div>
      </div>

      {/* Sub-View Content Wrapper */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 pb-20 flex flex-col">
        {activeTab === 'feed' && (
          <div className="w-full max-w-lg mx-auto px-4 py-6 space-y-6">
            {/* Stories Horizontal Tray */}
            <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none shrink-0">
              {/* User Story (Publish shortcut) */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <button 
                  onClick={() => { setCreateType('story'); setActiveTab('create'); }}
                  className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-cyan-400 to-blue-500 flex items-center justify-center relative cursor-pointer active:scale-95 transition-all"
                >
                  <div className="w-full h-full rounded-full border-2 border-black overflow-hidden relative">
                    <img src={profilePic} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <PlusSquare className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </button>
                <span className="text-[10px] font-bold text-slate-400 truncate w-16 text-center">Your Story</span>
              </div>

              {/* Other Stories */}
              {stories.map(story => (
                <div key={story.id} className="flex flex-col items-center gap-1 shrink-0">
                  <button 
                    onClick={() => setSelectedStory(story)}
                    className={`w-16 h-16 rounded-full p-0.5 flex items-center justify-center transition-all cursor-pointer ${
                      story.hasViewed 
                        ? 'bg-slate-700' 
                        : 'bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500'
                    }`}
                  >
                    <div className="w-full h-full rounded-full border-2 border-slate-950 overflow-hidden bg-black">
                      <img src={story.avatar} className="w-full h-full object-cover" />
                    </div>
                  </button>
                  <span className="text-[10px] font-bold text-slate-400 truncate w-16 text-center">{story.username}</span>
                </div>
              ))}
            </div>

            {/* Feed Category Filter Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none shrink-0">
              {[
                { id: 'all', label: isAr ? '✨ الكل' : '✨ All Moments', count: posts.length },
                { id: 'trending', label: isAr ? '🔥 الشائع' : '🔥 Trending', count: posts.filter(p => p.likes > 10).length },
                { id: 'following', label: isAr ? '👥 المتابَعون' : '👥 Following', count: posts.filter(p => followedUsers.includes(p.ownerId || p.username)).length }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFeedFilter(tab.id as any)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    feedFilter === tab.id
                      ? 'bg-gradient-to-r from-pink-500/20 to-indigo-500/20 border-pink-500/50 text-white shadow-md shadow-pink-500/10 scale-105'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className="text-[9px] font-mono opacity-60 bg-white/10 px-1.5 py-0.2 rounded-full">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Posts Feed */}
            <div className="space-y-6">
              {posts.filter(p => {
                if (feedFilter === 'trending') return p.likes > 10 || (p.comments && p.comments.length > 0);
                if (feedFilter === 'following') return followedUsers.includes(p.ownerId || p.username);
                return true;
              }).length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
                    <Grid className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-white uppercase tracking-wider text-center">
                      {feedFilter === 'following' ? 'No Following Posts Yet' : 'No Posts Yet'}
                    </h4>
                    <p className="text-xs text-slate-400 max-w-xs text-center">
                      {feedFilter === 'following' 
                        ? 'Follow your friends and contacts to see their moments here!' 
                        : 'Be the first to publish a photo to the Memuer Social+ platform!'}
                    </p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('create')}
                    className="px-4 py-2 bg-gradient-to-r from-pink-500 to-yellow-500 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-pink-500/20 active:scale-95 transition-all cursor-pointer"
                  >
                    Create Post
                  </button>
                </div>
              ) : (
                posts.filter(p => {
                  if (feedFilter === 'trending') return p.likes > 10 || (p.comments && p.comments.length > 0);
                  if (feedFilter === 'following') return followedUsers.includes(p.ownerId || p.username);
                  return true;
                }).map(post => (
                  <motion.div 
                    key={post.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 overflow-hidden shadow-2xl relative"
                  >
                    {/* Post Header */}
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden bg-slate-800">
                          <img src={post.userAvatar} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-black tracking-wide text-white">{post.username}</p>
                            {post.username !== (displayName || 'Memuer Citizen').toLowerCase().replace(/\s+/g, '.') && (
                              <button
                                onClick={() => handleToggleFollow(post.username, post.ownerId)}
                                className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                                  followedUsers.includes(post.ownerId || post.username)
                                    ? 'bg-white/10 border-white/20 text-slate-300'
                                    : 'bg-pink-500 hover:bg-pink-600 border-transparent text-white active:scale-95 shadow-md shadow-pink-500/15'
                                }`}
                              >
                                {followedUsers.includes(post.ownerId || post.username) ? 'Following' : 'Follow'}
                              </button>
                            )}
                          </div>
                          {post.location && (
                            <p className="text-[9px] text-slate-400 flex items-center gap-0.5">
                              <MapPin className="w-2.5 h-2.5 text-pink-500" />
                              {post.location}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => setInfoContent({
                            type: 'post',
                            caption: post.caption,
                            date: post.createdAt,
                            views: post.views || 0,
                            likes: post.likes
                          })}
                          className="p-1.5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="View post info"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                        {(post.ownerId === user?.uid || post.username === (displayName || 'Memuer Citizen').toLowerCase().replace(/\s+/g, '.')) && (
                          <button 
                            onClick={() => setDeletingContent({ type: 'post', id: post.id })}
                            className="p-1.5 hover:bg-red-500/20 rounded-full text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                            title="Delete post"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Post Image (with double tap interaction) */}
                    <div 
                      className="relative aspect-square w-full bg-slate-950 flex items-center justify-center overflow-hidden cursor-pointer"
                      onDoubleClick={(e) => handleDoubleTap(post.id, e)}
                    >
                      <img 
                        src={post.image} 
                        alt="Post visual" 
                        className="w-full h-full object-cover select-none pointer-events-none" 
                      />

                      {/* Double-tap heart indicator */}
                      <AnimatePresence>
                        {doubleTapHeart?.id === post.id && (
                          <motion.div 
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: [0, 1.3, 1], opacity: [0, 1, 0] }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            style={{ left: doubleTapHeart.x - 40, top: doubleTapHeart.y - 40 }}
                            className="absolute pointer-events-none text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.7)]"
                          >
                            <Heart className="w-20 h-20 fill-current" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Post Actions Panel */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => handleLikePost(post.id)}
                            className={`p-1.5 rounded-full transition-all hover:bg-white/5 ${
                              post.likedBy.includes(user?.uid || 'guest') 
                                ? 'text-red-500' 
                                : 'text-slate-200 hover:text-white'
                            }`}
                          >
                            <Heart className={`w-6 h-6 ${post.likedBy.includes(user?.uid || 'guest') ? 'fill-current' : ''}`} />
                          </button>
                          <button 
                            onClick={() => setCommentOpenPostId(commentOpenPostId === post.id ? null : post.id)}
                            className="p-1.5 text-slate-200 hover:text-white rounded-full hover:bg-white/5 transition-colors"
                          >
                            <MessageCircle className="w-6 h-6" />
                          </button>
                          <button 
                            onClick={() => setSharingContent({
                              type: 'post',
                              id: post.id,
                              caption: post.caption,
                              url: post.image
                            })}
                            className="p-1.5 text-slate-200 hover:text-white rounded-full hover:bg-white/5 transition-colors"
                            title="Share to connections"
                          >
                            <Send className="w-6 h-6" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setReportingItem({ type: 'post', id: post.id, item: post })}
                            className="p-1.5 text-slate-200 hover:text-red-500 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
                            title="Report Post"
                          >
                            <Flag className="w-6 h-6" />
                          </button>
                          <button 
                            onClick={() => setSavingItem({ type: 'post', id: post.id, item: post })}
                            className="p-1.5 text-slate-200 hover:text-pink-500 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
                            title="Save to playlist"
                          >
                            <Bookmark className="w-6 h-6" />
                          </button>
                        </div>
                      </div>

                    {/* Likes & Caption */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-black tracking-wide text-white">{post.likes.toLocaleString()} likes</p>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        <span className="font-black mr-2 text-white">{post.username}</span>
                        {post.caption}
                      </p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{post.createdAt}</p>
                    </div>

                    {/* Collapsible Comments Section */}
                    {post.comments.length > 0 && (
                      <button 
                        onClick={() => setCommentOpenPostId(commentOpenPostId === post.id ? null : post.id)}
                        className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-pink-400 transition-colors block"
                      >
                        {commentOpenPostId === post.id ? 'Hide Comments' : `View all ${post.comments.length} comments`}
                      </button>
                    )}

                    <AnimatePresence>
                      {commentOpenPostId === post.id && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden space-y-3 pt-2"
                        >
                          <div className="space-y-2 max-h-44 overflow-y-auto custom-scrollbar pr-2">
                            {post.comments.map(c => (
                              <div key={c.id} className="text-xs text-slate-300">
                                <span className="font-black text-white mr-1.5">{c.username}</span>
                                {c.text}
                              </div>
                            ))}
                          </div>

                          {/* Add Comment Input */}
                          <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                            <input 
                              type="text" 
                              placeholder="Write a comment..." 
                              value={newCommentText}
                              onChange={(e) => setNewCommentText(e.target.value)}
                              onKeyDown={(e) => { if(e.key === 'Enter') handleAddComment(post.id); }}
                              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 transition-colors"
                            />
                            <button 
                              onClick={() => handleAddComment(post.id)}
                              className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 active:scale-95 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all"
                            >
                              Post
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )))}
            </div>
          </div>
        )}

        {/* M SHORTS VIEW (Vertical loop Reels viewer - Full-Screen, Scrollable, with custom sizing, tap-to-pause, and side interaction bars) */}
        {activeTab === 'shorts' && (
          <div className="absolute inset-0 bg-black overflow-hidden z-25 flex flex-col">
            {/* Top Left Floating Exit Button */}
            <button 
              onClick={() => setActiveTab('feed')}
              className="absolute top-4 left-4 z-30 p-2.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-white hover:bg-black/60 transition-all active:scale-95 cursor-pointer"
              title="Exit Shorts"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {shorts.length > 0 ? (
              <div 
                ref={containerRef}
                onScroll={handleScroll}
                className="flex-1 w-full h-full overflow-y-auto snap-y snap-mandatory scrollbar-none relative bg-black"
              >
                {shorts.map((short, idx) => {
                  const isLiked = short.likedBy.includes(user?.uid || 'guest');
                  const isCover = videoFitMap[short.id] === 'cover';
                  const isPaused = !!pausedMap[short.id];

                  return (
                    <div id={`short-player-${short.id}`} key={short.id} className="w-full h-full snap-start snap-always relative shrink-0 flex flex-col justify-center items-center bg-zinc-950">
                      {/* Vertical Video Element */}
                      <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
                        <video 
                          ref={el => { videoRefs.current[short.id] = el; }}
                          src={short.videoUrl}
                          autoPlay={idx === activeShortIndex && !isPaused}
                          loop
                          muted={isMuted}
                          playsInline
                          className={`w-full h-full transition-all duration-300 ${
                            isCover ? 'object-cover' : 'object-contain'
                          }`}
                          onClick={() => {
                            const videoEl = videoRefs.current[short.id];
                            if (videoEl) {
                              if (videoEl.paused) {
                                videoEl.play().catch(err => console.log(err));
                                setPausedMap(prev => ({ ...prev, [short.id]: false }));
                              } else {
                                videoEl.pause();
                                setPausedMap(prev => ({ ...prev, [short.id]: true }));
                              }
                            }
                          }}
                        />

                        {/* Bottom shadow gradient mask for caption readability */}
                        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none z-10" />

                        {/* Centered Play Overlay Badge if paused */}
                        <AnimatePresence>
                          {isPaused && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.5 }}
                              className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none z-10"
                            >
                              <div className="p-4.5 rounded-full bg-black/65 backdrop-blur-md border border-white/10 text-white shadow-xl shadow-black/20">
                                <Play className="w-8 h-8 fill-current text-white translate-x-0.5" />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Right-side floating action buttons (Sleek, compact, failsafe against overflow) */}
                      <div className="absolute right-3 bottom-24 sm:bottom-28 z-30 flex flex-col items-center gap-2 sm:gap-3.5 max-h-[60%] overflow-y-auto scrollbar-none">
                        {/* Like Button */}
                        <div className="flex flex-col items-center gap-0.5">
                          <button 
                            onClick={() => handleLikeShort(short.id)}
                            className={`p-2.5 sm:p-3 rounded-full backdrop-blur-md border transition-all active:scale-75 shadow-lg cursor-pointer ${
                              isLiked 
                                ? 'bg-pink-500/25 border-pink-500/40 text-pink-500' 
                                : 'bg-black/40 border-white/10 text-white hover:bg-black/60'
                            }`}
                          >
                            <Heart className={`w-4.5 h-4.5 sm:w-5 sm:h-5 ${isLiked ? 'fill-current' : ''}`} />
                          </button>
                          <span className="text-[9px] font-bold text-white drop-shadow-md">{short.likes}</span>
                        </div>

                        {/* Save/Bookmark Button */}
                        <div className="flex flex-col items-center gap-0.5">
                          <button 
                            onClick={() => setSavingItem({ type: 'short', id: short.id, item: short })}
                            className="p-2.5 sm:p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60 hover:text-pink-400 transition-all active:scale-75 shadow-lg cursor-pointer"
                            title="Save to playlist"
                          >
                            <Bookmark className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                          </button>
                          <span className="text-[9px] font-bold text-white drop-shadow-md">Save</span>
                        </div>

                        {/* Mute Button */}
                        <div className="flex flex-col items-center gap-0.5">
                          <button 
                            onClick={() => setIsMuted(!isMuted)}
                            className={`p-2.5 sm:p-3 rounded-full backdrop-blur-md border transition-all active:scale-75 shadow-lg cursor-pointer ${
                              isMuted 
                                ? 'bg-red-500/25 border-red-500/40 text-red-400' 
                                : 'bg-black/40 border-white/10 text-white hover:bg-black/60'
                            }`}
                            title={isMuted ? "Unmute" : "Mute"}
                          >
                            {isMuted ? <VolumeX className="w-4.5 h-4.5 sm:w-5 sm:h-5" /> : <Volume2 className="w-4.5 h-4.5 sm:w-5 sm:h-5" />}
                          </button>
                          <span className="text-[9px] font-bold text-white drop-shadow-md">{isMuted ? "Muted" : "Mute"}</span>
                        </div>

                        {/* Fit/Fill Screen Toggle Button */}
                        <div className="flex flex-col items-center gap-0.5">
                          <button 
                            onClick={() => setVideoFitMap(prev => ({
                              ...prev,
                              [short.id]: prev[short.id] === 'cover' ? 'contain' : 'cover'
                            }))}
                            className="p-2.5 sm:p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60 transition-all active:scale-75 shadow-lg cursor-pointer"
                            title={isCover ? "Fit Screen" : "Fill Screen"}
                          >
                            {isCover ? <Minimize2 className="w-4.5 h-4.5 sm:w-5 sm:h-5" /> : <Maximize2 className="w-4.5 h-4.5 sm:w-5 sm:h-5" />}
                          </button>
                          <span className="text-[9px] font-bold text-white drop-shadow-md">{isCover ? "Fit" : "Fill"}</span>
                        </div>

                        {/* Native OS Fullscreen Button */}
                        <div className="flex flex-col items-center gap-0.5">
                          <button 
                            onClick={() => {
                              const videoEl = videoRefs.current[short.id];
                              if (videoEl) {
                                if (videoEl.requestFullscreen) {
                                  videoEl.requestFullscreen();
                                } else if ((videoEl as any).webkitRequestFullscreen) {
                                  (videoEl as any).webkitRequestFullscreen();
                                }
                              }
                            }}
                            className="p-2.5 sm:p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60 transition-all active:scale-75 shadow-lg cursor-pointer"
                            title="Open Native Fullscreen"
                          >
                            <svg className="w-4.5 h-4.5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                            </svg>
                          </button>
                          <span className="text-[9px] font-bold text-white drop-shadow-md">Full</span>
                        </div>

                        {/* Direct Share Button */}
                        <div className="flex flex-col items-center gap-0.5">
                          <button 
                            onClick={() => setSharingContent({
                              type: 'short',
                              id: short.id,
                              caption: short.caption,
                              url: short.videoUrl
                            })}
                            className="p-2.5 sm:p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60 transition-all active:scale-75 shadow-lg cursor-pointer"
                            title="Share video"
                          >
                            <Send className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                          </button>
                          <span className="text-[9px] font-bold text-white drop-shadow-md">Share</span>
                        </div>

                        {/* Info Button */}
                        <div className="flex flex-col items-center gap-0.5">
                          <button 
                            onClick={() => setInfoContent({
                              type: 'short',
                              id: short.id,
                              item: short,
                              caption: short.caption,
                              date: short.createdAt || 'Released recently',
                              views: short.views || 0,
                              likes: short.likes
                            })}
                            className="p-2.5 sm:p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60 transition-all active:scale-75 shadow-lg cursor-pointer animate-pulse"
                            title="Video Info & Report"
                          >
                            <Info className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-pink-400" />
                          </button>
                          <span className="text-[9px] font-bold text-white drop-shadow-md">Info</span>
                        </div>

                        {/* Delete Button (Owner only) */}
                        {(short.ownerId === user?.uid || short.username === (displayName || 'Memuer Citizen').toLowerCase().replace(/\s+/g, '.')) && (
                          <div className="flex flex-col items-center gap-0.5">
                            <button 
                              onClick={() => setDeletingContent({ type: 'short', id: short.id })}
                              className="p-2.5 sm:p-3 rounded-full bg-red-500/25 backdrop-blur-md border border-red-500/40 text-red-400 hover:bg-red-500/40 transition-all active:scale-75 shadow-lg cursor-pointer"
                              title="Delete video"
                            >
                              <Trash2 className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                            </button>
                            <span className="text-[9px] font-bold text-white drop-shadow-md">Delete</span>
                          </div>
                        )}
                      </div>

                      {/* m shorts overlay label */}
                      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                        <span className="px-3 py-1.5 bg-black/50 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-pink-400 border border-pink-500/20 flex items-center gap-1">
                          <Tv className="w-3.5 h-3.5 animate-pulse" />
                          m shorts
                        </span>
                      </div>

                      {/* Left Bottom Details Overlay (Shifted up to sit beautifully above the bottom nav bar, containerized for readability) */}
                      <div className="absolute bottom-20 left-4 right-16 z-30 space-y-2 pointer-events-none">
                        <div className="flex items-center gap-2 pointer-events-auto">
                          <div className="w-8 h-8 rounded-full border border-white/20 overflow-hidden bg-slate-800">
                            <img src={short.userAvatar} className="w-full h-full object-cover" />
                          </div>
                          <span className="text-xs font-black text-white drop-shadow-md">{short.username}</span>
                          {short.username !== (displayName || 'Memuer Citizen').toLowerCase().replace(/\s+/g, '.') && (
                            <button
                              onClick={() => handleToggleFollow(short.username, short.ownerId)}
                              className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                                followedUsers.includes(short.ownerId || short.username)
                                  ? 'bg-white/10 border-white/20 text-slate-300'
                                  : 'bg-pink-500 hover:bg-pink-600 border-transparent text-white active:scale-95'
                              }`}
                            >
                              {followedUsers.includes(short.ownerId || short.username) ? 'Following' : 'Follow'}
                            </button>
                          )}
                          <span className="px-1.5 py-0.5 bg-pink-500/80 rounded text-[8px] font-bold uppercase text-white drop-shadow-md">Creator</span>
                        </div>

                        {/* High-contrast container for complete readability against any background */}
                        <div className="bg-black/45 backdrop-blur-md p-2.5 sm:p-3.5 rounded-2xl border border-white/10 flex flex-col gap-1.5 pointer-events-auto shadow-lg shadow-black/40 max-w-sm">
                          <p className="text-xs text-slate-100 leading-relaxed drop-shadow-md font-medium">
                            {short.caption}
                          </p>

                          <div className="flex items-center gap-1.5 text-[9px] text-pink-300 font-bold tracking-wide drop-shadow-md">
                            <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
                            <div className="overflow-hidden w-40 h-4 relative">
                              <span className="absolute whitespace-nowrap animate-[marquee_15s_linear_infinite]">
                                🎵 {short.musicTitle} {isMuted ? '(Muted - Tap speaker button to unmute)' : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-zinc-950">
                <Video className="w-12 h-12 text-slate-600 animate-pulse" />
                <p className="text-sm text-slate-400 font-black uppercase tracking-widest">No Shorts Found</p>
                <p className="text-xs text-slate-500">Go to Create Tab to publish your first m short loop!</p>
              </div>
            )}
          </div>
        )}

        {/* CREATE TAB */}
        {activeTab === 'create' && (
          <div className="w-full max-w-lg mx-auto px-4 py-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h3 className="text-lg font-black bg-gradient-to-r from-pink-400 to-yellow-300 bg-clip-text text-transparent uppercase tracking-wider">{isAr ? 'نشر محتوى جديد' : 'Publish New Content'}</h3>
                
                {/* Type Selection Tabs */}
                <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/5">
                  <button 
                    onClick={() => setCreateType('post')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                      createType === 'post' ? 'bg-pink-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {isAr ? 'منشور' : 'Post'}
                  </button>
                  <button 
                    onClick={() => setCreateType('short')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                      createType === 'short' ? 'bg-pink-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {isAr ? 'مقطع' : 'Short'}
                  </button>
                  <button 
                    onClick={() => setCreateType('story')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                      createType === 'story' ? 'bg-pink-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {isAr ? 'قصة' : 'Story'}
                  </button>
                </div>
              </div>

              {/* POST FORM */}
              {createType === 'post' && (
                <div className="space-y-4">
                  {/* Select Template Image */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isAr ? 'اختر قالب صورة' : 'Choose Image Template'}</label>
                    <div className="grid grid-cols-5 gap-2">
                      {PRESET_IMAGES.map((img, idx) => (
                        <button
                          key={img.name}
                          onClick={() => { setSelectedImageTemplate(idx); setImageUrlInput(''); }}
                          className={`aspect-square rounded-xl overflow-hidden border-2 transition-all relative ${
                            selectedImageTemplate === idx && !imageUrlInput ? 'border-pink-500 scale-105 shadow-md shadow-pink-500/20' : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={img.url} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Real File Upload */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isAr ? 'رفع صورة حقيقية' : 'Upload Real Photo'}</label>
                    <div className="relative border-2 border-dashed border-white/15 rounded-2xl p-6 hover:border-pink-500/50 transition-colors flex flex-col items-center justify-center gap-2 bg-white/5">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handlePhotoUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                        disabled={uploading}
                      />
                      {uploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <span className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-[10px] font-bold text-slate-400">{isAr ? `جاري الرفع إلى الخادم (${uploadProgress}%)...` : `Uploading to server (${uploadProgress}%)...`}</span>
                        </div>
                      ) : imageUrlInput ? (
                        <div className="flex flex-col items-center gap-2 text-center">
                          <div className="w-16 h-16 rounded-lg overflow-hidden border border-pink-500/30">
                            <img src={imageUrlInput} className="w-full h-full object-cover" />
                          </div>
                          <span className="text-[10px] font-bold text-green-400 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> {isAr ? 'تم الرفع بنجاح!' : 'Uploaded Successfully!'}
                          </span>
                        </div>
                      ) : (
                        <>
                          <Camera className="w-8 h-8 text-slate-400" />
                          <span className="text-xs font-bold text-slate-300">{isAr ? 'اسحب واسقط أو انقر لرفع صورة' : 'Drag & drop or click to upload photo'}</span>
                          <span className="text-[9px] text-slate-500">{isAr ? 'يدعم صيغ PNG, JPG, WEBP' : 'Supports PNG, JPG, WEBP'}</span>
                        </>
                      )}
                    </div>
                    {uploadError && (
                      <p className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg text-center font-mono">
                        ⚠️ {uploadError}
                      </p>
                    )}
                  </div>

                  {/* Or input custom image URL */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isAr ? 'أو أدخل رابط الصورة' : 'Or Paste Image URL'}</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        placeholder="https://images.unsplash.com/..." 
                        value={imageUrlInput}
                        onChange={(e) => { setImageUrlInput(e.target.value); setSelectedImageTemplate(-1); }}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Caption */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isAr ? 'الشرح / التعليق' : 'Caption'}</label>
                    <textarea 
                      placeholder={isAr ? "اكتب الشرح لمنشورك..." : "Write your amazing post caption..."} 
                      rows={3}
                      value={captionInput}
                      onChange={(e) => setCaptionInput(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 transition-colors resize-none"
                    />
                  </div>

                  {/* Location */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isAr ? 'الموقع الجغرافي' : 'Location'}</label>
                    <input 
                      type="text" 
                      placeholder={isAr ? "مثال: الجيزة، مصر" : "e.g. Giza, Egypt"} 
                      value={locationInput}
                      onChange={(e) => setLocationInput(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* M SHORT FORM */}
              {createType === 'short' && (
                <div className="space-y-4">
                  {/* Select Video Template */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isAr ? 'اختر قالب فيديو' : 'Select Video Template'}</label>
                    <div className="grid grid-cols-4 gap-2">
                      {PRESET_SHORTS.map((video, idx) => (
                        <button
                          key={video.name}
                          onClick={() => { setSelectedVideoTemplate(idx); setVideoUrlInput(''); }}
                          className={`py-3 px-2 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider text-center transition-all ${
                            selectedVideoTemplate === idx && !videoUrlInput 
                              ? 'border-pink-500 bg-pink-500/10 text-pink-400 scale-105' 
                              : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                          }`}
                        >
                          {video.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Real File Upload */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isAr ? 'رفع فيديو حقيقي' : 'Upload Real Video'}</label>
                    <div className="relative border-2 border-dashed border-white/15 rounded-2xl p-6 hover:border-pink-500/50 transition-colors flex flex-col items-center justify-center gap-2 bg-white/5">
                      <input 
                        type="file" 
                        accept="video/*" 
                        onChange={handleVideoUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                        disabled={uploading}
                      />
                      {uploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <span className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-[10px] font-bold text-slate-400">{isAr ? `جاري الرفع إلى الخادم (${uploadProgress}%)...` : `Uploading to server (${uploadProgress}%)...`}</span>
                        </div>
                      ) : videoUrlInput ? (
                        <div className="flex flex-col items-center gap-2 text-center">
                          <video src={videoUrlInput} className="w-20 h-20 rounded-lg overflow-hidden border border-pink-500/30 object-cover bg-black" muted />
                          <span className="text-[10px] font-bold text-green-400 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> {isAr ? 'تم الرفع بنجاح!' : 'Uploaded Successfully!'}
                          </span>
                        </div>
                      ) : (
                        <>
                          <Video className="w-8 h-8 text-slate-400" />
                          <span className="text-xs font-bold text-slate-300">{isAr ? 'اسحب واسقط أو انقر لرفع فيديو MP4' : 'Drag & drop or click to upload MP4 video'}</span>
                          <span className="text-[9px] text-slate-500">{isAr ? 'يدعم صيغ MP4, WebM' : 'Supports MP4, WebM'}</span>
                        </>
                      )}
                    </div>
                    {uploadError && (
                      <p className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg text-center font-mono">
                        ⚠️ {uploadError}
                      </p>
                    )}
                  </div>

                  {/* Custom Video URL */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isAr ? 'أو أدخل رابط فيديو MP4' : 'Or Paste Video MP4 URL'}</label>
                    <input 
                      type="text" 
                      placeholder="https://player.vimeo.com/external/..." 
                      value={videoUrlInput}
                      onChange={(e) => { setVideoUrlInput(e.target.value); setSelectedVideoTemplate(-1); }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 transition-colors"
                    />
                  </div>

                  {/* Caption */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isAr ? 'الشرح / التعليق' : 'Caption'}</label>
                    <input 
                      type="text" 
                      placeholder={isAr ? "صف مقطع الفيديو الخاص بك..." : "Describe your loop short..."} 
                      value={captionInput}
                      onChange={(e) => setCaptionInput(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 transition-colors"
                    />
                  </div>

                  {/* Music Track */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isAr ? 'اسم المقطع الموسيقي' : 'Music Title'}</label>
                    <input 
                      type="text" 
                      placeholder={isAr ? "مثال: موسيقى هادئة - نغمات لوفي" : "e.g. Summer Lounge - LoFi Beats"} 
                      value={musicInput}
                      onChange={(e) => setMusicInput(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* STORY FORM */}
              {createType === 'story' && (
                <div className="space-y-4">
                  {/* Select Story Background Gradient */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isAr ? 'اختر خلفية ملونة' : 'Select Background Gradient'}</label>
                    <div className="grid grid-cols-5 gap-2">
                      {GRADIENTS.map((gradient, idx) => (
                        <button
                          key={gradient}
                          onClick={() => setStoryGradientIndex(idx)}
                          className={`aspect-square rounded-xl bg-gradient-to-tr ${gradient} border-2 transition-all ${
                            storyGradientIndex === idx ? 'border-white scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Story Text Overlay */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isAr ? 'النص الظاهر على القصة' : 'Story Text Overlay'}</label>
                    <input 
                      type="text" 
                      placeholder={isAr ? "ماذا يحدث الآن؟ مثال: جولة في القاهرة! 🏜️" : "What is happening? e.g. Exploring Cairo! 🏜️"} 
                      value={storyTextInput}
                      onChange={(e) => setStoryTextInput(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 transition-colors"
                    />
                  </div>

                  {/* Visual Live Story Preview Card */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isAr ? 'معاينة مباشرة للقصة' : 'Story Live Preview'}</label>
                    <div className={`w-full max-w-xs mx-auto aspect-[9/16] rounded-2xl bg-gradient-to-tr ${GRADIENTS[storyGradientIndex]} flex flex-col items-center justify-center p-6 text-center relative border border-white/20 shadow-2xl overflow-hidden`}>
                      {/* Fake progress bar */}
                      <div className="absolute top-3 left-3 right-3 h-0.5 bg-white/25 rounded-full overflow-hidden">
                        <div className="w-1/3 h-full bg-white" />
                      </div>
                      
                      {/* Fake user */}
                      <div className="absolute top-6 left-3 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full border border-white/20 overflow-hidden bg-slate-800">
                          <img src={profilePic} className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[9px] font-black text-white">{(displayName || 'Memuer Citizen').toLowerCase().replace(/\s+/g, '.')}</span>
                      </div>

                      <p className="text-sm font-black text-white px-4 leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                        {storyTextInput || (isAr ? "مرحباً بكم! 👋" : "Hello world! 👋")}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Publish Button */}
              <button 
                onClick={handlePublish}
                className="w-full py-3 bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 hover:opacity-90 active:scale-[0.98] text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-pink-500/10 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-white" />
                {isAr 
                  ? `نشر ${createType === 'post' ? 'المنشور' : createType === 'short' ? 'مقطع الفيديو' : 'القصة'}`
                  : `Publish ${createType === 'post' ? 'Post' : createType === 'short' ? 'Short Video' : 'Story'}`
                }
              </button>
            </motion.div>
          </div>
        )}

        {/* PROFILE TAB (See photos, m shorts, bio, story, edit from here) */}
        {activeTab === 'profile' && (
          <div className="w-full max-w-lg mx-auto px-4 py-6 space-y-6">
            <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-[32px] p-6 sm:p-8 space-y-6 shadow-2xl relative">
              {/* Profile Main Info Grid */}
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Story-ringed profile avatar clickable */}
                <div className="relative shrink-0">
                  <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center">
                    <div className="w-full h-full rounded-full border-2 border-slate-950 overflow-hidden bg-slate-800 relative">
                      <img src={profilePic} className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-pink-500 w-7 h-7 rounded-full flex items-center justify-center border-2 border-slate-950 text-white font-black text-xs">
                    ★
                  </div>
                </div>

                <div className="flex-1 text-center sm:text-left space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 justify-center sm:justify-start">
                    <h2 className="text-xl font-black text-white tracking-tight">{displayName}</h2>
                    <button 
                      onClick={() => {
                        setTempName(displayName);
                        setTempBio(bio);
                        setTempPic(profilePic);
                        setIsEditingProfile(true);
                      }}
                      className="px-4 py-1.5 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all cursor-pointer inline-flex items-center gap-1.5 mx-auto sm:mx-0"
                    >
                      <Edit3 className="w-3 h-3 text-pink-400" />
                      {isAr ? 'تعديل الملف الشخصي' : 'Edit Profile'}
                    </button>
                  </div>

                  <p className="text-xs text-slate-400 tracking-wide font-black uppercase">
                    @{(displayName || 'Memuer Citizen').toLowerCase().replace(/\s+/g, '.')}
                  </p>

                  <div className="flex items-center gap-4 justify-center sm:justify-start text-xs font-bold text-slate-300">
                    <div>
                      <span className="font-black text-white text-sm mr-1">
                        {posts.filter(p => p.username === (displayName || 'Memuer Citizen').toLowerCase().replace(/\s+/g, '.')).length}
                      </span>
                      {isAr ? 'منشورات' : 'posts'}
                    </div>
                    <div>
                      <span className="font-black text-white text-sm mr-1">
                        {shorts.filter(s => s.username === (displayName || 'Memuer Citizen').toLowerCase().replace(/\s+/g, '.')).length}
                      </span>
                      {isAr ? 'مقاطع' : 'shorts'}
                    </div>
                    <div>
                      <span className="font-black text-white text-sm mr-1">{followerCount}</span>
                      {isAr ? 'المتابعين' : 'followers'}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed pt-1 whitespace-pre-line">
                    {bio}
                  </p>
                </div>
              </div>

              {/* Direct Post / Short Trigger buttons from profile */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
                <button 
                  onClick={() => { setCreateType('post'); setActiveTab('create'); }}
                  className="py-2.5 bg-gradient-to-tr from-pink-600/30 to-purple-600/30 border border-pink-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-200 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                >
                  <Camera className="w-3.5 h-3.5 text-pink-400" />
                  {isAr ? 'نشر صورة' : 'Post Photo'}
                </button>
                <button 
                  onClick={() => { setCreateType('short'); setActiveTab('create'); }}
                  className="py-2.5 bg-gradient-to-tr from-cyan-600/30 to-blue-600/30 border border-cyan-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-200 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                >
                  <Video className="w-3.5 h-3.5 text-cyan-400" />
                  {isAr ? 'نشر مقطع' : 'Post m short'}
                </button>
              </div>
            </div>

            {/* Profile Grid Tabs */}
            <div className="space-y-4">
              <div className="flex border-b border-white/10 pb-2 gap-8 justify-center">
                <button 
                  onClick={() => setProfileSubTab('photos')}
                  className={`text-xs font-black uppercase tracking-widest pb-2 flex items-center gap-1.5 transition-all ${
                    profileSubTab === 'photos'
                      ? 'text-pink-500 border-b-2 border-pink-500'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                  {isAr ? 'شبكة الصور' : 'Photos Grid'}
                </button>
                <button 
                  onClick={() => setProfileSubTab('shorts')}
                  className={`text-xs font-black uppercase tracking-widest pb-2 flex items-center gap-1.5 transition-all ${
                    profileSubTab === 'shorts'
                      ? 'text-pink-500 border-b-2 border-pink-500'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Tv className="w-4 h-4" />
                  {isAr ? 'مقاطع الفيديو' : 'm shorts'}
                </button>
                <button 
                  onClick={() => setProfileSubTab('playlists')}
                  className={`text-xs font-black uppercase tracking-widest pb-2 flex items-center gap-1.5 transition-all ${
                    profileSubTab === 'playlists'
                      ? 'text-pink-500 border-b-2 border-pink-500'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                  {isAr ? 'قوائم التشغيل' : 'Playlists'}
                </button>
              </div>

              {profileSubTab === 'photos' ? (
                /* Grid of Posts */
                posts.filter(p => p.username === (displayName || 'Memuer Citizen').toLowerCase().replace(/\s+/g, '.')).length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {posts
                      .filter(p => p.username === (displayName || 'Memuer Citizen').toLowerCase().replace(/\s+/g, '.'))
                      .map(p => (
                        <div key={p.id} className="aspect-square bg-slate-900 rounded-2xl overflow-hidden relative border border-white/5 group cursor-pointer hover:scale-105 transition-all">
                          <img src={p.image} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-3 text-xs font-black">
                            <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 fill-current text-red-500" /> {p.likes}</span>
                            <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5 fill-current text-white" /> {p.comments.length}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-white/5 border border-white/10 rounded-3xl space-y-3">
                    <Image className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isAr ? 'لا توجد صور منشورة بعد' : 'No Photos Published Yet'}</p>
                  </div>
                )
              ) : profileSubTab === 'shorts' ? (
                /* Grid of Shorts */
                shorts.filter(s => s.username === (displayName || 'Memuer Citizen').toLowerCase().replace(/\s+/g, '.')).length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {shorts
                      .filter(s => s.username === (displayName || 'Memuer Citizen').toLowerCase().replace(/\s+/g, '.'))
                      .map(s => (
                        <div 
                          key={s.id} 
                          onClick={() => {
                            const sIdx = shorts.findIndex(item => item.id === s.id);
                            if (sIdx !== -1) {
                              setActiveShortIndex(sIdx);
                            }
                            setActiveTab('shorts');
                          }}
                          className="aspect-square bg-slate-900 rounded-2xl overflow-hidden relative border border-white/5 group cursor-pointer hover:scale-105 transition-all"
                        >
                          {/* Video element for thumbnail */}
                          <video src={s.videoUrl} muted playsInline className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-end p-2">
                            <span className="text-[9px] font-black text-white flex items-center gap-1">
                              <Tv className="w-3 h-3 text-pink-500" />
                              {s.likes} {isAr ? 'إعجاب' : 'likes'}
                            </span>
                          </div>
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs font-black">
                            <span className="text-white uppercase tracking-widest text-[9px]">{isAr ? 'تشغيل المقطع' : 'Play Short'}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-white/5 border border-white/10 rounded-3xl space-y-3">
                    <Video className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isAr ? 'لا توجد مقاطع فيديو منشورة بعد' : 'No m shorts Published Yet'}</p>
                  </div>
                )
              ) : (
                /* Playlists Subtab View */
                <div className="space-y-4">
                  {selectedPlaylistForView ? (
                    /* Detailed Playlist View */
                    <div className="space-y-4 bg-white/5 border border-white/10 p-5 rounded-3xl">
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <button 
                          onClick={() => setSelectedPlaylistIdForView(null)}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-300 flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" /> {isAr ? 'الرجوع' : 'Back'}
                        </button>
                        <h3 className="text-sm font-black text-white tracking-wide uppercase">{selectedPlaylistForView.name}</h3>
                        <button 
                          onClick={() => handleDeletePlaylist(selectedPlaylistForView.id)}
                          className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-400 flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> {isAr ? 'حذف' : 'Delete'}
                        </button>
                      </div>

                      {(!selectedPlaylistForView.items || selectedPlaylistForView.items.length === 0) ? (
                        <div className="text-center py-10 space-y-2">
                          <Bookmark className="w-8 h-8 text-slate-600 mx-auto" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isAr ? 'قائمة التشغيل هذه فارغة' : 'This Playlist Is Empty'}</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          {selectedPlaylistForView.items.map((item: any) => (
                            <div key={item.id} className="bg-slate-900/60 rounded-2xl overflow-hidden border border-white/10 p-3 space-y-3 flex flex-col justify-between">
                              <div className="space-y-2">
                                <div className="aspect-square rounded-xl overflow-hidden relative bg-black">
                                  {item.type === 'short' ? (
                                    <video src={item.videoUrl} className="w-full h-full object-cover" muted playsInline />
                                  ) : (
                                    <img src={item.image} className="w-full h-full object-cover" />
                                  )}
                                  <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[7px] font-black uppercase tracking-wider text-pink-400 border border-pink-500/10">
                                    {item.type}
                                  </span>
                                </div>
                                <div className="text-left">
                                  <p className="text-[10px] font-bold text-slate-200 line-clamp-1">@{item.username}</p>
                                  <p className="text-[9px] text-slate-400 line-clamp-2">{item.caption}</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => {
                                    if (item.type === 'short') {
                                      const sIdx = shorts.findIndex(s => s.id === item.id);
                                      if (sIdx !== -1) setActiveShortIndex(sIdx);
                                      setActiveTab('shorts');
                                    } else {
                                      setActiveTab('feed');
                                    }
                                  }}
                                  className="flex-1 py-1.5 bg-white/10 hover:bg-white/15 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-200 text-center cursor-pointer transition-all"
                                >
                                  {isAr ? 'عرض' : 'View'}
                                </button>
                                <button 
                                  onClick={() => handleRemoveFromPlaylist(selectedPlaylistForView.id, item.id)}
                                  className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl cursor-pointer transition-all flex items-center justify-center"
                                  title="Remove from playlist"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Playlists List View & Creator */
                    <div className="space-y-4">
                      {/* Inline playlist creator */}
                      <div className="bg-white/5 border border-white/10 p-4 rounded-3xl flex gap-2 items-center">
                        <input 
                          type="text" 
                          placeholder={isAr ? "اسم قائمة التشغيل الجديدة..." : "New Playlist Name..."} 
                          value={newPlaylistName}
                          onChange={(e) => setNewPlaylistName(e.target.value)}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 transition-colors"
                        />
                        <button 
                          onClick={() => {
                            if (!newPlaylistName.trim()) return;
                            handleCreateAndSavePlaylist(newPlaylistName);
                          }}
                          className="px-4 py-1.5 bg-pink-500 hover:bg-pink-600 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <PlusSquare className="w-3.5 h-3.5" /> {isAr ? 'إنشاء' : 'Create'}
                        </button>
                      </div>

                      {playlists.length === 0 ? (
                        <div className="text-center py-10 bg-white/5 border border-white/10 rounded-3xl space-y-3">
                          <Bookmark className="w-8 h-8 text-slate-600 mx-auto animate-pulse" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isAr ? 'لا توجد قوائم تشغيل حتى الآن' : 'No Playlists Created Yet'}</p>
                          <p className="text-[9px] text-slate-500">{isAr ? 'أنشئ قائمة أعلاه أو احفظ العناصر من الخلاصة!' : 'Create one above or save items from the feed!'}</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2.5">
                          {playlists.map(playlist => (
                            <div 
                              key={playlist.id}
                              onClick={() => setSelectedPlaylistIdForView(playlist.id)}
                              className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-pink-500/30 p-4 rounded-3xl flex items-center justify-between transition-all cursor-pointer group"
                            >
                              <div className="flex items-center gap-3.5">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-600/30 to-purple-600/30 border border-pink-500/10 flex items-center justify-center text-pink-400 shrink-0">
                                  <Bookmark className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                  <h4 className="text-xs font-black text-white tracking-wide uppercase">{playlist.name}</h4>
                                  <p className="text-[9px] text-slate-400">{(playlist.items || []).length} {isAr ? 'عنصر محفوظ' : 'items saved'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[9px] font-black uppercase tracking-widest text-pink-500 opacity-0 group-hover:opacity-100 transition-opacity">{isAr ? 'فتح ←' : 'Open →'}</span>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeletePlaylist(playlist.id);
                                  }}
                                  className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl cursor-pointer opacity-60 hover:opacity-100 transition-all flex items-center justify-center"
                                  title="Delete playlist"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FULL SCREEN STORY VIEWER MODAL */}
      <AnimatePresence>
        {selectedStory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black flex flex-col items-center justify-center p-4"
          >
            <div className="w-full max-w-md aspect-[9/16] relative rounded-3xl overflow-hidden flex flex-col justify-between p-6 bg-slate-900">
              {/* Backing Background Visual */}
              {selectedStory.imageUrl.startsWith('from-') ? (
                <div className={`absolute inset-0 bg-gradient-to-tr ${selectedStory.imageUrl} z-0`} />
              ) : (
                <img src={selectedStory.imageUrl} className="absolute inset-0 w-full h-full object-cover z-0" />
              )}

              {/* Story Header */}
              <div className="relative z-10 space-y-3">
                {/* Progress Indicators */}
                <div className="flex gap-1 h-1 bg-white/25 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-pink-500 transition-all duration-100 ease-linear" 
                    style={{ width: `${storyProgress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full border border-white/30 overflow-hidden bg-slate-800">
                      <img src={selectedStory.avatar} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-xs font-black text-white drop-shadow-md">{selectedStory.username}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(selectedStory.ownerId === user?.uid || (user?.displayName && selectedStory.username === user.displayName.toLowerCase().replace(/\s+/g, '.'))) && (
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm("Are you sure you want to delete your story?")) return;
                          if (db) {
                            try {
                              await deleteDoc(doc(db, 'social_stories', selectedStory.id));
                            } catch (err) {
                              console.error("Error deleting story:", err);
                            }
                          } else {
                            const updated = stories.filter(s => s.id !== selectedStory.id);
                            setStories(updated);
                            localStorage.setItem('social_stories', JSON.stringify(updated));
                          }
                          setSelectedStory(null);
                        }}
                        className="p-1.5 bg-red-600/60 hover:bg-red-600 rounded-full text-white cursor-pointer transition-all"
                        title="Delete Story"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => setSelectedStory(null)}
                      className="p-1.5 bg-black/40 hover:bg-black/60 rounded-full text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Story Content / Text Overlay */}
              <div className="relative z-10 flex-1 flex items-center justify-center text-center px-6">
                <p className="text-lg font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] whitespace-pre-line leading-relaxed">
                  {selectedStory.text}
                </p>
              </div>

              {/* Story Nav Overlay Triggers */}
              <button 
                onClick={handleStoryPrev} 
                className="absolute inset-y-0 left-0 w-1/4 z-10 cursor-w-resize" 
              />
              <button 
                onClick={handleStoryNext} 
                className="absolute inset-y-0 right-0 w-3/4 z-10 cursor-e-resize" 
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EDIT PROFILE MODAL */}
      <AnimatePresence>
        {isEditingProfile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-900 border border-white/15 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h4 className="text-sm font-black uppercase tracking-widest text-white">{isAr ? 'تعديل الملف الشخصي' : 'Edit Social Profile'}</h4>
                <button onClick={() => setIsEditingProfile(false)} className="text-slate-400 hover:text-white p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Profile Pic Upload & Preview */}
                <div className="flex flex-col items-center gap-3 bg-white/5 border border-white/10 p-3.5 rounded-2xl">
                  <div className="w-16 h-16 rounded-full border border-pink-500/40 overflow-hidden bg-slate-800 relative group">
                    <img src={tempPic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid || 'default'}`} className="w-full h-full object-cover" />
                  </div>
                  
                  <div className="w-full text-center">
                    <label className="inline-block px-3 py-1.5 bg-gradient-to-r from-pink-500 to-yellow-500 hover:from-pink-600 hover:to-yellow-600 active:scale-95 text-[10px] font-black uppercase tracking-wider text-white rounded-lg cursor-pointer transition-all shadow-md shadow-pink-500/10">
                      {isAr ? 'رفع صورة جديدة' : 'Upload New Photo'}
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            setUploadingProfilePic(true);
                            const uploadedUrl = await uploadFileInChunks(file);
                            if (uploadedUrl) {
                              setTempPic(uploadedUrl);
                            }
                          } catch (err) {
                            console.error("Error uploading profile photo:", err);
                            alert("Failed to upload profile image: " + (err instanceof Error ? err.message : String(err)));
                          } finally {
                            setUploadingProfilePic(false);
                          }
                        }}
                      />
                    </label>
                    {uploadingProfilePic && (
                      <p className="text-[9px] text-pink-400 font-bold mt-1.5 animate-pulse">{isAr ? 'جاري رفع الصورة...' : 'Uploading photo...'}</p>
                    )}
                  </div>
                </div>

                {/* Profile Pic URL */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">{isAr ? 'رابط الصورة الشخصية' : 'Profile Picture URL'}</label>
                  <input 
                    type="text" 
                    value={tempPic} 
                    onChange={(e) => setTempPic(e.target.value)} 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50"
                  />
                </div>

                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">{isAr ? 'الاسم المعروض' : 'Display Name'}</label>
                  <input 
                    type="text" 
                    value={tempName} 
                    onChange={(e) => setTempName(e.target.value)} 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50"
                  />
                </div>

                {/* Bio */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">{isAr ? 'السيرة الذاتية (البايو)' : 'Bio'}</label>
                  <textarea 
                    value={tempBio} 
                    onChange={(e) => setTempBio(e.target.value)} 
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setIsEditingProfile(false)}
                  className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/10"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button 
                  onClick={handleSaveProfile}
                  className="flex-1 py-2 bg-pink-500 hover:bg-pink-600 rounded-xl text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-pink-500/20"
                >
                  {isAr ? 'حفظ التغييرات' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {sharingContent && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-white/15 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl relative"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-white">Share to Connections</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Send this {sharingContent.type} directly to your chats</p>
                </div>
                <button 
                  onClick={() => { setSharingContent(null); setSharedStatus({}); }} 
                  className="text-slate-400 hover:text-white p-1 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Shared item preview */}
              <div className="flex items-center gap-3 p-2 bg-white/5 border border-white/5 rounded-2xl">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-black shrink-0">
                  {sharingContent.type === 'short' ? (
                    <video src={sharingContent.url} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={sharingContent.url} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="px-1.5 py-0.5 bg-pink-500/20 text-pink-400 rounded text-[8px] font-black uppercase tracking-wide">
                    {sharingContent.type}
                  </span>
                  <p className="text-[11px] text-slate-200 truncate mt-1 font-medium">{sharingContent.caption || 'No caption'}</p>
                </div>
              </div>

              {/* Connections list */}
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                {contacts.length === 0 ? (
                  <div className="text-center py-6 space-y-2">
                    <p className="text-xs text-slate-500 font-bold">No active connections found.</p>
                    <p className="text-[10px] text-slate-600">Add friends in the main chat to share posts with them!</p>
                  </div>
                ) : (
                  contacts.map(contact => {
                    const status = sharedStatus[contact.uid] || 'idle';
                    return (
                      <div key={contact.uid} className="flex items-center justify-between p-1.5 hover:bg-white/5 rounded-xl transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full border border-white/10 overflow-hidden bg-slate-800 shrink-0">
                            <img src={contact.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.uid}`} className="w-full h-full object-cover" />
                          </div>
                          <span className="text-xs font-bold text-white truncate">{contact.displayName || 'Anonymous Citizen'}</span>
                        </div>
                        <button 
                          disabled={status !== 'idle'}
                          onClick={() => handleShareToContact(contact)}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all min-w-[70px] ${
                            status === 'success' 
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                              : status === 'sending' 
                                ? 'bg-pink-500/20 text-pink-400 animate-pulse' 
                                : 'bg-pink-500 hover:bg-pink-600 text-white active:scale-95 shadow-md shadow-pink-500/10'
                          }`}
                        >
                          {status === 'success' ? 'Sent!' : status === 'sending' ? 'Sending...' : 'Send'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Delete Confirmation Warning Modal */}
        {deletingContent && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[160] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-red-500/25 rounded-3xl p-6 w-full max-w-sm space-y-5 shadow-2xl relative"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-3 bg-red-500/10 text-red-500 rounded-full border border-red-500/20">
                  <Trash2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-wider text-white">Confirm Removal</h3>
                <p className="text-xs text-slate-300">
                  Are you absolutely sure you want to delete this {deletingContent.type}? This action is permanent and cannot be undone.
                </p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setDeletingContent(null)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-slate-300 cursor-pointer active:scale-98 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDeleteContent(deletingContent.type, deletingContent.id)}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-red-600/25 cursor-pointer active:scale-98 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Content Info Modal */}
        {infoContent && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[160] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-white/15 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl relative text-left"
            >
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-pink-500" />
                  {infoContent.type === 'short' ? 'Video details' : 'Post details'}
                </h3>
                <button 
                  onClick={() => setInfoContent(null)}
                  className="text-slate-400 hover:text-white p-1 hover:bg-white/5 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-1">Description</span>
                  <p className="text-slate-200 bg-white/5 p-3 rounded-xl border border-white/5 italic">
                    "{infoContent.caption || 'No description provided.'}"
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 py-2">
                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/5 text-center">
                    <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 block">Views</span>
                    <span className="text-lg font-black text-white">{infoContent.views}</span>
                  </div>
                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/5 text-center">
                    <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 block">Likes</span>
                    <span className="text-lg font-black text-white">{infoContent.likes}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-1">Release Date</span>
                  <p className="text-slate-300 font-medium">
                    {infoContent.date ? new Date(infoContent.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Just now'}
                  </p>
                </div>
              </div>

              {infoContent.id && infoContent.item && (
                <button 
                  onClick={() => {
                    setReportingItem({ type: infoContent.type, id: infoContent.id || '', item: infoContent.item });
                    setInfoContent(null);
                  }}
                  className="w-full py-2 bg-red-600/20 hover:bg-red-600/35 border border-red-500/30 rounded-xl text-xs font-black uppercase tracking-widest text-red-400 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                >
                  <Flag className="w-3.5 h-3.5" />
                  Report Content
                </button>
              )}

              <button 
                onClick={() => setInfoContent(null)}
                className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-yellow-500 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-lg cursor-pointer active:scale-98 transition-all"
              >
                Done
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* Save to Playlist Modal Overlay */}
        {savingItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[160] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-white/15 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl relative text-left"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-white">Save to Playlist</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Select a playlist or create a new one</p>
                </div>
                <button 
                  onClick={() => setSavingItem(null)} 
                  className="text-slate-400 hover:text-white p-1 hover:bg-white/5 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Saved Item Mini-preview */}
              <div className="flex items-center gap-3 p-2 bg-white/5 border border-white/5 rounded-2xl">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-black shrink-0">
                  {savingItem.type === 'short' ? (
                    <video src={savingItem.item.videoUrl} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={savingItem.item.image} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="px-1.5 py-0.5 bg-pink-500/20 text-pink-400 rounded text-[8px] font-black uppercase tracking-wide">
                    {savingItem.type}
                  </span>
                  <p className="text-[11px] text-slate-200 truncate mt-1 font-medium">{savingItem.item.caption || 'No caption'}</p>
                </div>
              </div>

              {/* Playlists Selection List */}
              <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-none pr-1">
                {playlists.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">No playlists available yet.</p>
                  </div>
                ) : (
                  playlists.map(playlist => (
                    <button
                      key={playlist.id}
                      onClick={() => handleSaveToPlaylist(playlist.id)}
                      className="w-full flex items-center justify-between p-2.5 bg-white/5 hover:bg-pink-500/10 border border-white/5 hover:border-pink-500/20 rounded-xl transition-all text-left group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Bookmark className="w-4 h-4 text-pink-400 shrink-0" />
                        <span className="text-xs font-black text-white uppercase tracking-wide">{playlist.name}</span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 group-hover:text-pink-400">{(playlist.items || []).length} items</span>
                    </button>
                  ))
                )}
              </div>

              {/* Playlist creation during saving */}
              <div className="border-t border-white/10 pt-3 space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Create New Playlist & Save</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="New Playlist Name..." 
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 transition-colors"
                  />
                  <button 
                    onClick={() => {
                      if (!newPlaylistName.trim()) return;
                      handleCreateAndSavePlaylist(newPlaylistName);
                    }}
                    className="px-4 py-1.5 bg-pink-500 hover:bg-pink-600 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all cursor-pointer whitespace-nowrap"
                  >
                    Create & Save
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Report Content Modal Overlay */}
        {reportingItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[160] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-white/15 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl relative text-left"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <Flag className="w-4 h-4 text-red-500 animate-pulse" /> Report Content
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Let us know what is wrong with this post</p>
                </div>
                <button 
                  onClick={() => { setReportingItem(null); setReportReason(''); }} 
                  className="text-slate-400 hover:text-white p-1 hover:bg-white/5 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Reported Item Mini-preview */}
              <div className="flex items-center gap-3 p-2 bg-white/5 border border-white/5 rounded-2xl">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-black shrink-0">
                  {reportingItem.type === 'short' ? (
                    <video src={reportingItem.item.videoUrl} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={reportingItem.item.image} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[8px] font-black uppercase tracking-wide">
                    {reportingItem.type}
                  </span>
                  <p className="text-[11px] text-slate-200 truncate mt-1 font-medium">@{reportingItem.item.username}</p>
                </div>
              </div>

              {/* Report Input field */}
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Reason for reporting</label>
                <textarea 
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Tell us why this content is inappropriate (e.g., harassment, spam, copyright violation)..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 transition-colors resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2">
                <button 
                  onClick={handleReportSubmit}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all cursor-pointer text-center"
                >
                  Submit Report
                </button>
                <button 
                  onClick={() => { setReportingItem(null); setReportReason(''); }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FIXED BOTTOM NAVIGATION BAR */}
      <div className="absolute bottom-3 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-md h-16 bg-slate-950/80 backdrop-blur-2xl border border-white/15 rounded-3xl flex items-center justify-around px-3 z-30 shadow-[0_10px_35px_rgba(0,0,0,0.75)] ring-1 ring-white/5">
        {/* Go Back shortcut */}
        <button 
          onClick={onClose}
          className="flex flex-col items-center justify-center gap-1 py-1 px-2.5 text-slate-400 hover:text-white transition-all cursor-pointer rounded-2xl hover:bg-white/5 group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Chat</span>
        </button>

        {/* Home Feed */}
        <button 
          onClick={() => setActiveTab('feed')}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-3 transition-all cursor-pointer rounded-2xl relative ${
            activeTab === 'feed' 
              ? 'text-pink-400 font-bold bg-pink-500/10 border border-pink-500/25 shadow-sm' 
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Compass className={`w-5 h-5 ${activeTab === 'feed' ? 'animate-pulse text-pink-400' : ''}`} />
          <span className="text-[8px] font-black uppercase tracking-widest">{isAr ? 'الرئيسية' : 'Feed'}</span>
          {activeTab === 'feed' && (
            <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-pink-400 shadow-[0_0_8px_rgba(244,63,94,1)]" />
          )}
        </button>

        {/* Central Publish / Create Button with Glowing Ring */}
        <button 
          onClick={() => setActiveTab('create')}
          className="relative -top-3 p-3.5 bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-400 rounded-2xl text-white shadow-[0_0_20px_rgba(244,63,94,0.4)] hover:shadow-[0_0_30px_rgba(244,63,94,0.7)] hover:scale-110 active:scale-95 transition-all cursor-pointer border border-white/30 flex items-center justify-center group"
          title="Create New Post / Short / Story"
        >
          <PlusSquare className="w-6 h-6 stroke-[2.5] group-hover:rotate-90 transition-transform duration-300" />
        </button>

        {/* m shorts */}
        <button 
          onClick={() => setActiveTab('shorts')}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-3 transition-all cursor-pointer rounded-2xl relative ${
            activeTab === 'shorts' 
              ? 'text-cyan-400 font-bold bg-cyan-500/10 border border-cyan-500/25 shadow-sm' 
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Tv className={`w-5 h-5 ${activeTab === 'shorts' ? 'animate-pulse text-cyan-400' : ''}`} />
          <span className="text-[8px] font-black uppercase tracking-widest">{isAr ? 'مقاطع' : 'Shorts'}</span>
          {activeTab === 'shorts' && (
            <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,1)]" />
          )}
        </button>

        {/* Profile */}
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-3 transition-all cursor-pointer rounded-2xl relative ${
            activeTab === 'profile' 
              ? 'text-indigo-300 font-bold bg-indigo-500/10 border border-indigo-500/25 shadow-sm' 
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <User className={`w-5 h-5 ${activeTab === 'profile' ? 'text-indigo-300' : ''}`} />
          <span className="text-[8px] font-black uppercase tracking-widest">{isAr ? 'الملف' : 'Profile'}</span>
          {activeTab === 'profile' && (
            <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,1)]" />
          )}
        </button>
      </div>

      {/* Simple marquee CSS styling injected */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </motion.div>
  );
};
