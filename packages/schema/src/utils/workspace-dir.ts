import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'pathe'

const DECLARES_DENO_WORKSPACE_RE = /"workspace"\s*:/

/** Workspace files, with the pattern a file has to match to declare a workspace. */
const WORKSPACE_FILES: Array<[file: string, declaresWorkspace?: RegExp]> = [
  ['pnpm-workspace.yaml', /^packages\s*:/m],
  ['lerna.json'],
  ['turbo.json'],
  ['rush.json'],
  ['deno.json', DECLARES_DENO_WORKSPACE_RE],
  ['deno.jsonc', DECLARES_DENO_WORKSPACE_RE],
]

async function declaresWorkspace (dir: string): Promise<boolean> {
  for (const [file, declaresWorkspace] of WORKSPACE_FILES) {
    const path = join(dir, file)
    if (!existsSync(path)) { continue }
    if (!declaresWorkspace || declaresWorkspace.test(await readFile(path, 'utf8').catch(() => ''))) {
      return true
    }
  }
  return false
}

async function declaresPackageWorkspaces (path: string): Promise<boolean> {
  try {
    return !!JSON.parse(await readFile(path, 'utf8'))?.workspaces
  } catch {
    return false
  }
}

/**
 * Resolve the workspace directory of a project: the furthest directory with a file declaring a
 * workspace, the closest git repository, or the closest `package.json` declaring `workspaces`,
 * in that order. Falls back to `rootDir`.
 */
export async function findWorkspaceDir (rootDir: string): Promise<string> {
  const dirs: string[] = []
  for (let dir = rootDir; ; dir = dirname(dir)) {
    dirs.push(dir)
    if (dirname(dir) === dir) { break }
  }

  for (const dir of [...dirs].reverse()) {
    if (await declaresWorkspace(dir)) { return dir }
  }

  const gitDir = dirs.find(dir => existsSync(join(dir, '.git/config')))
  if (gitDir) { return gitDir }

  for (const dir of dirs) {
    const path = join(dir, 'package.json')
    if (existsSync(path) && await declaresPackageWorkspaces(path)) { return dir }
  }
  return rootDir
}
