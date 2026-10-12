import { defineEventHandler } from '#imports/server'

export const aliasedHandler = defineEventHandler(() => 'Hello aliased')
