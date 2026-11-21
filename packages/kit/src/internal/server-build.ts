import { join, relative, resolve } from 'pathe'
import type { Nuxt, NuxtOptions } from '@nuxt/schema'
import type { NuxtServerBuild } from '@nuxt/schema/internal'

import { useNuxt } from '../context.ts'

// The shape is experimental: it exists to get a second server builder working without
// every consumer reaching for a nitro instance, and both it and these helpers will change
// without a major release until that has settled.
// TODO: settle the shape, then decide whether it graduates to `@nuxt/kit`

type PartialServerBuild = Partial<Omit<NuxtServerBuild, 'input' | 'output' | 'capabilities'>> & {
  input?: Partial<NuxtServerBuild['input']>
  output?: Partial<NuxtServerBuild['output']>
  capabilities?: Partial<NuxtServerBuild['capabilities']>
}

/**
 * Describe the build the configured server builder produces. See {@link NuxtServerBuild}.
 *
 * Called by server builders, once they know their own output paths and target, and by app
 * builders for the `input` paths they emit; anything else should read the description with
 * {@link useServerBuild}.
 *
 * @internal
 */
export function setServerBuild (build: PartialServerBuild, nuxt: Nuxt = useNuxt()): void {
  const { input, output, capabilities, ...rest } = build
  Object.assign(nuxt.serverBuild, rest)
  Object.assign(nuxt.serverBuild.input, input)
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
  const serverDir = () => join(options.buildDir, 'dist/server')
  const clientDir = () => join(options.buildDir, 'dist/client')
  return {
    name: typeof options.server?.builder === 'string' ? options.server.builder : 'custom',
    buildsSeparately: !options.experimental?.nitroViteEnvironment,
    input: {
      serverEntry: () => join(serverDir(), 'server.mjs'),
      serverDir,
      clientDir,
      clientManifest: () => join(clientDir(), '.vite/manifest.json'),
    },
    output: {
      root: () => options.rootDir,
      dir: () => resolve(options.rootDir, outputDir()),
      publicDir: () => resolve(options.rootDir, options.nitro?.output?.publicDir || join(outputDir(), 'public')),
    },
    capabilities: { server: true, dev: true },
    runtime: options._nitroMajor === 3
      ? { fetch: 'nitro', runtimeConfig: 'nitro/runtime-config' }
      : { runtimeConfig: 'nitropack/runtime' },
  }
}

const OUTPUT_RELATIVE_PATH_RE = /(^|[\s:])\.\/(\S*)/g
const TEMPLATE_PARAM_RE = /\{\{ ?([\w.]+) ?\}\}/g
const WHITESPACE_RE = /\s/
const DOUBLE_QUOTED_ESCAPE_RE = /["\\]/g

/**
 * Resolve a Nitro (2 or 3) preset's deploy command into one to run from `rootDir`: paths
 * starting with `./` are relative to the output directory, and `{{ path.to.option }}`
 * placeholders name an option holding a path. Paths containing whitespace are quoted.
 *
 * @internal
 */
export function resolveNitroDeployCommand (command: unknown, options: Record<string, any> & { rootDir: string, output: { dir: string } }): string | undefined {
  if (typeof command !== 'string' || !command) {
    return
  }
  const outputDir = relative(options.rootDir, options.output.dir) || '.'
  return command
    .replace(OUTPUT_RELATIVE_PATH_RE, (_, prefix: string, path: string) => prefix + quoteShellPath(`${outputDir}/${path}`))
    .replace(TEMPLATE_PARAM_RE, (match, key: string) => {
      const value = key.split('.').reduce<any>((object, segment) => object?.[segment], options)
      return typeof value === 'string' && value ? quoteShellPath(relative(options.rootDir, value) || '.') : match
    })
}

function quoteShellPath (path: string): string {
  return WHITESPACE_RE.test(path) ? `"${path.replace(DOUBLE_QUOTED_ESCAPE_RE, '\\$&')}"` : path
}
