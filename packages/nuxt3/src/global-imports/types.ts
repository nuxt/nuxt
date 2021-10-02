export type IdentifierMap = Record<string, string>
export type Identifiers = [string, string][]

export interface GlobalImportsOptions {
  identifiers?: IdentifierMap
  disabled?: string[]
}
