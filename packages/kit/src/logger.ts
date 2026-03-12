import { consola } from 'consola'
import type { ConsolaInstance, ConsolaOptions } from 'consola'

export const logger: ConsolaInstance = consola

export function useLogger (tag?: string, options: Partial<ConsolaOptions> = {}): ConsolaInstance {
  return tag ? logger.create(options).withTag(tag) : logger
}
