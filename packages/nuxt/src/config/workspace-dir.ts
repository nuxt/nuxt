import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'pathe'

const JSONC_COMMENT_RE = /("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g
const JSONC_TRAILING_COMMA_RE = /("(?:\\.|[^"\\])*")|,(\s*[}\]])/g

function readText (path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}

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

function declaresWorkspace (dir: string): boolean {
  for (const [file, declaresWorkspace] of WORKSPACE_FILES) {
    const path = join(dir, file)
    if (!existsSync(path)) { continue }
    if (!declaresWorkspace || declaresWorkspace(readText(path))) {
      return true
    }
  }
  return false
}

/** Whether `dir` is the root of a git repository, worktree or submodule. */
function isGitRoot (dir: string): boolean {
  if (existsSync(join(dir, '.git/config'))) { return true }
  const gitFile = join(dir, '.git')
  return existsSync(gitFile) && readText(gitFile).startsWith('gitdir:')
}

function declaresPackageWorkspaces (path: string): boolean {
  try {
    return !!JSON.parse(readFileSync(path, 'utf8'))?.workspaces
  } catch {
    return false
  }
}

/**
 * Resolve the workspace directory of a project: the furthest directory with a file declaring a
 * workspace, the closest git repository, or the closest `package.json` declaring `workspaces`,
 * in that order. Falls back to `rootDir`.
 */
export function findWorkspaceDir (rootDir: string): string {
  const dirs: string[] = []
  for (let dir = rootDir; ; dir = dirname(dir)) {
    dirs.push(dir)
    if (dirname(dir) === dir) { break }
  }

  for (const dir of [...dirs].reverse()) {
    if (declaresWorkspace(dir)) { return dir }
  }

  for (const dir of dirs) {
    if (isGitRoot(dir)) { return dir }
  }

  for (const dir of dirs) {
    const path = join(dir, 'package.json')
    if (existsSync(path) && declaresPackageWorkspaces(path)) { return dir }
  }
  return rootDir
}
