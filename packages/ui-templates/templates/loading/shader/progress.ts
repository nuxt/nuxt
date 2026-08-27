// Build progress for the loading screen.
//
// The dev server is the producer. Two ways in, both optional:
//   window.__NUXT_LOADING_STATE__ = { step: { name, index, total }, startedAt }
//   window.dispatchEvent(new CustomEvent('nuxt:loading-state', { detail: state }))
//
// With no producer the bar keeps its indeterminate sweep. It never invents a
// percentage.

export type LoadingStep = {
  name: string
  index: number
  total: number
}

export type LoadingState = {
  step?: LoadingStep
  /** epoch ms the current step started, for the elapsed counter */
  startedAt?: number
}

const STATE_KEY = '__NUXT_LOADING_STATE__'
const STATE_EVENT = 'nuxt:loading-state'

function normalise (input: unknown): LoadingState | undefined {
  if (!input || typeof input !== 'object') { return undefined }
  const raw = input as LoadingState
  const step = raw.step
  if (!step || typeof step.name !== 'string') { return undefined }
  const total = Math.max(1, Math.round(step.total))
  const index = Math.min(total, Math.max(1, Math.round(step.index)))
  return {
    step: { name: step.name, index, total },
    startedAt: typeof raw.startedAt === 'number' ? raw.startedAt : Date.now(),
  }
}

function formatElapsed (ms: number): string {
  const seconds = ms / 1000
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`
}

export function mountProgress (): void {
  const container = document.querySelector<HTMLElement>('#nuxt-progress')
  const status = document.querySelector<HTMLElement>('#nuxt-progress-status')
  if (!container || !status) { return }

  let state: LoadingState | undefined
  let timer = 0

  const render = () => {
    if (!state?.step) { return }
    const { name, index, total } = state.step
    const elapsed = formatElapsed(Date.now() - (state.startedAt ?? Date.now()))
    status.textContent = ''
    const stepName = document.createElement('span')
    stepName.className = 'nuxt-progress-step'
    stepName.textContent = name
    status.append(stepName, ` · step ${index}/${total} · ${elapsed}`)
  }

  const tick = () => {
    render()
    timer = window.setTimeout(tick, 100)
  }

  const apply = (input: unknown) => {
    state = normalise(input)
    if (!state?.step) {
      container.removeAttribute('data-mode')
      window.clearTimeout(timer)
      timer = 0
      return
    }
    container.dataset.mode = 'determinate'
    container.style.setProperty('--nuxt-progress', `${(state.step.index / state.step.total) * 100}%`)
    render()
    if (!timer) { tick() }
  }

  apply((window as unknown as Record<string, unknown>)[STATE_KEY])
  window.addEventListener(STATE_EVENT, event => apply((event as CustomEvent).detail))
}
