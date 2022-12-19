<template>
  <div>
    <Head>
      <Title>Basic fixture</Title>
    </Head>
    <h1>Hello Nuxt 3!</h1>
    <div>RuntimeConfig | testConfig: {{ config.testConfig }}</div>
    <div>Composable | foo: {{ foo }}</div>
    <div>Composable | bar: {{ bar }}</div>
    <DevOnly>Some dev-only info</DevOnly>
    <div><DevOnly>Some dev-only info</DevOnly></div>
    <div>Composable | template: {{ templateAutoImport }}</div>
    <div>Path: {{ $route.fullPath }}</div>
    <NuxtLink to="/">
      Link
    </NuxtLink>
    <NestedSugarCounter :count="12" />
    <CustomComponent />
    <component :is="`test${'-'.toString()}global`" />
    <component :is="`with${'-'.toString()}suffix`" />
    <ClientWrapped ref="clientRef" style="color: red;" class="client-only" />
  </div>
</template>

<script setup lang="ts">
import { setupDevtoolsPlugin } from '@vue/devtools-api'
import { useRuntimeConfig } from '#imports'
import { importedValue, importedRE } from '~/some-exports'

setupDevtoolsPlugin({}, () => {}) as any

const config = useRuntimeConfig()

definePageMeta({
  alias: '/some-alias',
  other: ref('test'),
  imported: importedValue,
  something: importedRE.test('an imported regex')
})

// reset title template example
useHead({
  titleTemplate: ''
})

const foo = useFoo()
const bar = useBar()
const clientRef = ref()

onMounted(() => {
  clientRef.value.exposedFunc()
})
</script>
