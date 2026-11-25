import type { H3Event } from 'nitro/h3'

const arrivals = new WeakMap<H3Event, H3Event['req']>()

/** Keep the request an event arrived with. */
export function keepArrivalRequest (event: H3Event): void {
  arrivals.set(event, event.req)
}

/**
 * The request an event arrived with, if it was kept. A cached route replaces the request of
 * its event with one that carries only the headers the cache is keyed on.
 */
export function arrivalRequest (event: H3Event): H3Event['req'] {
  return arrivals.get(event) ?? event.req
}
