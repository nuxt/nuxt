<template>
  <table>
    <tbody>
      <!-- Basic setup function -->
      <tr><td><b>setup</b></td><td> {{ setup }}</td></tr>
      <!-- Ref -->
      <tr>
        <td>
          <b>ref</b>
        </td>
        <td>
          {{ ref }}
        </td>
        <td>
          <button @click="ref = '❇️'">
            update
          </button>
        </td>
      </tr>
      <!-- Lifecycle methods -->
      <tr><td><b>onMounted</b></td><td> {{ mounted }}</td></tr>
      <!-- Wrappers -->
      <tr><td><b>useStore</b></td><td> {{ store.state.test }}</td></tr>
      <tr><td><b>useRoute</b></td><td> {{ route.path === '/legacy-capi' ? '✅' : '❌' }}</td></tr>
      <tr><td><b>useContext</b></td><td> {{ Object.keys(context).length ? '✅' : '❌' }}</td></tr>
      <!-- Helpers -->
      <tr><td><b>useAsync</b></td><td> {{ async }}</td></tr>
      <tr><td><b>ssrRef</b></td><td> {{ ssrRef }}</td></tr>
      <tr><td><b>shallowSsrRef</b></td><td> {{ shallow }}</td></tr>
      <tr><td><b>ssrPromise</b></td><td> {{ promise }}</td></tr>
      <tr>
        <td><b>useMeta</b></td><td> {{ title }}</td>
        <td>
          <button @click="title = '❇️'">
            update
          </button>
        </td>
      </tr>
      <tr><td><b>onGlobalSetup</b></td><td> {{ globalsetup }}</td></tr>
      <FetchTest />
      <tr><td><b>reqSsrRef</b></td><td> {{ '⛔️' }}</td></tr>
      <tr><td><b>reqRef</b></td><td> {{ '⛔️' }}</td></tr>
    </tbody>
  </table>
</template>

<script lang="ts">
import { useRoute, useContext, useStore, useAsync, ssrRef, shallowSsrRef, ssrPromise, useMeta } from '@nuxtjs/composition-api'

export default defineComponent({
  setup () {
    const mounted = ref()
    const shallow = shallowSsrRef('❌')
    const { isHMR, $globalsetup } = useContext()
    const { title } = useMeta()
    if (process.server || isHMR) {
      shallow.value = '✅'
      title.value = '❌'
    }
    const promise = ref(null)
    ssrPromise(() => new Promise(resolve => setTimeout(() => resolve(process.server || isHMR ? '✅' : '❌'), 100))).then((r) => {
      promise.value = r
    })
    onMounted(() => {
      mounted.value = '✅'
      title.value = '✅'
    })
    const store = useStore()
    const route = useRoute()

    return {
      setup: '✅',
      ref: ref('✅'),
      mounted,
      store,
      route,
      context: useContext(),
      async: useAsync(() => new Promise(resolve => setTimeout(() => resolve(process.server || isHMR ? '✅' : '❌'), 100))),
      ssrRef: ssrRef(() => process.server || isHMR ? '✅' : '❌'),
      shallow,
      promise,
      title,
      globalsetup: $globalsetup
    }
  },
  head: {}
})
</script>
