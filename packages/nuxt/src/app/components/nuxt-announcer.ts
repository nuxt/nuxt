import { useAnnouncer } from '../composables/announcer'
import { defineAnnouncerComponent } from './announcer'

export default defineAnnouncerComponent('NuxtAnnouncer', 'nuxt-announcer', true, useAnnouncer)
