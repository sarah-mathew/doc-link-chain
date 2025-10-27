import CryptoJS from 'crypto-js';

// Generate AES key
export function generateAESKey(): string {
  return CryptoJS.lib.WordArray.random(256 / 8).toString();
}

// Encrypt data with AES
export function encryptWithAES(data: string, key: string): string {
  return CryptoJS.AES.encrypt(data, key).toString();
}

// Decrypt data with AES
export function decryptWithAES(encryptedData: string, key: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedData, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// Generate RSA key pair (simplified for demo - in production use Web Crypto API)
export async function generateRSAKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  // For demo purposes, we'll generate a simplified key pair
  // In production, use Web Crypto API: crypto.subtle.generateKey()
  const keyPair = CryptoJS.lib.WordArray.random(2048 / 8).toString();
  return {
    publicKey: `PUBLIC_${keyPair}`,
    privateKey: `PRIVATE_${keyPair}`
  };
}

// Encrypt AES key with RSA public key (simplified)
export function encryptKeyWithRSA(aesKey: string, publicKey: string): string {
  // In production, use crypto.subtle.encrypt() with RSA-OAEP
  // For demo, we'll use AES encryption with the public key as password
  return CryptoJS.AES.encrypt(aesKey, publicKey).toString();
}

// Decrypt AES key with RSA private key (simplified)
export function decryptKeyWithRSA(encryptedKey: string, privateKey: string): string {
  // In production, use crypto.subtle.decrypt() with RSA-OAEP
  // For demo, we'll use AES decryption with the private key as password
  const bytes = CryptoJS.AES.decrypt(encryptedKey, privateKey);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// Hash file content
export function hashFile(content: string): string {
  return CryptoJS.SHA256(content).toString();
}

// Convert file to base64
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}
