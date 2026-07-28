import { defineHandler } from 'h3'

export default defineHandler(() => {
  return {
    server: serverUtilsGreeting(),
    shared: sharedUtilsGreeting(),
  }
})
