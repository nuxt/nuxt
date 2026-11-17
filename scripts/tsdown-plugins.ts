export function failOnInvalidAnnotation () {
  return {
    name: 'nuxt:fail-on-invalid-annotation',
    onLog (this: { error: (error: string) => never }, _level: string, log: { code?: string, message: string }) {
      if (log.code === 'INVALID_ANNOTATION') {
        this.error(log.message)
      }
    },
  }
}
