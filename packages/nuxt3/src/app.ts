import { resolve, join, relative } from 'upath'
import globby from 'globby'
import lodashTemplate from 'lodash/template'
import defu from 'defu'
import { tryResolvePath, resolveFiles, Nuxt, NuxtApp, NuxtTemplate, NuxtPlugin } from '@nuxt/kit'
import { readFile } from 'fs-extra'
import * as templateUtils from './template.utils'

export function createApp (nuxt: Nuxt, options: Partial<NuxtApp> = {}): NuxtApp {
  return defu(options, {
    dir: nuxt.options.srcDir,
    extensions: nuxt.options.extensions,
    plugins: [],
    templates: {}
  } as NuxtApp)
}

export async function generateApp (nuxt: Nuxt, app: NuxtApp) {
  // Resolve app
  await resolveApp(nuxt, app)

  // Scan templates
  const templatesDir = join(nuxt.options.appDir, '_templates')
  const templateFiles = await globby(join(templatesDir, '/**'))
  app.templates = templateFiles
    .filter(src => !src.endsWith('.d.ts'))
    .map(src => ({
      src,
      path: relative(templatesDir, src),
      data: {}
    } as NuxtTemplate))

  // Custom templates (created with addTemplate)
  const customTemplates = nuxt.options.build.templates.map(t => ({
    path: t.dst,
    src: t.src,
    data: {
      options: t.options
    }
  }))
  app.templates = app.templates.concat(customTemplates)

  // Extend templates
  await nuxt.callHook('app:templates', app)

  // Compile templates into vfs
  const templateContext = { utils: templateUtils, nuxt, app }
  await Promise.all(app.templates.map(async (template) => {
    const contents = await compileTemplate(template, templateContext)

    const fullPath = resolve(nuxt.options.buildDir, template.path)
    nuxt.vfs[fullPath] = contents

    const aliasPath = '#build/' + template.path.replace(/\.\w+$/, '')
    nuxt.vfs[aliasPath] = contents
  }))

  await nuxt.callHook('app:templatesGenerated', app)
}

export async function resolveApp (nuxt: Nuxt, app: NuxtApp) {
  const resolveOptions = {
    base: nuxt.options.srcDir,
    alias: nuxt.options.alias,
    extensions: nuxt.options.extensions
  }

  // Resolve main (app.vue)
  if (!app.main) {
    app.main = tryResolvePath('~/App', resolveOptions) || tryResolvePath('~/app', resolveOptions)
  }
  if (!app.main) {
    app.main = resolve(nuxt.options.appDir, 'app.tutorial.vue')
  }

  // Resolve plugins
  app.plugins = [
    ...nuxt.options.plugins,
    ...await resolvePlugins(nuxt)
  ]

  // Extend app
  await nuxt.callHook('app:resolve', app)
}

async function compileTemplate (tmpl: NuxtTemplate, ctx: any) {
  const data = { ...ctx, ...tmpl.data }
  if (tmpl.src) {
    try {
      const srcContents = await readFile(tmpl.src, 'utf-8')
      return lodashTemplate(srcContents, {})(data)
    } catch (err) {
      console.error('Error compiling template: ', tmpl)
      throw err
    }
  }
  if (tmpl.compile) {
    return tmpl.compile(data)
  }
  throw new Error('Invalid template:' + tmpl)
}

async function resolvePlugins (nuxt: Nuxt) {
  const plugins = await resolveFiles(nuxt.options.srcDir, 'plugins/**/*.{js,ts}')

  return plugins.map(src => ({
    src,
    mode: getPluginMode(src)
  })
  )
}

function getPluginMode (src: string) {
  const [, mode = 'all'] = src.match(/\.(server|client)(\.\w+)*$/) || []
  return mode as NuxtPlugin['mode']
}
