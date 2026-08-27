/// <reference types="@webgpu/types" />
import shader from './mountains.wgsl?raw'

const COLS = 704
const ROWS = 260
const TERRAIN_VERTICES = COLS * ROWS * 6
/** flakes are appended after the terrain, and only drawn in winter */
const SNOWFLAKES = 2200
const WINTER_VERTICES = TERRAIN_VERTICES + SNOWFLAKES * 6

/** cap the backing store so huge displays don't pay for pixels nobody sees */
const MAX_RENDER_WIDTH = 2688
const MAX_PIXEL_RATIO = 1.75

const FRAME_INTERVAL_MS = 16
const POINTER_FOLLOW_SECONDS = 0.22
const POINTER_HOLD_SECONDS = 0.35
/** shockwaves per second while the lockup is hovered */
const WAVE_RATE = 0.55

const UNIFORM_BYTES = 64

/** the ground each theme clears to, matching the page background */
const PAPER = { r: 1, g: 1, b: 1, a: 1 }
const INK = { r: 0, g: 0, b: 0, a: 1 }

export type Renderer = {
  ready: Promise<void>
  dispose: () => void
  /** stop drawing entirely; time freezes so the scene resumes in place */
  setPaused: (paused: boolean) => void
  /** snow on the peaks and falling flakes, toggleable while running */
  setWinter: (winter: boolean) => void
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

/**
 * Winter runs Nov-Jan in the northern hemisphere and May-Jul in the southern
 * one, worked out from the timezone offsets, as the previous snow easter egg
 * did. `?winter` / `?winter=0` forces it either way for testing.
 */
export function isWinter (): boolean {
  try {
    const forced = new URLSearchParams(window.location.search).get('winter')
    if (forced !== null) { return forced !== '0' && forced !== 'false' }
  } catch {
    // URL unavailable
  }
  const now = new Date()
  const year = now.getFullYear()
  const january = -new Date(year, 0, 1).getTimezoneOffset()
  const july = -new Date(year, 6, 1).getTimezoneOffset()
  if (january === july) { return false }
  const months = january - july > 0 ? [4, 5, 6] : [10, 11, 0]
  return months.includes(now.getMonth())
}

export function createRenderer (
  canvas: HTMLCanvasElement,
  slot: HTMLElement,
  lockup: HTMLElement | null,
): Renderer {
  let disposed = false
  let device: GPUDevice | undefined
  let context: GPUCanvasContext | undefined
  let uniforms: GPUBuffer | undefined
  let bindGroup: GPUBindGroup | undefined
  let observer: ResizeObserver | undefined
  let rafId = 0
  // one pipeline per theme: they differ only in blend op, and the viewer can
  // change theme under us, so both are kept once built
  const pipelines = new Map<number, GPURenderPipeline>()
  let buildPipeline: ((light: number) => GPURenderPipeline) | undefined

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
  let resuming = false
  let pausedAt = 0
  let lastFrame = 0
  let timeOffset = 0

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const lightQuery = window.matchMedia('(prefers-color-scheme: light)')
  let light = lightQuery.matches ? 1 : 0
  let winter = isWinter() ? 1 : 0
  const scratch = new Float32Array(UNIFORM_BYTES / 4)

  /**
   * Draw one more frame after a change that reduced motion would otherwise sit
   * on. Before the first paint there is nothing to do: the frame that is
   * already coming reads the new value, and scheduling one here would race the
   * loop `initialise` starts.
   */
  const redraw = () => {
    if (disposed || paused || !painted) { return }
    lastRender = -Infinity
    rafId ||= requestAnimationFrame(frame)
  }

  const setWinter = (next: boolean) => {
    const value = next ? 1 : 0
    if (value === winter) { return }
    winter = value
    redraw()
  }

  const handleThemeChange = (event: MediaQueryListEvent) => {
    light = event.matches ? 1 : 0
    redraw()
  }

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
      // the last frame's timestamp is the moment the clock stopped
      pausedAt = lastFrame
      pointer = undefined
      overLockup = false
      if (rafId) { cancelAnimationFrame(rafId) }
      rafId = 0
      return
    }
    pauseWhenPainted = false
    // the paused span is only known once the next frame reports its timestamp
    resuming = true
    rafId ||= requestAnimationFrame(frame)
  }

  const frame = (now: number) => {
    if (disposed) { return }
    rafId = requestAnimationFrame(frame)
    lastFrame = now
    if (resuming) {
      // skip the paused span so the scene carries on where it stopped
      resuming = false
      timeOffset += now - pausedAt
      lastRender = -Infinity
      lastTime = (now - timeOffset) / 1000
    }
    if (now - lastRender < FRAME_INTERVAL_MS) { return }
    if (!device || !context || !buildPipeline || !uniforms || !bindGroup) { return }
    lastRender = now

    let pipeline = pipelines.get(light)
    if (!pipeline) {
      pipeline = buildPipeline(light)
      pipelines.set(light, pipeline)
    }

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
      winter, light,
    ])
    device.queue.writeBuffer(uniforms, 0, scratch)

    const encoder = device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: light > 0 ? PAPER : INK,
      }],
    })
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.draw(winter > 0 ? WINTER_VERTICES : TERRAIN_VERTICES)
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
    lightQuery.removeEventListener('change', handleThemeChange)
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

    const ctx = canvas.getContext('webgpu') as GPUCanvasContext | null
    if (!ctx) { throw new Error('No WebGPU canvas context.') }
    context = ctx
    const format = navigator.gpu.getPreferredCanvasFormat()
    context.configure({ device, format, alphaMode: 'opaque' })

    const module = device.createShaderModule({ label: 'nuxt-loading-mountains', code: shader })
    // an explicit layout, so the one bind group serves both theme pipelines
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }],
    })
    const layout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] })
    buildPipeline = (theme: number) => device!.createRenderPipeline({
      label: theme > 0 ? 'nuxt-loading-mountains-light' : 'nuxt-loading-mountains',
      layout,
      vertex: { module, entryPoint: 'vs_main' },
      fragment: {
        module,
        entryPoint: theme > 0 ? 'fs_light' : 'fs_main',
        // Particles accumulate either way. On the dark theme they add light, so
        // overlapping dust brightens towards white. On the light one they
        // composite premultiplied, so it converges on the ink colour instead of
        // running away to black. Alpha stays at the cleared 1: the canvas is
        // opaque, and the page shows through only where nothing was drawn.
        targets: [{
          format,
          blend: theme > 0
            ? {
                color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
                alpha: { srcFactor: 'zero', dstFactor: 'one' },
              }
            : {
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
      layout: bindGroupLayout,
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
    lightQuery.addEventListener('change', handleThemeChange)
    rafId ||= requestAnimationFrame(frame)
  }

  const ready = initialise().catch((error: unknown) => {
    dispose()
    throw error
  })

  const api: Renderer = { ready, dispose, setPaused, setWinter }
  return api
}
