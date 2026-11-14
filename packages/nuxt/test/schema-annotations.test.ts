import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { exec } from 'tinyexec'
import * as jiti from 'jiti'
import untypedPlugin from 'untyped/babel-plugin'
import { generateTypes, resolveSchema } from 'untyped'
import { annotateSchemaSource } from '../src/core/utils/schema-annotations.ts'
import { createSchemaJiti } from '../src/core/utils/schema-loader.ts'

const cases: Record<string, string> = {
  'literals': `export default {
  /** A title */
  title: 'value',
  /**
   * A title
   *
   * With a description
   * over two lines.
   */
  described: 1,
  /** No value */
  empty: undefined,
  /** Nullish */
  nothing: null,
  /** A function */
  fn: () => 'value',
  /** An array */
  list: ['a', 'b'],
}`,
  'tags': `export default {
  /**
   * Typed
   * @type {123 | 456}
   */
  typed: 123,
  /**
   * Imported type
   * @type {typeof import('vue')['App']}
   */
  imported: null,
  /** @type {'a' | 'b'} */
  union: 'a',
  /**
   * Deprecated
   * @deprecated use \`typed\`
   * @required
   * @example
   * \`\`\`ts
   * export default {
   *   typed: 456,
   * }
   * \`\`\`
   */
  tagged: true,
  /**
   * @typedef {import('./types').Foo} Foo
   * @type {Foo | Record<string, Foo>}
   */
  aliased: {},
  /**
   * Description with a code block
   *
   * \`\`\`js
   * const a = 1
   *
   * const b = 2
   * \`\`\`
   * after the code block
   */
  code: 1,
}`,
  'objects': `export default defineNuxtSchema({
  appConfig: {
    /** An object */
    nested: {
      /** Inner */
      inner: 'value',
      other: 1,
    },
    /** An empty object */
    empty: {},
    /** With \`$schema\` */
    withSchema: {
      $schema: { tsType: 'string', title: 'overridden' },
      $default: 'value',
    },
    /** With an empty \`$schema\` */
    emptySchema: { $schema: {}, $default: 1 },
    /** With a \`$schema\` that is not an object */
    otherSchema: { $schema: null, $default: 1 },
    /** With \`$schema\` and a trailing comma */
    trailing: {
      $schema: {
        tsType: 'number',
      },
      $default: 1,
    },
    /** Annotated inside \`$schema\` */
    insideSchema: {
      $schema: {
        /** Inner */
        tsType: 'number' },
      $default: 1,
    },
  },
})`,
  'comments': `export default {
  // A line comment
  line: 1,
  /* A block comment */
  block: 2,
  a: 1, /** after a comma */ b: 2,
  c: 3 /** before a comma */, d: 4,
  e: 5, // trailing a property
  /** Leading the next one */
  f: 6,
  /** First */
  /** Second */
  g: 7,
  ...{ spread: true },
  /** After a spread */
  h: 8,
  i: {
    j: 1,
    /** Last property */
    k: 2,
    /** Dangling */
  },
}`,
  'syntax': `const shorthand = 'value'
const key = 'computed'
type Options = { a: number }
export default {
  /** Shorthand */
  shorthand,
  /** Computed */
  [key]: 1,
  /** String key */
  'string-key': 2,
  /** Cast */
  cast: 'value' as string,
  /** Cast object */
  castObject: { a: 1 } as Options,
  /** Satisfies */
  satisfied: { a: 1 } satisfies Options,
  /** Parenthesised */
  parens: ({ a: 1 }),
  /** Sequence */
  sequence: (0, 'last'),
  /** Method */
  method () { return 1 },
  /** Getter */
  get getter () { return 1 },
  /** Ünïcödé ✨ */
  unicode: '✨',
  /** Call */
  call: [1, 2].map(n => ({ /** In a callback */ n })),
  /** Conditional */
  conditional: true ? { /** In a branch */ x: 1 } : null,
}`,
  'angle-brackets': `export default {
  /** Angle-bracket cast */
  angle: <number>3,
}`,
  'imports': `import child from './child.ts'
export default {
  /** Imported */
  child,
  spread: { ...child },
}`,
  'functions': `const arrow = () => ({
  /** From an arrow function */
  value: 1,
})
export default {
  /** A factory */
  made: arrow(),
}`,
}

const files: Record<string, string> = {
  'child.ts': `export default {
  /** In a child */
  inChild: 'value',
}`,
}

let dir: string

beforeAll(async () => {
  // @ts-expect-error `defineNuxtSchema` is a global in schema files
  globalThis.defineNuxtSchema = (value: unknown) => value
  dir = await mkdtemp(join(tmpdir(), 'nuxt-schema-annotations-'))
  for (const [name, source] of Object.entries({ ...files, ...Object.fromEntries(Object.entries(cases).map(([name, source]) => [`${name}.ts`, source])) })) {
    await mkdir(dirname(join(dir, name)), { recursive: true })
    await writeFile(join(dir, name), source)
  }
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

const withPlugin = () => jiti.createJiti(import.meta.url, { fsCache: false, moduleCache: false, transformOptions: { babel: { plugins: [untypedPlugin] } } })

async function output (definition: any) {
  const schema = await resolveSchema(definition)
  return {
    json: JSON.stringify(schema, null, 2),
    types: generateTypes(schema, { addExport: true, interfaceName: 'NuxtCustomSchema', partial: true, allowExtraKeys: false }),
  }
}

describe('annotateSchemaSource', () => {
  it.each(Object.keys(cases))('matches untyped/babel-plugin for %s', async (name) => {
    const file = join(dir, `${name}.ts`)
    const expected = await withPlugin().import(file, { default: true })
    const actual = await createSchemaJiti(jiti, import.meta.url).import(file, { default: true })

    expect(JSON.stringify(actual, null, 2)).toBe(JSON.stringify(expected, null, 2))
    expect(await output(actual)).toEqual(await output(expected))
  })

  it('picks up edits through the same jiti instance', async () => {
    const entry = join(dir, 'jiti-reload/nuxt.schema.ts')
    const child = join(dir, 'jiti-reload/options.ts')
    await mkdir(dirname(entry), { recursive: true })
    const write = (version: number) => Promise.all([
      writeFile(entry, `import options from './options'\nexport default { version: ${version}, options }`),
      writeFile(child, `export default {\n  /** Version ${version} */\n  value: ${version},\n}`),
    ])
    const loader = createSchemaJiti(jiti, import.meta.url)
    await write(1)
    const first = await loader.import(entry, { default: true })
    await write(2)
    const second = await loader.import(entry, { default: true })

    expect(first).toMatchObject({ version: 1, options: { value: { $default: 1, $schema: { title: 'Version 1' } } } })
    expect(second).toMatchObject({ version: 2, options: { value: { $default: 2, $schema: { title: 'Version 2' } } } })
  })

  it('keeps every line in place', () => {
    for (const source of Object.values(cases)) {
      expect(annotateSchemaSource(source, 'nuxt.schema.ts').split('\n').length).toBe(source.split('\n').length)
    }
  })

  it('leaves files without comments or with syntax errors untouched', () => {
    expect(annotateSchemaSource('export default { a: 1 }', 'nuxt.schema.ts')).toBe('export default { a: 1 }')
    expect(annotateSchemaSource('export default { /** a */ a: }', 'nuxt.schema.ts')).toBe('export default { /** a */ a: }')
  })
})

// The test runner's own module loader would intercept the native imports, so they run in a plain
// node process.
const loaderEntry = pathToFileURL(fileURLToPath(new URL('../src/core/utils/schema-loader.ts', import.meta.url))).href
async function importNatively (script: string) {
  const { stdout, stderr } = await exec(process.execPath, ['--input-type=module', '-e', `globalThis.defineNuxtSchema = value => value\nconst { importSchema } = await import(${JSON.stringify(loaderEntry)})\n${script}`])
  const line = stdout.trim().split('\n').at(-1)
  if (!line?.startsWith('{')) {
    throw new Error(`import failed:\n${stdout}\n${stderr}`)
  }
  return JSON.parse(line)
}

describe('importSchema', () => {
  it('matches untyped/babel-plugin', async () => {
    const files = Object.keys(cases).filter(name => name !== 'angle-brackets').map(name => join(dir, `${name}.ts`))
    const results = await importNatively(`const results = {}
for (const file of ${JSON.stringify(files)}) {
  results[file] = JSON.stringify(await importSchema(file), null, 2)
}
console.log(JSON.stringify(results))`)

    for (const file of files) {
      expect(results[file], file).toBe(JSON.stringify(await withPlugin().import(file, { default: true }), null, 2))
    }
  })

  it.each([
    ['ESM', 'ts', `import options from './options.ts'\\nexport default { version: \${version}, options }`, `export default {\\n  /** Version \${version} */\\n  value: \${version},\\n}`],
    ['CommonJS', 'cjs', `module.exports = { version: \${version}, options: require('./options.cjs') }`, `module.exports = {\\n  /** Version \${version} */\\n  value: \${version},\\n}`],
  ])('picks up edits to a %s schema file and its local imports', async (format, extension, entrySource, childSource) => {
    const folder = join(dir, `reload-${format}`)
    const entry = join(folder, `nuxt.schema.${extension}`)
    const child = join(folder, `options.${extension}`)
    const { first, second } = await importNatively(`const { mkdir, writeFile } = await import('node:fs/promises')
await mkdir(${JSON.stringify(folder)}, { recursive: true })
const write = (version) => Promise.all([
  writeFile(${JSON.stringify(entry)}, \`${entrySource}\`),
  writeFile(${JSON.stringify(child)}, \`${childSource}\`),
])
await write(1)
const first = await importSchema(${JSON.stringify(entry)})
await write(2)
const second = await importSchema(${JSON.stringify(entry)})
console.log(JSON.stringify({ first, second }))`)

    expect(first).toMatchObject({ version: 1, options: { value: { $default: 1, $schema: { title: 'Version 1' } } } })
    expect(second).toMatchObject({ version: 2, options: { value: { $default: 2, $schema: { title: 'Version 2' } } } })
  })

  it('reads the local imports of a schema file reached through a symlinked package', async () => {
    const real = join(dir, 'linked-real')
    const link = join(dir, 'linked-project/node_modules/linked-layer')
    await mkdir(real, { recursive: true })
    await mkdir(dirname(link), { recursive: true })
    await writeFile(join(real, 'nuxt.schema.mjs'), `import options from './options.mjs'\nexport default { options }`)
    await writeFile(join(real, 'options.mjs'), `export default {\n  /** Linked */\n  value: 1,\n}`)
    await symlink(real, link, 'dir')

    const schema = await importNatively(`console.log(JSON.stringify(await importSchema(${JSON.stringify(join(link, 'nuxt.schema.mjs'))})))`)
    expect(schema).toMatchObject({ options: { value: { $default: 1, $schema: { title: 'Linked' } } } })
  })
})
