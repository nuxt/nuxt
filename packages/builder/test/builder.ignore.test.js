import fs from 'fs'
import path from 'path'
import os from 'os'
import { loadNuxtConfig } from '@nuxt/config'
import { Nuxt } from '@nuxt/core'
import Builder from '../src/builder' // Adjust path as needed to import your local Builder class

/**
 * Write a minimal nuxt.config.js to the test directory
 */
function writeNuxtConfig (dir, config) {
  const configContent = `export default ${JSON.stringify(config, null, 2)}`
  fs.writeFileSync(path.join(dir, 'nuxt.config.js'), configContent, 'utf8')
}

describe('Integration Test: path.relative() error with ignore@5.x', () => {
  let tempDir

  const minimalConfig = {
    dev: false,
    build: { createRoutes: false },
    ignoreOptions: { allowRelativePaths: true },
    plugins: [],
    extensions: [],
    vue: {},
    router: {},
    features: {
      middleware: true
    }
  }

  beforeEach(() => {
    // Create a fresh temp directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nuxt-test-'))
    // 1. Create directories to mimic a Nuxt project
    // The main "apps/app" folder = srcDir in this scenario
    const appDir = path.join(tempDir, 'apps', 'app')
    fs.mkdirSync(appDir, { recursive: true })

    // Create a simple pages folder with an index.vue
    const pagesDir = path.join(appDir, 'pages')
    fs.mkdirSync(pagesDir, { recursive: true })
    fs.writeFileSync(
      path.join(pagesDir, 'index.vue'),
      `<template><div>Hello World</div></template>`
    )

    // The "middleware" folder is outside "apps/app"
    // so from "apps/app" it resolves to '../../middleware'
    const middlewareDir = path.join(tempDir, 'middleware')
    fs.mkdirSync(middlewareDir, { recursive: true })
    fs.writeFileSync(
      path.join(middlewareDir, 'auth.js'),
      `export default function (ctx) { console.log("HelloWorld from authMiddleware") }`
    )

    // 2. Write a minimal nuxt.config.js referencing middleware outside srcDir
    minimalConfig.rootDir = tempDir
    minimalConfig.srcDir = appDir
    minimalConfig.buildDir = path.join(appDir, '.nuxt')
  })

  afterEach(() => {
    // Remove the temp directory
    fs.rm(tempDir, { recursive: true })
  })

  test('No Error when middleware is outside srcDir', async () => {
    minimalConfig.dir = { middleware: '../../middleware' }
    writeNuxtConfig(tempDir, minimalConfig)

    const loadedConfig = await loadNuxtConfig({ rootDir: tempDir })
    const nuxt = new Nuxt(loadedConfig)
    await nuxt.ready()

    const builder = new Builder(nuxt)

    jest.spyOn(builder.bundleBuilder, 'build').mockResolvedValue()
    jest.spyOn(builder, 'addOptionalTemplates').mockResolvedValue()
    jest.spyOn(builder, 'resolveLoadingIndicator').mockResolvedValue()
    jest.spyOn(builder, 'compileTemplates').mockResolvedValue()

    let capturedError
    try {
      await builder.build() // or any async call that should throw
    } catch (err) {
      capturedError = err
    }

    expect(capturedError).toBeUndefined()
  })

  test('No Error when layouts is outside srcDir (example)', async () => {
    minimalConfig.dir = { layouts: '../../layouts' }

    // Create a layouts folder outside apps/app
    const layoutsDir = path.join(tempDir, 'layouts')
    fs.mkdirSync(layoutsDir, { recursive: true })
    fs.writeFileSync(
      path.join(layoutsDir, 'default.vue'),
      `<template><div>Default Layout</div></template>`
    )

    writeNuxtConfig(tempDir, minimalConfig)

    const loadedConfig = await loadNuxtConfig({ rootDir: tempDir })
    const nuxt = new Nuxt(loadedConfig)
    await nuxt.ready()

    const builder = new Builder(nuxt)

    jest.spyOn(builder.bundleBuilder, 'build').mockResolvedValue()
    jest.spyOn(builder, 'addOptionalTemplates').mockResolvedValue()
    jest.spyOn(builder, 'resolveLoadingIndicator').mockResolvedValue()
    jest.spyOn(builder, 'compileTemplates').mockResolvedValue()

    let capturedError
    try {
      await builder.build() // or any async call that should throw
    } catch (err) {
      capturedError = err
    }

    expect(capturedError).toBeUndefined()
  })
})
