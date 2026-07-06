import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function getEncryptionKey(): Buffer {
  const raw = process.env.MAILBOX_ENCRYPTION_KEY?.trim();
  if (!raw || !/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error("MAILBOX_ENCRYPTION_KEY must be a 32-byte hex string (64 hex characters)");
  }
  return Buffer.from(raw, "hex");
}

/** Encrypt a mailbox app password as iv:authTag:ciphertext (base64 segments). */
export function encryptMailboxSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

/** Decrypt a mailbox app password stored as iv:authTag:ciphertext. */
export function decryptMailboxSecret(payload: string): string {
  const key = getEncryptionKey();
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted mailbox secret format");
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
