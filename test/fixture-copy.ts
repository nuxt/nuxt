import { cpSync, readFileSync, rmSync } from 'node:fs'

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

/** 1-based position of `needle` within `contents`, as it should appear in a stack frame. */
export function positionIn (contents: string, file: string, needle: string): { line: number, column: number } {
  const lines = contents.split('\n')
  const index = lines.findIndex(line => line.includes(needle))
  if (index === -1) {
    throw new Error(`\`${needle}\` is no longer in \`${file}\`; update the fixture or the test`)
  }
  return { line: index + 1, column: lines[index]!.indexOf(needle) + 1 }
}
