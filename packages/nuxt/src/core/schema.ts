import { existsSync } from 'node:fs'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'pathe'
import { defu } from 'defu'
import { defineNuxtModule, createResolver } from '@nuxt/kit'
import {
  resolveSchema as resolveUntypedSchema,
  generateMarkdown,
  generateTypes
} from 'untyped'
import type { Schema, SchemaDefinition } from 'untyped'
// @ts-ignore
import untypedPlugin from 'untyped/babel-plugin'
import jiti from 'jiti'

export default defineNuxtModule({
  meta: {
    name: 'nuxt-config-schema'
  },
  setup (options, nuxt) {
    const resolver = createResolver(import.meta.url)

    // Initialize untyped/jiti loader
    const _resolveSchema = jiti(dirname(import.meta.url), {
      esmResolve: true,
      interopDefault: true,
      cache: false,
      requireCache: false,
      transformOptions: {
        babel: {
          plugins: [untypedPlugin]
        }
      }
    })

    // Register module types
    nuxt.hook('prepare:types', (ctx) => {
      ctx.references.push({ path: 'nuxt-config-schema' })
      ctx.references.push({ path: 'schema/nuxt.schema.d.ts' })
    })

    // Resolve schema after all modules initialized
    let schema: Schema
    nuxt.hook('modules:done', async () => {
      schema = await resolveSchema()
    })

    // Writie schema after build to allow further modifications
    nuxt.hooks.hook('build:done', async () => {
      await nuxt.hooks.callHook('schema:beforeWrite', schema)
      await writeSchema(schema)
      await nuxt.hooks.callHook('schema:written')
    })

    // --- Bound utils ---

    async function resolveSchema () {
      // Global import
      // @ts-ignore
      globalThis.defineNuxtSchema = (val: any) => val

      // Load schema from layers
      const schemaDefs: SchemaDefinition[] = [nuxt.options.$schema]
      for (const layer of nuxt.options._layers) {
        const filePath = await resolver.resolvePath(resolve(layer.config.rootDir, 'nuxt.schema'))
        if (filePath && existsSync(filePath)) {
          let loadedConfig: SchemaDefinition
          try {
            loadedConfig = _resolveSchema(filePath)
          } catch (err) {
            console.warn(
              '[nuxt-config-schema] Unable to load schema from',
              filePath,
              err
            )
            continue
          }
          schemaDefs.push(loadedConfig)
        }
      }

      // Allow hooking to extend custom schemas
      await nuxt.hooks.callHook('schema:extend', schemaDefs)

      // Resolve and merge schemas
      const schemas = await Promise.all(
        schemaDefs.map(schemaDef => resolveUntypedSchema(schemaDef))
      )

      // @ts-expect-error
      // Merge after normalazation
      const schema = defu(...schemas)

      // Allow hooking to extend resolved schema
      await nuxt.hooks.callHook('schema:resolved', schema)

      return schema
    }

    async function writeSchema (schema: Schema) {
      // Write it to build dir
      await mkdir(resolve(nuxt.options.buildDir, 'schema'), { recursive: true })
      await writeFile(
        resolve(nuxt.options.buildDir, 'schema/nuxt.schema.json'),
        JSON.stringify(schema, null, 2),
        'utf8'
      )
      const markdown = '# Nuxt Custom Config Schema' + generateMarkdown(schema)
      await writeFile(
        resolve(nuxt.options.buildDir, 'schema/nuxt.schema.md'),
        markdown,
        'utf8'
      )
      const _types = generateTypes(schema, {
        addExport: true,
        interfaceName: 'NuxtUserConfig',
        partial: true
      })
      const types =
        _types +
        `
export type UserAppConfig = Exclude<NuxtUserConfig['appConfig'], undefined>

declare module '@nuxt/schema' {
  interface NuxtConfig extends NuxtUserConfig {}
  interface NuxtOptions extends NuxtUserConfig {}
  interface AppConfigInput extends UserAppConfig {}
  interface AppConfig extends UserAppConfig {}
}`
      const typesPath = resolve(
        nuxt.options.buildDir,
        'schema/nuxt.schema.d.ts'
      )
      await writeFile(typesPath, types, 'utf8')
    }
  }
})
