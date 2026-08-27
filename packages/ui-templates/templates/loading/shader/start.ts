import { mountProgress } from './progress'
import { createRenderer } from './renderer'

function start () {
  // the status line and progress bar work with or without the shader
  mountProgress()

  const canvas = document.querySelector<HTMLCanvasElement>('#nuxt-shader')
  const slot = document.querySelector<HTMLElement>('#nuxt-logo-slot')

  // Without WebGPU the lockup and the progress bar are the whole screen, so the
  // canvas is dropped rather than left behind as an empty layer.
  if (!canvas || !slot || !navigator.gpu) {
    canvas?.remove()
    return
  }

  const renderer = createRenderer(canvas, slot, document.querySelector('.nuxt-lockup'))
  // Styles that only ever apply after JS runs are set inline: the build's
  // critical-CSS pass drops any selector absent from the initial markup.
  renderer.onFirstFrame = () => { canvas.style.opacity = '1' }
  renderer.ready.catch(() => canvas.remove())
  window.addEventListener('pagehide', () => renderer.dispose(), { once: true })

  // Nothing moves unless this window is the one being looked at. Someone running
  // several dev servers should only pay for the one in front of them, and hidden
  // tabs are not enough: browsers keep animating an unfocused but visible
  // window. The progress bar's CSS animation is frozen alongside it.
  const bar = document.querySelector<HTMLElement>('#nuxt-progress-fill')
  const setIdle = (idle: boolean) => {
    if (bar) { bar.style.animationPlayState = idle ? 'paused' : '' }
    renderer.setPaused(idle)
  }
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

// The bundle is inlined into the template, and depending on how it is emitted
// that can land in <head> and run before the body exists.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true })
} else {
  start()
}
