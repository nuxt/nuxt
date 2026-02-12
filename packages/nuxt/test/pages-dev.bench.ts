import { bench, describe } from 'vitest'
import { generateRoutesFromFiles } from '../src/pages/utils.ts'

const pagesDir = 'pages'

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

function createSimulator (filePaths: string[]): DevSimulator {
  // Full-rebuild path (main branch): generateRoutesFromFiles on every operation
  const makeFiles = (paths: string[]) => paths.map(p => ({
    relativePath: p.replace(/^pages\//, ''),
    absolutePath: p,
  }))
  const allFiles = makeFiles(filePaths)

  return {
    coldStart () {
      generateRoutesFromFiles(allFiles)
    },
    emit () {
      generateRoutesFromFiles(allFiles)
    },
    addFile (path: string) {
      generateRoutesFromFiles(makeFiles([...filePaths, path]))
    },
    removeFile (path: string) {
      generateRoutesFromFiles(makeFiles(filePaths.filter(p => p !== path)))
    },
  }
}

const newFile = `${pagesDir}/new-feature/dashboard.vue`
const existingFile = largeAppPaths[Math.floor(largeAppPaths.length / 2)]!

describe(`dev server simulation - medium app (${mediumAppPaths.length} files)`, () => {
  const sim = createSimulator(mediumAppPaths)
  sim.coldStart()

  bench(`cold start (initial build + emit) - medium (${mediumAppPaths.length} files)`, () => {
    sim.coldStart()
  })

  bench(`emit (no fs change) - medium (${mediumAppPaths.length} files)`, () => {
    sim.emit()
  })

  bench(`add file + emit - medium (${mediumAppPaths.length} files)`, () => {
    sim.addFile(newFile)
    sim.removeFile(newFile) // reset
  })

  bench(`remove file + emit - medium (${mediumAppPaths.length} files)`, () => {
    sim.removeFile(mediumAppPaths[Math.floor(mediumAppPaths.length / 2)]!)
    sim.addFile(mediumAppPaths[Math.floor(mediumAppPaths.length / 2)]!) // reset
  })
})

describe(`dev server simulation - large app (${largeAppPaths.length} files)`, () => {
  const sim = createSimulator(largeAppPaths)
  sim.coldStart()

  bench(`cold start (initial build + emit) - large (${largeAppPaths.length} files)`, () => {
    sim.coldStart()
  })

  bench(`emit (no fs change) - large (${largeAppPaths.length} files)`, () => {
    sim.emit()
  })

  bench(`add file + emit - large (${largeAppPaths.length} files)`, () => {
    sim.addFile(newFile)
    sim.removeFile(newFile) // reset
  })

  bench(`remove file + emit - large (${largeAppPaths.length} files)`, () => {
    sim.removeFile(existingFile)
    sim.addFile(existingFile) // reset
  })
})
