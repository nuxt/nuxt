export type JSONSchema = Record<string, unknown>

/** Hints for the browser and agent. Only hints set to `true` are declared. */
export interface AgentToolAnnotations {
  /** The tool only reads, so an agent can call it freely. */
  readOnlyHint?: boolean
  /** The tool has effects that are hard to undo, so the browser or agent may ask the user first. */
  consequentialHint?: boolean
  /** The result contains content from users or third parties. */
  untrustedContentHint?: boolean
}

export interface AgentToolSummary {
  name: string
  description: string
  inputSchema: JSONSchema
  annotations: AgentToolAnnotations
}
