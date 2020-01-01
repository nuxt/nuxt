import path from 'path'
import { remove } from 'fs-extra'
import consola from 'consola'
import { getNuxtConfig, Nuxt, Builder } from '../../../../test/utils'

const rootDir = path.resolve(__dirname, '..')

export async function compileTemplate (template, destination, options = {}) {
  if (arguments.length < 3) {
    options = destination || {}
    destination = undefined
  }

  const config = getNuxtConfig(options)

  config.rootDir = rootDir
  config.dev = false
  config.test = false
  config.server = false

  const nuxt = new Nuxt(config)
  const builder = new Builder(nuxt)

  const templateContext = builder.createTemplateContext()

  const multipleTemplates = Array.isArray(template)
  if (!multipleTemplates) {
    template = [template]
  }

  templateContext.templateFiles = template.map((template) => {
    if (typeof template === 'string') {
      return {
        src: path.resolve(rootDir, '../template', template),
        dst: path.join(rootDir, '.nuxt', destination || path.basename(template)),
        custom: false
      }
    }

    return {
      src: path.resolve(rootDir, '../template', template.src),
      dst: path.join(rootDir, '.nuxt', template.dst),
      custom: template.custom
    }
  })

  try {
    // clear all destinations
    await Promise.all(templateContext.templateFiles.map(({ dst }) => remove(dst)))

    await builder.compileTemplates(templateContext)

    if (multipleTemplates) {
      return templateContext.templateFiles.map(template => template.dst)
    }

    const [template] = templateContext.templateFiles
    return template.dst
  } catch (err) {
    consola.error('Could not compile template', err.message, template)
    return false
  }
}

export function importComponent (componentPath) {
  return import(componentPath).then(m => m.default || m)
}

export const vmTick = (vm) => {
  return new Promise((resolve) => {
    vm.$nextTick(resolve)
  })
}
