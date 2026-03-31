// lib/media.ts
// Client-Side Encrypted Media Handler
// Files are encrypted with AES-256-GCM BEFORE upload.
// Even the storage provider (Cloudinary/S3) cannot see your content.

import { encryptFile, decryptFile, bufferToBase64, base64ToBuffer } from "./crypto";

import { API_BASE_URL as API_BASE } from "./config";

/**
 * Encrypt a file client-side, then upload the encrypted blob to backend → Cloudinary.
 * Returns the Cloudinary URL (stores encrypted, unreadable data).
 */
export const encryptAndUpload = async (
  file: File,
  encryptionKey: CryptoKey
): Promise<{ url: string; iv: string; publicId: string; originalName: string; originalType: string }> => {
  // 1. Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // 2. Encrypt with AES-256-GCM
  const { encrypted, iv } = await encryptFile(encryptionKey, arrayBuffer);

  // 3. Create a Blob from the encrypted data
  const encryptedBlob = new Blob([encrypted], { type: "application/octet-stream" });

  // 4. Upload to backend
  const formData = new FormData();
  formData.append("file", encryptedBlob, `encrypted_${Date.now()}.bin`);
  formData.append("iv", iv);
  formData.append("originalName", file.name);
  formData.append("originalType", file.type);

  const response = await fetch(`${API_BASE}/api/media/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to upload encrypted media");
  }

  const result = await response.json();

  return {
    url: result.url,
    iv,
    publicId: result.publicId,
    originalName: file.name,
    originalType: file.type,
  };
};

/**
 * Download an encrypted file from its URL and decrypt it client-side.
 * Returns a displayable Blob URL.
 */
export const downloadAndDecrypt = async (
  url: string,
  iv: string,
  encryptionKey: CryptoKey,
  originalType: string
): Promise<string> => {
  // 1. Fetch the encrypted blob
  const response = await fetch(url);
  const encryptedBuffer = await response.arrayBuffer();

  // 2. Decrypt locally
  const decryptedBuffer = await decryptFile(encryptionKey, encryptedBuffer, iv);

  // 3. Create a displayable Blob URL
  const blob = new Blob([decryptedBuffer], { type: originalType });
  return URL.createObjectURL(blob);
};

/**
 * Request server to delete a media file from Cloudinary.
 */
export const deleteMedia = async (publicId: string): Promise<void> => {
  await fetch(`${API_BASE}/api/media/${encodeURIComponent(publicId)}`, {
    method: "DELETE",
  });
};
