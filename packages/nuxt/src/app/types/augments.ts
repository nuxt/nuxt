import type { UseHeadInput } from '@unhead/vue/types'
import type { NuxtApp, useNuxtApp } from '../nuxt'

declare module 'nitropack' {
  interface NitroRuntimeConfigApp {
    buildAssetsDir: string
    cdnURL: string
  }
  interface NitroRouteRules {
    ssr?: boolean
    noScripts?: boolean
    /** @deprecated Use `noScripts` instead */
    experimentalNoScripts?: boolean
    appMiddleware?: Record<string, boolean>
  }
}
declare module 'nitropack/types' {
  interface NitroRuntimeConfigApp {
    buildAssetsDir: string
    cdnURL: string
  }
  interface NitroRouteRules {
    ssr?: boolean
    noScripts?: boolean
    /** @deprecated Use `noScripts` instead */
    experimentalNoScripts?: boolean
    appMiddleware?: Record<string, boolean>
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Process {
      /** @deprecated Use `import.meta.browser` instead. This may be removed in Nuxt v5 or a future major version. */
      browser: boolean
      /** @deprecated Use `import.meta.client` instead. This may be removed in Nuxt v5 or a future major version. */
      client: boolean
      /** @deprecated Use `import.meta.dev` instead. This may be removed in Nuxt v5 or a future major version. */
      dev: boolean
      /** @deprecated Use `import.meta.server` instead. This may be removed in Nuxt v5 or a future major version. */
      server: boolean
      /** @deprecated Use `import.meta.test` instead. This may be removed in Nuxt v5 or a future major version. */
      test: boolean
    }
  }

  interface ImportMeta {
    browser: boolean
    client: boolean
    dev: boolean
    server: boolean
    test: boolean
  }

  interface Window {
    __NUXT__?: Record<string, any> | Record<string, Record<string, any>>
    useNuxtApp?: typeof useNuxtApp
  }
}

declare module 'vue' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface App<HostElement> {
    $nuxt: NuxtApp
  }
  interface ComponentCustomProperties {
    $nuxt: NuxtApp
  }
  interface ComponentInternalInstance {
    _nuxtOnBeforeMountCbs: Array<() => void | Promise<void>>
    _nuxtIdIndex?: Record<string, number>
    _nuxtClientOnly?: boolean
  }
  interface ComponentCustomOptions {
    /**
     * Available exclusively for `defineNuxtComponent`.
     * It will not be executed when using `defineComponent`.
     */
    head?(nuxtApp: NuxtApp): UseHeadInput
  }
}
