import { defineEventHandler } from 'h3'

import { counter } from '../utils/counter'

export default defineEventHandler(() => ({ hits: counter.hits }))
