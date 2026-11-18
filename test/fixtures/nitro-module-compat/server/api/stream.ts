import { defineHandler } from 'nitro/h3'

export default defineHandler(() => new ReadableStream({
  start (controller) {
    controller.enqueue(new TextEncoder().encode('first'))
  },
}))
