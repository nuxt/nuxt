import type { ExternalsOptions } from 'externality'
import { ExternalsDefaults, isExternal } from 'externality'
import type { ViteDevServer } from 'vite'
import { toArray } from '.'

export function createIsExternal (viteServer: ViteDevServer, rootDir: string, modulesDirs?: string[]) {
  const externalOpts: ExternalsOptions = {
    inline: [
      /virtual:/,
      /\.ts$/,
      ...ExternalsDefaults.inline || [],
      ...(
        viteServer.config.ssr.noExternal && viteServer.config.ssr.noExternal !== true
          ? toArray(viteServer.config.ssr.noExternal)
          : []
      )
    ],
    external: [
      ...viteServer.config.ssr.external || [],
      /node_modules/
    ],
    resolve: {
      modules: modulesDirs,
      type: 'module',
      extensions: ['.ts', '.js', '.json', '.vue', '.mjs', '.jsx', '.tsx', '.wasm']
    }
  }

  return (id: string) => isExternal(id, rootDir, externalOpts)
}
