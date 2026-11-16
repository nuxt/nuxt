import { defineHandler } from 'nitro/h3'

export default defineHandler(event => ({ api: 'nitro3', path: event.url.pathname }))
