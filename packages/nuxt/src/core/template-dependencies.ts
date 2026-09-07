import { normalize } from 'pathe'
import type { Nuxt, NuxtApp, NuxtPage, NuxtTemplateChange, NuxtTemplateDependency, ResolvedNuxtTemplate } from 'nuxt/schema'

const isSamePath = (a: string | undefined, b: string) => !!a && (a === b || normalize(a) === b)

function isPageFile (pages: NuxtPage[], path: string): boolean {
  for (const page of pages) {
    if (isSamePath(page.file, path)) { return true }
    if (page.children && isPageFile(page.children, path)) { return true }
  }
  return false
}

const dependencyMatchers: Record<NuxtTemplateDependency, (app: NuxtApp, path: string) => boolean> = {
  // `app.pages` is undefined for the whole session when the pages module is disabled, and adding
  // or removing a pages directory restarts Nuxt, so there is no page whose contents could matter
  pages: (app, path) => !!app.pages && isPageFile(app.pages, path),
  plugins: (app, path) => app.plugins.some(plugin => isSamePath(plugin.src, path)),
}

/**
 * Build a `generateApp` filter for a `change` event on `path`, selecting the templates whose
 * output could depend on that file, as declared by `dependsOn`. Returns `undefined` if no
 * template can be affected, in which case regeneration can be skipped entirely.
 *
 * A template that declares nothing is regenerated, so a template Nuxt knows nothing about is
 * never left stale.
 */
export function createChangedFileFilter (nuxt: Nuxt, app: NuxtApp, path: string): ((template: ResolvedNuxtTemplate<any>) => boolean) | undefined {
  const change: NuxtTemplateChange = { event: 'change', path }
  const filter = (template: ResolvedNuxtTemplate<any>) => {
    const dependsOn = template.dependsOn
    if (typeof dependsOn === 'function') {
      return dependsOn(change, { nuxt, app, options: template.options })
    }
    if (dependsOn) {
      return dependsOn.some(dependency => dependencyMatchers[dependency]?.(app, path))
    }
    // a template read from disk depends on its own source and nothing else
    if (template.src) {
      return isSamePath(template.src, path)
    }
    return true
  }

  for (const template of app.templates) {
    if (filter(template as ResolvedNuxtTemplate<any>)) { return filter }
  }
}
