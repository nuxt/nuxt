import { existsSync } from 'node:fs'
import { basename, parse, resolve } from 'pathe'
import hash from 'hash-sum'
import type { NuxtTemplate, ResolvedNuxtTemplate } from '@nuxt/schema'
import { useNuxt, tryUseNuxt } from './context'

/**
 * Renders given template using lodash template during build into the project buildDir
 */
export function addTemplate (_template: NuxtTemplate<any> | string) {
  const nuxt = useNuxt()

  // Normalize template
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
export function normalizeTemplate (template: NuxtTemplate<any> | string): ResolvedNuxtTemplate<any> {
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
      template.filename = (template as any).fileName ||
        `${basename(srcPath.dir)}.${srcPath.name}.${hash(template.src)}${srcPath.ext}`
    }
  }

  if (!template.src && !template.getContents) {
    throw new Error('Invalid template. Either getContents or src options should be provided: ' + JSON.stringify(template))
  }

  if (!template.filename) {
    throw new Error('Invalid template. Either filename should be provided: ' + JSON.stringify(template))
  }

  // Always write declaration files
  if (template.filename.endsWith('.d.ts')) {
    template.write = true
  }

  // Resolve dst
  if (!template.dst) {
    const nuxt = useNuxt()
    template.dst = resolve(nuxt.options.buildDir, template.filename)
  }

  return template as ResolvedNuxtTemplate<any>
}

/**
 * Trigger rebuilding Nuxt templates
 *
 * You can pass a filter within the options to selectively regenerate a subset of templates.
 */
export async function updateTemplates (options?: { filter?: (template: ResolvedNuxtTemplate<any>) => boolean }) {
  return await tryUseNuxt()?.hooks.callHook('builder:generateApp', options)
}
