<template>
  <div>
    <Head>
      <Title>Basic fixture</Title>
    </Head>
    <h1>Hello Nuxt 3!</h1>
    <div>RuntimeConfig | testConfig: {{ config.public.testConfig }}</div>
    <div>Composable | foo: {{ foo }}</div>
    <div>Composable | bar: {{ bar }}</div>
    <div>Composable | template: {{ templateAutoImport }}</div>
    <div>Composable | star: {{ useNestedBar() }}</div>
    <DevOnly>Some dev-only info</DevOnly>
    <div><DevOnly>Some dev-only info</DevOnly></div>
    <div>
      <DevOnly>
        Some dev-only info
        <template #fallback>
          Some prod-only info
        </template>
      </DevOnly>
    </div>
    <div>Path: {{ $route.fullPath }}</div>
    <NuxtLink to="/">
      Link
    </NuxtLink>
    <NuxtLink
      id="islands"
      to="/islands"
    >
      islands
    </NuxtLink>
    <NuxtLink
      id="to-immediate-remove-unmounted"
      to="/useAsyncData/immediate-remove-unmounted"
    >
      Immediate remove unmounted
    </NuxtLink>
    <NuxtLink
      no-prefetch
      to="/chunk-error"
    >
      Chunk error
    </NuxtLink>
    <NuxtLink
      id="to-client-only-components"
      to="/client-only-components"
    >
      createClientOnly()
    </NuxtLink>
    <NuxtLink
      id="middleware-abort-non-fatal"
      to="/middleware-abort-non-fatal"
      :prefetch="false"
    >
      Middleware abort navigation
    </NuxtLink>
    <NuxtLink
      id="middleware-abort-non-fatal-error"
      to="/middleware-abort-non-fatal?error=someerror"
      :prefetch="false"
    >
      Middleware abort navigation with error
    </NuxtLink>
    Some value: {{ someValue }}
    <button @click="someValue++">
      Increment state
    </button>
    <NuxtLink to="/no-scripts">
      to no script
    </NuxtLink>
    <NestedCounter :multiplier="2" />
    <CustomComponent />
    <component :is="`global${'-'.toString()}sync`" />
    <Spin>Test</Spin>
    <component :is="`test${'-'.toString()}global`" />
    <component :is="`with${'-'.toString()}suffix`" />
    <ClientWrapped
      ref="clientRef"
      style="color: red;"
      class="client-only"
    />
    <NuxtIsland
      ref="island"
      name="AsyncServerComponent"
      :props="{ count: 34 }"
    />
    <ServerOnlyComponent
      class="server-only"
      style="background-color: gray;"
    />
    <NuxtLink to="/big-page-1">
      to big 1
    </NuxtLink>
    <NuxtLink to="/server-page">
      to server page
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { setupDevtoolsPlugin } from '@vue/devtools-api'
import { toDisplayString } from 'vue'
import { useRuntimeConfig } from '#imports'
import { importedRE, importedValue } from '~/some-exports'
import type { NuxtIsland, ServerOnlyComponent } from '#build/components'

toDisplayString(useRoute())

setupDevtoolsPlugin({}, () => {}) as any
const island = ref<InstanceType<typeof ServerOnlyComponent>>()
const config = useRuntimeConfig()

const someValue = useState('val', () => 1)

const NestedCounter = resolveComponent('NestedCounter')
if (!NestedCounter) {
  throw new Error('Component not found')
}
useHead({
  meta: [
    {
      name: 'author',
      content: 'Nuxt',
      key: 'testkey',
    },
    {
      name: 'author',
      content: 'Nuxt',
      key: 'testkey',
    },
  ],
  script: [
    {
      innerHTML: 'console.log("my script")',
      key: 'my-script',
    },
    {
      innerHTML: 'console.log("my script")',
      key: 'my-script',
    },
  ],
}, { key: 'testkey' })
definePageMeta({
  alias: '/some-alias',
  other: ref('test'),
  imported: importedValue,
  something: importedRE.test('an imported regex'),
})

// reset title template example
useHead({
  titleTemplate: '',
})

const foo = useFoo()
const bar = useBar()
const clientRef = ref()

onMounted(() => {
  clientRef.value.exposedFunc()
})
</script>
