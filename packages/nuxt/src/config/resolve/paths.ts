import process from 'node:process'
import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'pathe'
import type { NuxtOptions } from '@nuxt/schema'

import { findWorkspaceDir } from '../workspace-dir.ts'
import { objectOrEmpty, string } from '../validate.ts'
import type { RawConfig } from '../validate.ts'

export type LayerDirOptions = Pick<NuxtOptions, 'rootDir' | 'srcDir' | 'serverDir' | 'dir'>
export type PathOptions = LayerDirOptions & Pick<NuxtOptions, 'workspaceDir' | 'buildDir' | 'typesDir' | 'modulesDir' | 'analyzeDir'>

const SRC_DIR_MARKERS = ['assets', 'layouts', 'middleware', 'pages', 'plugins'] as const

export function resolveLayerDirs (input: RawConfig): LayerDirOptions {
  const rootDir = typeof input.rootDir === 'string' ? resolve(input.rootDir) : process.cwd()
  const dirInput = objectOrEmpty(input.dir)

  const dir = {
    ...dirInput,
    assets: string('dir.assets', dirInput.assets, 'assets'),
    layouts: string('dir.layouts', dirInput.layouts, 'layouts'),
    middleware: string('dir.middleware', dirInput.middleware, 'middleware'),
    pages: string('dir.pages', dirInput.pages, 'pages'),
    plugins: string('dir.plugins', dirInput.plugins, 'plugins'),
    shared: string('dir.shared', dirInput.shared, 'shared'),
    modules: resolve(rootDir, string('dir.modules', dirInput.modules, 'modules')),
    public: resolve(rootDir, string('dir.public', dirInput.public, 'public')),
  }

  const srcDirInput = string('srcDir', input.srcDir, undefined)
  const srcDir = srcDirInput ? resolve(rootDir, srcDirInput) : detectSrcDir(rootDir, dir)
  const appDir = string('dir.app', dirInput.app, srcDir === rootDir ? 'app' : '.')

  return {
    rootDir,
    srcDir,
    serverDir: resolve(rootDir, string('serverDir', input.serverDir, 'server')),
    dir: { ...dir, app: resolve(srcDir, appDir) },
  }
}

/** `<rootDir>/app`, unless the project keeps its app files in `rootDir` itself. */
function detectSrcDir (rootDir: string, dir: Record<typeof SRC_DIR_MARKERS[number], string>): string {
  const srcDir = resolve(rootDir, 'app')
  if (!existsSync(srcDir)) {
    return rootDir
  }

  if (readDir(srcDir).some(file => file !== 'spa-loading-template.html' && !file.startsWith('router.options'))) {
    return srcDir
  }
  for (const file of ['app.vue', 'App.vue']) {
    if (existsSync(resolve(rootDir, file))) {
      return rootDir
    }
  }
  for (const key of SRC_DIR_MARKERS) {
    if (existsSync(resolve(rootDir, dir[key]))) {
      return rootDir
    }
  }
  return srcDir
}

function readDir (dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

export function resolvePaths (input: RawConfig): PathOptions {
  const layerDirs = resolveLayerDirs(input)
  const { rootDir } = layerDirs

  const workspaceDirInput = string('workspaceDir', input.workspaceDir, undefined)
  const buildDir = resolve(rootDir, string('buildDir', input.buildDir, '.nuxt'))
  const typesDirInput = string('typesDir', input.typesDir, undefined)
  const analyzeDirInput = string('analyzeDir', input.analyzeDir, undefined)

  const modulesDir = new Set([resolve(rootDir, 'node_modules')])
  if (Array.isArray(input.modulesDir)) {
    for (const dir of input.modulesDir) {
      if (dir && typeof dir === 'string') {
        modulesDir.add(resolve(rootDir, dir))
      }
    }
  }

  return {
    ...layerDirs,
    workspaceDir: workspaceDirInput ? resolve(rootDir, workspaceDirInput) : findWorkspaceDir(rootDir),
    buildDir,
    typesDir: typesDirInput ? resolve(rootDir, typesDirInput) : buildDir,
    modulesDir: [...modulesDir],
    analyzeDir: analyzeDirInput ? resolve(rootDir, analyzeDirInput) : resolve(buildDir, 'analyze'),
  }
}
