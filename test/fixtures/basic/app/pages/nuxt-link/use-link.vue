<script setup lang="ts">
import { resolveDynamicComponent } from 'vue'
import { NuxtLink } from '#components'

const useLinkPresent = 'useLink' in NuxtLink
const link = useLinkPresent ? NuxtLink.useLink({ to: '/nuxt-link/trailing-slash' }) : undefined
const route = computed(() => link?.route.value.path)
const href = computed(() => link?.href.value)

const NuxtLink2 = resolveComponent('NuxtLinkAlias') as unknown as any
const useLink2Present = typeof NuxtLink2 !== 'string' && 'useLink' in NuxtLink2
const link2 = useLink2Present ? NuxtLink2.useLink({ to: '/nuxt-link/trailing-slash' }) : undefined
const route2 = computed(() => link2?.route.value.path)
const href2 = computed(() => link2?.href.value)

const NuxtLink3 = resolveDynamicComponent('NuxtLinkAlias') as unknown as any
const useLink3Present = typeof NuxtLink3 !== 'string' && 'useLink' in NuxtLink3
const link3 = useLink3Present ? NuxtLink3.useLink({ to: '/nuxt-link/trailing-slash' }) : undefined
const route3 = computed(() => link3?.route.value.path)
const href3 = computed(() => link3?.href.value)
</script>

<template>
  <div>
    <div>useLink in NuxtLink: {{ useLinkPresent }}</div>
    <div>route using useLink: {{ route }}</div>
    <div>href using useLink: {{ href }}</div>
    <button
      id="button1"
      @click="link?.navigate()"
    >
      Test
    </button>
    <div>useLink2 in NuxtLink: {{ useLink2Present }}</div>
    <div>route2 using useLink: {{ route2 }}</div>
    <div>href2 using useLink: {{ href2 }}</div>
    <button
      id="button2"
      @click="link2?.navigate()"
    >
      Test
    </button>
    <div>useLink3 in NuxtLink: {{ useLink3Present }}</div>
    <div>route3 using useLink: {{ route3 }}</div>
    <div>href3 using useLink: {{ href3 }}</div>
    <button
      id="button3"
      @click="link3?.navigate()"
    >
      Test
    </button>
  </div>
</template>
