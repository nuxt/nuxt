<script setup lang="ts">
const { status: status1 } = await useAsyncData(() => Promise.resolve(true))
if (status1.value !== 'SUCCESS') {
  throw new Error('status1 should be "SUCCESS"')
}

const { status: status2 } = await useAsyncData(() => Promise.reject(Error('boom!')))
if (status2.value !== 'ERROR') {
  throw new Error('status2 should be "ERROR"')
}

const { status: status3 } = await useAsyncData(() => Promise.resolve(true), { immediate: false })
if (status3.value !== 'IDLE') {
  throw new Error('status3 should be "IDLE"')
}

const { status: status4, execute } = await useAsyncData(() => Promise.resolve(true), { immediate: false })
await execute()
if (status4.value !== 'SUCCESS') {
  throw new Error('status4 should be "SUCCESS"')
}

const { status: status5 } = await useAsyncData(() => Promise.resolve(true), { server: false })
if (process.server && status5.value !== 'IDLE') {
  throw new Error('status5 should be "IDLE" server side')
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
      {{ status1 === 'SUCCESS' }}
      {{ status2 === 'ERROR' }}
      {{ status3 === 'IDLE' }}
      {{ status4 === 'SUCCESS' }}
      <ClientOnly>
        <div id="status5-values">
          {{ status5Values.join(',') }}
        </div>
      </ClientOnly>
    </div>
  </div>
</template>
