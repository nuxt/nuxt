import { importModule, tryResolveModule } from './esm'

export const loadKit = async (rootDir: string): Promise<typeof import('@nuxt/kit')> => {
  try {
    // Without PNP (or if users have a local install of kit, we bypass resolving from nuxt)
    const localKit = await tryResolveModule('@nuxt/kit', rootDir)
    // Otherwise, we resolve Nuxt _first_ as it is Nuxt's kit dependency that will be used
    const rootURL = localKit ? rootDir : await tryResolveNuxt() || rootDir
    return await importModule('@nuxt/kit', rootURL) as typeof import('@nuxt/kit')
  } catch (e: any) {
    if (e.toString().includes("Cannot find module '@nuxt/kit'")) {
      throw new Error('nuxi requires `@nuxt/kit` to be installed in your project. Try installing `nuxt` v3 or `@nuxt/bridge` first.')
    }
    throw e
  }
}

async function tryResolveNuxt () {
  for (const pkg of ['nuxt3', 'nuxt', 'nuxt-edge']) {
    const path = await tryResolveModule(pkg)
    if (path) { return path }
  }
  return null
}
