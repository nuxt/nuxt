export type IdentifierMap = Record<string, string>
export type Identifiers = [string, string][]

export interface AutoImportsOptions {
  identifiers?: IdentifierMap
  disabled?: string[]
}
