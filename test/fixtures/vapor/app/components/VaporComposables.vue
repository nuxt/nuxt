<script setup lang="ts" vapor>
import { useAttrs, useId } from 'vue'

const nuxtApp = tryUseNuxtApp()
const state = useState('vapor-composables-state', () => 'state-ok')
const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()
const id = useId()
const attrs = useAttrs()

useHead({ title: 'vapor head title' })
useSeoMeta({ description: 'vapor seo description' })

onPrehydrate(() => {
  document.documentElement.setAttribute('data-vapor-prehydrate', 'ran')
})

const ready = ref('pending')
onNuxtReady(() => { ready.value = 'ready' })

const requestFetch = useRequestFetch()
const { data: hello, status } = useAsyncData('vapor-hello', () => requestFetch<{ hello: string }>('/api/hello'))

const elRef = ref<HTMLElement>()
const refInfo = ref('pending')
onMounted(() => {
  refInfo.value = elRef.value instanceof HTMLElement ? 'el:ok' : 'el:missing'
})
</script>

<template>
  <div>
    <p data-testid="nuxt-app">
      {{ nuxtApp ? 'nuxt-app-ok' : 'nuxt-app-missing' }}
    </p>
    <p data-testid="state">
      {{ state }}
    </p>
    <p data-testid="route-path">
      {{ route.path }}
    </p>
    <p data-testid="router">
      {{ router?.currentRoute.value.path === route.path ? 'router-ok' : 'router-missing' }}
    </p>
    <p data-testid="runtime-config">
      {{ config.public.testValue }}
    </p>
    <p data-testid="use-id">
      {{ id || 'id-missing' }}
    </p>
    <p data-testid="attrs">
      {{ attrs['data-extra'] || 'attrs-missing' }}
    </p>
    <p data-testid="ready">
      {{ ready }}
    </p>
    <p data-testid="async-data">
      {{ hello?.hello ?? 'no-data' }} ({{ status }})
    </p>
    <div
      ref="elRef"
      data-testid="el-ref-target"
    />
    <p data-testid="refs">
      {{ refInfo }}
    </p>
  </div>
</template>
