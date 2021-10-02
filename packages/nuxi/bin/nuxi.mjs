#!/usr/bin/env node
process._startTime = Date.now()
import('../dist/index.mjs').then(r => (r.default || r).main())
