import { existsSync, promises as fsp, lstatSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { ModuleMeta, ModuleOptions, Nuxt, NuxtConfig, NuxtModule, NuxtOptions } from '@nuxt/schema'
import { dirname, isAbsolute, join, resolve } from 'pathe'
import { defu } from 'defu'
import { createJiti } from 'jiti'
import { parseNodeModulePath } from 'mlly'
import { resolveModulePath, resolveModuleURL } from 'exsolve'
import { isRelative } from 'ufo'
import { readPackageJSON, resolvePackageJSON } from 'pkg-types'
import { read as readRc, update as updateRc } from 'rc9'
import semver from 'semver'
import { directoryToURL } from '../internal/esm'
import { useNuxt } from '../context'
import { resolveAlias } from '../resolve'
import { logger } from '../logger'

const NODE_MODULES_RE = /[/\\]node_modules[/\\]/

interface ResolvedModule {
  moduleToInstall: string | NuxtModule<ModuleOptions, Partial<ModuleOptions>, false>
  nuxtModule: NuxtModule<ModuleOptions, Partial<ModuleOptions>, false>
  buildTimeModuleMeta: ModuleMeta
  resolvedModulePath: string | undefined
  inlineOptions: Record<string, any>
}

/**
 * Installs a set of modules on a Nuxt instance.
 * @internal
 */
export async function installModules (modulesToInstall: Map<string | NuxtModule<ModuleOptions, Partial<ModuleOptions>, false>, Record<string, any>>, resolvedModulePaths: Set<string>, nuxt: Nuxt = useNuxt()) {
  const localLayerModuleDirs: string[] = []
  for (const l of nuxt.options._layers) {
    const srcDir = l.config.srcDir || l.cwd
    if (!NODE_MODULES_RE.test(srcDir)) {
      localLayerModuleDirs.push(resolve(srcDir, l.config?.dir?.modules || 'modules').replace(/\/?$/, '/'))
    }
  }

  const optionsFunctions = new Map<string | NuxtModule<ModuleOptions, Partial<ModuleOptions>, false>, Array<() => { defaults?: Record<string, unknown>, overrides?: Record<string, unknown> }>>()
  const resolvedModules: Array<ResolvedModule> = []
  for (const [moduleToInstall, inlineOptions] of modulesToInstall) {
    const res = await loadNuxtModuleInstance(moduleToInstall, nuxt)

    const dependencyMeta = res.nuxtModule.getDependencyMeta?.() || {}
    for (const [name, value] of Object.entries(dependencyMeta)) {
      if (!value.overrides && !value.defaults && !value.version && value.optional) {
        continue
      }

      const resolvedModule = resolveModuleWithOptions(name, nuxt)
      const moduleToAttribute = typeof moduleToInstall === 'string' ? `\`${moduleToInstall}\`` : 'a module in `nuxt.options`'

      if (!resolvedModule) {
        logger.warn(`Could not resolves \`${name}\` (specified as a dependency of ${moduleToAttribute}).`)
        continue
      }

      if (value.version) {
        const pkg = await readPackageJSON(name, { from: [res.resolvedModulePath!, ...nuxt.options.modulesDir] }).catch(() => null)
        if (pkg?.version && !semver.satisfies(pkg.version, value.version)) {
          logger.warn(`Module \`${name}\` version (\`${pkg.version}\`) does not satisfy \`${value.version}\` (requested by ${moduleToAttribute}).`)
        }
      }

      if (value.overrides || value.defaults) {
        const currentFns = optionsFunctions.get(resolvedModule.module) || []
        optionsFunctions.set(resolvedModule.module, [
          ...currentFns,
          () => ({ defaults: value.defaults, overrides: value.overrides }),
        ])
      }

      if (value.optional === false) {
        continue
      }

      if (resolvedModule && !modulesToInstall.has(resolvedModule.module) && (!resolvedModule.resolvedPath || !resolvedModulePaths.has(resolvedModule.resolvedPath))) {
        // check for config key already registered
        if (typeof resolvedModule.module === 'string') {
          const configKeys = new Set(await Promise.all([...modulesToInstall].map(([mod]) => typeof mod !== 'string' && mod.getMeta?.()?.then(r => r.configKey))))
          if (configKeys.has(resolvedModule.module)) {
            continue
          }
        }
        modulesToInstall.set(resolvedModule.module, resolvedModule.options)
        const path = resolvedModule.resolvedPath || typeof resolvedModule.module
        if (typeof path === 'string') {
          resolvedModulePaths.add(path)
        }
      }
    }

    resolvedModules.push({
      moduleToInstall,
      nuxtModule: res.nuxtModule,
      buildTimeModuleMeta: res.buildTimeModuleMeta,
      resolvedModulePath: res.resolvedModulePath,
      inlineOptions,
    })
  }

  for (const { nuxtModule, moduleToInstall, buildTimeModuleMeta, resolvedModulePath, inlineOptions } of resolvedModules) {
    // module lifecycle hooks
    if (nuxtModule.getMeta && (nuxtModule.onInstall || nuxtModule.onUpgrade)) {
      const meta = await nuxtModule.getMeta?.()

      if (meta && meta.name && meta.version) {
        const rc = readRc({ dir: nuxt.options.rootDir, name: '.nuxtrc' })
        const previousVersion = rc?.setups?.[meta.name]

        try {
          if (!previousVersion) {
            await nuxtModule.onInstall?.(nuxt)
          } else if (semver.gt(meta.version, previousVersion)) {
            await nuxtModule.onUpgrade?.(inlineOptions, nuxt, previousVersion)
          }
          if (previousVersion !== meta.version) {
            updateRc(
              { setups: { [meta.name]: meta?.version } },
              { dir: nuxt.options.rootDir, name: '.nuxtrc' },
            )
          }
        } catch (e) {
          logger.error(
            `Error while executing ${!previousVersion ? 'install' : 'upgrade'} hook for module \`${meta.name}\`: ${e}`,
          )
        }
      }
    }

    const configKey = await nuxtModule.getMeta?.().then(m => m?.configKey) as keyof NuxtOptions | undefined
    const optionsFns = [
      ...optionsFunctions.get(moduleToInstall) || [],
      ...(configKey && optionsFunctions.get(configKey)) || [],
    ]
    if (optionsFns.length > 0) {
      if (configKey) {
        const overrides = [] as unknown as [Record<string, unknown> | undefined, ...Array<Record<string, unknown> | undefined>]
        const defaults: Array<Record<string, unknown> | undefined> = []
        for (const fn of optionsFns) {
          const options = fn()
          overrides.push(options.overrides)
          defaults.push(options.defaults)
        }
        ;(nuxt.options[configKey] as any) = defu(...overrides, nuxt.options[configKey], ...defaults)
      }
    }

    // Call module
    const res = nuxt.options.experimental?.debugModuleMutation && nuxt._asyncLocalStorageModule
      ? await nuxt._asyncLocalStorageModule.run(nuxtModule, () => nuxtModule(inlineOptions || {}, nuxt)) ?? {}
      : await nuxtModule(inlineOptions || {}, nuxt) ?? {}
    if (res === false /* setup aborted */) {
      return
    }

    const modulePath = resolvedModulePath || moduleToInstall
    if (typeof modulePath === 'string') {
      const parsed = parseNodeModulePath(modulePath)
      const moduleRoot = parsed.dir
        ? parsed.dir + parsed.name
        : await resolvePackageJSON(modulePath, { try: true }).then(r => r ? dirname(r) : modulePath)
      nuxt.options.build.transpile.push(normalizeModuleTranspilePath(moduleRoot))
      const directory = moduleRoot.replace(/\/?$/, '/')
      if (moduleRoot !== moduleToInstall && !localLayerModuleDirs.some(dir => directory.startsWith(dir))) {
        nuxt.options.modulesDir.push(join(moduleRoot, 'node_modules'))
      }
    }

    nuxt.options._installedModules ||= []
    const entryPath = typeof moduleToInstall === 'string' ? resolveAlias(moduleToInstall, nuxt.options.alias) : undefined

    if (typeof moduleToInstall === 'string' && entryPath !== moduleToInstall) {
      buildTimeModuleMeta.rawPath = moduleToInstall
    }

    nuxt.options._installedModules.push({
      meta: defu(await nuxtModule.getMeta?.(), buildTimeModuleMeta),
      module: nuxtModule,
      timings: res.timings,
      entryPath,
    })
  }
}

/**
 * Installs a module on a Nuxt instance.
 * @deprecated Use module dependencies.
 */
export async function installModule<
  T extends string | NuxtModule,
  Config extends Extract<NonNullable<NuxtConfig['modules']>[number], [T, any]>,
> (moduleToInstall: T, inlineOptions?: [Config] extends [never] ? any : Config[1], nuxt: Nuxt = useNuxt()) {
  const { nuxtModule, buildTimeModuleMeta, resolvedModulePath } = await loadNuxtModuleInstance(moduleToInstall, nuxt)

  const localLayerModuleDirs: string[] = []
  for (const l of nuxt.options._layers) {
    const srcDir = l.config.srcDir || l.cwd
    if (!NODE_MODULES_RE.test(srcDir)) {
      localLayerModuleDirs.push(resolve(srcDir, l.config?.dir?.modules || 'modules').replace(/\/?$/, '/'))
    }
  }

  // module lifecycle hooks
  if (nuxtModule.getMeta && (nuxtModule.onInstall || nuxtModule.onUpgrade)) {
    const meta = await nuxtModule.getMeta?.()

    if (meta && meta.name && meta.version) {
      const rc = readRc({ dir: nuxt.options.rootDir, name: '.nuxtrc' })
      const previousVersion = rc?.setups?.[meta.name]

      try {
        if (!previousVersion) {
          await nuxtModule.onInstall?.(nuxt)
        } else if (semver.gt(meta.version, previousVersion)) {
          await nuxtModule.onUpgrade?.(inlineOptions, nuxt, previousVersion)
        }
        if (previousVersion !== meta.version) {
          updateRc(
            { setups: { [meta.name]: meta?.version } },
            { dir: nuxt.options.rootDir, name: '.nuxtrc' },
          )
        }
      } catch (e) {
        logger.error(
          `Error while executing ${!previousVersion ? 'install' : 'upgrade'} hook for module \`${meta.name}\`: ${e}`,
        )
      }
    }
  }

  // Call module
  const res = nuxt.options.experimental?.debugModuleMutation && nuxt._asyncLocalStorageModule
    ? await nuxt._asyncLocalStorageModule.run(nuxtModule, () => nuxtModule(inlineOptions || {}, nuxt)) ?? {}
    : await nuxtModule(inlineOptions || {}, nuxt) ?? {}
  if (res === false /* setup aborted */) {
    return
  }

  const modulePath = resolvedModulePath || moduleToInstall
  if (typeof modulePath === 'string') {
    const parsed = parseNodeModulePath(modulePath)
    const moduleRoot = parsed.dir
      ? parsed.dir + parsed.name
      : await resolvePackageJSON(modulePath, { try: true }).then(r => r ? dirname(r) : modulePath)
    nuxt.options.build.transpile.push(normalizeModuleTranspilePath(moduleRoot))
    const directory = moduleRoot.replace(/\/?$/, '/')
    if (moduleRoot !== moduleToInstall && !localLayerModuleDirs.some(dir => directory.startsWith(dir))) {
      nuxt.options.modulesDir.push(join(moduleRoot, 'node_modules'))
    }
  }

  nuxt.options._installedModules ||= []
  const entryPath = typeof moduleToInstall === 'string' ? resolveAlias(moduleToInstall, nuxt.options.alias) : undefined

  if (typeof moduleToInstall === 'string' && entryPath !== moduleToInstall) {
    buildTimeModuleMeta.rawPath = moduleToInstall
  }

  nuxt.options._installedModules.push({
    meta: defu(await nuxtModule.getMeta?.(), buildTimeModuleMeta),
    module: nuxtModule,
    timings: res.timings,
    entryPath,
  })
}

// --- Internal ---

export function getDirectory (p: string) {
  try {
    // we need to target directories instead of module file paths themselves
    // /home/user/project/node_modules/module/index.js -> /home/user/project/node_modules/module
    return isAbsolute(p) && lstatSync(p).isFile() ? dirname(p) : p
  } catch {
    // maybe the path is absolute but does not exist, allow this to bubble up
  }
  return p
}

export const normalizeModuleTranspilePath = (p: string) => {
  return getDirectory(p).split('node_modules/').pop() as string
}

const MissingModuleMatcher = /Cannot find module\s+['"]?([^'")\s]+)['"]?/i

export function resolveModuleWithOptions (
  definition: NuxtModule<any> | string | false | undefined | null | [(NuxtModule | string)?, Record<string, any>?],
  nuxt: Nuxt,
): { resolvedPath?: string, module: string | NuxtModule<any>, options: Record<string, any> } | undefined {
  const [module, options = {}] = Array.isArray(definition) ? definition : [definition, {}]

  if (!module) {
    return
  }

  if (typeof module !== 'string') {
    return {
      module,
      options,
    }
  }

  const modAlias = resolveAlias(module, nuxt.options.alias)
  const modPath = resolveModulePath(modAlias, {
    try: true,
    from: nuxt.options.modulesDir.map(m => directoryToURL(m.replace(/\/node_modules\/?$/, '/'))),
    suffixes: ['nuxt', 'nuxt/index', 'module', 'module/index', '', 'index'],
    extensions: ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'],
  })

  return {
    module,
    resolvedPath: modPath || modAlias,
    options,
  }
}

export async function loadNuxtModuleInstance (nuxtModule: string | NuxtModule, nuxt: Nuxt = useNuxt()): Promise<{ nuxtModule: NuxtModule<any>, buildTimeModuleMeta: ModuleMeta, resolvedModulePath?: string }> {
  let buildTimeModuleMeta: ModuleMeta = {}

  if (typeof nuxtModule === 'function') {
    return {
      nuxtModule,
      buildTimeModuleMeta,
    }
  }

  if (typeof nuxtModule !== 'string') {
    throw new TypeError(`Nuxt module should be a function or a string to import. Received: ${nuxtModule}.`)
  }

  const jiti = createJiti(nuxt.options.rootDir, { alias: nuxt.options.alias })

  // Import if input is string
  nuxtModule = resolveAlias(nuxtModule, nuxt.options.alias)

  if (isRelative(nuxtModule)) {
    nuxtModule = resolve(nuxt.options.rootDir, nuxtModule)
  }

  try {
    const src = resolveModuleURL(nuxtModule, {
      from: nuxt.options.modulesDir.map(m => directoryToURL(m.replace(/\/node_modules\/?$/, '/'))),
      suffixes: ['nuxt', 'nuxt/index', 'module', 'module/index', '', 'index'],
      extensions: ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'],
    })
    const resolvedModulePath = fileURLToPath(src)
    const resolvedNuxtModule = await jiti.import<NuxtModule<any>>(src, { default: true })

    if (typeof resolvedNuxtModule !== 'function') {
      throw new TypeError(`Nuxt module should be a function: ${nuxtModule}.`)
    }

    // nuxt-module-builder generates a module.json with metadata including the version
    const moduleMetadataPath = new URL('module.json', src)
    if (existsSync(moduleMetadataPath)) {
      buildTimeModuleMeta = JSON.parse(await fsp.readFile(moduleMetadataPath, 'utf-8'))
    }

    return { nuxtModule: resolvedNuxtModule, buildTimeModuleMeta, resolvedModulePath }
  } catch (error: unknown) {
    const code = (error as Error & { code?: string }).code
    if (code === 'ERR_PACKAGE_PATH_NOT_EXPORTED' || code === 'ERR_UNSUPPORTED_DIR_IMPORT' || code === 'ENOTDIR') {
      throw new TypeError(`Could not load \`${nuxtModule}\`. Is it installed?`)
    }
    if (code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND') {
      const module = MissingModuleMatcher.exec((error as Error).message)?.[1]
      // verify that it's missing the nuxt module otherwise it may be a sub dependency of the module itself
      // i.e. module is importing a module that is missing
      if (module && !module.includes(nuxtModule as string)) {
        throw new TypeError(`Error while importing module \`${nuxtModule}\`: ${error}`)
      }
    }
  }

  throw new TypeError(`Could not load \`${nuxtModule}\`. Is it installed?`)
}
