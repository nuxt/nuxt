import type { InlineConfig, SSROptions } from 'vite'
import type { VueViteOptions } from 'vite-plugin-vue2'

export interface Nuxt {
  options: any;
  resolver: any;
  hook: Function;
  callHook: Function;
}

export interface ViteOptions extends Omit<InlineConfig, 'build'> {
  /**
   * Options for vite-plugin-vue2
   *
   * @see https://github.com/underfin/vite-plugin-vue2
   */
  vue?: VueViteOptions

  ssr?: boolean | SSROptions

  build?: boolean | InlineConfig['build']

  experimentWarning?: boolean
}

export interface ViteBuildContext {
  nuxt: Nuxt;
  builder: {
    plugins: { name: string; mode?: 'client' | 'server'; src: string; }[];
  };
  config: ViteOptions;
}
