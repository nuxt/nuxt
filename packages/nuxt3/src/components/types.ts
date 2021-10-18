export interface Component {
  pascalName: string
  kebabName: string
  export: string
  filePath: string
  shortPath: string
  chunkName: string
  level: number
  prefetch: boolean
  preload: boolean

  /** @deprecated */
  import?: string
  /** @deprecated */
  asyncImport?: string
  /** @deprecated */
  global?: boolean
  /** @deprecated */
  async?: boolean
}

export interface ScanDir {
  path: string
  pattern?: string | string[]
  ignore?: string[]
  prefix?: string
  pathPrefix?: boolean
  level?: number
  prefetch?: boolean
  preload?: boolean
  extendComponent?: (component: Component) => Promise<Component | void> | (Component | void)
  /** @deprecated */
  global?: boolean | 'dev'
}

export interface ComponentsDir extends ScanDir {
  watch?: boolean
  extensions?: string[]
  transpile?: 'auto' | boolean
}

type componentsDirHook = (dirs: ComponentsDir[]) => void | Promise<void>
type componentsExtendHook = (components: (ComponentsDir | ScanDir)[]) => void | Promise<void>

export interface Options {
  dirs: (string | ComponentsDir)[]
  loader: Boolean
}

declare module '@nuxt/kit' {
  interface NuxtOptions {
    components: boolean | Options | Options['dirs']
  }
  interface NuxtHooks {
    'components:dirs'?: componentsDirHook
    'components:extend'?: componentsExtendHook
    components?: {
      dirs?: componentsDirHook
      extend?: componentsExtendHook
    }
  }
}
