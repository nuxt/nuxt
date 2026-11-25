import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'pathe'

const JSONC_COMMENT_RE = /("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g
const JSONC_TRAILING_COMMA_RE = /("(?:\\.|[^"\\])*")|,(\s*[}\]])/g

function declaresDenoWorkspace (contents: string): boolean {
  const json = contents
    .replace(JSONC_COMMENT_RE, (_, string = '') => string)
    .replace(JSONC_TRAILING_COMMA_RE, (_, string, close) => string ?? close)
  try {
    return !!JSON.parse(json)?.workspace
  } catch {
    return false
  }
}

/** Workspace files, with the check a file has to pass to declare a workspace. */
const WORKSPACE_FILES: Array<[file: string, declaresWorkspace?: (contents: string) => boolean]> = [
  ['pnpm-workspace.yaml', contents => /^packages\s*:/m.test(contents)],
  ['lerna.json'],
  ['turbo.json'],
  ['rush.json'],
  ['deno.json', declaresDenoWorkspace],
  ['deno.jsonc', declaresDenoWorkspace],
]

async function declaresWorkspace (dir: string): Promise<boolean> {
  for (const [file, declaresWorkspace] of WORKSPACE_FILES) {
    const path = join(dir, file)
    if (!existsSync(path)) { continue }
    if (!declaresWorkspace || declaresWorkspace(await readFile(path, 'utf8').catch(() => ''))) {
      return true
    }
  }
  return false
}

/** Whether `dir` is the root of a git repository, worktree or submodule. */
async function isGitRoot (dir: string): Promise<boolean> {
  if (existsSync(join(dir, '.git/config'))) { return true }
  const gitFile = await readFile(join(dir, '.git'), 'utf8').catch(() => '')
  return gitFile.startsWith('gitdir:')
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

  for (const dir of dirs) {
    if (await isGitRoot(dir)) { return dir }
  }

  for (const dir of dirs) {
    const path = join(dir, 'package.json')
    if (existsSync(path) && await declaresPackageWorkspaces(path)) { return dir }
  }
  return rootDir
}
