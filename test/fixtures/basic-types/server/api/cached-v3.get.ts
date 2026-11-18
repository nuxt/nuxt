import { defineCachedHandler } from 'nitro/cache'

export default defineCachedHandler(() => ({ cached: true, at: new Date() }), { maxAge: 60 })
