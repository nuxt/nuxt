export const defaultUserConfig = 123 as const

export function useDefaultUserConfig () {
  return computed(() => useNuxtApp().payload.state.userConfig ?? defaultUserConfig)
}
