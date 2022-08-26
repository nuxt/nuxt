import { importModule } from './cjs'

export const loadKit = async (rootDir: string): Promise<typeof import('@nuxt/kit')> => {
  try {
    return await importModule('@nuxt/kit', rootDir) as typeof import('@nuxt/kit')
  } catch (e: any) {
    if (e.toString().includes("Cannot find module '@nuxt/kit'")) {
      throw new Error('nuxi requires `@nuxt/kit` to be installed in your project. Try installing `nuxt3` or `@nuxt/bridge` first.')
    }
    throw e
  }
}
