import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { exec } from 'tinyexec'
import { join } from 'pathe'
import { projectSuffix, runsOnceInMatrix } from './matrix'

describe.skipIf(!runsOnceInMatrix)('a template whose contents never resolve', () => {
  const rootDir = fileURLToPath(new URL(`./fixtures/.hung-template-${projectSuffix}`, import.meta.url))

  afterAll(() => {
    rmSync(rootDir, { recursive: true, force: true })
  })

  it('fails the build and names the template', async () => {
    mkdirSync(rootDir, { recursive: true })
    writeFileSync(join(rootDir, 'package.json'), JSON.stringify({ private: true, type: 'module', name: 'fixture-hung-template' }))
    writeFileSync(join(rootDir, 'app.vue'), `<template><div>hung</div></template>`)
    writeFileSync(join(rootDir, 'nuxt.config.mjs'), [
      `export default {`,
      `  modules: [(_options, nuxt) => {`,
      `    nuxt.options.build.templates.push({ filename: 'never-settles.mjs', getContents: () => new Promise(() => {}) })`,
      `  }],`,
      `}`,
    ].join('\n'))

    const result = await exec('pnpm', ['nuxt', 'build', rootDir], { throwOnError: false })
    const output = result.stdout + result.stderr

    expect(result.exitCode).not.toBe(0)
    expect(output).toContain('NUXT_B1022')
    expect(output).toContain('never-settles.mjs')
  }, 120 * 1000)
})
