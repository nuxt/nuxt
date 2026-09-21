import fragmentSource from './mountains.frag.glsl?raw'
import vertexSource from './mountains.vert.glsl?raw'

const COLS = 704
const ROWS = 260
const TERRAIN_VERTICES = COLS * ROWS * 6
/** flakes are appended after the terrain, and only drawn in winter */
const SNOWFLAKES = 2200
const WINTER_VERTICES = TERRAIN_VERTICES + SNOWFLAKES * 6

/**
 * A GPU that is blocklisted, virtualised or missing still yields a WebGL2
 * context — backed by a software rasteriser. Rasterising this many particles on
 * the CPU costs whole cores, so those renderers get the plain lockup instead.
 */
const SOFTWARE_RENDERERS = /swiftshader|llvmpipe|softpipe|software|basic render/i

/** cap the backing store so huge displays don't pay for pixels nobody sees */
const MAX_RENDER_WIDTH = 2688
const MAX_PIXEL_RATIO = 1.75

// 30fps: the scene is ambient dust behind a lockup, and halving the frame
// rate halves what it takes from anything else competing for the GPU
const FRAME_INTERVAL_MS = 33
const POINTER_FOLLOW_SECONDS = 0.22
const POINTER_HOLD_SECONDS = 0.35
/** shockwaves per second after the lockup is clicked */
const WAVE_RATE = 0.55
/** enough slots for rapid clicks while earlier waves are still travelling */
const MAX_WAVES = 8

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
  let gl: WebGL2RenderingContext | undefined
  let program: WebGLProgram | undefined
  let observer: ResizeObserver | undefined
  let rafId = 0

  let width = 1
  let height = 1
  let logoCentre: Point = [0.5, 0.5]
  let logoScale: Point = [0.1, 0.1]

  let pointer: Point | undefined
  let smoothed: Point = [0.5, 0.5]
  let pointerHold = 0
  const wavePhases = new Float32Array(MAX_WAVES).fill(-1)
  let hoverWavePhase = -1

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

  type Uniforms = Record<'uLogoCentre' | 'uLogoScale' | 'uResolution' | 'uPointer' | 'uWave' | 'uHoverWave' | 'uMisc' | 'uSeason' | 'uLight', WebGLUniformLocation | null>
  let uniforms: Uniforms | undefined

  /**
   * Draw one more frame after a change that reduced motion would otherwise sit
   * on. Before the first paint there is nothing to do: the frame that is
   * already coming reads the new value.
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
    applyBlend()
    redraw()
  }

  /**
   * The dark theme adds light to black, so overlapping dust brightens towards
   * white. The light theme composites premultiplied over the page, so it
   * converges on the ink colour rather than running away to black. Alpha is
   * left at the cleared 1 either way: the canvas is opaque.
   */
  const applyBlend = () => {
    if (!gl) { return }
    if (light > 0) {
      gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE)
    } else {
      gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE)
    }
  }

  const measure = () => {
    if (!gl) { return }
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
      gl.viewport(0, 0, width, height)
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
  }
  const handleLockupClick = () => {
    let slot = wavePhases.findIndex(phase => phase < 0)
    if (slot < 0) {
      // If every slot is occupied, replace the wave closest to finishing.
      slot = wavePhases.indexOf(Math.max(...wavePhases))
    }
    wavePhases[slot] = 0
    redraw()
  }
  const handleLockupEnter = (event: PointerEvent) => {
    if (event.pointerType === 'touch') { return }
    hoverWavePhase = 0
    redraw()
  }
  // A lost context clears the drawing buffer, so the canvas would be left as a
  // blank rectangle over the page. Drop it and fall back to the plain lockup.
  const handleContextLost = (event: Event) => {
    event.preventDefault()
    dispose()
    canvas.remove()
  }

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
    if (!gl || !program || !uniforms) { return }
    lastRender = now

    const time = (now - timeOffset) / 1000
    const dt = Math.min(Math.max(time - lastTime, 0), 0.05)
    lastTime = time

    smoothed = follow(smoothed, pointer ?? smoothed, dt, POINTER_FOLLOW_SECONDS)
    pointerHold += ((pointer ? 1 : 0) - pointerHold) * (1 - Math.exp(-dt / POINTER_HOLD_SECONDS))

    // Each click gets its own wave, so rapid clicks produce overlapping rings.
    for (let i = 0; i < wavePhases.length; i++) {
      if (wavePhases[i]! < 0) { continue }
      wavePhases[i]! += dt * WAVE_RATE
      if (wavePhases[i]! >= 1) { wavePhases[i] = -1 }
    }
    if (hoverWavePhase >= 0) {
      hoverWavePhase += dt * WAVE_RATE
      if (hoverWavePhase >= 1) { hoverWavePhase = -1 }
    }

    gl.uniform2f(uniforms.uLogoCentre, logoCentre[0], logoCentre[1])
    gl.uniform2f(uniforms.uLogoScale, logoScale[0], logoScale[1])
    gl.uniform2f(uniforms.uResolution, width, height)
    gl.uniform2f(uniforms.uPointer, smoothed[0], smoothed[1])
    gl.uniform1fv(uniforms.uWave, wavePhases)
    gl.uniform1f(uniforms.uHoverWave, hoverWavePhase)
    gl.uniform2f(uniforms.uMisc, time, pointerHold)
    gl.uniform2f(uniforms.uSeason, winter, light)
    gl.uniform1f(uniforms.uLight, light)

    const ground = light > 0 ? 1 : 0
    gl.clearColor(ground, ground, ground, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLES, 0, winter > 0 ? WINTER_VERTICES : TERRAIN_VERTICES)

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
    lockup?.removeEventListener('click', handleLockupClick)
    lockup?.removeEventListener('pointerenter', handleLockupEnter)
    lightQuery.removeEventListener('change', handleThemeChange)
    canvas.removeEventListener('webglcontextlost', handleContextLost)
    if (gl && program) { gl.deleteProgram(program) }
    gl = undefined
    program = undefined
  }

  const compile = (context: WebGL2RenderingContext, type: number, source: string) => {
    const shader = context.createShader(type)
    if (!shader) { throw new Error('Could not create shader.') }
    context.shaderSource(shader, source)
    context.compileShader(shader)
    if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
      const log = context.getShaderInfoLog(shader)
      context.deleteShader(shader)
      throw new Error(`Shader failed to compile: ${log}`)
    }
    return shader
  }

  const initialise = () => {
    const context = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
    })
    if (!context) { throw new Error('No WebGL2 context.') }

    const debugInfo = context.getExtension('WEBGL_debug_renderer_info')
    const name = String(
      (debugInfo && context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
      || context.getParameter(context.RENDERER)
      || '',
    )
    if (SOFTWARE_RENDERERS.test(name)) {
      throw new Error(`Software renderer (${name}); falling back to the lockup.`)
    }

    gl = context

    const vertex = compile(context, context.VERTEX_SHADER, vertexSource)
    const fragment = compile(context, context.FRAGMENT_SHADER, fragmentSource)
    const linked = context.createProgram()
    if (!linked) { throw new Error('Could not create program.') }
    context.attachShader(linked, vertex)
    context.attachShader(linked, fragment)
    context.linkProgram(linked)
    // the shaders live on inside the program once it is linked
    context.deleteShader(vertex)
    context.deleteShader(fragment)
    if (!context.getProgramParameter(linked, context.LINK_STATUS)) {
      const log = context.getProgramInfoLog(linked)
      context.deleteProgram(linked)
      throw new Error(`Program failed to link: ${log}`)
    }
    program = linked
    context.useProgram(linked)

    const at = (name: string) => context.getUniformLocation(linked, name)
    uniforms = {
      uLogoCentre: at('uLogoCentre'),
      uLogoScale: at('uLogoScale'),
      uResolution: at('uResolution'),
      uPointer: at('uPointer'),
      uWave: at('uWave[0]'),
      uHoverWave: at('uHoverWave'),
      uMisc: at('uMisc'),
      uSeason: at('uSeason'),
      uLight: at('uLight'),
    }

    // every vertex comes from gl_VertexID, so there is nothing to bind beyond
    // an empty vertex array
    context.bindVertexArray(context.createVertexArray())
    context.disable(context.DEPTH_TEST)
    context.enable(context.BLEND)
    applyBlend()

    measure()
    observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(canvas)
    observer?.observe(slot)
    window.addEventListener('pointermove', handlePointerMove)
    document.documentElement.addEventListener('pointerleave', handlePointerLeave)
    lockup?.addEventListener('click', handleLockupClick)
    lockup?.addEventListener('pointerenter', handleLockupEnter)
    lightQuery.addEventListener('change', handleThemeChange)
    canvas.addEventListener('webglcontextlost', handleContextLost)
    rafId ||= requestAnimationFrame(frame)
  }

  // WebGL2 sets up synchronously, unlike WebGPU's adapter request. `ready` stays
  // a promise so callers keep one way to hear about a failure; the rejection
  // handler is attached in the same tick, before microtasks run.
  let ready: Promise<void>
  try {
    initialise()
    ready = Promise.resolve()
  } catch (error) {
    dispose()
    ready = Promise.reject(error instanceof Error ? error : new Error(String(error)))
  }

  const api: Renderer = { ready, dispose, setPaused, setWinter }
  return api
}
