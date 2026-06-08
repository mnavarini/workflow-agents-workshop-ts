/**
 * Auto-discover tools from the `tools/` directory.
 *
 * Convention: each `tools/{name}.ts` (except loader.ts) must default-export a
 * `defineTool(...)` result or a `defineMcpSource(...)` ToolSource. The file name
 * is for humans only — the registry id is the tool's `name` (or source `id`).
 */

import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { RegistryEntry } from '../types.js'

const SKIP = new Set(['loader.ts'])

export async function loadTools(dir: string): Promise<RegistryEntry[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const tools: RegistryEntry[] = []

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.ts') || SKIP.has(entry.name)) continue

    const mod = (await import(pathToFileURL(join(dir, entry.name)).href)) as Record<
      string,
      unknown
    >
    const tool = findToolExport(mod)
    if (tool) tools.push(tool)
  }

  tools.sort((a, b) => entryId(a).localeCompare(entryId(b)))

  const seen = new Set<string>()
  for (const entry of tools) {
    const id = entryId(entry)
    if (seen.has(id)) {
      throw new Error(`duplicate tool id "${id}" in ${dir}`)
    }
    seen.add(id)
  }

  return tools
}

function entryId(entry: RegistryEntry): string {
  return 'resolve' in entry ? entry.id : entry.name
}

function findToolExport(mod: Record<string, unknown>): RegistryEntry | undefined {
  if (isRegistryEntry(mod.default)) return mod.default
  if (isRegistryEntry(mod.tool)) return mod.tool
  if (isRegistryEntry(mod.source)) return mod.source
  return undefined
}

function isRegistryEntry(value: unknown): value is RegistryEntry {
  if (typeof value !== 'object' || value === null) return false
  if ('invoke' in value && typeof (value as RegistryEntry & { invoke?: unknown }).invoke === 'function') {
    return true
  }
  return 'resolve' in value && typeof (value as { resolve?: unknown }).resolve === 'function'
}
