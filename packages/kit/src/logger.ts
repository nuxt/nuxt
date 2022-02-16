import consola from 'consola'

export const logger = consola

export function useLogger (scope?: string) {
  return scope ? logger.withScope(scope) : logger
}
