function useAsyncData (s?: any) { return s }

export const ShouldNotBeKeyed = (() => {
  return useAsyncData()
})()
