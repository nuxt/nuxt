<script setup lang="ts" vapor>
const compRef = ref()
const refInfo = ref('pending')
onMounted(() => {
  refInfo.value = [
    compRef.value ? 'comp:ok' : 'comp:missing',
    compRef.value?.$el ? '$el:present' : '$el:absent',
  ].join(' ')
})
</script>

<template>
  <div>
    <VaporCounter
      ref="compRef"
      label="vapor in vapor"
    />
    <p data-testid="nested-refs">
      {{ refInfo }}
    </p>
  </div>
</template>
