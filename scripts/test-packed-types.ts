/**
 * Type-check a project that installs the packed packages and runs on Nitro v3.
 *
 * Inside the workspace, packages resolve to their sources, so a fixture cannot show what the
 * published declarations give a project.
 */
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const PACKAGES = ['kit', 'schema', 'nuxt', 'nitro-server', 'nitro-v3-server', 'vite']

// a store of its own for the project, so nothing resolves through packages another project hoisted
const env = { ...process.env, pnpm_config_virtual_store_dir: 'node_modules/.pnpm' }
const run = (command: string, args: string[], cwd: string) => execFileSync(command, args, { cwd, env, stdio: 'inherit' })
const readPackage = (dir: string) => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
const installedVersion = (name: string, from: string) => createRequire(join(repoRoot, from, 'package.json'))(`${name}/package.json`).version as string

const files: Record<string, string> = {
  'nuxt.config.ts': `export default defineNuxtConfig({ compatibilityDate: 'latest' })\n`,
  'tsconfig.json': JSON.stringify({
    files: [],
    references: ['app', 'server', 'shared', 'node'].map(name => ({ path: `./.nuxt/tsconfig.${name}.json` })),
  }),
  'app/app.vue': `<template>\n  <div>{{ useRequestURL().pathname }}</div>\n</template>\n`,
  'server/api/legacy.ts': [
    `export default defineEventHandler((event) => {`,
    `  // @ts-expect-error the method is a string`,
    `  const method: number = event.node.req.method`,
    `  // @ts-expect-error query values are strings`,
    `  const page: number = getQuery(event).page`,
    `  // @ts-expect-error the app config is an object`,
    `  const config: number = useAppConfig(event)`,
    `  return { method, page, config, path: event.path }`,
    `})`,
    ``,
  ].join('\n'),
  'server/plugins/response.ts': [
    `export default defineNitroPlugin((nitroApp) => {`,
    `  nitroApp.hooks.hook('render:response', (response) => {`,
    `    // @ts-expect-error the body is a string`,
    `    const body: number = response.body`,
    `    return void body`,
    `  })`,
    `})`,
    ``,
  ].join('\n'),
}

const dir = mkdtempSync(join(tmpdir(), 'nuxt-packed-types-'))
try {
  const tarballs = join(dir, 'tarballs')
  mkdirSync(tarballs)
  const overrides: Record<string, string> = {}
  for (const name of PACKAGES) {
    const packageDir = join(repoRoot, 'packages', name)
    const before = new Set(readdirSync(tarballs))
    run('pnpm', ['pack', '--pack-destination', tarballs], packageDir)
    const tarball = readdirSync(tarballs).find(file => !before.has(file))
    if (!tarball) {
      throw new Error(`pnpm pack did not produce a tarball for packages/${name}`)
    }
    overrides[readPackage(packageDir).name] = `file:${join(tarballs, tarball)}`
  }

  const project = join(dir, 'project')
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(project, path)), { recursive: true })
    writeFileSync(join(project, path), contents)
  }
  writeFileSync(join(project, 'package.json'), JSON.stringify({
    private: true,
    name: 'nuxt-packed-types',
    type: 'module',
    dependencies: {
      'nitro': readPackage(join(repoRoot, 'packages/nitro-v3-server')).peerDependencies.nitro,
      'nuxt': overrides.nuxt,
      'vue': installedVersion('vue', 'packages/nuxt'),
      'vue-router': installedVersion('vue-router', 'packages/nuxt'),
    },
    devDependencies: {
      '@types/node': installedVersion('@types/node', '.'),
      'typescript': installedVersion('typescript', '.'),
      'vue-tsc': installedVersion('vue-tsc', '.'),
    },
  }, null, 2))
  writeFileSync(join(project, 'pnpm-workspace.yaml'), [
    'overrides:',
    ...Object.entries(overrides).map(([name, target]) => `  ${JSON.stringify(name)}: ${JSON.stringify(target)}`),
    'allowBuilds:',
    '  esbuild: true',
    '  "@parcel/watcher": true',
    '',
  ].join('\n'))

  run('pnpm', ['install', '--no-frozen-lockfile'], project)
  run('pnpm', ['exec', 'nuxt', 'prepare'], project)
  run('pnpm', ['exec', 'vue-tsc', '-b', '--noEmit'], project)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  rmSync(dir, { recursive: true, force: true })
}
