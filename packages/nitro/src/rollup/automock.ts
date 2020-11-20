import consola from 'consola'

export function autoMock () {
  return {
    name: 'auto-mock',
    resolveId (src: string) {
      if (src && !src.startsWith('.') && !src.includes('?') && !src.includes('.js')) {
        consola.info('Automatically mocking', src)
        return {
          id: require.resolve('@nuxt/un/runtime/mock/proxy')
        }
      }
      return null
    }
  }
}
