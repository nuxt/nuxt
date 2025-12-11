import type { SchemaDefinition } from '@nuxt/schema'
import { useNuxt } from '../context'

export function extendNuxtSchema (def: SchemaDefinition | (() => SchemaDefinition)): void {
  const nuxt = useNuxt()
  nuxt.hook('schema:extend', (schemas) => {
    schemas.push(typeof def === 'function' ? def() : def)
  })
}
