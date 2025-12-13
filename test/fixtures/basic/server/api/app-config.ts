import { defineHandler } from 'nitro/h3'

export default defineHandler(() => {
  const appConfig = useAppConfig()
  return {
    appConfig,
  }
})
