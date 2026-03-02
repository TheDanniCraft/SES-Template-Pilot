import crypto from "node:crypto";

const ENC_VERSION = "v1";
let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }

  const b64 = process.env.DB_SECRET_KEY;
  if (b64) {
    const key = Buffer.from(b64, "base64");
    if (key.length !== 32) {
      throw new Error(
        "DB_SECRET_KEY must be base64 for exactly 32 bytes (AES-256 key)"
      );
    }
    cachedKey = key;
    return key;
  }

  if (process.env.NODE_ENV !== "production") {
    const devSeed = process.env.COOKIE_SECRET ?? "dev-db-secret-key-change-this";
    cachedKey = crypto.createHash("sha256").update(devSeed).digest();
    return cachedKey;
  }

  throw new Error("Missing DB_SECRET_KEY");
}

function b64urlEncode(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlDecode(value: string) {
  let next = value.replace(/-/g, "+").replace(/_/g, "/");
  while (next.length % 4 !== 0) {
    next += "=";
  }
  return Buffer.from(next, "base64");
}

export function encryptToken(plaintext: string, aad: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return `${ENC_VERSION}.${b64urlEncode(iv)}.${b64urlEncode(tag)}.${b64urlEncode(ciphertext)}`;
}

export function decryptToken(payload: string, aad: string): string {
  if (!payload.startsWith(`${ENC_VERSION}.`)) {
    return payload;
  }

  const parts = payload.split(".");
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted token format");
  }

  const [_version, ivB64, tagB64, ctB64] = parts;
  const key = getKey();
  const iv = b64urlDecode(ivB64);
  const tag = b64urlDecode(tagB64);
  const ciphertext = b64urlDecode(ctB64);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    "utf8"
  );
}
