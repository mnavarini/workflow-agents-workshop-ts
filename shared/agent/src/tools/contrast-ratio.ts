import { defineTool } from './tool.js'

function parseHex(hex: string): [number, number, number] | null {
  const h = hex.replace(/^#/, '')
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(h)) return null
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * rs! + 0.7152 * gs! + 0.0722 * bs!
}

function computeContrastRatio(foreground: string, background: string) {
  const fg = parseHex(foreground)
  const bg = parseHex(background)
  if (!fg || !bg) return { error: 'Invalid hex color; use #RGB or #RRGGBB.' }
  const l1 = relativeLuminance(fg)
  const l2 = relativeLuminance(bg)
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  return {
    ratio: Math.round(ratio * 100) / 100,
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
  }
}

export default defineTool({
  name: 'contrast_ratio',
  description:
    'Compute WCAG contrast ratio between two hex colors. Use when reviewing CSS/Tailwind color changes.',
  inputSchema: {
    type: 'object',
    properties: {
      foreground: { type: 'string', description: 'Foreground hex color, e.g. "#333".' },
      background: { type: 'string', description: 'Background hex color, e.g. "#fff".' },
    },
    required: ['foreground', 'background'],
    additionalProperties: false,
  },
  async invoke(input) {
    const { foreground, background } = input as {
      foreground: string
      background: string
    }
    return { content: JSON.stringify(computeContrastRatio(foreground, background), null, 2) }
  },
})
