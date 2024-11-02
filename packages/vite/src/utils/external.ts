import type { ExternalsOptions } from 'externality'
import { ExternalsDefaults, isExternal } from 'externality'
import type { ViteDevServer } from 'vite'
import escapeStringRegexp from 'escape-string-regexp'
import { withTrailingSlash } from 'ufo'
import type { Nuxt } from 'nuxt/schema'
import { resolve } from 'pathe'
import { toArray } from '.'

export function createIsExternal (viteServer: ViteDevServer, nuxt: Nuxt) {
  const externalOpts: ExternalsOptions = {
    inline: [
      /virtual:/,
      /\.ts$/,
      ...ExternalsDefaults.inline || [],
      ...(
        viteServer.config.ssr.noExternal && viteServer.config.ssr.noExternal !== true
          ? toArray(viteServer.config.ssr.noExternal)
          : []
      ),
    ],
    external: [
      '#shared',
      new RegExp('^' + escapeStringRegexp(withTrailingSlash(resolve(nuxt.options.rootDir, nuxt.options.dir.shared)))),
      ...(viteServer.config.ssr.external as string[]) || [],
      /node_modules/,
    ],
    resolve: {
      modules: nuxt.options.modulesDir,
      type: 'module',
      extensions: ['.ts', '.js', '.json', '.vue', '.mjs', '.jsx', '.tsx', '.wasm'],
    },
  }

  return (id: string) => isExternal(id, nuxt.options.rootDir, externalOpts)
}
