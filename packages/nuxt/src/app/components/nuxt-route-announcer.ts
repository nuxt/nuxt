import { useRouteAnnouncer } from '../composables/route-announcer'
import { defineAnnouncerComponent } from './announcer'
import { appRouteAnnouncerClass } from '#build/nuxt.config.mjs'

export default defineAnnouncerComponent('NuxtRouteAnnouncer', appRouteAnnouncerClass, false, useRouteAnnouncer)
