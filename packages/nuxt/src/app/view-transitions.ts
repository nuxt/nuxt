import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { NuxtApp } from './nuxt'

/**
 * Lifecycle stage of a staged page navigation.
 *
 * - `armed`: Session created in `router.beforeResolve`, waiting for `<NuxtPage>` to claim it
 * - `claimed`: `<NuxtPage>` attached the session to a render branch
 * - `preparing`: Destination page is loading in the hidden stage
 * - `ready`: Destination resolved, the pending view transition may call `documentstartViewTransition()`
 * - `committing`: Browser `update` callback opened the gate and the visible page swap is in progress
 * - `finished`: Browser transition completed
 * - `cancelled`: Navigation was aborted or superseded by a newer session
 *
 * @internal
 */
export type PendingViewTransitionStatus =
  | 'armed'
  | 'claimed'
  | 'preparing'
  | 'ready'
  | 'committing'
  | 'finished'
  | 'cancelled'

/** @internal */
export interface PendingViewTransition {
  /** Monotonic session id. */
  id: number
  /** Destination route. */
  to: RouteLocationNormalizedLoaded
  /** Source route. */
  from: RouteLocationNormalizedLoaded
  /** View transition types for `document.startViewTransition()`. */
  types: string[]
  /** Current lifecycle stage. */
  status: PendingViewTransitionStatus
  /** `<NuxtPage>` branch that claimed this session. */
  owner?: object
  /** Browser `ViewTransition` instance, once started. */
  transition?: ViewTransition
  /** Starts the native view transition after the destination is ready. */
  start?: () => void
  /** Superseded sessions whose gates release after the replacement stage mounts. */
  superseded?: PendingViewTransition[]
  /** Blocks the visible swap until the browser captures the old page. */
  gate: Promise<void>
  /** Opens {@link PendingViewTransition.gate gate}. */
  resolveGate: () => void
  /** Signals that Vue finished rendering the committed destination page. */
  resolveCommitted: () => void
  /** Awaited by the browser `update` callback until outer Suspense resolves. */
  committed: Promise<void>
}

let transitionId = 0

/**
 * Creates a new PendingViewTransition object to track the state of an in-progress view transition.
 * @internal
 */
export function createPendingViewTransition (to: RouteLocationNormalizedLoaded, from: RouteLocationNormalizedLoaded, types: string[]): PendingViewTransition {
  let resolveGate: () => void
  let resolveCommitted: () => void

  const gate = new Promise<void>((resolve) => {
    resolveGate = resolve
  })
  const committed = new Promise<void>((resolve) => {
    resolveCommitted = resolve
  })

  return {
    id: ++transitionId,
    to,
    from,
    types,
    status: 'armed',
    // keep the gate alive until the browser has captured the old page
    resolveGate: resolveGate!,
    resolveCommitted: resolveCommitted!,
    committed,
    gate,
  }
}

/**
 * claims the pending view transition session for the given route
 * @internal
 */
export function claimPendingViewTransition (nuxtApp: NuxtApp, route: RouteLocationNormalizedLoaded, owner: object): PendingViewTransition | undefined {
  const session = nuxtApp._pendingViewTransition

  // exit early if no valid session matches the route
  if (!session || session.status === 'cancelled' || session.to.fullPath !== route.fullPath) {
    return
  }

  // if the session is armed, claim it by attaching the owner
  if (session.status === 'armed') {
    session.owner = owner
    session.status = 'claimed'
    return session
  }

  // if the session is already claimed by the same owner, return the session
  if (session.owner === owner) {
    return session
  }
}

export function preparePendingViewTransition (session: PendingViewTransition): Promise<void> {
  if (session.status === 'cancelled' || session.status === 'finished') {
    return session.gate
  }

  session.status = 'preparing'

  // resolve the gates of any superseded sessions
  for (const superseded of session.superseded || []) {
    superseded.resolveGate()
  }

  // clear the superseded sessions
  session.superseded = undefined
  return session.gate
}

export function markPendingViewTransitionReady (session: PendingViewTransition): void {
  // exit early if the session is not preparing
  if (session.status !== 'preparing') { return }
  session.status = 'ready'
  session.start?.()
}

/**
 * commits the pending view transition session
 * @internal
 */
export function commitPendingViewTransition (session: PendingViewTransition): void {
  if (session.status === 'cancelled' || session.status === 'finished') { return }
  session.resolveCommitted()
}

export function cancelPendingViewTransition (session: PendingViewTransition): void {
  if (session.status === 'cancelled' || session.status === 'finished') { return }
  session.status = 'cancelled'
  session.transition?.skipTransition()
  session.resolveGate()
  session.resolveCommitted()
}

/**
 * cancels the pending view transition session and releases the gate
 * @internal
 */
export function supersedePendingViewTransition (session: PendingViewTransition): void {
  if (session.status === 'cancelled' || session.status === 'finished') { return }
  session.status = 'cancelled'
  session.transition?.skipTransition()
  // Replacement releases this gate after Vue discards the old branch; releasing here would commit a stale route.
  session.resolveCommitted()
}
