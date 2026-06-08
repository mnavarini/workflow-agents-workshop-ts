import { defineTool } from './tool.js'

export default defineTool({
  name: 'current_time',
  description: 'Get the current time as an ISO 8601 UTC string.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  async invoke() {
    return { content: new Date().toISOString() }
  },
})
