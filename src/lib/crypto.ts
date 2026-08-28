import nacl from 'tweetnacl';
import { decodeUTF8, encodeUTF8, decodeBase64, encodeBase64 } from 'tweetnacl-util';

export function generateKeyPair() {
  const pair = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(pair.publicKey),
    secretKey: encodeBase64(pair.secretKey)
  };
}

export function getStoredKeyPair(uid?: string) {
  if (!uid) {
    const pub = localStorage.getItem('memuer_pub');
    const sec = localStorage.getItem('memuer_sec');
    if (pub && sec) return { publicKey: pub, secretKey: sec };
    return null;
  }

  const suffix = `_${uid}`;
  let pub = localStorage.getItem(`memuer_pub${suffix}`);
  let sec = localStorage.getItem(`memuer_sec${suffix}`);
  
  // Robust fallback with owner check: only use non-suffix keys if they are owned by this user or have no recorded owner
  if (!pub || !sec) {
    const legacyPub = localStorage.getItem('memuer_pub');
    const legacySec = localStorage.getItem('memuer_sec');
    const legacyOwner = localStorage.getItem('memuer_key_owner_uid');
    
    if (legacyPub && legacySec && (!legacyOwner || legacyOwner === uid)) {
      pub = legacyPub;
      sec = legacySec;
      // Migrate legacy key pair to are secure per-user location
      localStorage.setItem(`memuer_pub${suffix}`, pub);
      localStorage.setItem(`memuer_sec${suffix}`, sec);
      localStorage.setItem('memuer_key_owner_uid', uid);
    }
  }
  
  if (pub && sec) {
    return { publicKey: pub, secretKey: sec };
  }
  return null;
}

export function storeKeyPair(keys: { publicKey: string, secretKey: string } | string, maybeKeys?: { publicKey: string, secretKey: string }) {
  let finalUid = '';
  let finalKeys: { publicKey: string, secretKey: string };

  if (typeof keys === 'string') {
    finalUid = keys;
    finalKeys = maybeKeys!;
  } else {
    finalKeys = keys;
  }

  const suffix = finalUid ? `_${finalUid}` : '';
  localStorage.setItem(`memuer_pub${suffix}`, finalKeys.publicKey);
  localStorage.setItem(`memuer_sec${suffix}`, finalKeys.secretKey);

  if (finalUid) {
    localStorage.setItem('memuer_key_owner_uid', finalUid);
  }

  // Dual-write to non-suffix version for backwards compatibility & clean fallbacks
  localStorage.setItem('memuer_pub', finalKeys.publicKey);
  localStorage.setItem('memuer_sec', finalKeys.secretKey);
}

export function encryptMessage(messageText: string, recipientPublicKey: string, senderSecretKey: string): { content: string, nonce: string } {
  try {
    if (!recipientPublicKey || !senderSecretKey) {
      // Fallback/No-op encryption to prevent crash if keys are missing
      return { content: encodeBase64(decodeUTF8(messageText)), nonce: '' };
    }
    const messageUint8 = decodeUTF8(messageText);
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const recipientPubKeyUint8 = decodeBase64(recipientPublicKey);
    const senderSecKeyUint8 = decodeBase64(senderSecretKey);
    
    const encrypted = nacl.box(messageUint8, nonce, recipientPubKeyUint8, senderSecKeyUint8);
    return {
      content: encodeBase64(encrypted),
      nonce: encodeBase64(nonce)
    };
  } catch (error) {
    console.error("Encryption error:", error);
    return { content: encodeBase64(decodeUTF8(messageText)), nonce: '' };
  }
}

export function decryptMessage(ciphertext: string, nonce: string, senderPublicKey: string, recipientSecretKey: string): string {
  try {
    if (!nonce || !senderPublicKey || !recipientSecretKey) {
      return encodeUTF8(decodeBase64(ciphertext));
    }
    const ciphertextUint8 = decodeBase64(ciphertext);
    const nonceUint8 = decodeBase64(nonce);
    const senderPubKeyUint8 = decodeBase64(senderPublicKey);
    const recipientSecKeyUint8 = decodeBase64(recipientSecretKey);
    
    const decrypted = nacl.box.open(ciphertextUint8, nonceUint8, senderPubKeyUint8, recipientSecKeyUint8);
    if (!decrypted) {
      throw new Error("Failed to decrypt message");
    }
    return encodeUTF8(decrypted);
  } catch (error: any) {
    console.warn("Decryption warning:", error?.message || error);
    try {
      return encodeUTF8(decodeBase64(ciphertext));
    } catch {
      return "[Undecryptable Message due to key mismatch]";
    }
  }
}

export function generateSymmetricKey(): string {
  const key = nacl.randomBytes(nacl.secretbox.keyLength);
  return encodeBase64(key);
}

export function encryptSymmetric(messageText: string, base64Key: string): { content: string, nonce: string } {
  try {
    if (!base64Key) {
      return { content: encodeBase64(decodeUTF8(messageText)), nonce: '' };
    }
    const messageUint8 = decodeUTF8(messageText);
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const keyUint8 = decodeBase64(base64Key);
    
    const encrypted = nacl.secretbox(messageUint8, nonce, keyUint8);
    return {
      content: encodeBase64(encrypted),
      nonce: encodeBase64(nonce)
    };
  } catch (error) {
    console.error("Symmetric encryption error:", error);
    return { content: encodeBase64(decodeUTF8(messageText)), nonce: '' };
  }
}

export function decryptSymmetric(ciphertext: string, nonce: string, base64Key: string): string {
  try {
    if (!nonce || !base64Key) {
      return encodeUTF8(decodeBase64(ciphertext));
    }
    const ciphertextUint8 = decodeBase64(ciphertext);
    const nonceUint8 = decodeBase64(nonce);
    const keyUint8 = decodeBase64(base64Key);
    
    const decrypted = nacl.secretbox.open(ciphertextUint8, nonceUint8, keyUint8);
    if (!decrypted) {
      throw new Error("Failed to decrypt symmetrically");
    }
    return encodeUTF8(decrypted);
  } catch (error: any) {
    console.warn("Symmetric decryption warning:", error?.message || error);
    try {
      return encodeUTF8(decodeBase64(ciphertext));
    } catch {
      return "[Undecryptable Group Message]";
    }
  }
}
