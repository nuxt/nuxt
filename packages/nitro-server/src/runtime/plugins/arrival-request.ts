import { definePlugin } from 'nitro'
import type { H3Event } from 'nitro/h3'

import { keepArrivalRequest } from '../utils/arrival-request'

export default definePlugin((nitroApp) => {
  nitroApp.hooks?.hook('request', event => keepArrivalRequest(event as H3Event))
})
