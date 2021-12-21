import type { AutoImport } from '@nuxt/schema'

export interface AutoImportContext {
  autoImports: AutoImport[]
  matchRE: RegExp
  transform: {
    exclude: RegExp[]
  }
  map: Map<string, AutoImport>
}

export function createAutoImportContext (opts): AutoImportContext {
  return {
    autoImports: [],
    map: new Map(),
    matchRE: /__never__/,
    transform: {
      exclude: opts.transform.exclude || [/node_modules/]
    }
  }
}

export function updateAutoImportContext (ctx: AutoImportContext) {
  // Detect duplicates
  const usedNames = new Set()
  for (const autoImport of ctx.autoImports) {
    if (usedNames.has(autoImport.as)) {
      autoImport.disabled = true
      console.warn(`Disabling duplicate auto import '${autoImport.as}' (imported from '${autoImport.from}')`)
    } else {
      usedNames.add(autoImport.as)
    }
  }

  // Filter out disabled auto imports
  ctx.autoImports = ctx.autoImports.filter(i => i.disabled !== true)

  // Create regex
  ctx.matchRE = new RegExp(`\\b(${ctx.autoImports.map(i => i.as).join('|')})\\b`, 'g')

  // Create map
  ctx.map.clear()
  for (const autoImport of ctx.autoImports) {
    ctx.map.set(autoImport.as, autoImport)
  }

  return ctx
}
