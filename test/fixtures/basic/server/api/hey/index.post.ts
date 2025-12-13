import { defineHandler } from 'nitro/h3'

export default defineHandler(() => ({
  method: 'post' as const,
}))
