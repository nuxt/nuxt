import { resolve } from 'pathe'
import { type JSValue } from 'untyped'
import { applyDefaults } from 'untyped'
import { type LoadConfigOptions } from 'c12'
import { loadConfig } from 'c12'
import { type NuxtConfig, type NuxtOptions } from '@nuxt/schema'
import { NuxtConfigSchema } from '@nuxt/schema'

export interface LoadNuxtConfigOptions extends LoadConfigOptions<NuxtConfig> {}

export async function loadNuxtConfig(
  options: LoadNuxtConfigOptions
): Promise<NuxtOptions> {
  // eslint-disable-next-line style/max-len
  // eslint-disable-next-line ts/no-unsafe-return, ts/no-explicit-any, ts/no-unsafe-member-access
  (globalThis as any).defineNuxtConfig = (config: any) => config

  const result = await loadConfig<NuxtConfig>({
    name: 'nuxt',
    configFile: 'nuxt.config',
    rcFile: '.nuxtrc',
    extend: { extendKey: ['theme', 'extends'] },
    dotenv: true,
    globalRc: true,
    ...options
  })

  // eslint-disable-next-line ts/no-unsafe-member-access, ts/no-explicit-any
  delete (globalThis as any).defineNuxtConfig

  const { configFile, layers = [], cwd, config } = result
  // eslint-disable-next-line ts/no-non-null-assertion
  const nuxtConfig = config!

  // Fill config
  nuxtConfig.rootDir = nuxtConfig.rootDir || cwd

  nuxtConfig._nuxtConfigFile = configFile

  nuxtConfig._nuxtConfigFiles = [configFile]

  // Resolve `rootDir` & `srcDir` of layers
  for (const layer of layers) {
    layer.config = layer.config || {}

    layer.config.rootDir = layer.config.rootDir ?? layer.cwd

    // eslint-disable-next-line ts/no-non-null-assertion
    layer.config.srcDir = resolve(layer.config.rootDir!, layer.config.srcDir!)
  }

  // Filter layers
  const _layers = layers.filter((layer) => layer.configFile && !layer.configFile.endsWith('.nuxtrc'));

  // eslint-disable-next-line ts/no-unsafe-member-access, ts/no-explicit-any
  (nuxtConfig as any)._layers = _layers

  // Ensure at least one layer remains (without nuxt.config)
  if (_layers.length === 0) {
    _layers.push({
      cwd,
      config: {
        rootDir: cwd,
        srcDir: cwd
      }
    })
  }

  // Resolve and apply defaults
  return await applyDefaults(
    NuxtConfigSchema, nuxtConfig as NuxtConfig & Record<string, JSValue>
  ) as unknown as NuxtOptions
}
