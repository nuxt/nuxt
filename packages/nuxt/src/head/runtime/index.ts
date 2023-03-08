import type { UseHeadInput } from '@unhead/vue'
import type { HeadAugmentations } from 'nuxt/schema'

export * from './composables'

export type MetaObject = UseHeadInput<HeadAugmentations>
