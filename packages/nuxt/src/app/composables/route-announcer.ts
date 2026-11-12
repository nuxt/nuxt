import { injectHead } from './head'
import { createAnnouncer, useSharedAnnouncer } from './announcer'
import type { AnnouncerPoliteness, NuxtAnnouncer, NuxtAnnouncerOpts } from './announcer'

export type Politeness = AnnouncerPoliteness
export type NuxtRouteAnnouncerOpts = NuxtAnnouncerOpts
export type RouteAnnouncer = NuxtAnnouncer

function createRouteAnnouncer (opts: NuxtRouteAnnouncerOpts): RouteAnnouncer {
  const announcer = createAnnouncer(opts)
  const activeHead = injectHead()

  function _updateMessageWithPageHeading () {
    announcer.set(document?.title?.trim(), announcer.politeness.value)
  }

  _updateMessageWithPageHeading()
  activeHead?.hooks?.hook('dom:rendered', _updateMessageWithPageHeading)

  announcer._cleanup = () => {
    activeHead?.hooks?.removeHook('dom:rendered', _updateMessageWithPageHeading)
  }

  return announcer
}

/**
 * composable to handle the route announcer
 * @since 3.12.0
 */
export function useRouteAnnouncer (opts: NuxtRouteAnnouncerOpts = {}): Omit<RouteAnnouncer, '_cleanup'> {
  return useSharedAnnouncer('_routeAnnouncer', opts, () => createRouteAnnouncer(opts))
}
