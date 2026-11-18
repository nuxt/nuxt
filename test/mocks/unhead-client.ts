import { createHead } from '@unhead/vue/client'
import type { SerializableHead } from '@unhead/vue/types'

export const appComponentHead: SerializableHead[] = []

export const createClientHead = () => createHead()
