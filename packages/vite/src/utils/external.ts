import type { ExternalsOptions } from 'externality'
import { ExternalsDefaults, isExternal } from 'externality'
import type { ViteDevServer } from 'vite'

export function createIsExternal (viteServer: ViteDevServer, rootDir: string) {
  const externalOpts: ExternalsOptions = {
    inline: [
      /virtual:/,
      /\.ts$/,
      ...ExternalsDefaults.inline || [],
      ...viteServer.config.ssr.noExternal as string[]
    ],
    external: [
      ...viteServer.config.ssr.external || [],
      /node_modules/
    ],
    resolve: {
      type: 'module',
      extensions: ['.ts', '.js', '.json', '.vue', '.mjs', '.jsx', '.tsx', '.wasm']
    }
  }

  return (id: string) => isExternal(id, rootDir, externalOpts)
}
