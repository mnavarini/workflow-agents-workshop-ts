import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getToolRegistry, resolveTools, loadTools } from '@workshop/agent'
import type { ToolContext } from '@workshop/agent'
import contrastRatio from '../../shared/agent/src/tools/contrast-ratio.js'
import diffStats from '../../shared/agent/src/tools/diff-stats.js'
import scanForSecrets from '../../shared/agent/src/tools/scan-for-secrets.js'

const toolsDir = new URL('../../shared/agent/src/tools', import.meta.url).pathname

const ctx: ToolContext = {
  env: () => undefined,
  signal: AbortSignal.timeout(5000),
  logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
}

test('loadTools auto-discovers tool files', async () => {
  const tools = await loadTools(toolsDir)
  assert.deepEqual(
    tools.map((t) => ('resolve' in t ? t.id : t.name)).sort(),
    ['contrast_ratio', 'current_time', 'diff_stats', 'scan_for_secrets'],
  )
})

test('getToolRegistry returns the same discovered tools', async () => {
  const registry = await getToolRegistry()
  assert.equal(registry.length, 4)
})

test('resolveTools resolves discovered tools by name', async () => {
  const { tools, close } = await resolveTools(['scan_for_secrets', 'diff_stats'], ctx)
  await close()
  assert.deepEqual(
    tools.map((t) => t.name).sort(),
    ['diff_stats', 'scan_for_secrets'],
  )
})

test('scan_for_secrets detects credential patterns', async () => {
  const result = await scanForSecrets.invoke(
    { text: 'const key = "AKIAIOSFODNN7EXAMPLE"' },
    ctx,
  )
  const parsed = JSON.parse(result.content) as { findings: Array<{ pattern: string }> }
  assert.equal(parsed.findings.some((f) => f.pattern === 'aws_access_key'), true)
})

test('diff_stats counts unified diff lines', async () => {
  const result = await diffStats.invoke(
    { diff: '@@ -1,2 +1,3 @@\n-old\n+new\n context' },
    ctx,
  )
  const parsed = JSON.parse(result.content) as {
    additions: number
    deletions: number
    hunkCount: number
  }
  assert.deepEqual(parsed, { additions: 1, deletions: 1, changedLines: 2, hunkCount: 1 })
})

test('contrast_ratio computes WCAG ratio for black on white', async () => {
  const result = await contrastRatio.invoke({ foreground: '#000', background: '#fff' }, ctx)
  const parsed = JSON.parse(result.content) as { ratio: number; aaNormal: boolean }
  assert.equal(parsed.ratio, 21)
  assert.equal(parsed.aaNormal, true)
})

test('contrast_ratio rejects invalid hex', async () => {
  const result = await contrastRatio.invoke({ foreground: 'red', background: '#fff' }, ctx)
  const parsed = JSON.parse(result.content) as { error: string }
  assert.match(parsed.error, /Invalid hex/)
})
