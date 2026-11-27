import { defineCachedEventHandler } from 'nitropack/runtime'

export default defineCachedEventHandler(() => null, { maxAge: 60 })
