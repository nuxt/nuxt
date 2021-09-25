export * from '@vue/composition-api'

const mock = () => () => { throw new Error('not implemented') }

export const useAsyncData = mock()
export const asyncData = mock()
export const useSSRRef = mock()
export const useData = mock()
export const useGlobalData = mock()
export const useHydration = mock()
