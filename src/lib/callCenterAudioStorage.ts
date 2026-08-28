import { db } from './firebase';
import { doc, setDoc, getDoc, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore';

// IndexedDB helper for storing custom greeting audio and hold music files locally as a fast offline cache
const DB_NAME = 'MemuerCallCenterAudioDB';
const STORE_NAME = 'audio_files';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAudioToIDB(key: string, dataUrl: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(dataUrl, key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Error saving audio to IndexedDB:', err);
  }
}

export async function getAudioFromIDB(key: string): Promise<string | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Error fetching audio from IndexedDB:', err);
    return null;
  }
}

export async function deleteAudioFromIDB(key: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
  } catch (err) {
    console.warn('Error deleting audio from IndexedDB:', err);
  }
}

/**
 * Save audio Data URL to Firestore in chunks (up to ~300KB per chunk) 
 * AND to local IndexedDB. This ensures ALL users and devices on all servers receive the audio!
 */
export async function saveAudioToFirestoreAndIDB(key: string, dataUrl: string): Promise<void> {
  // 1. Save to local IDB for fast immediate playback
  if (dataUrl) {
    await saveAudioToIDB(key, dataUrl);
  } else {
    await deleteAudioFromIDB(key);
  }

  // 2. Upload chunks to Firestore collection `call_center_audio_store/{key}/chunks/chunk_N`
  const audioDocRef = doc(db, 'call_center_audio_store', key);

  if (!dataUrl) {
    try {
      await deleteDoc(audioDocRef);
    } catch (_) {}
    return;
  }

  const CHUNK_SIZE = 250000; // 250 KB per chunk (comfortably under Firestore 1MB limit)
  const totalChunks = Math.ceil(dataUrl.length / CHUNK_SIZE);
  const timestamp = new Date().toISOString();

  // Write Metadata document
  await setDoc(audioDocRef, {
    key,
    totalChunks,
    totalSize: dataUrl.length,
    updatedAt: timestamp
  });

  // Write Chunks sequentially or via batch
  for (let i = 0; i < totalChunks; i++) {
    const chunkStr = dataUrl.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const chunkDocRef = doc(db, 'call_center_audio_store', key, 'chunks', `chunk_${i}`);
    await setDoc(chunkDocRef, {
      index: i,
      data: chunkStr,
      updatedAt: timestamp
    });
  }
}

/**
 * Retrieves full audio Data URL from local IndexedDB cache or loads and re-assembles chunks from Firestore.
 */
export async function getAudioFromFirestoreOrIDB(key: string): Promise<string | null> {
  // 1. Check local IndexedDB cache
  const cached = await getAudioFromIDB(key);

  // 2. Try fetching Firestore audio store
  try {
    const audioDocRef = doc(db, 'call_center_audio_store', key);
    const docSnap = await getDoc(audioDocRef);

    if (docSnap.exists()) {
      const meta = docSnap.data();
      const totalChunks = meta.totalChunks || 0;

      if (totalChunks > 0) {
        const chunksCollection = collection(db, 'call_center_audio_store', key, 'chunks');
        const chunksSnap = await getDocs(chunksCollection);

        if (!chunksSnap.empty) {
          const chunkDocs = chunksSnap.docs.map(d => d.data());
          chunkDocs.sort((a, b) => a.index - b.index);

          const fullDataUrl = chunkDocs.map(c => c.data).join('');
          if (fullDataUrl) {
            // Update local IndexedDB cache with latest global version
            await saveAudioToIDB(key, fullDataUrl);
            return fullDataUrl;
          }
        }
      }
    }
  } catch (err) {
    console.warn(`Error fetching global audio from Firestore for ${key}:`, err);
  }

  // 3. Fallback to cached IDB audio if Firestore fetch wasn't successful or offline
  return cached;
}
