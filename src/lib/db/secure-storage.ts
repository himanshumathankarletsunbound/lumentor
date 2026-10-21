import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { prisma } from './prisma';

const ALGORITHM = 'aes-256-gcm';

function encryptionKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error('APP_ENCRYPTION_KEY must be configured for encrypted production secrets.');
  }
  return createHashKey(raw);
}

function createHashKey(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptSecret(value: string): string {
  const [iv, tag, ciphertext] = value.split('.');
  if (!iv || !tag || !ciphertext) throw new Error('Invalid encrypted secret format.');
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}

export async function getEncryptedSecret(name: string): Promise<string> {
  const record = await prisma.encryptedSecret.findUnique({ where: { name } });
  return record ? decryptSecret(record.ciphertext) : '';
}

export async function setEncryptedSecret(name: string, value: string): Promise<void> {
  if (!value) return;
  await prisma.encryptedSecret.upsert({
    where: { name },
    create: { name, ciphertext: encryptSecret(value) },
    update: { ciphertext: encryptSecret(value) },
  });
}
