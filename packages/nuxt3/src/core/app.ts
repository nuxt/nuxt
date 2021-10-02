import { promises as fsp } from 'fs'
import { resolve } from 'pathe'
import defu from 'defu'
import { tryResolvePath, resolveFiles, Nuxt, NuxtApp, normalizePlugin, normalizeTemplate, compileTemplate, templateUtils } from '@nuxt/kit'

import * as defaultTemplates from '../app/templates'

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

  // User templates from options.build.templates
  app.templates = Object.values(defaultTemplates).concat(nuxt.options.build.templates)

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
      await fsp.writeFile(fullPath, contents, 'utf8')
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
