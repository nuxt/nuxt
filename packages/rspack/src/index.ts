import './impl.ts'

import type { NuxtBuilder } from '@nuxt/schema'

import { bundle as bundleWithRsbuild } from './rsbuild.ts'

export const bundle: NuxtBuilder['bundle'] = nuxt => bundleWithRsbuild(nuxt)
