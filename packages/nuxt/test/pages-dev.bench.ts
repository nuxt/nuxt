import { describe, test } from 'vitest'
import { createPagesContext } from '../src/pages/utils.ts'

const roots = ['pages/']
const inPages = (paths: string[]) => paths.map(path => `pages/${path}`)

const smallAppPaths = inPages([
  'index.vue', 'about.vue', 'contact.vue', 'blog.vue', 'blog/[slug].vue',
  'users.vue', 'users/[id].vue', 'users/[id]/settings.vue', '[...slug].vue', 'login.vue',
])

const mediumAppPaths = inPages([
  'index.vue', 'about.vue', 'contact.vue',
  'blog.vue', 'blog/[slug].vue', 'blog/index.vue',
  'blog/categories.vue', 'blog/categories/[cat].vue',
  'blog/tags/[tag].vue', 'users.vue', 'users/[id].vue',
  'users/[id]/settings.vue', '[...slug].vue', 'login.vue',
  'dashboard.vue', 'dashboard/index.vue',
  'dashboard/analytics.vue', 'dashboard/settings.vue',
  'dashboard/settings/profile.vue', 'dashboard/settings/notifications.vue',
  'dashboard/settings/security.vue', 'dashboard/projects.vue',
  'dashboard/projects/[id].vue', 'dashboard/projects/[id]/tasks.vue',
  'dashboard/projects/[id]/members.vue', 'api/auth.vue',
  'api/users.vue', 'api/posts.vue',
  '(admin)/manage.vue', '(admin)/manage/users.vue',
  '(admin)/manage/roles.vue', 'products.vue',
  'products/index.vue', 'products/[category].vue',
  'products/[category]/[id].vue', 'products/[[category]]/featured.vue',
  'docs/[...slug].vue', 'docs/index.vue',
  'pricing.vue', 'terms.vue', 'privacy.vue',
  'faq.vue', 'support.vue', 'support/[ticket].vue',
  'auth/login.vue', 'auth/register.vue',
  'auth/forgot-password.vue', 'auth/reset-password/[token].vue',
  'settings.vue', 'settings/index.vue',
  'settings/account.vue', 'settings/billing.vue',
])

const largeAppPaths = [...mediumAppPaths]
for (const section of ['shop', 'learn', 'community', 'enterprise', 'developer']) {
  largeAppPaths.push(`pages/${section}.vue`, `pages/${section}/index.vue`)
  for (let i = 0; i < 20; i++) {
    largeAppPaths.push(`pages/${section}/page-${i}.vue`)
    if (i % 3 === 0) { largeAppPaths.push(`pages/${section}/[id]-${i}.vue`) }
  }
  largeAppPaths.push(`pages/${section}/[...slug].vue`)
}

const apps = { small: smallAppPaths, medium: mediumAppPaths, large: largeAppPaths }
const newFile = 'pages/new-feature/dashboard.vue'

for (const [size, paths] of Object.entries(apps)) {
  describe(`dev server simulation - ${size} app (${paths.length} files)`, () => {
    const files = paths.map(path => ({ path }))
    const existingFile = paths[Math.floor(paths.length / 2)]!
    let ctx = createPagesContext({ roots })

    const coldStart = () => {
      ctx = createPagesContext({ roots })
      ctx.rebuild(files)
      ctx.emit()
    }
    coldStart()

    const cases: Record<string, () => void> = {
      'cold start (initial build + emit)': coldStart,
      'emit (no fs change)': () => ctx.emit(),
    }
    if (size !== 'small') {
      cases['add file + emit'] = () => {
        ctx.addFile(newFile)
        ctx.emit()
        ctx.removeFile(newFile)
        ctx.emit()
      }
      cases['remove file + emit'] = () => {
        ctx.removeFile(existingFile)
        ctx.emit()
        ctx.addFile(existingFile)
        ctx.emit()
      }
    }

    for (const [name, run] of Object.entries(cases)) {
      const title = `${name} - ${size} (${paths.length} files)`
      test(title, async ({ bench }) => {
        await bench(title, run).run()
      })
    }
  })
}
