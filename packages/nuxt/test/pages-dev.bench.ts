/**
 * Dev server lifecycle benchmark.
 *
 * Simulates the real dev-mode page scanning workflow:
 * 1. Cold start — build routes from all files (initial page scan)
 * 2. Add file — a new page is created during development
 * 3. Remove file — a page is deleted during development
 * 4. No-op re-emit — layout/middleware change triggers route re-generation without fs change
 *
 * Branch-agnostic: uses `createPagesContext` when available (incremental path)
 * and falls back to `generateRoutesFromFiles` (full-rebuild path on main branch).
 */
import { bench, describe } from 'vitest'
import * as pagesUtils from '../src/pages/utils.ts'

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const pagesDir = 'pages'
const roots = [`${pagesDir}/`]

const mediumAppPaths = [
  `${pagesDir}/index.vue`, `${pagesDir}/about.vue`, `${pagesDir}/contact.vue`,
  `${pagesDir}/blog.vue`, `${pagesDir}/blog/[slug].vue`, `${pagesDir}/blog/index.vue`,
  `${pagesDir}/blog/categories.vue`, `${pagesDir}/blog/categories/[cat].vue`,
  `${pagesDir}/blog/tags/[tag].vue`, `${pagesDir}/users.vue`, `${pagesDir}/users/[id].vue`,
  `${pagesDir}/users/[id]/settings.vue`, `${pagesDir}/[...slug].vue`, `${pagesDir}/login.vue`,
  `${pagesDir}/dashboard.vue`, `${pagesDir}/dashboard/index.vue`,
  `${pagesDir}/dashboard/analytics.vue`, `${pagesDir}/dashboard/settings.vue`,
  `${pagesDir}/dashboard/settings/profile.vue`, `${pagesDir}/dashboard/settings/notifications.vue`,
  `${pagesDir}/dashboard/settings/security.vue`, `${pagesDir}/dashboard/projects.vue`,
  `${pagesDir}/dashboard/projects/[id].vue`, `${pagesDir}/dashboard/projects/[id]/tasks.vue`,
  `${pagesDir}/dashboard/projects/[id]/members.vue`, `${pagesDir}/api/auth.vue`,
  `${pagesDir}/api/users.vue`, `${pagesDir}/api/posts.vue`,
  `${pagesDir}/(admin)/manage.vue`, `${pagesDir}/(admin)/manage/users.vue`,
  `${pagesDir}/(admin)/manage/roles.vue`, `${pagesDir}/products.vue`,
  `${pagesDir}/products/index.vue`, `${pagesDir}/products/[category].vue`,
  `${pagesDir}/products/[category]/[id].vue`, `${pagesDir}/products/[[category]]/featured.vue`,
  `${pagesDir}/docs/[...slug].vue`, `${pagesDir}/docs/index.vue`,
  `${pagesDir}/pricing.vue`, `${pagesDir}/terms.vue`, `${pagesDir}/privacy.vue`,
  `${pagesDir}/faq.vue`, `${pagesDir}/support.vue`, `${pagesDir}/support/[ticket].vue`,
  `${pagesDir}/auth/login.vue`, `${pagesDir}/auth/register.vue`,
  `${pagesDir}/auth/forgot-password.vue`, `${pagesDir}/auth/reset-password/[token].vue`,
  `${pagesDir}/settings.vue`, `${pagesDir}/settings/index.vue`,
  `${pagesDir}/settings/account.vue`, `${pagesDir}/settings/billing.vue`,
]

function generateLargeAppPaths (): string[] {
  const files: string[] = [...mediumAppPaths]
  const sections = ['shop', 'learn', 'community', 'enterprise', 'developer']
  for (const section of sections) {
    files.push(`${pagesDir}/${section}.vue`)
    files.push(`${pagesDir}/${section}/index.vue`)
    for (let i = 0; i < 20; i++) {
      files.push(`${pagesDir}/${section}/page-${i}.vue`)
      if (i % 3 === 0) { files.push(`${pagesDir}/${section}/[id]-${i}.vue`) }
    }
    files.push(`${pagesDir}/${section}/[...slug].vue`)
  }
  return files
}

const largeAppPaths = generateLargeAppPaths()

// ---------------------------------------------------------------------------
// Branch-agnostic adapter
// ---------------------------------------------------------------------------

type ContextOptions = { roots: string[] }

/**
 * Adapter that wraps either the incremental `createPagesContext` API
 * (unrouting branch) or falls back to full `generateRoutesFromFiles` rebuilds
 * (main branch). Both branches export `generateRoutesFromFiles`; only the
 * unrouting branch exports `createPagesContext`.
 */
interface DevSimulator {
  /** Build the initial route tree from all files. */
  coldStart: () => void
  /** Emit routes from the current state (no fs change). */
  emit: () => void
  /** Add a single file and emit routes. */
  addFile: (path: string) => void
  /** Remove a single file and emit routes. */
  removeFile: (path: string) => void
}

function createSimulator (filePaths: string[], opts: ContextOptions): DevSimulator {
  const hasIncremental = 'createPagesContext' in pagesUtils

  if (hasIncremental) {
    // Incremental path: persistent tree with addFile/removeFile
    const createCtx = (pagesUtils as any).createPagesContext as typeof pagesUtils.createPagesContext
    let ctx = createCtx(opts)
    const files = filePaths.map(p => ({ path: p }))

    return {
      coldStart () {
        ctx = createCtx(opts)
        ctx.rebuild(files)
        ctx.emit()
      },
      emit () {
        ctx.emit()
      },
      addFile (path: string) {
        ctx.addFile(path)
        ctx.emit()
      },
      removeFile (path: string) {
        ctx.removeFile(path)
        ctx.emit()
      },
    }
  } else {
    // Full-rebuild path (main branch): generateRoutesFromFiles on every operation
    // Construct files in the format main branch expects (relativePath + absolutePath)
    const makeFiles = (paths: string[]) => paths.map(p => ({
      path: p,
      relativePath: p.replace(/^pages\//, ''),
      absolutePath: p,
    }))
    const allFiles = makeFiles(filePaths)

    return {
      coldStart () {
        pagesUtils.generateRoutesFromFiles(allFiles as any)
      },
      emit () {
        pagesUtils.generateRoutesFromFiles(allFiles as any)
      },
      addFile (path: string) {
        pagesUtils.generateRoutesFromFiles(makeFiles([...filePaths, path]) as any)
      },
      removeFile (path: string) {
        pagesUtils.generateRoutesFromFiles(makeFiles(filePaths.filter(p => p !== path)) as any)
      },
    }
  }
}

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

const newFile = `${pagesDir}/new-feature/dashboard.vue`
const existingFile = largeAppPaths[Math.floor(largeAppPaths.length / 2)]!

describe(`dev server simulation — medium app (${mediumAppPaths.length} files)`, () => {
  const sim = createSimulator(mediumAppPaths, { roots })
  sim.coldStart()

  bench('cold start (initial build + emit)', () => {
    sim.coldStart()
  })

  bench('emit (no fs change)', () => {
    sim.emit()
  })

  bench('add file + emit', () => {
    sim.addFile(newFile)
    sim.removeFile(newFile) // reset
  })

  bench('remove file + emit', () => {
    sim.removeFile(mediumAppPaths[Math.floor(mediumAppPaths.length / 2)]!)
    sim.addFile(mediumAppPaths[Math.floor(mediumAppPaths.length / 2)]!) // reset
  })
})

describe(`dev server simulation — large app (${largeAppPaths.length} files)`, () => {
  const sim = createSimulator(largeAppPaths, { roots })
  sim.coldStart()

  bench('cold start (initial build + emit)', () => {
    sim.coldStart()
  })

  bench('emit (no fs change)', () => {
    sim.emit()
  })

  bench('add file + emit', () => {
    sim.addFile(newFile)
    sim.removeFile(newFile) // reset
  })

  bench('remove file + emit', () => {
    sim.removeFile(existingFile)
    sim.addFile(existingFile) // reset
  })
})
