import fsExtra from 'fs-extra'
import globby from 'globby'
import lodashTemplate from 'lodash/template'
import { join, relative, dirname } from 'upath'

import * as nxt from './utils/nxt'
import type { Builder } from './builder'

export interface NuxtTemplate {
  src: string // Absolute path to source file
  path: string // Relative path of destination
  data?: any
}

export function templateData (builder: Builder) {
  return {
    globals: builder.globals,
    app: builder.app,
    nuxtOptions: builder.nuxt.options,
    nxt
  }
}

async function compileTemplate (tmpl: NuxtTemplate, destDir: string) {
  const srcContents = await fsExtra.readFile(tmpl.src, 'utf-8')
  let compiledSrc: string
  try {
    compiledSrc = lodashTemplate(srcContents, {})(tmpl.data)
  } catch (err) {
    console.error('Error compiling template: ', tmpl)
    throw err
  }
  const dest = join(destDir, tmpl.path)
  // consola.log('Compile template', dest)
  await fsExtra.mkdirp(dirname(dest))
  await fsExtra.writeFile(dest, compiledSrc)
}

export function compileTemplates (templates: NuxtTemplate[], destDir: string) {
  return Promise.all(templates.map(t => compileTemplate(t, destDir)))
}

export async function scanTemplates (dir: string, data?: Record<string, any>) {
  const templateFiles = (await globby(join(dir, '/**')))

  return templateFiles.filter(src => !src.endsWith('.d.ts')).map(src => ({
    src,
    path: relative(dir, src),
    data
  }))
}

export function watchTemplate (template: NuxtTemplate, _watcher: any, _cb: () => any) {
  template.data = new Proxy(template.data, {
    // TODO: deep watch option changes
  })
  // TODO: Watch fs changes
}
