// @ts-ignore
process._startTime = Date.now()

// @ts-ignore
import('./cli').then(r => (r.default || r).main())
