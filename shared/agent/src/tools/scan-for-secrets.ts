import { defineTool } from './tool.js'

const PATTERNS = [
  { name: 'aws_access_key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'github_token', re: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g },
  { name: 'private_key', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  {
    name: 'generic_secret',
    re: /\b(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
  },
] as const

export default defineTool({
  name: 'scan_for_secrets',
  description:
    'Scan a text snippet for common secret/credential patterns (API keys, tokens, private keys). Pass suspicious lines from the diff.',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to scan (e.g. a line or hunk from the patch).' },
    },
    required: ['text'],
    additionalProperties: false,
  },
  async invoke(input) {
    const text = (input as { text?: string }).text ?? ''
    const findings = PATTERNS.flatMap(({ name, re }) => {
      const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`
      const regex = new RegExp(re.source, flags)
      return [...text.matchAll(regex)].map((m) => ({
        pattern: name,
        match: m[0],
        index: m.index ?? 0,
      }))
    })
    return {
      content: JSON.stringify({ scannedLength: text.length, findings }, null, 2),
    }
  },
})
