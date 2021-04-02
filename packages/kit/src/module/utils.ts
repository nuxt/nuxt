import path, { basename, parse } from 'path'
import fs from 'fs'
import hash from 'hash-sum'
import consola from 'consola'
import { useNuxt } from '../nuxt'
import { chainFn } from '../utils/task'
import type { TemplateOpts, PluginTemplateOpts } from '../types/module'

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

  // Mostly for DX, some people prefers `filename` vs `fileName`
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

export function addErrorLayout (dst: string) {
  const nuxt = useNuxt()

  const relativeBuildDir = path.relative(nuxt.options.rootDir, nuxt.options.buildDir)
  nuxt.options.ErrorPage = `~/${relativeBuildDir}/${dst}`
}

export function addServerMiddleware (middleware) {
  const nuxt = useNuxt()

  nuxt.options.serverMiddleware.push(middleware)
}

export function extendBuild (fn) {
  const nuxt = useNuxt()

  // @ts-ignore TODO
  nuxt.options.build.extend = chainFn(nuxt.options.build.extend, fn)
}

export function extendRoutes (fn) {
  const nuxt = useNuxt()

  nuxt.options.router.extendRoutes = chainFn(nuxt.options.router.extendRoutes, fn)
}
