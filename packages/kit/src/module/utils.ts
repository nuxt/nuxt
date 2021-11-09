import { existsSync, promises as fsp } from 'fs'
import { basename, extname, normalize, parse, resolve } from 'pathe'
import lodashTemplate from 'lodash.template'
import hash from 'hash-sum'
import { pascalCase, camelCase, kebabCase } from 'scule'
import type { WebpackPluginInstance, Configuration as WebpackConfig } from 'webpack'
import type { Plugin as VitePlugin, UserConfig as ViteConfig } from 'vite'
import satisfies from 'semver/functions/satisfies.js' // npm/node-semver#381
import { NuxtCompatibilityConstraints, NuxtCompatibilityIssues } from '../types/module'
import { Nuxt } from '../types/nuxt'
import { useNuxt } from '../nuxt'
import type { NuxtTemplate, NuxtPlugin, NuxtPluginTemplate } from '../types/nuxt'
import type { ComponentsDir, Component } from '../types/components'
import type { NuxtHooks } from '../types/hooks'

/**
 * Renders given template using lodash template during build into the project buildDir
 */
export function addTemplate (_template: NuxtTemplate | string) {
  const nuxt = useNuxt()

  // Noprmalize template
  const template = normalizeTemplate(_template)

  // Remove any existing template with the same filename
  nuxt.options.build.templates = nuxt.options.build.templates
    .filter(p => normalizeTemplate(p).filename !== template.filename)

  // Add to templates array
  nuxt.options.build.templates.push(template)

  return template
}

/**
 * Normalize a nuxt template object
 */
export function normalizeTemplate (template: NuxtTemplate | string): NuxtTemplate {
  if (!template) {
    throw new Error('Invalid template: ' + JSON.stringify(template))
  }

  // Normalize
  if (typeof template === 'string') {
    template = { src: template }
  } else {
    template = { ...template }
  }

  // Use src if provided
  if (template.src) {
    if (!existsSync(template.src)) {
      throw new Error('Template not found: ' + template.src)
    }
    if (!template.filename) {
      const srcPath = parse(template.src)
      template.filename = template.fileName ||
        `${basename(srcPath.dir)}.${srcPath.name}.${hash(template.src)}${srcPath.ext}`
    }
  }

  if (!template.src && !template.getContents) {
    throw new Error('Invalid template. Either getContents or src options should be provided: ' + JSON.stringify(template))
  }

  if (!template.filename) {
    throw new Error('Invalid template. Either filename should be provided: ' + JSON.stringify(template))
  }

  // Resolve dst
  if (!template.dst) {
    const nuxt = useNuxt()
    template.dst = resolve(nuxt.options.buildDir, template.filename)
  }

  return template
}

/**
 * Normalize a nuxt plugin object
 */
export function normalizePlugin (plugin: NuxtPlugin | string): NuxtPlugin {
  // Normalize src
  if (typeof plugin === 'string') {
    plugin = { src: plugin }
  } else {
    plugin = { ...plugin }
  }

  if (!plugin.src) {
    throw new Error('Invalid plugin. src option is required: ' + JSON.stringify(plugin))
  }

  // Normalize full path to plugin
  plugin.src = normalize(plugin.src)

  // Normalize mode
  if (plugin.ssr) {
    plugin.mode = 'server'
  }
  if (!plugin.mode) {
    const [, mode = 'all'] = plugin.src.match(/\.(server|client)(\.\w+)*$/) || []
    plugin.mode = mode as 'all' | 'client' | 'server'
  }

  return plugin
}

/**
 * Registers a nuxt plugin and to the plugins array.
 *
 * Note: You can use mode or .client and .server modifiers with fileName option
 * to use plugin only in client or server side.
 *
 * Note: By default plugin is prepended to the plugins array. You can use second argument to append (push) instead.
 *
 * @example
 * ```js
 * addPlugin({
 *   src: path.resolve(__dirname, 'templates/foo.js'),
 *   filename: 'foo.server.js' // [optional] only include in server bundle
 * })
 * ```
 */
export interface AddPluginOptions { append?: Boolean }
export function addPlugin (_plugin: NuxtPlugin | string, opts: AddPluginOptions = {}) {
  const nuxt = useNuxt()

  // Normalize plugin
  const plugin = normalizePlugin(_plugin)

  // Remove any existing plugin with the same src
  nuxt.options.plugins = nuxt.options.plugins.filter(p => normalizePlugin(p).src !== plugin.src)

  // Prepend to array by default to be before user provided plugins since is usually used by modules
  nuxt.options.plugins[opts.append ? 'push' : 'unshift'](plugin)

  return plugin
}

/**
 * Adds a template and registers as a nuxt plugin.
 */
export function addPluginTemplate (plugin: NuxtPluginTemplate | string, opts: AddPluginOptions = {}): NuxtPluginTemplate {
  if (typeof plugin === 'string') {
    plugin = { src: plugin }
  }

  // Update plugin src to template destination
  plugin.src = addTemplate(plugin).dst

  return addPlugin(plugin, opts)
}

/** Adds a new server middleware to the end of the server middleware array. */
export function addServerMiddleware (middleware) {
  useNuxt().options.serverMiddleware.push(middleware)
}

export interface ExtendConfigOptions {
  /**
   * Install plugin on dev
   *
   * @default true
   */
   dev?: boolean
   /**
    * Install plugin on build
    *
    * @default true
    */
   build?: boolean
}

export interface ExtendWebpackConfigOptions extends ExtendConfigOptions {
  /**
   * Install plugin on server side
   *
   * @default true
   */
  server?: boolean
  /**
   * Install plugin on client side
   *
   * @default true
   */
  client?: boolean
  /**
   * Install plugin on modern build
   *
   * @default true
   * @deprecated Nuxt 2 only
   */
  modern?: boolean
}

export interface ExtendViteConfigOptions extends ExtendConfigOptions {}

/**
 * Extend Webpack config
 *
 * The fallback function might be called multiple times
 * when applying to both client and server builds.
 */
export function extendWebpackConfig (
  fn: ((config: WebpackConfig)=> void),
  options: ExtendWebpackConfigOptions = {}
) {
  const nuxt = useNuxt()

  if (options.dev === false && nuxt.options.dev) {
    return
  }
  if (options.build === false && nuxt.options.build) {
    return
  }

  nuxt.hook('webpack:config', (configs: WebpackConfig[]) => {
    if (options.server !== false) {
      const config = configs.find(i => i.name === 'server')
      if (config) {
        fn(config)
      }
    }
    if (options.client !== false) {
      const config = configs.find(i => i.name === 'client')
      if (config) {
        fn(config)
      }
    }
    // Nuxt 2 backwards compatibility
    if (options.modern !== false) {
      const config = configs.find(i => i.name === 'modern')
      if (config) {
        fn(config)
      }
    }
  })
}

/**
 * Extend Vite config
 */
export function extendViteConfig (
  fn: ((config: ViteConfig) => void),
  options: ExtendViteConfigOptions = {}
) {
  const nuxt = useNuxt()

  if (options.dev === false && nuxt.options.dev) {
    return
  }
  if (options.build === false && nuxt.options.build) {
    return
  }

  nuxt.hook('vite:extend', ({ config }) => fn(config))
}

/**
 * Append Webpack plugin to the config.
 */
export function addWebpackPlugin (plugin: WebpackPluginInstance, options?: ExtendWebpackConfigOptions) {
  extendWebpackConfig((config) => {
    config.plugins = config.plugins || []
    config.plugins.push(plugin)
  }, options)
}

/**
 * Append Vite plugin to the config.
 */
export function addVitePlugin (plugin: VitePlugin, options?: ExtendViteConfigOptions) {
  extendViteConfig((config) => {
    config.plugins = config.plugins || []
    config.plugins.push(plugin)
  }, options)
}

export async function compileTemplate (template: NuxtTemplate, ctx: any) {
  const data = { ...ctx, options: template.options }
  if (template.src) {
    try {
      const srcContents = await fsp.readFile(template.src, 'utf-8')
      return lodashTemplate(srcContents, {})(data)
    } catch (err) {
      console.error('Error compiling template: ', template)
      throw err
    }
  }
  if (template.getContents) {
    return template.getContents(data)
  }
  throw new Error('Invalid template: ' + JSON.stringify(template))
}

/**
 * Register a directory to be scanned for components and imported only when used.
 *
 * Requires Nuxt 2.13+
 */
export function addComponentsDir (dir: ComponentsDir) {
  const nuxt = useNuxt()
  ensureNuxtCompatibility({ nuxt: '>=2.13' }, nuxt)
  nuxt.options.components = nuxt.options.components || []
  nuxt.hook('components:dirs', (dirs) => { dirs.push(dir) })
}

export type AddComponentOptions = { name: string, filePath: string } & Partial<Exclude<Component,
'shortPath' | 'async' | 'level' | 'import' | 'asyncImport'
>>

/**
 * Register a directory to be scanned for components and imported only when used.
 *
 * Requires Nuxt 2.13+
 */
export function addComponent (opts: AddComponentOptions) {
  const nuxt = useNuxt()
  ensureNuxtCompatibility({ nuxt: '>=2.13' }, nuxt)
  nuxt.options.components = nuxt.options.components || []

  // Apply defaults
  const component: Component = {
    export: opts.export || 'default',
    chunkName: 'components/' + kebabCase(opts.name),
    global: opts.global ?? false,
    kebabName: kebabCase(opts.name || ''),
    pascalName: pascalCase(opts.name || ''),
    prefetch: false,
    preload: false,

    // Nuxt 2 support
    shortPath: opts.filePath,
    async: false,
    level: 0,
    asyncImport: `() => import('${opts.filePath}').then(r => r['${opts.export || 'default'}'])`,
    import: `require('${opts.filePath}')['${opts.export || 'default'}']`,

    ...opts
  }

  nuxt.hook('components:extend', (components: Component[]) => {
    const existingComponent = components.find(c => c.pascalName === component.pascalName || c.kebabName === component.kebabName)
    if (existingComponent) {
      const name = existingComponent.pascalName || existingComponent.kebabName
      console.warn(`Overriding ${name} component.`)
      Object.assign(existingComponent, component)
    } else {
      components.push(component)
    }
  })
}

export function extendPages (cb: NuxtHooks['pages:extend']) {
  const nuxt = useNuxt()
  nuxt.hook('pages:extend', cb)
}

const serialize = (data: any) => JSON.stringify(data, null, 2).replace(/"{(.+)}"/g, '$1')

const importName = (src: string) => `${camelCase(basename(src, extname(src))).replace(/[^a-zA-Z?\d\s:]/g, '')}_${hash(src)}`

const importSources = (sources: string | string[], { lazy = false } = {}) => {
  if (!Array.isArray(sources)) {
    sources = [sources]
  }
  return sources.map((src) => {
    if (lazy) {
      return `const ${importName(src)} = () => import('${src}' /* webpackChunkName: '${src}' */)`
    }
    return `import ${importName(src)} from '${src}'`
  }).join('\n')
}

export const templateUtils = {
  serialize,
  importName,
  importSources
}

/**
 * Check if current nuxt instance is version 2 legacy
 */
export function isNuxt2 (nuxt: Nuxt = useNuxt()) {
  return getNuxtVersion(nuxt).startsWith('2.')
}

/**
 * Check if current nuxt instance is version 3
 */
export function isNuxt3 (nuxt: Nuxt = useNuxt()) {
  return getNuxtVersion(nuxt).startsWith('3.')
}

/**
 * Get nuxt version
 */
export function getNuxtVersion (nuxt: Nuxt | any = useNuxt() /* TODO: LegacyNuxt */) {
  const version = (nuxt?._version || nuxt?.version || nuxt?.constructor?.version || '').replace(/^v/g, '')
  if (!version) {
    throw new Error('Cannot determine nuxt version! Is currect instance passed?')
  }
  return version
}

/**
 * Check version constraints and return incompatibility issues as an array
 */
export function checkNuxtCompatibilityIssues (constraints: NuxtCompatibilityConstraints, nuxt: Nuxt = useNuxt()): NuxtCompatibilityIssues {
  const issues: NuxtCompatibilityIssues = []
  if (constraints.nuxt) {
    const nuxtVersion = getNuxtVersion(nuxt)
    const nuxtSemanticVersion = nuxtVersion.split('-').shift()
    if (!satisfies(nuxtSemanticVersion, constraints.nuxt)) {
      issues.push({
        name: 'nuxt',
        message: `Nuxt version \`${constraints.nuxt}\` is required but currently using \`${nuxtVersion}\``
      })
    }
  }
  issues.toString = () => issues.map(issue => ` - [${issue.name}] ${issue.message}`).join('\n')
  return issues
}

/**
 * Check version constraints and throw a detailed error if has any, otherwise returns true
 */
export function ensureNuxtCompatibility (constraints: NuxtCompatibilityConstraints, nuxt: Nuxt = useNuxt()): true {
  const issues = checkNuxtCompatibilityIssues(constraints, nuxt)
  if (issues.length) {
    throw new Error('Nuxt compatibility issues found:\n' + issues.toString())
  }
  return true
}

/**
 * Check version constraints and return true if passed, otherwise returns false
 */
export function hasNuxtCompatibility (constraints: NuxtCompatibilityConstraints, nuxt: Nuxt = useNuxt()) {
  return !checkNuxtCompatibilityIssues(constraints, nuxt).length
}
