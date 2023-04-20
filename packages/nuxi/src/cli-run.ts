// @ts-expect-error internal property for tracking start time
process._startTime = Date.now()

// @ts-expect-error `default` property is not declared
import('./cli').then(r => (r.default || r).main())
