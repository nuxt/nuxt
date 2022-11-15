import type { UseHeadInput } from '@vueuse/head'
import type { HeadAugmentations } from '@nuxt/schema'

export * from './composables'

export type MetaObject = UseHeadInput<HeadAugmentations>
