import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import type { SettingsData, WorkspaceData } from '../shared/types';

type Payload = { version: 1; workspace: WorkspaceData; settings: SettingsData };
export async function exportBackup(path: string, password: string, payload: Payload) {
  const salt = randomBytes(16); const iv = randomBytes(12); const key = pbkdf2Sync(password, salt, 310_000, 32, 'sha256'); const cipher = createCipheriv('aes-256-gcm', key, iv); const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]); const tag = cipher.getAuthTag(); await writeFile(path, Buffer.concat([Buffer.from('CONSTELLATION1'), salt, iv, tag, encrypted]));
}
export async function importBackup(path: string, password: string): Promise<Payload> {
  const value = await readFile(path); if (value.subarray(0, 14).toString() !== 'CONSTELLATION1') throw new Error('Sauvegarde Constellation invalide.'); const salt = value.subarray(14, 30); const iv = value.subarray(30, 42); const tag = value.subarray(42, 58); const encrypted = value.subarray(58); const key = pbkdf2Sync(password, salt, 310_000, 32, 'sha256'); const decipher = createDecipheriv('aes-256-gcm', key, iv); decipher.setAuthTag(tag); return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')) as Payload;
}
