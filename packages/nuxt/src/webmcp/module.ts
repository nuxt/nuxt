import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'pathe'
import type { CompilerOptions } from '@vue/compiler-core'
import { addImports, addPlugin, defineNuxtModule } from '@nuxt/kit'
import { buildDiagnostics } from '@nuxt/kit/internal'
import { distDir } from '../dirs.ts'
import { linkToAlias, logger } from '../utils.ts'
import type { AgentToolFinding } from './compiler.ts'
import { createAgentToolTransform } from './compiler.ts'
import type { AgentToolSummary } from './runtime/types.ts'

export interface SchemaFile {
  tools: AgentToolSummary[]
  routes: Record<string, string[]>
}

/** Adds the tools a page reports to `schema`; returns whether `update` has the shape the client sends. */
export function mergeSchemaUpdate (schema: SchemaFile, update: unknown) {
  const { path, tools } = (update ?? {}) as { path?: unknown, tools?: unknown }
  const isTool = (tool: unknown): tool is AgentToolSummary => !!tool && typeof tool === 'object'
    && typeof (tool as AgentToolSummary).name === 'string' && typeof (tool as AgentToolSummary).description === 'string'
  if (typeof path !== 'string' || !path.startsWith('/') || !Array.isArray(tools) || !tools.every(isTool)) {
    return false
  }
  const byName = new Map(schema.tools.map(tool => [tool.name, tool]))
  for (const tool of tools) {
    byName.set(tool.name, tool)
  }
  schema.tools = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
  schema.routes[path] = [...new Set([...schema.routes[path] ?? [], ...tools.map(tool => tool.name)])].sort()
  return true
}

function lineAndColumn (source: string, offset: number) {
  const before = source.slice(0, offset).split('\n')
  return `${before.length}:${before.at(-1)!.length + 1}`
}

/** Report a finding of the agent tool transform as a build diagnostic. */
export function reportAgentToolFinding (finding: AgentToolFinding, file: string, source: string, rootDir: string) {
  const path = relative(rootDir, file)
  const params = { ...finding.params, file: path, sources: [`${path}:${lineAndColumn(source, finding.offset)}`] } as never
  return buildDiagnostics[finding.code](params)
}

export default defineNuxtModule({
  meta: {
    name: 'nuxt:webmcp',
  },
  setup (_, nuxt) {
    const enabled = nuxt.options.experimental.webmcp
    if (!enabled) {
      return
    }
    const { navigate = true, schema: schemaOption } = enabled === true ? {} : enabled
    const runtimeDir = resolve(distDir, 'webmcp/runtime')

    const transform = createAgentToolTransform({
      report: (finding, file, source) => {
        reportAgentToolFinding(finding, file, source, nuxt.options.rootDir)
      },
    })
    const withTransform = <T extends Pick<CompilerOptions, 'nodeTransforms'>> (compilerOptions?: T): T => ({
      ...compilerOptions,
      nodeTransforms: [...compilerOptions?.nodeTransforms || [], transform],
    }) as T

    nuxt.hook('build:before', () => {
      const template = (nuxt.options.vite.vue ||= {}).template ||= {}
      template.compilerOptions = withTransform(template.compilerOptions)
      const loader = nuxt.options.webpack.loaders.vue
      loader.compilerOptions = withTransform(loader.compilerOptions)
      const rsbuildLoader = (nuxt.options.rsbuild.vue ||= {}).vueLoaderOptions ||= {}
      rsbuildLoader.compilerOptions = withTransform(rsbuildLoader.compilerOptions)
    })

    const composables = resolve(runtimeDir, 'composables')
    addImports([
      { name: 'defineAgentTool', from: composables },
      { name: 'useAgentTool', from: composables },
      { name: 'useAgentActivity', from: composables },
    ])

    addPlugin(resolve(runtimeDir, 'plugins/agent-tools.client'))
    if (navigate) {
      addPlugin(resolve(runtimeDir, 'plugins/navigate.client'))
    }

    if (!nuxt.options.dev || schemaOption === false) {
      return
    }
    const schemaPath = schemaOption ? resolve(nuxt.options.rootDir, schemaOption) : resolve(nuxt.options.buildDir, 'webmcp/schema.json')
    const schema: SchemaFile = { tools: [], routes: {} }
    let logged = false
    let writing = Promise.resolve()
    nuxt.hook('vite:serverCreated', (server, { isClient }) => {
      if (!isClient) {
        return
      }
      server.ws.on('nuxt:agent-tools', (update: unknown) => {
        if (!mergeSchemaUpdate(schema, update)) {
          return
        }
        const content = `${JSON.stringify(schema, null, 2)}\n`
        writing = writing.then(async () => {
          await mkdir(dirname(schemaPath), { recursive: true })
          await writeFile(schemaPath, content)
          if (!logged) {
            logged = true
            logger.info(`Writing the agent tools registered while you browse to \`${linkToAlias(schemaPath, nuxt)}\``)
          }
        }).catch((cause) => {
          buildDiagnostics.NUXT_B1031({ file: relative(nuxt.options.rootDir, schemaPath), cause })
        })
      })
    })
  },
})
