export default defineCachedEventHandler(() => ({ cached: true, at: new Date() }), { maxAge: 60 })
