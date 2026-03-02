const encoder = new TextEncoder();
const decoder = new TextDecoder();

const ALGO = "AES-GCM";
const SESSION_VERSION = 1;

type SessionPayload = {
  v: number;
  s: string;
  exp: number;
};

function getCryptoKeyMaterial() {
  const secret =
    process.env.COOKIE_SECRET ??
    (process.env.NODE_ENV !== "production"
      ? "dev-cookie-secret-change-this"
      : undefined);

  if (!secret) {
    throw new Error("COOKIE_SECRET is not set");
  }
  return encoder.encode(secret);
}

async function getKey() {
  const keyMaterial = getCryptoKeyMaterial();
  const digest = await crypto.subtle.digest("SHA-256", keyMaterial);
  return crypto.subtle.importKey("raw", digest, ALGO, false, [
    "encrypt",
    "decrypt"
  ]);
}

function bytesToBase64(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64url");
  }
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string) {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64url"));
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function encryptAuthCookie(plainText: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey();
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    encoder.encode(plainText)
  );
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

export async function decryptAuthCookie(value: string) {
  try {
    const [ivPart, cipherPart] = value.split(".");
    if (!ivPart || !cipherPart) {
      return null;
    }
    const iv = base64ToBytes(ivPart);
    const cipher = base64ToBytes(cipherPart);
    const key = await getKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGO, iv },
      key,
      cipher
    );
    return decoder.decode(decrypted);
  } catch {
    return null;
  }
}

export async function createSessionCookie(
  sessionToken: string,
  maxAgeSeconds = 60 * 60 * 24 * 7
) {
  const payload: SessionPayload = {
    v: SESSION_VERSION,
    s: sessionToken,
    exp: Date.now() + maxAgeSeconds * 1000
  };

  return encryptAuthCookie(JSON.stringify(payload));
}

export async function parseSessionCookie(cookieValue: string) {
  const decrypted = await decryptAuthCookie(cookieValue);
  if (!decrypted) {
    return null;
  }

  try {
    const parsed = JSON.parse(decrypted) as SessionPayload;
    if (!parsed || parsed.v !== SESSION_VERSION) {
      return null;
    }
    if (typeof parsed.exp !== "number" || parsed.exp <= Date.now()) {
      return null;
    }
    if (typeof parsed.s !== "string" || !parsed.s) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
