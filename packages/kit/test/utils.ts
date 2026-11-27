import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'pathe'

/** File contents keyed by path; objects are written as JSON. */
export type FixtureFiles = Record<string, string | Record<string, unknown>>

export async function writeFiles (dir: string, files: FixtureFiles) {
  await Promise.all(Object.entries(files).map(async ([path, contents]) => {
    const file = join(dir, path)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, typeof contents === 'string' ? contents : JSON.stringify(contents))
  }))
}

/** Files for a package installed in `node_modules`, with `source` as its entry. */
export function fakePackage (name: string, source: string, pkg: Record<string, unknown> = {}): FixtureFiles {
  const entry = typeof pkg.exports === 'string' ? pkg.exports : './index.js'
  return {
    [`node_modules/${name}/package.json`]: { name, version: '1.0.0', type: 'module', exports: entry, ...pkg },
    [`node_modules/${name}/${entry}`]: source,
  }
}

/** Creates a directory outside the workspace, so resolution cannot reach the repository's `node_modules`. */
export async function createTempDir (prefix = 'nuxt-kit-') {
  return realpath(await mkdtemp(join(tmpdir(), prefix)))
}

export async function withTempDir<T> (files: FixtureFiles, fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await createTempDir()
  try {
    await writeFiles(dir, files)
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
