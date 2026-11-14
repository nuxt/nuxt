import { injectHead } from './head'
import { createAnnouncer, useSharedAnnouncer } from './announcer'
import type { AnnouncerPoliteness, NuxtAnnouncer, NuxtAnnouncerOpts } from './announcer'

export type Politeness = AnnouncerPoliteness
export type NuxtRouteAnnouncerOpts = NuxtAnnouncerOpts
export type RouteAnnouncer = NuxtAnnouncer

function createRouteAnnouncer (opts: NuxtRouteAnnouncerOpts): RouteAnnouncer {
  const announcer = createAnnouncer(opts)
  if (import.meta.server) {
    return announcer
  }

  const activeHead = injectHead()

  function _updateMessageWithPageHeading () {
    const title = document.title?.trim()
    // an empty title still cancels a pending message restoration
    if (title !== announcer.message.value || title === '') {
      announcer.set(title, announcer.politeness.value)
    }
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
