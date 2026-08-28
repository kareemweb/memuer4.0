import { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '../types';
import { getStoredKeyPair, generateKeyPair, storeKeyPair } from '../lib/crypto';

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setLoading(true);
        // Ensure user document exists and has a public key
        const userRef = doc(db, 'users', firebaseUser.uid);
        let docSnap;
        let retryCount = 0;
        const maxRetries = 2;
        
        const fetchDoc = async (): Promise<any> => {
          try {
            return await getDoc(userRef);
          } catch (err) {
            if (retryCount < maxRetries) {
              retryCount++;
              console.warn(`Retrying user profile fetch (${retryCount}/${maxRetries})...`);
              await new Promise(resolve => setTimeout(resolve, 500));
              return fetchDoc();
            }
            throw err;
          }
        };

        try {
          docSnap = await fetchDoc();
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`, firebaseUser);
          setLoading(false);
          return;
        }
        
        let profile: UserProfile;
        
        if (!docSnap.exists()) {
          // If this is a new user, they might be in the middle of registration (updating profile)
          // We'll wait a moment for the displayName if it's missing
          let name = firebaseUser.displayName;
          if (!name) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Force reload user to get updated profile
            await firebaseUser.reload();
            name = auth.currentUser?.displayName || 'Vault Member';
          }

          // New user: generate E2EE keys
          const keyPair = generateKeyPair();
          storeKeyPair(keyPair);
          
          profile = {
            uid: firebaseUser.uid,
            displayName: name,
            photoURL: firebaseUser.photoURL || '',
            publicKey: keyPair.publicKey,
            isOnline: true,
            lastSeen: new Date().toISOString(),
            status: 'Hey there! I am using Memuer.',
            role: firebaseUser.email === 'koke.kozkoz@gmail.com' ? 'headowner' : 'user',
            email: firebaseUser.email || '',
            preferences: { theme: 'vibrant', chatBackground: 'default' }
          };
          
          try {
            await setDoc(userRef, profile);
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, `users/${firebaseUser.uid}`, firebaseUser);
          }
        } else {
          profile = docSnap.data() as UserProfile;
          // Check keys status
          const localKeys = getStoredKeyPair();
          const keysMatch = !!(localKeys && localKeys.publicKey === profile.publicKey);
          profile = { ...profile, vaultSynced: keysMatch };
          
          // Update online status and ensure owner privileges
          try {
            const updates: any = {
              isOnline: true, 
              lastSeen: new Date().toISOString() 
            };
            if (firebaseUser.email || !profile.email) {
              updates.email = firebaseUser.email || '';
              profile.email = firebaseUser.email || '';
            }
            if (firebaseUser.email === 'koke.kozkoz@gmail.com' && profile.role !== 'headowner') {
              updates.role = 'headowner';
              profile.role = 'headowner';
            }
            await setDoc(userRef, updates, { merge: true });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `users/${firebaseUser.uid}`, firebaseUser);
          }
        }
        
        // Listen for profile updates (including presence)
        const unsubscribe = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            let updatedProfile = snap.data() as UserProfile;
            if (updatedProfile.preferences?.theme) {
              try {
                localStorage.setItem('memuer_theme', updatedProfile.preferences.theme);
              } catch (_) {}
            }
            const localKeys = getStoredKeyPair();
            const keysMatch = !!(localKeys && localKeys.publicKey === updatedProfile.publicKey);
            updatedProfile = { ...updatedProfile, vaultSynced: keysMatch };
            setUser(updatedProfile);
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`, firebaseUser);
        });
        
        setLoading(false);
        return unsubscribe;
      } else {
        setUser(null);
        setLoading(false);
      }
    });
  }, []);

  const login = async () => {
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Login failed:", err);
      if (err.code === 'auth/popup-blocked') {
        setError("Sign-in popup was blocked. Please enable popups or open the app in a new tab using the button in the top right.");
      } else {
        setError(err.message || "An unexpected error occurred during sign-in.");
      }
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const registerWithEmail = async (email: string, pass: string, name: string) => {
    setError(null);
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName: name });
      
      // Explicitly create the firestore document here to ensure the name is used
      const userRef = doc(db, 'users', cred.user.uid);
      const keyPair = generateKeyPair();
      storeKeyPair(keyPair);
      
      const profile: UserProfile = {
        uid: cred.user.uid,
        displayName: name,
        photoURL: '',
        publicKey: keyPair.publicKey,
        isOnline: true,
        lastSeen: new Date().toISOString(),
        status: 'Hey there! I am using Memuer.',
        role: email === 'koke.kozkoz@gmail.com' ? 'headowner' : 'user',
        email: email,
        preferences: { theme: 'vibrant', chatBackground: 'default' }
      };
      
      await setDoc(userRef, profile);
      // onAuthStateChanged will pick up the existing document now
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const logout = async () => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { isOnline: false, lastSeen: new Date().toISOString() }, { merge: true });
    }
    await signOut(auth);
  };

  const resetPassword = async (email: string) => {
    setError(null);
    setResetEmailSent(false);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetEmailSent(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return { user, loading, error, setError, login, loginWithEmail, registerWithEmail, logout, resetPassword, resetEmailSent };
}
