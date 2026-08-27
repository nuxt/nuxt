import { mountProgress } from './progress'
import { createRenderer } from './renderer'

// the status line and progress bar work with or without the shader
mountProgress()

const canvas = document.querySelector<HTMLCanvasElement>('#nuxt-shader')
const slot = document.querySelector<HTMLElement>('#nuxt-logo-slot')

// Without WebGPU the lockup and the progress bar are the whole screen, so the
// canvas is dropped rather than left behind as an empty layer.
const renderer = !canvas || !slot || !navigator.gpu
  ? (canvas?.remove(), undefined)
  : createRenderer(canvas, slot, document.querySelector('.nuxt-lockup'))

if (canvas && renderer) {
  // the canvas fades in only once it has something to show
  renderer.onFirstFrame = () => canvas.classList.add('is-ready')
  renderer.ready.catch(() => canvas.remove())
  window.addEventListener('pagehide', () => renderer.dispose(), { once: true })
}

// Nothing moves unless this window is the one being looked at. Someone running
// several dev servers should only pay for the one in front of them, and hidden
// tabs are not enough: browsers keep animating an unfocused but visible window.
// `data-idle` also freezes the progress bar's CSS animation.
const setIdle = (idle: boolean) => {
  document.documentElement.toggleAttribute('data-idle', idle)
  renderer?.setPaused(idle)
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
