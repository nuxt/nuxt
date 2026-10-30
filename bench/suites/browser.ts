import type { Browser, Page } from 'playwright-core'
import { chromium } from 'playwright-core'
import type { Interaction } from '../lib/fixtures.ts'
import { waitForHttp } from '../lib/proc.ts'
import type { Metric } from '../lib/report.ts'
import { timing } from '../lib/report.ts'
import { compareHeaders, compareRow, formatMs, markdownTable } from '../lib/stats.ts'
import type { SuiteContext, SuiteResult } from '../lib/suite.ts'
import { interleave } from '../lib/suite.ts'
import { ensureBuilt, startProduction } from './render.ts'

const CPU_SLOWDOWN = 8

interface PageState {
  longtasks: [start: number, duration: number][]
  events: number[]
  hydrated: number | null
  fcp: number | null
  input: number | null
  done: number | null
}

type BenchWindow = Window & { __bench: PageState }

interface Sample {
  hydration: number
  tbt: number
  longestTask: number
  scripts: number
  /** Longest Event Timing duration and milliseconds from the first input event until `done` held, per interaction. */
  interactions: { duration: number, done: number }[]
}

function instrument () {
  const state: PageState = { longtasks: [], events: [], hydrated: null, fcp: null, input: null, done: null }
  ;(window as unknown as BenchWindow).__bench = state
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      state.longtasks.push([entry.startTime, entry.duration])
    }
  }).observe({ type: 'longtask', buffered: true })
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as PerformanceEventTiming[]) {
      if (entry.interactionId) {
        state.events.push(entry.duration)
      }
    }
  }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit)
  new PerformanceObserver((list) => {
    state.fcp ??= list.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null
  }).observe({ type: 'paint', buffered: true })
  for (const type of ['pointerdown', 'keydown']) {
    addEventListener(type, () => { state.input ??= performance.now() }, { capture: true })
  }
  Object.defineProperty(HTMLElement.prototype, '__vue_app__', {
    configurable: true,
    set (app) {
      Object.defineProperty(this, '__vue_app__', { value: app, configurable: true, writable: true })
      if (app.$nuxt?.isHydrating) {
        app.$nuxt.hooks.hookOnce('app:suspense:resolve', () => { state.hydrated = performance.now() })
      } else {
        state.hydrated = performance.now()
      }
    },
  })
}

/** Resolves once no long task has started for 500 ms. */
function settle (page: Page) {
  return page.evaluate(() => new Promise<void>((resolve) => {
    let last = performance.now()
    new PerformanceObserver(() => { last = performance.now() }).observe({ type: 'longtask' })
    const check = () => requestAnimationFrame(() => setTimeout(() => {
      if (performance.now() - last > 500) {
        resolve()
      } else {
        check()
      }
    }, 100))
    check()
  }))
}

async function measure (browser: Browser, url: string, interactions: Interaction[]): Promise<Sample> {
  const context = await browser.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true })
  try {
    const page = await context.newPage()
    const errors: string[] = []
    page.on('console', (message) => {
      if ((message.type() === 'error' || message.type() === 'warning') && !message.location().url.endsWith('/favicon.ico')) {
        errors.push(`[${message.type()}] ${message.text()}`)
      }
    })
    page.on('pageerror', error => errors.push(`[pageerror] ${error.message}`))

    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN })
    let scripts = 0
    cdp.on('Network.responseReceived', (event) => {
      if (event.type === 'Script') {
        scripts++
      }
    })

    await page.addInitScript(instrument)
    await page.goto(url, { waitUntil: 'load' })
    await page.waitForFunction(() => (window as unknown as BenchWindow).__bench.hydrated !== null, null, { timeout: 60_000 })
    await settle(page)
    const loadScripts = scripts
    const load = await page.evaluate(() => {
      const state = (window as unknown as BenchWindow).__bench
      return { hydrated: state.hydrated!, fcp: state.fcp ?? 0, longtasks: state.longtasks.slice() }
    })

    const results: Sample['interactions'] = []
    for (const interaction of interactions) {
      const before = await page.evaluate(() => {
        const state = (window as unknown as BenchWindow).__bench
        state.input = state.done = null
        return state.events.length
      })
      const done = page.waitForFunction(`window.__bench.input !== null && (${interaction.done})() && (window.__bench.done = performance.now() - window.__bench.input, true)`, null, { polling: 'raf', timeout: 30_000 })
        .then(() => undefined, (error: Error) => error)
      await interaction.run(page)
      const error = await done
      if (error) {
        throw new Error(`\`${interaction.name}\` did not complete on ${url}: ${error.message}`)
      }
      await settle(page)
      results.push(await page.evaluate((from) => {
        const state = (window as unknown as BenchWindow).__bench
        return { duration: Math.max(0, ...state.events.slice(from)), done: state.done! }
      }, before))
    }

    if (errors.length) {
      throw new Error(`errors on ${url}:\n${errors.join('\n')}`)
    }
    const longtasks = load.longtasks
    return {
      hydration: load.hydrated,
      tbt: longtasks.filter(([start]) => start >= load.fcp).reduce((total, [, duration]) => total + Math.max(0, duration - 50), 0),
      longestTask: Math.max(0, ...longtasks.map(([, duration]) => duration)),
      scripts: loadScripts,
      interactions: results,
    }
  } finally {
    await context.close()
  }
}

export async function browserSuite ({ targets, fixtures, reps, log }: SuiteContext): Promise<SuiteResult> {
  const rows: string[][] = []
  const headline: Metric[] = []
  const data: Record<string, Record<string, Sample[]>> = {}

  const browser = await chromium.launch()
  try {
    for (const fixture of fixtures) {
      for (const target of targets) {
        await ensureBuilt(target, fixture, message => log(`browser: ${message}`))
      }
      log(`browser: ${fixture.id}`)
      const route = fixture.routes[0]!
      const interactions = fixture.interactions ?? []
      const servers = targets.map(target => startProduction(target, fixture))
      try {
        for (const { server, url } of servers) {
          await waitForHttp(url + route.path, { match: route.match, server, timeout: 30_000 })
        }
        const samples = await interleave(targets, reps, target => measure(browser, servers.find(s => s.target === target)!.url + route.path, interactions))
        const [baseline, head] = targets.map(target => samples.get(target)!) as [Sample[], Sample[]]
        data[fixture.id] = { baseline, head }

        const label = `${fixture.id} / \`${route.path}\``
        const metric = (name: string, value: (sample: Sample) => number, format = formatMs) => {
          rows.push(compareRow(`${label} / ${name}`, baseline.map(value), head.map(value), format))
        }
        metric('hydrated', s => s.hydration)
        metric('TBT', s => s.tbt)
        metric('longest task', s => s.longestTask)
        metric('JS requests', s => s.scripts, String)
        const inp = (s: Sample) => Math.max(0, ...s.interactions.map(i => i.duration))
        if (interactions.length) {
          metric('slowest interaction', inp)
        }
        interactions.forEach((interaction, index) => {
          metric(interaction.name, s => s.interactions[index]!.done)
        })

        headline.push(timing(`hydrated (${fixture.id})`, baseline.map(s => s.hydration), head.map(s => s.hydration), formatMs))
        if (interactions.length) {
          headline.push(timing(`slowest interaction (${fixture.id})`, baseline.map(inp), head.map(inp), formatMs))
        }
      } finally {
        for (const { server } of servers) {
          await server.stop()
        }
      }
    }
  } finally {
    await browser.close()
  }

  const markdown = [
    `Headless Chromium with a mobile viewport and ${CPU_SLOWDOWN}x CPU slowdown, no network throttling, loading the production server. _hydrated_ is the time from navigation to \`app:suspense:resolve\`; TBT and the longest task cover long tasks from first contentful paint until the page has been idle for 500 ms; JS requests include chunks imported after hydration. Then each interaction runs in order and is timed from its first input event until the page reflects it; _slowest interaction_ is the longest Event Timing entry across all of them, which the browser rounds to 8 ms. Fails on console errors or warnings, including hydration mismatches. Median of ${reps} interleaved runs after one warmup.`,
    '',
    '**These timings spread by up to 2x between runs of the same build.** Treat anything within the min / max range as noise, and use the `client` suite for regressions in what is loaded.',
    '',
    markdownTable(['Fixture / route / metric', ...compareHeaders.slice(1)], rows),
  ].join('\n')

  return { markdown, headline, data }
}
