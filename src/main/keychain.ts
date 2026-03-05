import { safeStorage } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

const KEYCHAIN_FILE = join(app.getPath('userData'), 'credentials.enc')

interface CredentialStore {
  [connectionId: string]: string // base64-encoded encrypted API key
}

async function readStore(): Promise<CredentialStore> {
  if (!existsSync(KEYCHAIN_FILE)) return {}
  try {
    const data = JSON.parse(await readFile(KEYCHAIN_FILE, 'utf-8'))
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      console.error('Corrupted credential store — expected object, resetting')
      return {}
    }
    return data
  } catch (e) {
    console.error('Failed to read credential store:', e)
    return {}
  }
}

async function writeStore(store: CredentialStore): Promise<void> {
  await writeFile(KEYCHAIN_FILE, JSON.stringify(store), { encoding: 'utf-8', mode: 0o600 })
}

export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

export async function getCredential(connectionId: string): Promise<string | null> {
  const store = await readStore()
  const encrypted = store[connectionId]
  if (!encrypted) return null
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(encrypted, 'base64')
      return safeStorage.decryptString(buffer)
    }
    // Fallback: stored as plain base64 (unencrypted)
    return Buffer.from(encrypted, 'base64').toString('utf-8')
  } catch {
    return null
  }
}

export async function setCredential(connectionId: string, apiKey: string): Promise<void> {
  const store = await readStore()
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(apiKey)
    store[connectionId] = encrypted.toString('base64')
  } else {
    // Fallback: store as plain base64 (unencrypted) — user is warned in the UI
    console.warn('Encryption unavailable — storing credential as base64 (not encrypted)')
    store[connectionId] = Buffer.from(apiKey, 'utf-8').toString('base64')
  }
  await writeStore(store)
}

export async function deleteCredential(connectionId: string): Promise<void> {
  const store = await readStore()
  delete store[connectionId]
  await writeStore(store)
}
