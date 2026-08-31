import { join, resolve } from 'pathe'
import type { Nuxt, NuxtOptions } from '@nuxt/schema'
import type { NuxtServerBuild } from '@nuxt/schema/internal'

import { useNuxt } from '../context.ts'

// The shape is experimental: it exists to get a second server builder working without
// every consumer reaching for a nitro instance, and both it and these helpers will change
// without a major release until that has settled.
// TODO: settle the shape, then decide whether it graduates to `@nuxt/kit`

type PartialServerBuild = Partial<Omit<NuxtServerBuild, 'output' | 'capabilities'>> & {
  output?: Partial<NuxtServerBuild['output']>
  capabilities?: Partial<NuxtServerBuild['capabilities']>
}

/**
 * Describe the build the configured server builder produces. See {@link NuxtServerBuild}.
 *
 * Called by server builders, once they know their own output paths and target; anything
 * else should read the description with {@link useServerBuild}.
 *
 * @internal
 */
export function setServerBuild (build: PartialServerBuild, nuxt: Nuxt = useNuxt()): void {
  const { output, capabilities, ...rest } = build
  Object.assign(nuxt.serverBuild, rest)
  Object.assign(nuxt.serverBuild.output, output)
  Object.assign(nuxt.serverBuild.capabilities, capabilities)
}

/**
 * A description of the build the configured server builder produces.
 *
 * Paths and the deploy target are resolved on access, so call them from a hook that runs
 * after the server builder has initialised.
 *
 * @internal
 */
export function useServerBuild (nuxt: Nuxt = useNuxt()): NuxtServerBuild {
  return (nuxt.serverBuild ??= createServerBuild(nuxt.options))
}

/**
 * The description a Nitro-backed build has before any builder registers its own, and the
 * fallback for a partially constructed `Nuxt` (a test fixture, say). Every path is
 * resolved on access, so constructing this never touches the filesystem or requires a
 * fully resolved configuration.
 *
 * @internal
 */
export function createServerBuild (options: NuxtOptions): NuxtServerBuild {
  const outputDir = () => options.nitro?.output?.dir || '.output'
  return {
    name: typeof options.server?.builder === 'string' ? options.server.builder : 'custom',
    buildsSeparately: !options.experimental?.nitroViteEnvironment,
    output: {
      root: () => options.rootDir,
      dir: () => resolve(options.rootDir, outputDir()),
      publicDir: () => resolve(options.rootDir, options.nitro?.output?.publicDir || join(outputDir(), 'public')),
    },
    capabilities: { server: true, dev: true },
    runtime: { fetch: 'nitro', runtimeConfig: 'nitro/runtime-config' },
  }
}
