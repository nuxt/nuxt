import { useRouteAnnouncer } from '../composables/route-announcer'
import { defineAnnouncerComponent } from './announcer'

export default defineAnnouncerComponent('NuxtRouteAnnouncer', 'nuxt-route-announcer', false, useRouteAnnouncer)
