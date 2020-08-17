import { resolve, join, sep } from 'path'
import fsExtra from 'fs-extra'
import globby from 'globby'
import lodashTemplate from 'lodash/template'
import { Builder } from './builder'

export async function copyTemplates ({ nuxt, app }: Builder) {
  // Resolve appDir
  const templatesDir = join(nuxt.options.appDir, '_templates')

  const templateFiles = (await globby(join(templatesDir, '/**')))
    .map(f => f.replace(templatesDir + sep, ''))

  await fsExtra.mkdirp(nuxt.options.buildDir)

  for (const template of templateFiles) {
    const src = resolve(templatesDir, template)
    const dst = resolve(nuxt.options.buildDir, template)

    const templateData = { app: Object.freeze(app) }
    const srcContents = await fsExtra.readFile(src, 'utf-8')
    const compiledSrc = lodashTemplate(srcContents, {})(templateData)

    await fsExtra.writeFile(dst, compiledSrc)
  }
}
