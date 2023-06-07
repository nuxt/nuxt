export default defineEventHandler(() => {
  const appConfig = useAppConfig()
  return {
    appConfig
  }
})
