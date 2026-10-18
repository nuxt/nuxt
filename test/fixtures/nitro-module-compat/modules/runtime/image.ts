// @ts-expect-error `#imports` is typed for the Nuxt app, not the server build
import { useRuntimeConfig } from '#imports'

// registered through `addServerImports`, never as a handler
export function useModuleImage () {
  return {
    flavour: useRuntimeConfig().public.flavour,
    // nitro v2 rewrote `import.meta` to this global
    assetURL: new URL('assets/logo.png', (globalThis as { _importMeta_?: { url: string } })._importMeta_!.url).pathname.split('/').pop(),
    hasEnv: !!(globalThis as { _importMeta_?: { env: Record<string, string> } })._importMeta_!.env,
  }
}
