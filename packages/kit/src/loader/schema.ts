import { type SchemaDefinition } from '@nuxt/schema'
import { useNuxt } from '../context'

export function extendNuxtSchema (
  definition: SchemaDefinition | (() => SchemaDefinition)
) {
  const nuxt = useNuxt()

  nuxt.hook('schema:extend', (schemas) => {
    schemas.push(typeof definition === 'function' ? definition() : definition)
  })
}
