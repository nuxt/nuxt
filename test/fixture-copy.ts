import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'pathe'

/** Build output and sockets left behind by a previous run, which a copy must not carry over. */
const filter = (src: string) => !src.includes('.cache') && !src.endsWith('.sock') && !src.includes('.output') && !src.includes('.nuxt-')

/**
 * Copy `fixtures/<name>` to `fixtures-temp/<dest>`, so a suite that starts its own dev server
 * or rewrites files does not race the matrix project. The copy keeps the directory depth, so
 * the workspace symlinks under `node_modules` still resolve.
 */
export function copyFixture (name: string, dest: string): URL {
  const source = new URL(`./fixtures/${name}/`, import.meta.url)
  const target = new URL(`./fixtures-temp/${dest}/`, import.meta.url)
  rmSync(target, { force: true, recursive: true })
  cpSync(source, target, { recursive: true, filter })
  return target
}

/** 1-based position of `needle` within `file`, as it should appear in a stack frame. */
export function sourcePosition (fixtureURL: URL, file: string, needle: string): { line: number, column: number } {
  return positionIn(readFileSync(new URL(file, fixtureURL), 'utf8'), file, needle)
}

function positionIn (contents: string, file: string, needle: string): { line: number, column: number } {
  const lines = contents.split('\n')
  const index = lines.findIndex(line => line.includes(needle))
  if (index === -1) {
    throw new Error(`\`${needle}\` is no longer in \`${file}\`; update the fixture or the test`)
  }
  return { line: index + 1, column: lines[index]!.indexOf(needle) + 1 }
}

/** Checkouts on Windows have CRLF line endings, which the patterns tests match on do not. */
function readNormalised (path: string): string {
  return readFileSync(path, 'utf8').replaceAll('\r\n', '\n')
}

/**
 * Read and rewrite files of the fixture copy at `fixtureDir` while a suite runs.
 * `restore()` puts back every file the suite changed and removes the ones it created.
 */
export function editFixture (fixtureDir: string) {
  const originals = new Map<string, string | undefined>()

  function remember (file: string): string {
    const path = join(fixtureDir, file)
    if (!originals.has(file)) {
      originals.set(file, existsSync(path) ? readNormalised(path) : undefined)
    }
    return path
  }

  function read (file: string): string {
    return readNormalised(remember(file))
  }

  function write (file: string, contents: string): void {
    writeFileSync(remember(file), contents)
  }

  function remove (file: string): void {
    rmSync(remember(file), { force: true })
  }

  function restore (): void {
    for (const [file, contents] of originals) {
      const path = join(fixtureDir, file)
      const current = existsSync(path) ? readNormalised(path) : undefined
      if (current === contents) { continue }
      if (contents === undefined) {
        rmSync(path, { force: true })
      } else {
        writeFileSync(path, contents)
      }
    }
  }

  /** 1-based position of `needle` in `file`, as it appears in a stack frame. */
  function positionOf (file: string, needle: string): { line: number, column: number } {
    return positionIn(read(file), file, needle)
  }

  /** Replace `needle` in `file`, failing loudly when the fixture no longer contains it. */
  function replace (file: string, needle: string, replacement: string): void {
    const contents = read(file)
    if (!contents.includes(needle)) {
      throw new Error(`\`${needle}\` is no longer in \`${file}\`; update the fixture or the test`)
    }
    write(file, contents.replace(needle, replacement))
  }

  return { fixtureDir, positionOf, read, remove, replace, restore, write }
}
