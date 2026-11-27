import { useAnnouncer } from '../composables/announcer'
import { defineAnnouncerComponent } from './announcer'
import { appAnnouncerClass } from '#build/nuxt.config.mjs'

export default defineAnnouncerComponent('NuxtAnnouncer', appAnnouncerClass, true, useAnnouncer)
