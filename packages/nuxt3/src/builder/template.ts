import { join, relative, dirname } from 'path'
import fsExtra from 'fs-extra'
import globby from 'globby'
import consola from 'consola'
import lodashTemplate from 'lodash/template'

export interface NuxtTemplate {
  src: string // Absolute path to source file
  path: string // Relative path of destination
  data?: any
}

async function compileTemplate ({ src, path, data }: NuxtTemplate, destDir: string) {
  const srcContents = await fsExtra.readFile(src, 'utf-8')
  const compiledSrc = lodashTemplate(srcContents, {})(data)
  const dest = join(destDir, path)
  consola.log('Compile template', dest)
  await fsExtra.mkdirp(dirname(dest))
  await fsExtra.writeFile(dest, compiledSrc)
}

export function compileTemplates (templates: NuxtTemplate[], destDir: string) {
  return Promise.all(templates.map(t => compileTemplate(t, destDir)))
}

export async function scanTemplates (dir: string, data?: Object) {
  const templateFiles = (await globby(join(dir, '/**')))

  return templateFiles.map(src => ({
    src,
    path: relative(dir, src),
    data
  }))
}

export function watchTemplate (template: NuxtTemplate, _watcher: any, _cb: Function) {
  template.data = new Proxy(template.data, {
    // TODO: deep watch option changes
  })
  // TODO: Watch fs changes
}
