import crypto from 'crypto';

/**
 * Derives a cryptographic hash of a password using PBKDF2 with a unique salt.
 */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, generatedSalt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt: generatedSalt };
}

/**
 * Constant-time verification of a candidate password against an existing salt and hash.
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const candidateHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    const candidateBuffer = Buffer.from(candidateHash, 'hex');

    if (hashBuffer.length !== candidateBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(hashBuffer, candidateBuffer);
  } catch {
    return false;
  }
}

/**
 * Generates an opaque, high-entropy session token.
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generates a password reset token with expiration (default: 1 hour).
 */
export function generateResetToken(validMinutes: number = 60): { token: string; expiresAt: string } {
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + validMinutes * 60 * 1000).toISOString();
  return { token, expiresAt };
}
