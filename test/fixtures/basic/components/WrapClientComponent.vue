<template>
  <div>
    <ClientSetupScript
      ref="clientSetupScript"
      class="client-only-script-setup"
      foo="hello"
    />
  </div>
</template>

<script setup lang="ts">
const clientSetupScript = ref<{ $el: HTMLElement }>()
onMounted(() => {
  console.log(clientSetupScript.value?.$el as HTMLElement ? 'has $el' : 'no $el')
})
</script>
