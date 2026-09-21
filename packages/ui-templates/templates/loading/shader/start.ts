import { createRenderer, isWinter } from './renderer'
import type { Renderer } from './renderer'

/** the key the previous snow easter egg used, so an existing choice carries over */
const SNOW_KEY = 'nuxt-snow'

function readSnowPreference (): boolean {
  try {
    return window.localStorage.getItem(SNOW_KEY) !== 'false'
  } catch {
    // storage can be unavailable or blocked
    return true
  }
}

/**
 * Winter is opt-out, and only offered while it is in season. The button ships
 * hidden in the markup rather than being created here, so the critical-CSS pass
 * keeps its styles.
 */
function mountSeasonToggle (renderer: Renderer) {
  const inSeason = isWinter()
  let enabled = readSnowPreference()
  renderer.setWinter(inSeason && enabled)
  if (!inSeason) { return }

  const button = document.querySelector<HTMLElement>('#nuxt-season')
  if (!button) { return }
  const paint = () => {
    // set inline: a selector that only matches after JS runs would be dropped
    button.style.opacity = enabled ? '1' : '0.4'
    button.setAttribute('aria-pressed', String(enabled))
    button.title = enabled ? 'Turn off snow' : 'Turn on snow'
  }
  paint()
  button.hidden = false
  button.addEventListener('click', () => {
    enabled = !enabled
    renderer.setWinter(enabled)
    paint()
    try {
      window.localStorage.setItem(SNOW_KEY, String(enabled))
    } catch {
      // the toggle still works for this page load
    }
  })
}

/** `?shader=0` forces the fallback, so it can be checked without a second browser */
function forcedOff (): boolean {
  try {
    const value = new URLSearchParams(window.location.search).get('shader')
    return value === '0' || value === 'false'
  } catch {
    return false
  }
}

function start () {
  const canvas = document.querySelector<HTMLCanvasElement>('#nuxt-shader')
  const slot = document.querySelector<HTMLElement>('#nuxt-logo-slot')

  // Without WebGL2 the lockup and the progress bar are the whole screen, so the
  // canvas is dropped rather than left behind as an empty layer.
  if (!canvas || !slot || !window.WebGL2RenderingContext || forcedOff()) {
    canvas?.remove()
    return
  }

  const renderer = createRenderer(canvas, slot, document.querySelector('.nuxt-lockup'))
  mountSeasonToggle(renderer)
  // Styles that only ever apply after JS runs are set inline: the build's
  // critical-CSS pass drops any selector absent from the initial markup.
  renderer.onFirstFrame = () => { canvas.style.opacity = '1' }
  renderer.ready.catch(() => canvas.remove())
  window.addEventListener('pagehide', () => renderer.dispose(), { once: true })

  // Nothing moves unless this window is the one being looked at. Someone running
  // several dev servers should only pay for the one in front of them, and hidden
  // tabs are not enough: browsers keep animating an unfocused but visible window.
  const setIdle = (idle: boolean) => renderer.setPaused(idle)
  const embedded = window !== window.top
  if (embedded) {
    // Preview iframes are usually unfocused; still draw so the grid stays useful.
    document.addEventListener('visibilitychange', () => setIdle(document.hidden))
    if (document.hidden) { setIdle(true) }
  } else {
    window.addEventListener('blur', () => setIdle(true))
    window.addEventListener('focus', () => setIdle(false))
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        setIdle(true)
      } else if (document.hasFocus()) {
        setIdle(false)
      }
    })
    if (document.hidden || !document.hasFocus()) {
      setIdle(true)
    }
  }
}

// The bundle is inlined into the template, and depending on how it is emitted
// that can land in <head> and run before the body exists.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true })
} else {
  start()
}
