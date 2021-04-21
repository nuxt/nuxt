import consola from 'consola'

export function autoMock () {
  return {
    name: 'auto-mock',
    resolveId (src: string) {
      if (src && !src.startsWith('.') && !src.includes('?') && !src.includes('.js')) {
        consola.warn('Auto mock external ', src)
        return {
          id: require.resolve('unenv/runtime/mock/proxy')
        }
      }
      return null
    }
  }
}
