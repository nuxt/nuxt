import type { SchemaDefinition } from 'nuxt/schema'
import type { DefineNuxtConfig } from 'nuxt/config'

export * from './dist/index.js'

declare global {
  const defineNuxtConfig: DefineNuxtConfig
  const defineNuxtSchema: (schema: SchemaDefinition) => SchemaDefinition
}
