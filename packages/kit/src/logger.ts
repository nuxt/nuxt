import { consola } from 'consola'

export const logger = consola

/**
 * Returns a logger instance. It uses {@link https://github.com/unjs/consola consola} under the hood.
 * @param tag - A tag to prefix all log messages with.
 * @returns Consola instance
 * @see {@link https://nuxt.com/docs/api/kit/logging#uselogger documentation}
 */
export function useLogger (tag?: string) {
  return tag ? logger.withTag(tag) : logger
}
