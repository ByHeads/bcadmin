import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { SavedConnection } from '@shared/types'
import { deleteCredential } from './keychain'

const CONNECTIONS_FILE = join(app.getPath('userData'), 'connections.json')

export async function getConnections(): Promise<SavedConnection[]> {
  if (!existsSync(CONNECTIONS_FILE)) return []
  try {
    const data = JSON.parse(await readFile(CONNECTIONS_FILE, 'utf-8'))
    if (!Array.isArray(data)) {
      console.error('Corrupted connections file — expected array, resetting')
      return []
    }
    return data
  } catch (e) {
    console.error('Failed to read connections file:', e)
    return []
  }
}

async function writeConnections(connections: SavedConnection[]): Promise<void> {
  await writeFile(CONNECTIONS_FILE, JSON.stringify(connections, null, 2), { encoding: 'utf-8', mode: 0o600 })
}

export async function saveConnection(connection: SavedConnection): Promise<void> {
  const connections = await getConnections()
  const index = connections.findIndex((c) => c.id === connection.id)
  if (index >= 0) {
    connections[index] = connection
  } else {
    connections.push(connection)
  }
  await writeConnections(connections)
}

export async function reorderConnections(ids: string[]): Promise<void> {
  const connections = await getConnections()
  const byId = new Map(connections.map((c) => [c.id, c]))
  const reordered = ids.map((id) => byId.get(id)).filter(Boolean) as SavedConnection[]
  // Append any connections not in the ids list (safety net)
  for (const c of connections) {
    if (!ids.includes(c.id)) reordered.push(c)
  }
  await writeConnections(reordered)
}

export async function deleteConnection(connectionId: string): Promise<void> {
  const connections = (await getConnections()).filter((c) => c.id !== connectionId)
  await writeConnections(connections)
  // Clean up orphaned credential
  try {
    await deleteCredential(connectionId)
  } catch {
    // Credential may already be gone
  }
}
