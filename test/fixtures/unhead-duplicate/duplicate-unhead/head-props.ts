import { defineEventHandler } from 'h3'
import { propsToString } from 'unhead/server'

export default defineEventHandler(() => propsToString({ 'data-source': 'unhead' }))
