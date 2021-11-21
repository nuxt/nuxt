import { existsSync } from 'fs'
import { basename, parse, resolve } from 'pathe'
import hash from 'hash-sum'
import type { NuxtTemplate } from '@nuxt/schema'
import { useNuxt } from './context'

/**
 * Renders given template using lodash template during build into the project buildDir
 */
export function addTemplate (_template: NuxtTemplate | string) {
  const nuxt = useNuxt()

  // Noprmalize template
  const template = normalizeTemplate(_template)

  // Remove any existing template with the same filename
  nuxt.options.build.templates = nuxt.options.build.templates
    .filter(p => normalizeTemplate(p).filename !== template.filename)

  // Add to templates array
  nuxt.options.build.templates.push(template)

  return template
}

/**
 * Normalize a nuxt template object
 */
export function normalizeTemplate (template: NuxtTemplate | string): NuxtTemplate {
  if (!template) {
    throw new Error('Invalid template: ' + JSON.stringify(template))
  }

  // Normalize
  if (typeof template === 'string') {
    template = { src: template }
  } else {
    template = { ...template }
  }

  // Use src if provided
  if (template.src) {
    if (!existsSync(template.src)) {
      throw new Error('Template not found: ' + template.src)
    }
    if (!template.filename) {
      const srcPath = parse(template.src)
      template.filename = template.fileName ||
        `${basename(srcPath.dir)}.${srcPath.name}.${hash(template.src)}${srcPath.ext}`
    }
  }

  if (!template.src && !template.getContents) {
    throw new Error('Invalid template. Either getContents or src options should be provided: ' + JSON.stringify(template))
  }

  if (!template.filename) {
    throw new Error('Invalid template. Either filename should be provided: ' + JSON.stringify(template))
  }

  // Resolve dst
  if (!template.dst) {
    const nuxt = useNuxt()
    template.dst = resolve(nuxt.options.buildDir, template.filename)
  }

  return template
}
