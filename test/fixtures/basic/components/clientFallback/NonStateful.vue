<template>
  <div>
    non stateful
    <NuxtClientFallback>
      <BreakInSetup class="clientfallback-non-stateful" />
    </NuxtClientFallback>
  </div>
</template>

<script>
export default defineNuxtComponent({
  name: 'ClientFallbackStateful'
})
</script>
