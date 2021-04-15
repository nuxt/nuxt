import path, { basename, parse } from 'path'
import fs from 'fs'
import hash from 'hash-sum'
import consola from 'consola'
import { useNuxt } from '../nuxt'
import { chainFn } from '../utils/task'
import type { TemplateOpts, PluginTemplateOpts } from '../types/module'

/**
 * Renders given template using lodash template during build into the project buildDir (`.nuxt`).
 *
 * If a fileName is not provided or the template is string, target file name defaults to
 * [dirName].[fileName].[pathHash].[ext].
 */
export function addTemplate (tmpl: TemplateOpts | string) {
  const nuxt = useNuxt()

  if (!tmpl) {
    throw new Error('Invalid tmpl: ' + JSON.stringify(tmpl))
  }

  // Validate & parse source
  const src = typeof tmpl === 'string' ? tmpl : tmpl.src
  const srcPath = parse(src)

  if (typeof src !== 'string' || !fs.existsSync(src)) {
    throw new Error('tmpl src not found: ' + src)
  }

  // Mostly for DX, some people prefer `filename` vs `fileName`
  const fileName = typeof tmpl === 'string' ? '' : tmpl.fileName || tmpl.filename
  // Generate unique and human readable dst filename if not provided
  const dst = fileName || `${basename(srcPath.dir)}.${srcPath.name}.${hash(src)}${srcPath.ext}`
  // Add to tmpls list
  const tmplObj = {
    src,
    dst,
    options: typeof tmpl === 'string' ? undefined : tmpl.options
  }

  nuxt.options.build.templates.push(tmplObj)

  return tmplObj
}

/**
 * Registers a plugin using `addTemplate` and prepends it to the plugins[] array.
 *
 * Note: You can use mode or .client and .server modifiers with fileName option
 * to use plugin only in client or server side.
 *
 * If you choose to specify a fileName, you can configure a custom path for the
 * fileName too, so you can choose the folder structure inside .nuxt folder in
 * order to prevent name collisioning:
 *
 * @example
 * ```js
 * addPlugin({
 *   src: path.resolve(__dirname, 'templates/foo.js'),
 *   fileName: 'foo.server.js' // [optional] only include in server bundle
 * })
 * ```
 */
export function addPlugin (tmpl: PluginTemplateOpts) {
  const nuxt = useNuxt()

  const { dst } = addTemplate(tmpl)

  if (!tmpl.mode && typeof tmpl.ssr === 'boolean') {
    tmpl.mode = tmpl.ssr ? 'server' : 'client'
  }

  // Add to nuxt plugins
  nuxt.options.plugins.unshift({
    src: path.join(nuxt.options.buildDir, dst),
    mode: tmpl.mode
  })
}

/** Register a custom layout. If its name is 'error' it will override the default error layout. */
export function addLayout (tmpl: TemplateOpts, name: string) {
  const nuxt = useNuxt()

  const { dst, src } = addTemplate(tmpl)
  const layoutName = name || path.parse(src).name
  const layout = nuxt.options.layouts[layoutName]

  if (layout) {
    consola.warn(`Duplicate layout registration, "${layoutName}" has been registered as "${layout}"`)
  }

  // Add to nuxt layouts
  nuxt.options.layouts[layoutName] = `./${dst}`

  // If error layout, set ErrorPage
  if (name === 'error') {
    addErrorLayout(dst)
  }
}

/**
 * Set the layout that will render Nuxt errors. It should already have been added via addLayout or addTemplate.
 *
 * @param dst - Path to layout file within the buildDir (`.nuxt/<dst>.vue`)
 */
export function addErrorLayout (dst: string) {
  const nuxt = useNuxt()

  const relativeBuildDir = path.relative(nuxt.options.rootDir, nuxt.options.buildDir)
  nuxt.options.ErrorPage = `~/${relativeBuildDir}/${dst}`
}

/** Adds a new server middleware to the end of the server middleware array. */
export function addServerMiddleware (middleware) {
  const nuxt = useNuxt()

  nuxt.options.serverMiddleware.push(middleware)
}

/** Allows extending webpack build config by chaining `options.build.extend` function. */
export function extendBuild (fn) {
  const nuxt = useNuxt()

  // @ts-ignore TODO
  nuxt.options.build.extend = chainFn(nuxt.options.build.extend, fn)
}

/** Allows extending routes by chaining `options.build.extendRoutes` function. */
export function extendRoutes (fn) {
  const nuxt = useNuxt()

  nuxt.options.router.extendRoutes = chainFn(nuxt.options.router.extendRoutes, fn)
}
