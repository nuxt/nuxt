import { defineHandler } from 'nitro/h3'

let counter = 0

export default defineHandler(() => ({ count: counter++ }))
