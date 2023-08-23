import { consola } from 'consola'

export const logger = consola

export function useLogger (tag?: string) {
  return tag ? logger.withTag(tag) : logger
}
