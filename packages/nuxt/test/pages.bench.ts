import { bench, describe } from 'vitest'
import { generateRoutesFromFiles } from '../src/pages/utils.ts'

const pagesDir = 'pages'

function scanned (paths: string[]) {
  return paths.map(p => ({ relativePath: p.replace(`${pagesDir}/`, ''), absolutePath: p }))
}

const smallApp = scanned([
  `${pagesDir}/index.vue`,
  `${pagesDir}/about.vue`,
  `${pagesDir}/contact.vue`,
  `${pagesDir}/blog.vue`,
  `${pagesDir}/blog/[slug].vue`,
  `${pagesDir}/users.vue`,
  `${pagesDir}/users/[id].vue`,
  `${pagesDir}/users/[id]/settings.vue`,
  `${pagesDir}/[...slug].vue`,
  `${pagesDir}/login.vue`,
])

const mediumApp = scanned([
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
])

function generateLargeApp () {
  const files: string[] = mediumApp.map(f => `${pagesDir}/${f.relativePath}`)
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
  return scanned(files)
}

const largeApp = generateLargeApp()

describe('generateRoutesFromFiles', () => {
  bench(`small app (${smallApp.length} files)`, () => {
    generateRoutesFromFiles(smallApp)
  })

  bench(`medium app (${mediumApp.length} files)`, () => {
    generateRoutesFromFiles(mediumApp)
  })

  bench(`large app (${largeApp.length} files)`, () => {
    generateRoutesFromFiles(largeApp)
  })
})
