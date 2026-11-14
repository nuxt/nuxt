import type { Page } from '@playwright/test'
import { expect, test } from './test-utils'
import { useTempFixture } from './temp-fixture'

const fixture = useTempFixture('dev-error-warnings')

test.use({
  nuxt: {
    rootDir: fixture.fixtureDir,
  },
})

test.describe.configure({ mode: 'serial' })

test.afterEach(() => fixture.restore())

const badgeOf = (page: Page) => page.locator('nuxt-error-overlay-badge .mb-badge')

/** The line the channel's open warning points at, read without touching the page's badge. */
function warningLine (page: Page): Promise<number | undefined> {
  return page.evaluate(async () => {
    const res = await fetch('/__nuxt_dev__/error/events?path=/ok', { headers: { accept: 'text/event-stream' } })
    const reader = res.body!.getReader()
    let text = ''
    while (!text.includes('\n\n')) {
      const { value, done } = await reader.read()
      if (done) { break }
      text += new TextDecoder().decode(value)
    }
    await reader.cancel()
    const hello = JSON.parse(/^data: (.*)$/m.exec(text)?.[1] ?? '{}') as { history?: Array<{ id: string, kind: string }> }
    const warning = hello.history?.find(entry => entry.kind === 'warning')
    if (!warning) { return undefined }
    const report = await (await fetch(`/__nuxt_dev__/error/history/${warning.id}`)).json() as { frames?: Array<{ line?: number }> }
    return report.frames?.[0]?.line
  })
}

function breakLink () {
  fixture.replace('app/pages/ok.vue', '    ok page\n', '    ok page\n    <NuxtLink to="/nowhere">\n      nowhere\n    </NuxtLink>\n')
}

test('shows a template warning on every open page, and retires it once fixed', async ({ page, goto }) => {
  await goto('/ok')
  const other = await page.context().newPage()
  try {
    await other.goto('/click-boom')
    await expect(other.locator('body')).toContainText('click boom healthy')
    await expect(badgeOf(page)).toBeHidden()

    breakLink()
    for (const open of [page, other]) {
      await expect(badgeOf(open)).toContainText('1 warning', { timeout: 30_000 })
    }

    fixture.restore()
    for (const open of [page, other]) {
      await expect(badgeOf(open)).toBeHidden({ timeout: 30_000 })
    }
  } finally {
    await other.close()
  }
})

test('opens a warning the page was rendered with from the badge, and stops showing it once fixed', async ({ page, goto }) => {
  breakLink()
  await goto('/ok')
  await badgeOf(page).click({ timeout: 30_000 })

  const overlay = page.locator('nuxt-error-overlay')
  await expect(overlay.locator('.mb-message')).toContainText('/nowhere')

  fixture.restore()
  await expect(overlay.getByText('/nowhere')).toHaveCount(0, { timeout: 30_000 })
  await expect(badgeOf(page)).toBeHidden()
})

test('updates a warning in place when a line is added above it', async ({ page, goto }) => {
  await page.addInitScript(() => {
    const log: { counts: string[], announcements: string[] } = { counts: [], announcements: [] }
    ;(window as unknown as { __badge: typeof log }).__badge = log
    const attach = () => {
      const root = document.querySelector('nuxt-error-overlay-badge')?.shadowRoot
      const status = root?.querySelector('[role="status"]')
      if (!root || !status) {
        return setTimeout(attach, 20)
      }
      const record = () => {
        const count = root.querySelector('button')?.hidden ? 'hidden' : root.querySelector('.mb-badge-count')?.textContent ?? ''
        if (log.counts.at(-1) !== count) {
          log.counts.push(count)
        }
      }
      new MutationObserver(record).observe(root, { subtree: true, childList: true, characterData: true, attributes: true })
      new MutationObserver(() => log.announcements.push(status.textContent ?? '')).observe(status, { subtree: true, childList: true, characterData: true })
      record()
    }
    addEventListener('DOMContentLoaded', attach)
  })
  await goto('/ok')
  breakLink()
  await expect(badgeOf(page)).toContainText('1 warning', { timeout: 30_000 })
  await expect.poll(() => page.evaluate(() => (window as unknown as { __badge: { announcements: string[] } }).__badge.announcements.length)).toBe(1)

  fixture.replace('app/pages/ok.vue', '    <NuxtLink to="/nowhere">\n', '    <span>moved</span>\n    <NuxtLink to="/nowhere">\n')
  await expect(page.locator('body')).toContainText('moved', { timeout: 30_000 })
  const { line } = fixture.positionOf('app/pages/ok.vue', 'to="/nowhere"')
  await expect.poll(() => warningLine(page), { timeout: 30_000 }).toBe(line)

  const log = await page.evaluate(() => (window as unknown as { __badge: { counts: string[], announcements: string[] } }).__badge)
  expect(log.counts).toEqual(['1 warning'])
  expect(log.announcements).toHaveLength(1)

  await badgeOf(page).click()
  await expect(page.locator('nuxt-error-overlay').locator('.mb-loc').first()).toContainText(`app/pages/ok.vue:${line}:`)
})
