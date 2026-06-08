import { defineTool } from './tool.js'

export default defineTool({
  name: 'diff_stats',
  description:
    'Compute line-level stats for a unified diff hunk or full file patch: additions, deletions, and hunk count.',
  inputSchema: {
    type: 'object',
    properties: {
      diff: { type: 'string', description: 'Unified diff text for one file.' },
    },
    required: ['diff'],
    additionalProperties: false,
  },
  async invoke(input) {
    const diff = (input as { diff?: string }).diff ?? ''
    let additions = 0
    let deletions = 0
    let hunkCount = 0
    for (const line of diff.split('\n')) {
      if (line.startsWith('@@')) hunkCount++
      else if (line.startsWith('+') && !line.startsWith('+++')) additions++
      else if (line.startsWith('-') && !line.startsWith('---')) deletions++
    }
    return {
      content: JSON.stringify(
        { additions, deletions, changedLines: additions + deletions, hunkCount },
        null,
        2,
      ),
    }
  },
})
