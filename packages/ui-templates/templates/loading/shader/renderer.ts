import shader from './mountains.wgsl?raw'

const COLS = 704
const ROWS = 260
const VERTEX_COUNT = COLS * ROWS * 6

/** cap the backing store so huge displays don't pay for pixels nobody sees */
const MAX_RENDER_WIDTH = 2688
const MAX_PIXEL_RATIO = 1.75

const FRAME_INTERVAL_MS = 16
const POINTER_FOLLOW_SECONDS = 0.22
const POINTER_HOLD_SECONDS = 0.35
/** shockwaves per second while the lockup is hovered */
const WAVE_RATE = 0.55

const UNIFORM_BYTES = 48

export type Renderer = {
  ready: Promise<void>
  dispose: () => void
  /** stop drawing entirely; time freezes so the scene resumes in place */
  setPaused: (paused: boolean) => void
  /** fires once the first frame has actually been painted */
  onFirstFrame?: () => void
}

type Point = readonly [number, number]

function follow (current: Point, target: Point, dt: number, seconds: number): Point {
  const alpha = 1 - Math.exp(-Math.min(Math.max(dt, 0), 0.05) / Math.max(seconds, 0.001))
  return [
    current[0] + (target[0] - current[0]) * alpha,
    current[1] + (target[1] - current[1]) * alpha,
  ]
}

export function createRenderer (
  canvas: HTMLCanvasElement,
  slot: HTMLElement,
  lockup: HTMLElement | null,
): Renderer {
  let disposed = false
  let device: GPUDevice | undefined
  let context: GPUCanvasContext | undefined
  let pipeline: GPURenderPipeline | undefined
  let uniforms: GPUBuffer | undefined
  let bindGroup: GPUBindGroup | undefined
  let observer: ResizeObserver | undefined
  let rafId = 0

  let width = 1
  let height = 1
  let logoCentre: Point = [0.5, 0.5]
  let logoScale: Point = [0.1, 0.1]

  let pointer: Point | undefined
  let smoothed: Point = [0.5, 0.5]
  let pointerHold = 0
  let overLockup = false
  let wavePhase = 0
  let waveAlive = 0

  let lastTime = 0
  let lastRender = -Infinity
  let painted = false
  // With several dev servers open, only the focused one should cost anything.
  // Browsers suspend frames for hidden tabs but not for unfocused windows, so
  // the scene is paused explicitly, and time is frozen so it resumes in place.
  let paused = false
  let pauseWhenPainted = false
  let pausedAt = 0
  let timeOffset = 0

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const scratch = new Float32Array(UNIFORM_BYTES / 4)

  const measure = () => {
    if (!device || !context) { return }
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) { return }
    const ratio = Math.min(
      window.devicePixelRatio || 1,
      MAX_PIXEL_RATIO,
      MAX_RENDER_WIDTH / rect.width,
    )
    const next = [
      Math.max(1, Math.floor(rect.width * ratio)),
      Math.max(1, Math.floor(rect.height * ratio)),
    ]
    if (next[0] !== width || next[1] !== height) {
      width = next[0]!
      height = next[1]!
      canvas.width = width
      canvas.height = height
    }
    const slotRect = slot.getBoundingClientRect()
    logoCentre = [
      (slotRect.left + slotRect.width / 2 - rect.left) / Math.max(1, rect.width),
      (slotRect.top + slotRect.height / 2 - rect.top) / Math.max(1, rect.height),
    ]
    logoScale = [
      Math.max(0.001, slotRect.width / Math.max(1, rect.width)),
      Math.max(0.001, slotRect.height / Math.max(1, rect.height)),
    ]
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (event.pointerType === 'touch') { return }
    const rect = canvas.getBoundingClientRect()
    pointer = [
      Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width))),
      Math.min(1, Math.max(0, (event.clientY - rect.top) / Math.max(1, rect.height))),
    ]
  }
  const handlePointerLeave = () => {
    pointer = undefined
    overLockup = false
  }
  const handleLockupEnter = () => { overLockup = true }
  const handleLockupLeave = () => { overLockup = false }

  const setPaused = (next: boolean) => {
    if (next === paused || disposed) { return }
    // never pause before the first frame, or the screen would stay blank
    if (next && !painted) {
      pauseWhenPainted = true
      return
    }
    paused = next
    if (paused) {
      pausedAt = performance.now()
      pointer = undefined
      overLockup = false
      if (rafId) { cancelAnimationFrame(rafId) }
      rafId = 0
      return
    }
    pauseWhenPainted = false
    timeOffset += performance.now() - pausedAt
    lastRender = -Infinity
    lastTime = (performance.now() - timeOffset) / 1000
    if (!rafId) { rafId = requestAnimationFrame(frame) }
  }

  const frame = (now: number) => {
    if (disposed) { return }
    rafId = requestAnimationFrame(frame)
    if (now - lastRender < FRAME_INTERVAL_MS) { return }
    if (!device || !context || !pipeline || !uniforms || !bindGroup) { return }
    lastRender = now

    const time = (now - timeOffset) / 1000
    const dt = Math.min(Math.max(time - lastTime, 0), 0.05)
    lastTime = time

    smoothed = follow(smoothed, pointer ?? smoothed, dt, POINTER_FOLLOW_SECONDS)
    pointerHold += ((pointer ? 1 : 0) - pointerHold) * (1 - Math.exp(-dt / POINTER_HOLD_SECONDS))

    // a wave, once fired, always completes its travel
    if (overLockup) {
      waveAlive = 1
      wavePhase = (wavePhase + dt * WAVE_RATE) % 1
    } else if (waveAlive > 0) {
      wavePhase += dt * WAVE_RATE
      if (wavePhase >= 1) {
        wavePhase = 0
        waveAlive = 0
      }
    }

    scratch.set([
      logoCentre[0], logoCentre[1],
      logoScale[0], logoScale[1],
      width, height,
      smoothed[0], smoothed[1],
      wavePhase, waveAlive,
      time, pointerHold,
    ])
    device.queue.writeBuffer(uniforms, 0, scratch)

    const encoder = device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
      }],
    })
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.draw(VERTEX_COUNT)
    pass.end()
    device.queue.submit([encoder.finish()])

    if (!painted) {
      painted = true
      api.onFirstFrame?.()
      // the window may already have been in the background at startup
      if (pauseWhenPainted) { setPaused(true) }
    }
    if (reducedMotion) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  }

  const dispose = () => {
    if (disposed) { return }
    disposed = true
    if (rafId) { cancelAnimationFrame(rafId) }
    rafId = 0
    observer?.disconnect()
    window.removeEventListener('pointermove', handlePointerMove)
    document.documentElement.removeEventListener('pointerleave', handlePointerLeave)
    lockup?.removeEventListener('pointerenter', handleLockupEnter)
    lockup?.removeEventListener('pointerleave', handleLockupLeave)
    uniforms?.destroy()
    device?.destroy()
    device = undefined
    context = undefined
  }

  const initialise = async () => {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' })
    if (!adapter) { throw new Error('No WebGPU adapter.') }
    const gpu = await adapter.requestDevice()
    if (disposed) {
      gpu.destroy()
      return
    }
    device = gpu
    device.lost.then(() => dispose())

    const ctx = canvas.getContext('webgpu')
    if (!ctx) { throw new Error('No WebGPU canvas context.') }
    context = ctx
    const format = navigator.gpu.getPreferredCanvasFormat()
    context.configure({ device, format, alphaMode: 'opaque' })

    const module = device.createShaderModule({ label: 'nuxt-loading-mountains', code: shader })
    pipeline = device.createRenderPipeline({
      label: 'nuxt-loading-mountains',
      layout: 'auto',
      vertex: { module, entryPoint: 'vs_main' },
      fragment: {
        module,
        entryPoint: 'fs_main',
        // particles accumulate, so overlapping dust brightens rather than occludes
        targets: [{
          format,
          blend: {
            color: { srcFactor: 'one', dstFactor: 'one' },
            alpha: { srcFactor: 'one', dstFactor: 'one' },
          },
        }],
      },
    })
    uniforms = device.createBuffer({
      label: 'nuxt-loading-params',
      size: UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniforms } }],
    })

    measure()
    observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(canvas)
    observer?.observe(slot)
    window.addEventListener('pointermove', handlePointerMove)
    document.documentElement.addEventListener('pointerleave', handlePointerLeave)
    lockup?.addEventListener('pointerenter', handleLockupEnter)
    lockup?.addEventListener('pointerleave', handleLockupLeave)
    rafId = requestAnimationFrame(frame)
  }

  const ready = initialise().catch((error: unknown) => {
    dispose()
    throw error
  })

  const api: Renderer = { ready, dispose, setPaused }
  return api
}
