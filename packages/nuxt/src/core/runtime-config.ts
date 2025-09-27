import { tryImportModule } from '@nuxt/kit'
import type { Nuxt, NuxtTemplate } from '@nuxt/schema'
import { dirname, resolve } from 'pathe'
import type ts from 'typescript'
import { type JSValue, generateTypes, resolveSchema } from 'untyped'
import { GenMapping, addMapping, toEncodedMap } from '@jridgewell/gen-mapping'
import { genObjectKey } from 'knitwork'
import type { Program } from 'typescript'

export function useRuntimeConfigTemplates () {
  const _ts = tryImportModule<typeof import('typescript')>('typescript')
  let program: Program
  let mapPromise: Promise<GenMapping>

  const runtimeConfigTemplate: NuxtTemplate = {
    filename: 'types/runtime-config.d.ts',
    getContents: async ({ nuxt }) => {
      let resolve: (map: GenMapping) => void
      mapPromise = new Promise<GenMapping>((_resolve) => {
        resolve = _resolve
      })

      let codegen: Generator<Code>
      const ts = await _ts
      if (ts) {
        program ||= createProgram(nuxt, ts)
        codegen = generate(generateWithTypeScript(nuxt, ts, program))
      } else {
        codegen = generate(await generateWithUntyped(nuxt))
      }

      let contents = ''
      let line = 1
      let column = 0
      const map = new GenMapping({ file: 'runtime-config.d.ts' })

      for (const code of codegen) {
        let str: string
        if (typeof code === 'object') {
          const [text, meta] = code
          for (const range of meta.ranges) {
            addMapping(map, {
              generated: {
                line,
                column,
              },
              source: range.fileName,
              original: {
                line: range.start.line + 1,
                column: range.start.character,
              },
              name: text,
            })
            addMapping(map, {
              generated: {
                line,
                column: column + text.length,
              },
              source: range.fileName,
              original: {
                line: range.end.line + 1,
                column: range.end.character,
              },
            })
          }
          str = text
        } else {
          str = code
        }
        contents += str
        line += str.split('\n').length - 1
        column = contents.split('\n').pop()?.length ?? 0
      }
      resolve!(map)

      return contents
    },
  }

  const runtimeConfigMappingTemplate: NuxtTemplate = {
    filename: 'types/runtime-config.d.ts.map',
    write: true,
    getContents: async () => {
      const map = await mapPromise
      return JSON.stringify(toEncodedMap(map))
    },
  }

  return {
    runtimeConfigTemplate,
    runtimeConfigMappingTemplate,
  }
}

type Code = string | [string, Meta]

function* generate (generator: Generator<Code> | Code[]): Generator<Code> {
  yield `import { RuntimeConfig as UserRuntimeConfig, PublicRuntimeConfig as UserPublicRuntimeConfig } from 'nuxt/schema'\n`

  yield* generator

  yield `
declare module '@nuxt/schema' {
  interface RuntimeConfig extends UserRuntimeConfig {}
  interface PublicRuntimeConfig extends UserPublicRuntimeConfig {}
}
declare module 'nuxt/schema' {
  interface RuntimeConfig extends SharedRuntimeConfig {}
  interface PublicRuntimeConfig extends SharedPublicRuntimeConfig {}
}
declare module 'vue' {
  interface ComponentCustomProperties {
    $config: UserRuntimeConfig
  }
}`
}

const MetaSymbol = Symbol('meta')

interface Item extends Record<string, Item> {
  [MetaSymbol]: Meta
}

interface Meta {
  ranges: Range[]
  types?: Set<string>
}

interface Range {
  fileName: string
  start: ts.LineAndCharacter
  end: ts.LineAndCharacter
}

function createProgram (nuxt: Nuxt, ts: typeof import('typescript')) {
  const configDir = resolve(nuxt.options.buildDir, 'tsconfig.node.json')
  const configFile = ts.readConfigFile(configDir, ts.sys.readFile)
  const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(configDir))
  const host = ts.createCompilerHost(parsedConfig.options)

  const { readFile } = host
  host.readFile = (fileName: string) => {
    if (fileName.endsWith('runtime-config.d.ts')) {
      return ''
    }
    const file = readFile?.call(host, fileName)
    if (fileName === nuxt.options._nuxtConfigFile) {
      return `${file}
const __NUXT_runtimeConfig = ${JSON.stringify(nuxt.options.runtimeConfig, null, 2)}
type __NUXT_DeepMerge<T, D> = T extends object
  ? T extends any[]
    ? T
    : { [K in keyof T]: __NUXT_DeepMerge<T[K], D[K]> }
    & { [K in Exclude<keyof D, keyof T>]?: D[K] }
  : T
declare function defineNuxtConfig<T>(config: T): __NUXT_DeepMerge<T, {
  runtimeConfig: typeof __NUXT_runtimeConfig
}>
`
    }
    return file
  }

  const program = ts.createProgram({
    rootNames: [nuxt.options._nuxtConfigFile],
    options: parsedConfig.options,
    host,
  })

  return program
}

function* generateWithTypeScript (nuxt: Nuxt, ts: typeof import('typescript'), program: Program): Generator<Code> {
  const sourceFile = program.getSourceFile(nuxt.options._nuxtConfigFile)
  if (!sourceFile) {
    return
  }

  const checker = program.getTypeChecker()
  let config: Record<string, Item> | undefined

  sourceFile.forEachChild((node) => {
    if (ts.isExportAssignment(node)) {
      const type = checker.getTypeAtLocation(node.expression)
      const properties = type.getProperties()
      const symbol = properties.find(p => p.name === 'runtimeConfig')
      if (symbol) {
        const type = checker.getTypeOfSymbol(symbol)
        config = accessTypes(type)
      }
    }
  })

  const publicConfig = config?.public
  delete config?.public
  yield `interface SharedRuntimeConfig `
  yield* generateObject(config ?? {})
  yield '\n'
  yield `interface SharedPublicRuntimeConfig `
  yield* generateObject(publicConfig ?? {})
  yield '\n'

  function accessTypes (type: ts.Type) {
    const result: Record<string, Item> = {}

    for (const property of getProperties(type.getNonNullableType())) {
      for (const declaration of property.getDeclarations() ?? []) {
        const symbol = (declaration as any).symbol as ts.Symbol | undefined
        if (!symbol || symbol.escapedName === ts.InternalSymbolName.Computed) { continue }

        const name = symbol.getName()
        result[name] ??= {
          [MetaSymbol]: {
            ranges: [],
          },
        }

        const sourceFile = declaration.getSourceFile()
        if (ts.isPropertyAssignment(declaration) || ts.isPropertySignature(declaration)) {
          result[name][MetaSymbol].ranges.push({
            fileName: sourceFile.fileName,
            start: sourceFile.getLineAndCharacterOfPosition(declaration.name.getStart()),
            end: sourceFile.getLineAndCharacterOfPosition(declaration.name.end),
          })
        }

        const propType = checker.getTypeOfSymbolAtLocation(property, declaration).getNonNullableType()
        if (isObjectLike(propType) && !checker.isArrayLikeType(propType)) {
          Object.assign(result[name], accessTypes(propType))
        } else {
          const type = checker.typeToString(propType, void 0, ts.TypeFormatFlags.InTypeAlias)
          ;(result[name][MetaSymbol].types ??= new Set()).add(type)
        }
      }
    }

    return result
  }

  function isObjectLike (type: ts.Type): type is ts.ObjectType {
    if (type.isUnionOrIntersection()) {
      return type.types.some(isObjectLike)
    }
    return (type.flags & ts.TypeFlags.Object) !== 0
  }
}

function getProperties (type: ts.Type): ts.Symbol[] {
  if (type.isUnionOrIntersection()) {
    return type.types.flatMap(getProperties)
  }
  return type.getProperties()
}

function* generateObject (obj: Record<string, Item>): Generator<Code> {
  yield `{\n`
  for (const [key, value] of Object.entries(obj)) {
    const meta = value[MetaSymbol]
    yield `  `
    yield [genObjectKey(key), meta]
    yield `: `
    if (meta.types) {
      yield [...meta.types].join(' | ')
    } else {
      yield* generateObject(value)
    }
    yield `\n`
  }
  yield `}`
}

async function generateWithUntyped (nuxt: Nuxt) {
  const privateRuntimeConfig = Object.create(null)
  for (const key in nuxt.options.runtimeConfig) {
    if (key !== 'public') {
      privateRuntimeConfig[key] = nuxt.options.runtimeConfig[key]
    }
  }

  const [privateSchema, publicSchema] = await Promise.all([
    resolveSchema(privateRuntimeConfig as Record<string, JSValue>),
    resolveSchema(nuxt.options.runtimeConfig.public as Record<string, JSValue>),
  ])

  return [
    generateTypes(privateSchema, {
      interfaceName: 'SharedRuntimeConfig',
      addExport: false,
      addDefaults: false,
      allowExtraKeys: false,
      indentation: 2,
    }),
    '\n',
    generateTypes(publicSchema, {
      interfaceName: 'SharedPublicRuntimeConfig',
      addExport: false,
      addDefaults: false,
      allowExtraKeys: false,
      indentation: 2,
    }),
  ]
}
