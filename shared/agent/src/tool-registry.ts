/**
 * Tool registry — auto-discovered from `tools/` on first use.
 *
 * Entries are either local tools (`defineTool`) or sources with a lifecycle
 * (`defineMcpSource`). Agents reference entries by id in their `tools` array;
 * `resolveTools()` (called inside `agent.run()`) connects any sources, flattens
 * everything into the tool list the loop consumes, and returns a `close()` that
 * tears connections down.
 *
 * To add a tool: drop a new `.ts` file in `tools/` with a default export.
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadTools } from './tools/loader.js'
import type { RegistryEntry, Tool, ToolContext } from './types.js'

const TOOLS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'tools')

const extraTools: RegistryEntry[] = []
let registryPromise: Promise<RegistryEntry[]> | undefined

async function ensureRegistry(): Promise<RegistryEntry[]> {
  if (!registryPromise) {
    registryPromise = loadTools(TOOLS_DIR).then((discovered) => [...discovered, ...extraTools])
  }
  return registryPromise
}

/** All registered tools and MCP sources (loads from disk on first call). */
export async function getToolRegistry(): Promise<readonly RegistryEntry[]> {
  return ensureRegistry()
}

/** Register an extra tool at runtime (merged after auto-discovered tools). */
export function registerTool(entry: RegistryEntry): void {
  extraTools.push(entry)
  registryPromise = undefined
}

function entryId(entry: RegistryEntry): string {
  return 'resolve' in entry ? entry.id : entry.name
}

function isSource(entry: RegistryEntry): entry is Extract<RegistryEntry, { resolve: unknown }> {
  return 'resolve' in entry
}

export interface ResolvedTools {
  tools: Tool[]
  close(): Promise<void>
}

/** Resolve declared tool/source ids into a flat tool list + a combined close(). */
export async function resolveTools(ids: readonly string[], ctx: ToolContext): Promise<ResolvedTools> {
  const registry = new Map((await ensureRegistry()).map((e) => [entryId(e), e]))
  const tools: Tool[] = []
  const closers: Array<() => Promise<void>> = []

  for (const id of ids) {
    const entry = registry.get(id)
    if (!entry) {
      throw new Error(`unknown tool "${id}". Registered: ${[...registry.keys()].join(', ')}`)
    }
    if (isSource(entry)) {
      const resolved = await entry.resolve(ctx)
      tools.push(...resolved.tools)
      closers.push(() => resolved.close())
    } else {
      tools.push(entry)
    }
  }

  return {
    tools,
    async close() {
      for (const close of closers) {
        await close().catch(() => {})
      }
    },
  }
}
