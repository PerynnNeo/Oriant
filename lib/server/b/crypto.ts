/**
 * lib/server/b/crypto.ts — AES-256-GCM helpers for OAuth token storage
 * (item 6). Never imported from client code. The key is derived (via
 * scrypt) from INTEGRATION_TOKEN_ENCRYPTION_KEY so the env var itself can
 * be any passphrase-length string, not a precisely-sized raw key.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12; // recommended GCM IV size
const AUTH_TAG_LENGTH = 16;
const KDF_SALT = "oriant-integration-credentials-v1";

function getKey(): Buffer {
  const secret = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "INTEGRATION_TOKEN_ENCRYPTION_KEY is not set — required to store/read OAuth tokens.",
    );
  }
  return scryptSync(secret, KDF_SALT, 32);
}

/** Encrypts a plaintext token; returns iv + authTag + ciphertext, base64-packed. */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptToken(packed: string): string {
  const raw = Buffer.from(packed, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function tokenEncryptionConfigured(): boolean {
  return !!process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
}

/**
 * Signs an opaque value for use as an OAuth `state` param — CSRF
 * protection so /callback only trusts a value this server actually issued
 * from /connect. Reuses INTEGRATION_TOKEN_ENCRYPTION_KEY as the HMAC key
 * (a different derivation context than encryptToken, no conflict).
 */
export function signState(value: string): string {
  const secret = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error("INTEGRATION_TOKEN_ENCRYPTION_KEY is not set");
  const sig = createHmac("sha256", secret).update(value).digest("base64url");
  return `${value}.${sig}`;
}

/** Returns the original value if the signature is valid, else null. */
export function verifyState(signed: string): string | null {
  const secret = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  if (!secret) return null;
  const dot = signed.lastIndexOf(".");
  if (dot < 0) return null;
  const value = signed.slice(0, dot);
  const sig = signed.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(value).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;
  return value;
}
