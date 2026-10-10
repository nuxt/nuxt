import { defineEventHandler } from 'h3'

import { counter } from '../utils/counter'

export default defineEventHandler(() => {
  counter.hits++
  return { hits: counter.hits }
})
