import type { NuxtConfig, NuxtOptions } from '@nuxt/schema'

import { withDefaults } from '../validate.ts'
import type { RawConfig } from '../validate.ts'
import { resolveApp } from './app.ts'
import { resolveBuilders } from './builders.ts'
import { resolveCore } from './core.ts'
import { resolveEnv } from './env.ts'
import { resolveExperimental } from './experimental.ts'
import { resolveNitro } from './nitro.ts'
import { resolveLayerDirs, resolvePaths } from './paths.ts'
import type { LayerDirOptions } from './paths.ts'

type InternalKeys =
  | '_majorVersion' | '_nitroMajor' | '_prepare' | '_requiredModules' | '_nuxtConfigFiles' | 'appDir'
  | '_installedModules' | '_modules' | '_noScriptsPageSources' | '_spaOnlyPageSources'

/** Options that keep the value they were configured with. */
type UnresolvedKeys = 'extends' | 'theme' | 'telemetry' | 'pages' | 'compatibilityDate' | 'hooks' | 'ignoreOptions' | 'compiler'

/** Options set by `loadNuxtConfig` or by the internal modules. */
type LaterKeys = '$schema' | '_loadOptions' | '_nuxtConfigFile' | '_layers' | '_runtimeConfigSchemas'

function resolveInternal (input: RawConfig): RawConfig & Pick<NuxtOptions, InternalKeys> {
  return withDefaults('', input, {
    _majorVersion: 4,
    _nitroMajor: 3,
    _prepare: false,
    _requiredModules: {},
    _nuxtConfigFiles: [],
    appDir: '',
    _installedModules: [],
    _modules: [],
    _noScriptsPageSources: [],
    _spaOnlyPageSources: [],
  }) as RawConfig & Pick<NuxtOptions, InternalKeys>
}

/**
 * Resolve a merged `nuxt.config` into `nuxt.options`. The config is not modified, and keys that
 * Nuxt does not define are copied as they are.
 * @internal
 */
export function resolveNuxtOptions (config: NuxtConfig): NuxtOptions {
  const input = config as RawConfig
  const paths = resolvePaths(input)
  const env = resolveEnv(input)
  const core = resolveCore(input, { ...paths, ...env })
  const experimental = resolveExperimental(input, { ...env, ...core })
  const app = resolveApp(input, { ...paths, ...env })
  const nitro = resolveNitro(input, app)
  const builders = resolveBuilders(input, { ...paths, ...env, ...core, ...experimental, ...app })

  const options: Omit<NuxtOptions, UnresolvedKeys | LaterKeys> = {
    ...resolveInternal(input),
    ...paths,
    ...env,
    ...core,
    ...experimental,
    ...app,
    ...nitro,
    ...builders,
  }
  return options as NuxtOptions
}

/**
 * Resolve the directories of a layer's config, leaving its other keys as they are.
 * @internal
 */
export function resolveLayerOptions<T extends NuxtConfig> (config: T): T & LayerDirOptions {
  return { ...config, ...resolveLayerDirs(config as RawConfig) }
}
