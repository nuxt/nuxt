<script setup>
const ctr = ref(0)
const { data, pending, refresh } = await useAsyncData(() => $fetch(`/api/hello/${ctr.value}`), { watch: [ctr] })

</script>

<template>
  <div>
    {{ data }}
    <div class="flex justify-center gap-2">
      <NButton :disabled="pending" @click="ctr++">
        +
      </NButton>
      <NButton :disabled="pending" @click="refresh">
        ⟳
      </NButton>
    </div>
  </div>
</template>
