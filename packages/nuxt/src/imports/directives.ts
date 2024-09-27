import { createUnplugin } from 'unplugin'
import { type AddonsOptions, type Import, createUnimport } from 'unimport'
import type { ImportPresetWithDeprecation } from 'nuxt/schema'
import MagicString from 'magic-string'
import { isVue } from '../core/utils'

export const DirectivesPlugin = ({
  addons,
  dirs,
  imports,
  presets,
}: {
  addons: AddonsOptions
  dirs: string[]
  imports: Import[]
  presets: ImportPresetWithDeprecation[]
}) => createUnplugin(() => {
  const useImports: Import[] = []
  function visit (i: Import) {
    if (i.meta?.vueDirective === true) {
      useImports.push(i)
    }
  }
  imports?.forEach(visit)
  presets?.forEach((preset) => {
    if (preset && 'imports' in preset) {
      const imports = preset.imports as Import[]
      imports.forEach(visit)
    }
  })

  const ctx = createUnimport({
    dirs,
    imports: useImports,
    addons,
  })

  return {
    name: 'nuxt:directives-transform',
    enforce: 'post',
    transformInclude (id) {
      return isVue(id, { type: ['script', 'template'] })
    },
    async transform (code, id) {
      const s = new MagicString(code)

      await ctx.injectImports(s, id, {
        autoImport: false,
      })

      if (!s.hasChanged()) { return }

      return {
        code: s.toString(),
        map: s.generateMap(),
      }
    },
    async buildStart () {
      await ctx.init()
    },
  }
})
