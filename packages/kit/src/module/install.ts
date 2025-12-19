import { existsSync, promises as fsp, lstatSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { ModuleMeta, ModuleOptions, Nuxt, NuxtConfig, NuxtModule, NuxtOptions } from '@nuxt/schema'
import { dirname, isAbsolute, join, resolve } from 'pathe'
import { defu } from 'defu'
import { createJiti } from 'jiti'
import { lookupNodeModuleSubpath, parseNodeModulePath } from 'mlly'
import { resolveModulePath, resolveModuleURL } from 'exsolve'
import { isRelative } from 'ufo'
import { readPackageJSON, resolvePackageJSON } from 'pkg-types'
import { read as readRc, update as updateRc } from 'rc9'
import semver from 'semver'
import { directoryToURL } from '../internal/esm.ts'
import { useNuxt } from '../context.ts'
import { resolveAlias } from '../resolve.ts'
import { logger } from '../logger.ts'
import { getLayerDirectories } from '../layers.ts'

const NODE_MODULES_RE = /[/\\]node_modules[/\\]/

type ModuleToInstall = string | NuxtModule<ModuleOptions, Partial<ModuleOptions>, false>
interface ResolvedModule {
  moduleToInstall: ModuleToInstall
  nuxtModule: NuxtModule<ModuleOptions, Partial<ModuleOptions>, false>
  buildTimeModuleMeta: ModuleMeta
  resolvedModulePath: string | undefined
  inlineOptions: Record<string, any>
  meta: ModuleMeta | undefined
}

/**
 * Installs a set of modules on a Nuxt instance.
 * @internal
 */
export async function installModules (modulesToInstall: Map<ModuleToInstall, Record<string, any>>, resolvedModulePaths: Set<string>, nuxt: Nuxt = useNuxt()): Promise<void> {
  const localLayerModuleDirs: string[] = []
  for (const l of nuxt.options._layers) {
    const srcDir = l.config.srcDir || l.cwd
    if (!NODE_MODULES_RE.test(srcDir)) {
      localLayerModuleDirs.push(resolve(srcDir, l.config?.dir?.modules || 'modules').replace(/\/?$/, '/'))
    }
  }

  nuxt._moduleOptionsFunctions ||= new Map<ModuleToInstall, Array<() => { defaults?: Record<string, unknown>, overrides?: Record<string, unknown> }>>()
  const resolvedModules: Array<ResolvedModule> = []
  const inlineConfigKeys = new Set(
    await Promise.all([...modulesToInstall].map(([mod]) => typeof mod !== 'string' && Promise.resolve(mod.getMeta?.())?.then(r => r?.configKey))),
  )
  let error: Error | undefined
  const dependencyMap = new Map<ModuleToInstall, string>()
  for (const [key, options] of modulesToInstall) {
    const res = await loadNuxtModuleInstance(key, nuxt).catch((err) => {
      if (dependencyMap.has(key) && typeof key === 'string') {
        (err as Error).cause = `Could not resolve \`${key}\` (specified as a dependency of ${dependencyMap.get(key)!}).`
      }
      throw err
    })

    const dependencyMeta = res.nuxtModule.getModuleDependencies?.(nuxt) || {}
    for (const [name, value] of Object.entries(dependencyMeta)) {
      if (!value.overrides && !value.defaults && !value.version && value.optional) {
        continue
      }

      const resolvedModule = resolveModuleWithOptions(name, nuxt)
      const moduleToAttribute = typeof key === 'string' ? `\`${key}\`` : 'a module in `nuxt.options`'

      if (!resolvedModule?.module) {
        const message = `Could not resolve \`${name}\` (specified as a dependency of ${moduleToAttribute}).`
        error = new TypeError(message)
        continue
      }

      if (value.version) {
        const resolvePaths = [res.resolvedModulePath!, ...nuxt.options.modulesDir].filter(Boolean)
        const pkg = await readPackageJSON(name, { from: resolvePaths }).catch(() => null)
        if (pkg?.version && !semver.satisfies(pkg.version, value.version)) {
          const message = `Module \`${name}\` version (\`${pkg.version}\`) does not satisfy \`${value.version}\` (requested by ${moduleToAttribute}).`
          error = new TypeError(message)
        }
      }

      if (value.overrides || value.defaults) {
        const currentFns = nuxt._moduleOptionsFunctions.get(resolvedModule.module) || []
        nuxt._moduleOptionsFunctions.set(resolvedModule.module, [
          ...currentFns,
          () => ({ defaults: value.defaults, overrides: value.overrides }),
        ])
      }

      if (value.optional === true) {
        continue
      }

      // ensure types are recognised for modules that are dependencies of other modules
      nuxt.options.typescript.hoist.push(name)

      if (resolvedModule && !modulesToInstall.has(resolvedModule.module) && (!resolvedModule.resolvedPath || !resolvedModulePaths.has(resolvedModule.resolvedPath))) {
        // check for config key already registered
        if (typeof resolvedModule.module === 'string' && inlineConfigKeys.has(resolvedModule.module)) {
          continue
        }
        modulesToInstall.set(resolvedModule.module, resolvedModule.options)
        dependencyMap.set(resolvedModule.module, moduleToAttribute)
        const path = resolvedModule.resolvedPath || resolvedModule.module
        if (typeof path === 'string') {
          resolvedModulePaths.add(path)
        }
      }
    }

    resolvedModules.push({
      moduleToInstall: key,
      meta: await res.nuxtModule.getMeta?.(),
      nuxtModule: res.nuxtModule,
      buildTimeModuleMeta: res.buildTimeModuleMeta,
      resolvedModulePath: res.resolvedModulePath,
      inlineOptions: options,
    })
  }

  if (error) {
    throw error
  }

  // config keys that accept `false` as a valid config value or are known to handle disabling internally
  const ignoredConfigKeys = new Set(['pages', 'components', 'devtools'])

  for (const { nuxtModule, meta, moduleToInstall, buildTimeModuleMeta, resolvedModulePath, inlineOptions } of resolvedModules) {
    const configKey = meta?.configKey as keyof NuxtOptions | undefined

    // Check if module should be disabled
    const configValue = configKey ? (nuxt.options)[configKey as keyof NuxtOptions] : undefined
    const isDisabled = configKey && configValue === false && !ignoredConfigKeys.has(configKey)

    // Merge options
    const optionsFns = [
      ...nuxt._moduleOptionsFunctions.get(moduleToInstall) || [],
      ...meta?.name ? nuxt._moduleOptionsFunctions.get(meta.name) || [] : [],
      // TODO: consider dropping options functions keyed by config key
      ...configKey ? nuxt._moduleOptionsFunctions.get(configKey) || [] : [],
    ]
    if (optionsFns.length > 0) {
      const overrides = [] as unknown as [Record<string, unknown> | undefined, ...Array<Record<string, unknown> | undefined>]
      const defaults: Array<Record<string, unknown> | undefined> = []
      for (const fn of optionsFns) {
        const options = fn()
        overrides.push(options.overrides)
        defaults.push(options.defaults)
      }
      if (configKey) {
        ;(nuxt.options[configKey] as any) = defu(...overrides, nuxt.options[configKey], ...defaults)
      }
    }

    await callLifecycleHooks(nuxtModule, meta, inlineOptions, nuxt, isDisabled)
    await callModule(nuxtModule, meta, inlineOptions, resolvedModulePath, moduleToInstall, localLayerModuleDirs, buildTimeModuleMeta, nuxt, isDisabled)
  }

  // clean up merging options
  delete nuxt._moduleOptionsFunctions
}

/**
 * Installs a module on a Nuxt instance.
 * @deprecated Use module dependencies.
 */
export async function installModule<
  T extends string | NuxtModule,
  Config extends Extract<NonNullable<NuxtConfig['modules']>[number], [T, any]>,
> (moduleToInstall: T, inlineOptions?: [Config] extends [never] ? any : Config[1], nuxt: Nuxt = useNuxt()): Promise<void> {
  const { nuxtModule, buildTimeModuleMeta, resolvedModulePath } = await loadNuxtModuleInstance(moduleToInstall, nuxt)

  const localLayerModuleDirs: string[] = []
  for (const dirs of getLayerDirectories(nuxt)) {
    if (!NODE_MODULES_RE.test(dirs.app)) {
      localLayerModuleDirs.push(dirs.modules)
    }
  }

  // module lifecycle hooks
  const meta = await nuxtModule.getMeta?.()

  // Apply options from moduleDependencies if available
  let mergedOptions = inlineOptions
  const configKey = meta?.configKey as keyof NuxtOptions | undefined
  if (configKey && nuxt._moduleOptionsFunctions) {
    const optionsFns = [
      ...nuxt._moduleOptionsFunctions.get(moduleToInstall) || [],
      ...nuxt._moduleOptionsFunctions.get(configKey) || [],
    ]
    if (optionsFns.length > 0) {
      const overrides = [] as unknown as [Record<string, unknown> | undefined, ...Array<Record<string, unknown> | undefined>]
      const defaults: Array<Record<string, unknown> | undefined> = []
      for (const fn of optionsFns) {
        const options = fn()
        overrides.push(options.overrides)
        defaults.push(options.defaults)
      }
      mergedOptions = defu(inlineOptions, ...overrides, nuxt.options[configKey], ...defaults) as any
      ;(nuxt.options[configKey] as any) = mergedOptions
    }
  }

  await callLifecycleHooks(nuxtModule, meta, mergedOptions, nuxt)
  await callModule(nuxtModule, meta, mergedOptions, resolvedModulePath, moduleToInstall, localLayerModuleDirs, buildTimeModuleMeta, nuxt)
}

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

// --- Internal ---

export function getDirectory (p: string): string {
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

async function callLifecycleHooks (nuxtModule: NuxtModule<any, Partial<any>, false>, meta: ModuleMeta = {}, inlineOptions?: Record<string, unknown>, nuxt = useNuxt(), isDisabled = false) {
  if (isDisabled) {
    return
  }
  if (!meta.name || !meta.version) {
    return
  }
  if (!nuxtModule.onInstall && !nuxtModule.onUpgrade) {
    return
  }

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

function registerInstalledModule (
  nuxtModule: NuxtModule<any, Partial<any>, false>,
  meta: ModuleMeta,
  moduleToInstall: ModuleToInstall,
  buildTimeModuleMeta: ModuleMeta,
  entryPath: string | undefined,
  nuxt: Nuxt,
  timings?: Record<string, number | undefined>,
) {
  nuxt.options._installedModules ||= []
  entryPath ||= typeof moduleToInstall === 'string' ? resolveAlias(moduleToInstall, nuxt.options.alias) : undefined

  if (typeof moduleToInstall === 'string' && entryPath !== moduleToInstall) {
    buildTimeModuleMeta.rawPath = moduleToInstall
  }

  nuxt.options._installedModules.push({
    meta: defu(meta, buildTimeModuleMeta),
    module: nuxtModule,
    timings,
    entryPath,
  })
}

async function callModule (nuxtModule: NuxtModule<any, Partial<any>, false>, meta: ModuleMeta = {}, inlineOptions: Record<string, unknown> | undefined, resolvedModulePath: string | undefined, moduleToInstall: ModuleToInstall, localLayerModuleDirs: string[], buildTimeModuleMeta: ModuleMeta, nuxt = useNuxt(), isDisabled?: boolean) {
  const modulePath = resolvedModulePath || moduleToInstall
  let entryPath: string | undefined
  let parsed: ReturnType<typeof parseNodeModulePath> | undefined

  // Parse module path and calculate entryPath
  if (typeof modulePath === 'string') {
    parsed = parseNodeModulePath(modulePath)
    if (parsed.name) {
      const subpath = await lookupNodeModuleSubpath(modulePath) || '.'
      entryPath = join(parsed.name, subpath === './' ? '.' : subpath)
    }
  }

  // Disabled modules register without executing
  if (isDisabled) {
    registerInstalledModule(nuxtModule, meta, moduleToInstall, buildTimeModuleMeta, entryPath, nuxt)
    return
  }

  // Execute enabled module
  const res = nuxt.options.experimental?.debugModuleMutation && nuxt._asyncLocalStorageModule
    ? await nuxt._asyncLocalStorageModule.run(nuxtModule, () => nuxtModule(inlineOptions || {}, nuxt)) ?? {}
    : await nuxtModule(inlineOptions || {}, nuxt) ?? {}
  if (res === false /* setup aborted */) {
    return
  }

  // Setup transpile and modulesDir for enabled modules
  if (typeof modulePath === 'string' && parsed) {
    const moduleRoot = parsed.dir
      ? parsed.dir + parsed.name
      : await resolvePackageJSON(modulePath, { try: true }).then(r => r ? dirname(r) : modulePath)
    nuxt.options.build.transpile.push(normalizeModuleTranspilePath(moduleRoot))
    const directory = moduleRoot.replace(/\/?$/, '/')
    if (moduleRoot !== moduleToInstall && !localLayerModuleDirs.some(dir => directory.startsWith(dir))) {
      nuxt.options.modulesDir.push(join(moduleRoot, 'node_modules'))
    }
  }

  registerInstalledModule(nuxtModule, meta, moduleToInstall, buildTimeModuleMeta, entryPath, nuxt, res.timings)
}
