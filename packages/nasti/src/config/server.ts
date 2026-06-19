import { builtinModules } from 'node:module'
import { defineEnv } from 'unenv'
import type { Nuxt } from '@nuxt/schema'
import type { EnvironmentOptions } from '@nasti-toolchain/nasti'

const nodeBuiltins = [...builtinModules, ...builtinModules.map(m => `node:${m}`)]

/**
 * Build the `ssr` environment options (Nasti Environment API) for Nuxt's server build.
 *
 * Mirrors `@nuxt/vite-builder`'s `shared/server.ts` intent, adapted to Nasti's
 * `EnvironmentOptions`:
 *  - `consumer: 'server'` with an explicit `entry` (Nasti only builds non-client
 *    environments that declare one);
 *  - Node resolution conditions for SSR;
 *  - ESM server output (`output.format: 'es'`);
 *  - Node built-ins kept external (the default Nitro `node-server` target runs on Node, so
 *    they must not be bundled). For non-Node Nitro presets, unenv supplies the polyfill
 *    layer — its `alias` map is applied so `node:*` specifiers resolve to shims when the
 *    real built-in is unavailable, and `env.external` refines what stays external.
 */
export function ssrEnvironment (nuxt: Nuxt, serverEntry: string): EnvironmentOptions {
  const { env } = defineEnv({ nodeCompat: true, resolve: true })

  return {
    consumer: 'server',
    entry: serverEntry,
    resolve: {
      conditions: ['node', 'import', 'module', 'default'],
      // unenv Node built-in polyfills (used when the resolved built-in is absent, e.g.
      // edge/workerd Nitro presets). On the default Node target the externals below win.
      alias: { ...env.alias },
    },
    build: {
      rolldownOptions: {
        external: [...new Set([...nodeBuiltins, ...env.external])],
        output: {
          format: 'es',
        },
      },
      // SSR output is consumed by Nitro; never minify or empty the shared outDir here.
      minify: false,
      sourcemap: nuxt.options.sourcemap?.server,
    },
  }
}
