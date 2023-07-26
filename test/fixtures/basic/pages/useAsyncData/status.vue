<script setup lang="ts">
const { status: status1 } = await useAsyncData(() => Promise.resolve(true))
if (status1.value !== 'success') {
  throw new Error('status1 should be "success"')
}

const { status: status2 } = await useAsyncData(() => Promise.reject(Error('boom!')))
if (status2.value !== 'error') {
  throw new Error('status2 should be "error"')
}

const { status: status3 } = await useAsyncData(() => Promise.resolve(true), { immediate: false })
if (status3.value !== 'idle') {
  throw new Error('status3 should be "idle"')
}

const { status: status4, execute } = await useAsyncData(() => Promise.resolve(true), { immediate: false })
await execute()
if (status4.value !== 'success') {
  throw new Error('status4 should be "success"')
}

const { status: status5 } = await useAsyncData(() => Promise.resolve(true), { server: false })
if (process.server && status5.value !== 'idle') {
  throw new Error('status5 should be "idle" server side')
}

const status5Values = ref<string[]>([])
watchEffect(() => {
  status5Values.value.push(status5.value)
})
</script>

<template>
  <div>
    Status
    <div>
      {{ status1 === 'success' }}
      {{ status2 === 'error' }}
      {{ status3 === 'idle' }}
      {{ status4 === 'success' }}
      <ClientOnly>
        <div id="status5-values">
          {{ status5Values.join(',') }}
        </div>
      </ClientOnly>
    </div>
  </div>
</template>
