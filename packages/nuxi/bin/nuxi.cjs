#!/usr/bin/env node
process._startTime = Date.now()

require('../dist/index.cjs').main()
