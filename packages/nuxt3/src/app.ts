import { resolve, join, relative } from 'upath'
import globby from 'globby'
import lodashTemplate from 'lodash/template'
import defu from 'defu'
import { tryResolvePath, resolveFiles, Nuxt, NuxtApp, NuxtTemplate, normalizePlugin, normalizeTemplate } from '@nuxt/kit'
import { readFile, writeFile } from 'fs-extra'
import * as templateUtils from './template.utils'

export function createApp (nuxt: Nuxt, options: Partial<NuxtApp> = {}): NuxtApp {
  return defu(options, {
    dir: nuxt.options.srcDir,
    extensions: nuxt.options.extensions,
    plugins: [],
    templates: []
  } as NuxtApp)
}

export async function generateApp (nuxt: Nuxt, app: NuxtApp) {
  // Resolve app
  await resolveApp(nuxt, app)

  // Scan app templates
  const templatesDir = join(nuxt.options.appDir, '_templates')
  const templateFiles = await globby(join(templatesDir, '/**'))
  app.templates = templateFiles
    .filter(src => !src.endsWith('.d.ts'))
    .map(src => ({ src, filename: relative(templatesDir, src) } as NuxtTemplate))

  // User templates from options.build.templates
  app.templates = app.templates.concat(nuxt.options.build.templates)

  // Extend templates with hook
  await nuxt.callHook('app:templates', app)

  // Normalize templates
  app.templates = app.templates.map(tmpl => normalizeTemplate(tmpl))

  // Compile templates into vfs
  const templateContext = { utils: templateUtils, nuxt, app }
  await Promise.all(app.templates.map(async (template) => {
    const contents = await compileTemplate(template, templateContext)

    const fullPath = template.dst || resolve(nuxt.options.buildDir, template.filename)
    nuxt.vfs[fullPath] = contents

    const aliasPath = '#build/' + template.filename.replace(/\.\w+$/, '')
    nuxt.vfs[aliasPath] = contents

    // In case a non-normalized absolute path is called for on Windows
    if (process.platform === 'win32') {
      nuxt.vfs[fullPath.replace(/\//g, '\\')] = contents
    }

    if (template.write) {
      await writeFile(fullPath, contents, 'utf8')
    }
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
    ...await resolveFiles(nuxt.options.srcDir, 'plugins/**/*.{js,ts,mjs,cjs}')
  ].map(plugin => normalizePlugin(plugin))

  // Extend app
  await nuxt.callHook('app:resolve', app)
}

async function compileTemplate (template: NuxtTemplate, ctx: any) {
  const data = { ...ctx, ...template.options }
  if (template.src) {
    try {
      const srcContents = await readFile(template.src, 'utf-8')
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
