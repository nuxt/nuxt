import { mountProgress } from './progress'
import { createRenderer } from './renderer'

// the status line and progress bar work with or without the shader
mountProgress()

const canvas = document.querySelector<HTMLCanvasElement>('#nuxt-shader')
const slot = document.querySelector<HTMLElement>('#nuxt-logo-slot')

// Without WebGPU the lockup and the progress bar are the whole screen, so the
// canvas is dropped rather than left behind as an empty layer.
if (!canvas || !slot || !navigator.gpu) {
  canvas?.remove()
} else {
  const renderer = createRenderer(canvas, slot, document.querySelector('.nuxt-lockup'))
  // the canvas fades in only once it has something to show
  renderer.onFirstFrame = () => canvas.classList.add('is-ready')
  renderer.ready.catch(() => canvas.remove())
  window.addEventListener('pagehide', () => renderer.dispose(), { once: true })
}
