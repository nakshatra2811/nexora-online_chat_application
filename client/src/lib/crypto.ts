// lib/crypto.ts
// Military-Grade E2EE Crypto Engine — ECDH + AES-256-GCM
// Keys NEVER leave the client device.

// ═══════════════════════════════════════════════════════
// 1. BUFFER UTILITIES
// ═══════════════════════════════════════════════════════

export const bufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const base64ToBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

// ═══════════════════════════════════════════════════════
// 2. SYMMETRIC ENCRYPTION (AES-256-GCM)
// ═══════════════════════════════════════════════════════

export const generateAESKey = async (): Promise<CryptoKey> => {
  return await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
};

export const deriveKeyFromPassword = async (password: string): Promise<CryptoKey> => {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("nexora_salt_1337"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
};

export const encryptMessage = async (key: CryptoKey, text: string) => {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(text)
  );
  return {
    ciphertext: bufferToBase64(cipherBuffer),
    iv: bufferToBase64(iv.buffer),
  };
};

export const decryptMessage = async (key: CryptoKey, ciphertextBase64: string, ivBase64: string): Promise<string> => {
  const cipherBuffer = base64ToBuffer(ciphertextBase64);
  const ivBuffer = base64ToBuffer(ivBase64);
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
    key,
    cipherBuffer
  );
  return new TextDecoder().decode(decryptedBuffer);
};

// ═══════════════════════════════════════════════════════
// 3. ASYMMETRIC KEY EXCHANGE (ECDH P-256)
//    Each user generates a keypair on-device.
//    Public key is shared via Socket.io.
//    Shared secret is derived locally → AES-256 key.
// ═══════════════════════════════════════════════════════

export const generateECDHKeyPair = async (): Promise<CryptoKeyPair> => {
  return await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true, // extractable for export
    ["deriveKey", "deriveBits"]
  );
};

export const exportPublicKey = async (publicKey: CryptoKey): Promise<string> => {
  const raw = await crypto.subtle.exportKey("raw", publicKey);
  return bufferToBase64(raw);
};

export const importPublicKey = async (base64Key: string): Promise<CryptoKey> => {
  const raw = base64ToBuffer(base64Key);
  return await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
};

export const deriveSharedSecret = async (
  myPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey
): Promise<CryptoKey> => {
  return await crypto.subtle.deriveKey(
    { name: "ECDH", public: theirPublicKey },
    myPrivateKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
};

// ═══════════════════════════════════════════════════════
// 4. MEDIA ENCRYPTION (Client-side AES-256-GCM for files)
//    Encrypt BEFORE upload → provider cannot see content.
// ═══════════════════════════════════════════════════════

export const encryptFile = async (key: CryptoKey, file: ArrayBuffer): Promise<{ encrypted: ArrayBuffer; iv: string }> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    file
  );
  return { encrypted, iv: bufferToBase64(iv.buffer) };
};

export const decryptFile = async (key: CryptoKey, encrypted: ArrayBuffer, ivBase64: string): Promise<ArrayBuffer> => {
  const iv = new Uint8Array(base64ToBuffer(ivBase64));
  return await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted
  );
};

// ═══════════════════════════════════════════════════════
// 5. ON-DEVICE KEY STORE (IndexedDB)
//    Private keys NEVER leave the browser.
// ═══════════════════════════════════════════════════════

const KEYSTORE_DB = "NexoraKeyStore";
const KEYSTORE_VERSION = 1;

const openKeyStore = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(KEYSTORE_DB, KEYSTORE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("keys")) {
        db.createObjectStore("keys", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("shared_secrets")) {
        db.createObjectStore("shared_secrets", { keyPath: "peerId" });
      }
      if (!db.objectStoreNames.contains("vault_key")) {
        db.createObjectStore("vault_key", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const KeyStore = {
  async saveKeyPair(keyPair: CryptoKeyPair): Promise<void> {
    const db = await openKeyStore();
    const pubRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
    const privJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
    const tx = db.transaction("keys", "readwrite");
    tx.objectStore("keys").put({
      id: "my_ecdh_keypair",
      publicKeyRaw: bufferToBase64(pubRaw),
      privateKeyJwk: privJwk,
      createdAt: Date.now(),
    });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getKeyPair(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey } | null> {
    const db = await openKeyStore();
    const tx = db.transaction("keys", "readonly");
    const request = tx.objectStore("keys").get("my_ecdh_keypair");
    return new Promise((resolve, reject) => {
      request.onsuccess = async () => {
        const record = request.result;
        if (!record) return resolve(null);
        try {
          const publicKey = await importPublicKey(record.publicKeyRaw);
          const privateKey = await crypto.subtle.importKey(
            "jwk",
            record.privateKeyJwk,
            { name: "ECDH", namedCurve: "P-256" },
            true,
            ["deriveKey", "deriveBits"]
          );
          resolve({ publicKey, privateKey });
        } catch (e) {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  async saveSharedSecret(peerId: string, key: CryptoKey): Promise<void> {
    const db = await openKeyStore();
    const jwk = await crypto.subtle.exportKey("jwk", key);
    const tx = db.transaction("shared_secrets", "readwrite");
    tx.objectStore("shared_secrets").put({ peerId, keyJwk: jwk, createdAt: Date.now() });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getSharedSecret(peerId: string): Promise<CryptoKey | null> {
    const db = await openKeyStore();
    const tx = db.transaction("shared_secrets", "readonly");
    const request = tx.objectStore("shared_secrets").get(peerId);
    return new Promise((resolve, reject) => {
      request.onsuccess = async () => {
        const record = request.result;
        if (!record) return resolve(null);
        try {
          const key = await crypto.subtle.importKey(
            "jwk",
            record.keyJwk,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
          );
          resolve(key);
        } catch {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  async getPublicKeyBase64(): Promise<string | null> {
    const db = await openKeyStore();
    const tx = db.transaction("keys", "readonly");
    const request = tx.objectStore("keys").get("my_ecdh_keypair");
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const record = request.result;
        resolve(record ? record.publicKeyRaw : null);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async getVaultKey(): Promise<CryptoKey | null> {
    const db = await openKeyStore();
    const tx = db.transaction("vault_key", "readonly");
    const request = tx.objectStore("vault_key").get("my_storage_vault");
    return new Promise((resolve, reject) => {
      request.onsuccess = async () => {
        const record = request.result;
        if (!record) return resolve(null);
        try {
          const key = await crypto.subtle.importKey(
            "jwk",
            record.keyJwk,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
          );
          resolve(key);
        } catch {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  async saveVaultKey(key: CryptoKey): Promise<void> {
    const db = await openKeyStore();
    const jwk = await crypto.subtle.exportKey("jwk", key);
    const tx = db.transaction("vault_key", "readwrite");
    tx.objectStore("vault_key").put({ id: "my_storage_vault", keyJwk: jwk, createdAt: Date.now() });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

// ═══════════════════════════════════════════════════════
// 6. LOCAL STORAGE ENCRYPTION HELPERS
//    Used to lock the entire chat history on disk (localStorage)
// ═══════════════════════════════════════════════════════

export const encryptStorageData = async (data: any, key: CryptoKey): Promise<string> => {
  const json = JSON.stringify(data);
  const { ciphertext, iv } = await encryptMessage(key, json);
  return `anc:${iv}:${ciphertext}`; // "anc" prefix for Nexora Encrypted
};

export const decryptStorageData = async (encryptedString: string, key: CryptoKey): Promise<any> => {
  if (!encryptedString.startsWith("anc:")) return null;
  const [, iv, ciphertext] = encryptedString.split(":");
  try {
    const json = await decryptMessage(key, ciphertext, iv);
    return JSON.parse(json);
  } catch (e) {
    console.error("[!] Storage Decryption Failed", e);
    return null;
  }
};
