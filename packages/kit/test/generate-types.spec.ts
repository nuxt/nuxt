import { promises as fsp } from 'node:fs'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import type { Nuxt, NuxtConfig } from '@nuxt/schema'
import { defu } from 'defu'
import { join, normalize } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import ts from 'typescript'

import { loadNuxtConfig } from '../src/loader/config.ts'
import { loadNuxt } from '../src/loader/nuxt.ts'
import { _generateTypes, resolveLayerPaths, writeTypes } from '../src/template.ts'
import { getLayerDirectories } from 'nuxt/kit'

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Record<string, any> ? DeepPartial<T[P]> : T[P]
}

const mockNuxt = {
  options: {
    rootDir: '/my-app',
    srcDir: '/my-app',
    alias: {
      '~': '/my-app',
      'some-custom-alias': '/my-app/some-alias',
    },
    typescript: { includeWorkspace: false },
    buildDir: '/my-app/.nuxt',
    modulesDir: ['/my-app/node_modules', '/node_modules'],
    modules: [],
    extensions: ['.ts', '.mjs', '.js'],
    _layers: [{ config: { rootDir: '/my-app', srcDir: '/my-app' } }],
    _installedModules: [],
    _modules: [],
  },
  callHook: () => {},
} satisfies DeepPartial<Nuxt> as unknown as Nuxt

const mockNuxtWithOptions = (options: NuxtConfig) => defu({ options }, mockNuxt) as Nuxt

describe('tsConfig generation', () => {
  it('should add correct relative paths for aliases', async () => {
    const { tsConfig } = await _generateTypes(mockNuxt)
    expect(tsConfig.compilerOptions?.paths).toMatchInlineSnapshot(`
      {
        "some-custom-alias": [
          "../some-alias",
        ],
        "~": [
          "..",
        ],
      }
    `)
  })

  it('should add exclude for module paths', async () => {
    const { tsConfig } = await _generateTypes(mockNuxtWithOptions({
      modulesDir: ['/my-app/modules/test/node_modules', '/my-app/modules/node_modules', '/my-app/node_modules/@some/module/node_modules'],
    }))
    expect(tsConfig.exclude).toMatchInlineSnapshot(`
      [
        "../../node_modules",
        "../dist",
        "../.data",
        "../modules/*/runtime/server/**/*",
        "../layers/*/server/**/*",
        "../layers/*/modules/*/runtime/server/**/*",
        "../modules/*.*",
        "../nuxt.config.*",
        "../.config/nuxt.*",
        "../layers/*/nuxt.config.*",
        "../layers/*/.config/nuxt.*",
        "../layers/*/modules/**/*",
      ]
    `)
  })

  it('should not exclude node-context paths from legacy tsconfig', async () => {
    const { legacyTsConfig } = await _generateTypes(mockNuxt)
    // nuxt.config.* and .config/nuxt.* are intentionally in legacyInclude (node context)
    // and must NOT be excluded by the legacy tsconfig
    expect(legacyTsConfig.include).toEqual(expect.arrayContaining(['../nuxt.config.*', '../.config/nuxt.*']))
    expect(legacyTsConfig.exclude).not.toEqual(expect.arrayContaining(['../nuxt.config.*', '../.config/nuxt.*']))
  })

  it('should propagate user-defined excludes to legacy tsconfig', async () => {
    const { legacyTsConfig } = await _generateTypes(mockNuxtWithOptions({
      typescript: { tsConfig: { exclude: ['my-custom-exclude'] } },
    }))
    expect(legacyTsConfig.exclude).toContain('my-custom-exclude')
    // but computed app-only paths must still be absent
    expect(legacyTsConfig.exclude).not.toContain('../nuxt.config.*')
  })

  it('should add #build after #components to paths', async () => {
    const { tsConfig } = await _generateTypes(mockNuxtWithOptions({
      alias: {
        '~': '/my-app',
        '@': '/my-app',
        'some-custom-alias': '/my-app/some-alias',
        '#build': './build-dir',
        '#build/*': './build-dir/*',
        '#imports': './imports',
        '#components': './components',
      },
    }))

    expect(tsConfig.compilerOptions?.paths).toMatchObject({
      '~': [
        '..',
      ],
      'some-custom-alias': [
        '../some-alias',
      ],
      '@': [
        '..',
      ],
      '#imports': [
        './imports',
      ],
      '#components': [
        './components',
      ],
      '#build': [
        './build-dir',
      ],
      '#build/*': [
        './build-dir/*',
      ],
    })
  })
})

describe('resolveLayerPaths', () => {
  it('should include existing top-level test directories in node type paths', async () => {
    const rootDir = await fsp.mkdtemp(join(tmpdir(), 'nuxt-layer-paths-'))
    await Promise.all([
      fsp.mkdir(join(rootDir, 'app')),
      fsp.mkdir(join(rootDir, 'modules')),
      fsp.mkdir(join(rootDir, 'public')),
      fsp.mkdir(join(rootDir, 'server')),
      fsp.mkdir(join(rootDir, 'shared')),
      fsp.mkdir(join(rootDir, 'test'), { recursive: true }),
      fsp.mkdir(join(rootDir, 'tests'), { recursive: true }),
      fsp.mkdir(join(rootDir, 'test/nuxt'), { recursive: true }),
      fsp.mkdir(join(rootDir, 'tests/nuxt'), { recursive: true }),
    ])
    await Promise.all([
      fsp.writeFile(join(rootDir, 'test', 'unit.test.ts'), ''),
      fsp.writeFile(join(rootDir, 'tests', 'helpers.ts'), ''),
    ])

    try {
      const paths = resolveLayerPaths({
        root: rootDir,
        server: join(rootDir, 'server'),
        app: join(rootDir, 'app'),
        appLayouts: join(rootDir, 'app/layouts'),
        appMiddleware: join(rootDir, 'app/middleware'),
        appPages: join(rootDir, 'app/pages'),
        appPlugins: join(rootDir, 'app/plugins'),
        modules: join(rootDir, 'modules'),
        shared: join(rootDir, 'shared'),
        public: join(rootDir, 'public'),
      }, join(rootDir, '.nuxt'))

      expect(paths.node).toContain('../test/unit.test.ts')
      expect(paths.node).toContain('../tests/helpers.ts')
      expect(paths.node).not.toContain('../test/nuxt/**/*')
      expect(paths.node).not.toContain('../tests/nuxt/**/*')
      expect(paths.nuxt).not.toContain('../test/unit.test.ts')
      expect(paths.nuxt).not.toContain('../tests/helpers.ts')
    } finally {
      await fsp.rm(rootDir, { recursive: true, force: true })
    }
  })

  it('should skip missing top-level test directories', async () => {
    const rootDir = await fsp.mkdtemp(join(tmpdir(), 'nuxt-layer-paths-'))
    await Promise.all([
      fsp.mkdir(join(rootDir, 'app')),
      fsp.mkdir(join(rootDir, 'modules')),
      fsp.mkdir(join(rootDir, 'public')),
      fsp.mkdir(join(rootDir, 'server')),
      fsp.mkdir(join(rootDir, 'shared')),
    ])

    try {
      const paths = resolveLayerPaths({
        root: rootDir,
        server: join(rootDir, 'server'),
        app: join(rootDir, 'app'),
        appLayouts: join(rootDir, 'app/layouts'),
        appMiddleware: join(rootDir, 'app/middleware'),
        appPages: join(rootDir, 'app/pages'),
        appPlugins: join(rootDir, 'app/plugins'),
        modules: join(rootDir, 'modules'),
        shared: join(rootDir, 'shared'),
        public: join(rootDir, 'public'),
      }, join(rootDir, '.nuxt'))

      expect(paths.node).not.toContain('../test/**/*')
      expect(paths.node).not.toContain('../tests/**/*')
    } finally {
      await fsp.rm(rootDir, { recursive: true, force: true })
    }
  })

  it('should allow custom runtime test globs', async () => {
    const rootDir = await fsp.mkdtemp(join(tmpdir(), 'nuxt-layer-paths-'))
    await Promise.all([
      fsp.mkdir(join(rootDir, 'app')),
      fsp.mkdir(join(rootDir, 'modules')),
      fsp.mkdir(join(rootDir, 'public')),
      fsp.mkdir(join(rootDir, 'server')),
      fsp.mkdir(join(rootDir, 'shared')),
      fsp.mkdir(join(rootDir, 'test'), { recursive: true }),
    ])
    await fsp.writeFile(join(rootDir, 'test', 'unit.test.ts'), '')

    try {
      const paths = resolveLayerPaths({
        root: rootDir,
        server: join(rootDir, 'server'),
        app: join(rootDir, 'app'),
        appLayouts: join(rootDir, 'app/layouts'),
        appMiddleware: join(rootDir, 'app/middleware'),
        appPages: join(rootDir, 'app/pages'),
        appPlugins: join(rootDir, 'app/plugins'),
        modules: join(rootDir, 'modules'),
        shared: join(rootDir, 'shared'),
        public: join(rootDir, 'public'),
      }, join(rootDir, '.nuxt'), ['test/**/*'])

      expect(paths.nuxt).toContain('../test/**/*')
      expect(paths.node).not.toContain('../test/**/*')
    } finally {
      await fsp.rm(rootDir, { recursive: true, force: true })
    }
  })
})

describe('resolveLayerPaths with workspace config', async () => {
  const repoRoot = await findWorkspaceDir()

  it('should respect custom nuxt options', async () => {
    const nuxtOptions = await loadNuxtConfig({
      cwd: repoRoot,
      overrides: {
        _prepare: true,
        srcDir: 'app',
        dir: {
          modules: 'custom-modules',
          shared: 'custom-shared',
        },
      },
    })
    const [layer] = getLayerDirectories({ options: nuxtOptions } as Nuxt)
    const paths = resolveLayerPaths(layer!, nuxtOptions.buildDir)
    expect(paths.nitro).toEqual([
      '../custom-modules/*/runtime/server/**/*',
      '../layers/*/server/**/*',
      '../layers/*/modules/*/runtime/server/**/*',
    ])
    expect(paths.nuxt).toEqual(expect.arrayContaining([
      '../app/**/*',
      '../custom-modules/*/runtime/**/*',
      '../test/nuxt/**/*',
      '../tests/nuxt/**/*',
      '../layers/*/app/**/*',
      '../layers/*/modules/*/runtime/**/*',
    ]))
    expect(paths.node).toEqual(expect.arrayContaining([
      '../test/basic.test.ts',
      '../custom-modules/*.*',
      '../nuxt.config.*',
      '../.config/nuxt.*',
      '../layers/*/nuxt.config.*',
      '../layers/*/.config/nuxt.*',
      '../layers/*/modules/**/*',
    ]))
    expect(paths.nuxt).not.toContain('../test/**/*')
    expect(paths.nuxt).not.toContain('../tests/**/*')
    expect(paths.node).not.toContain('../tests/**/*')
    expect(paths.shared).toEqual([
      '../custom-shared/**/*',
      '../custom-modules/*/shared/**/*',
      '../layers/*/shared/**/*',
    ])
    expect(paths.sharedDeclarations).toEqual([
      '../custom-shared/**/*.d.ts',
      '../custom-modules/*/shared/**/*.d.ts',
      '../layers/*/shared/**/*.d.ts',
    ])
    expect(paths.globalDeclarations).toEqual([
      '../*.d.ts',
      '../layers/*/*.d.ts',
    ])
  })
})

describe('writeTypes', async () => {
  const repoRoot = await findWorkspaceDir()

  it('should include top-level test files in the node project without adding them to the app project', async () => {
    const fixtureDir = join(repoRoot, 'test/fixtures/minimal-types')
    const buildDir = join(fixtureDir, '.nuxt')
    const testDir = join(fixtureDir, 'tests')
    const testFile = join(testDir, 'utils.test.ts')
    const normalizedTestFile = normalize(testFile)
    let nuxt: Awaited<ReturnType<typeof loadNuxt>> | undefined

    await fsp.mkdir(testDir, { recursive: true })
    await fsp.writeFile(testFile, 'const a: number = "asdf";')

    try {
      nuxt = await loadNuxt({ cwd: fixtureDir, ready: false })
      await writeTypes(nuxt)

      const parseProject = (configName: string) => {
        const configPath = join(buildDir, configName)
        const config = ts.readConfigFile(configPath, ts.sys.readFile)
        return ts.parseJsonConfigFileContent(config.config, ts.sys, buildDir).fileNames
      }

      expect(parseProject('tsconfig.node.json').map(normalize)).toContain(normalizedTestFile)
      expect(parseProject('tsconfig.app.json').map(normalize)).not.toContain(normalizedTestFile)
    } finally {
      await nuxt?.close()
      await fsp.rm(testFile, { force: true })
      await fsp.rm(buildDir, { recursive: true, force: true })
      await fsp.rm(testDir, { recursive: true, force: true }).catch(() => undefined)
    }
  })

  it('should allow opting top-level runtime tests into the app project', async () => {
    const fixtureDir = join(repoRoot, 'test/fixtures/minimal-types')
    const buildDir = join(fixtureDir, '.nuxt')
    const testDir = join(fixtureDir, 'test')
    const testFile = join(testDir, 'utils.test.ts')
    const normalizedTestFile = normalize(testFile)
    let nuxt: Awaited<ReturnType<typeof loadNuxt>> | undefined

    await fsp.mkdir(testDir, { recursive: true })
    await fsp.writeFile(testFile, 'const a: number = "asdf";')

    try {
      nuxt = await loadNuxt({
        cwd: fixtureDir,
        ready: false,
        overrides: {
          typescript: {
            runtimeTestGlobs: ['test/**/*'],
          },
        },
      })
      await writeTypes(nuxt)

      const parseProject = (configName: string) => {
        const configPath = join(buildDir, configName)
        const config = ts.readConfigFile(configPath, ts.sys.readFile)
        return ts.parseJsonConfigFileContent(config.config, ts.sys, buildDir).fileNames
      }

      expect(parseProject('tsconfig.app.json').map(normalize)).toContain(normalizedTestFile)
      expect(parseProject('tsconfig.node.json').map(normalize)).not.toContain(normalizedTestFile)
    } finally {
      await nuxt?.close()
      await fsp.rm(testFile, { force: true })
      await fsp.rm(buildDir, { recursive: true, force: true })
      await fsp.rm(testDir, { recursive: true, force: true }).catch(() => undefined)
    }
  })

  it('should keep default nuxt runtime test files in the app project', async () => {
    const fixtureDir = join(repoRoot, 'test/fixtures/minimal-types')
    const buildDir = join(fixtureDir, '.nuxt')
    const testDir = join(fixtureDir, 'test/nuxt')
    const testFile = join(testDir, 'runtime.test.ts')
    const normalizedTestFile = normalize(testFile)
    let nuxt: Awaited<ReturnType<typeof loadNuxt>> | undefined

    await fsp.mkdir(testDir, { recursive: true })
    await fsp.writeFile(testFile, 'const a: number = "asdf";')

    try {
      nuxt = await loadNuxt({ cwd: fixtureDir, ready: false })
      await writeTypes(nuxt)

      const parseProject = (configName: string) => {
        const configPath = join(buildDir, configName)
        const config = ts.readConfigFile(configPath, ts.sys.readFile)
        return ts.parseJsonConfigFileContent(config.config, ts.sys, buildDir).fileNames
      }

      expect(parseProject('tsconfig.app.json').map(normalize)).toContain(normalizedTestFile)
      expect(parseProject('tsconfig.node.json').map(normalize)).not.toContain(normalizedTestFile)
    } finally {
      await nuxt?.close()
      await fsp.rm(testFile, { force: true })
      await fsp.rm(buildDir, { recursive: true, force: true })
      await fsp.rm(testDir, { recursive: true, force: true }).catch(() => undefined)
      await fsp.rm(join(fixtureDir, 'test'), { recursive: true, force: true }).catch(() => undefined)
    }
  })
})
