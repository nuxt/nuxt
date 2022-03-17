import { promises as fsp } from 'fs'
import { dirname, resolve, basename, extname } from 'pathe'
import defu from 'defu'
import { kebabCase } from 'scule'
import type { Nuxt, NuxtApp, NuxtPlugin } from '@nuxt/schema'
import { findPath, resolveFiles, normalizePlugin, normalizeTemplate, compileTemplate, templateUtils, tryResolveModule } from '@nuxt/kit'

import * as defaultTemplates from './templates'

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
      await fsp.mkdir(dirname(fullPath), { recursive: true })
      await fsp.writeFile(fullPath, contents, 'utf8')
    }
  }))

  await nuxt.callHook('app:templatesGenerated', app)
}

export async function resolveApp (nuxt: Nuxt, app: NuxtApp) {
  // Resolve main (app.vue)
  if (!app.mainComponent) {
    app.mainComponent = await findPath(['~/App', '~/app'])
  }
  if (!app.mainComponent) {
    app.mainComponent = tryResolveModule('@nuxt/ui-templates/templates/welcome.vue')
  }

  // Resolve root component
  if (!app.rootComponent) {
    app.rootComponent = await findPath(['~/app.root', resolve(nuxt.options.appDir, 'components/nuxt-root.vue')])
  }

  // Resolve error component
  if (!app.errorComponent) {
    app.errorComponent = (await findPath(['~/error'])) || resolve(nuxt.options.appDir, 'components/nuxt-error-page.vue')
  }

  // Resolve layouts/ from all config layers
  app.layouts = {}
  for (const config of nuxt.options._layers.map(layer => layer.config)) {
    const layoutFiles = await resolveFiles(config.srcDir, `${config.dir?.layouts || 'layouts'}/*{${nuxt.options.extensions.join(',')}}`)
    for (const file of layoutFiles) {
      const name = getNameFromPath(file)
      app.layouts[name] = app.layouts[name] || { name, file }
    }
  }

  // Resolve plugins
  app.plugins = [
    ...nuxt.options.plugins.map(normalizePlugin)
  ]
  for (const config of nuxt.options._layers.map(layer => layer.config)) {
    app.plugins.push(...[
      ...(config.plugins || []),
      ...await resolveFiles(config.srcDir, [
        'plugins/*.{ts,js,mjs,cjs,mts,cts}',
        'plugins/*/index.*{ts,js,mjs,cjs,mts,cts}'
      ])
    ].map(plugin => normalizePlugin(plugin as NuxtPlugin)))
  }
  app.plugins = uniqueBy(app.plugins, 'src')

  // Extend app
  await nuxt.callHook('app:resolve', app)
}

function getNameFromPath (path: string) {
  return kebabCase(basename(path).replace(extname(path), '')).replace(/["']/g, '')
}

function uniqueBy (arr: any[], uniqueKey: string) {
  const seen = new Set<string>()
  const res = []
  for (const i of arr) {
    const key = i[uniqueKey]
    if (seen.has(key)) { continue }
    res.push(i)
    seen.add(key)
  }
  return res
}
