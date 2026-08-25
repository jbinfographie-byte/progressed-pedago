const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PASSWORD_HASH_VERSION = 'pbkdf2-sha256';
const PASSWORD_HASH_ITERATIONS = 100_000;
const LEGACY_PASSWORD_HASH_ITERATIONS = 210_000;
function bytesToBase64(bytes: Uint8Array): string { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }
function base64ToBytes(value: string): Uint8Array { const binary = atob(value); return Uint8Array.from(binary, (char) => char.charCodeAt(0)); }
function bufferSource(value: Uint8Array): BufferSource { return value as unknown as BufferSource; }
export function randomToken(byteLength = 32): string { const bytes = crypto.getRandomValues(new Uint8Array(byteLength)); return bytesToBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); }
export function validatePassword(password: string): string[] { const errors: string[] = []; if (password.length < 12) errors.push('Le mot de passe doit contenir au moins 12 caractères.'); if (!/[a-z]/.test(password)) errors.push('Ajoutez une lettre minuscule.'); if (!/[A-Z]/.test(password)) errors.push('Ajoutez une lettre majuscule.'); if (!/[0-9]/.test(password)) errors.push('Ajoutez un chiffre.'); if (!/[^A-Za-z0-9]/.test(password)) errors.push('Ajoutez un caractère spécial.'); return errors; }
async function derivePasswordHash(password: string, salt: string, iterations: number): Promise<string> { const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']); const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations }, key, 256); return bytesToBase64(new Uint8Array(bits)); }
export async function hashPassword(password: string, salt = randomToken(16)): Promise<{ hash: string; salt: string }> { const derived = await derivePasswordHash(password, salt, PASSWORD_HASH_ITERATIONS); return { hash: `${PASSWORD_HASH_VERSION}$${PASSWORD_HASH_ITERATIONS}$${derived}`, salt }; }
export async function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  const versioned = expectedHash.match(/^pbkdf2-sha256\$(\d+)\$(.+)$/);
  if (versioned) {
    const iterations = Number(versioned[1]);
    if (!Number.isInteger(iterations) || iterations < 50_000 || iterations > PASSWORD_HASH_ITERATIONS) return false;
    return timingSafeEqual(await derivePasswordHash(password, salt, iterations), versioned[2]);
  }
  for (const iterations of [LEGACY_PASSWORD_HASH_ITERATIONS, PASSWORD_HASH_ITERATIONS]) {
    try { if (timingSafeEqual(await derivePasswordHash(password, salt, iterations), expectedHash)) return true; }
    catch { /* Les anciens réglages trop élevés ne sont pas acceptés par tous les runtimes. */ }
  }
  return false;
}
export async function sha256(value: string): Promise<string> { const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value)); return bytesToBase64(new Uint8Array(digest)); }
export function timingSafeEqual(a: string, b: string): boolean { const aBytes = encoder.encode(a); const bBytes = encoder.encode(b); let difference = aBytes.length ^ bBytes.length; const length = Math.max(aBytes.length, bBytes.length); for (let index = 0; index < length; index += 1) difference |= (aBytes[index % Math.max(aBytes.length, 1)] ?? 0) ^ (bBytes[index % Math.max(bBytes.length, 1)] ?? 0); return difference === 0; }
export async function encryptSecret(secret: string, masterKeyBase64: string): Promise<{ ciphertext: string; iv: string }> { const keyBytes = base64ToBytes(masterKeyBase64); if (keyBytes.length !== 32) throw new Error('La clé maître de chiffrement doit contenir exactement 32 octets encodés en base64.'); const key = await crypto.subtle.importKey('raw', bufferSource(keyBytes), 'AES-GCM', false, ['encrypt']); const iv = crypto.getRandomValues(new Uint8Array(12)); const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bufferSource(iv) }, key, encoder.encode(secret)); return { ciphertext: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv) }; }
export async function decryptSecret(ciphertext: string, iv: string, masterKeyBase64: string): Promise<string> { const key = await crypto.subtle.importKey('raw', bufferSource(base64ToBytes(masterKeyBase64)), 'AES-GCM', false, ['decrypt']); const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bufferSource(base64ToBytes(iv)) }, key, bufferSource(base64ToBytes(ciphertext))); return decoder.decode(decrypted); }
