<template>
  <div ref="star" class="absolute bg-primary-300 dark:bg-white rounded-full opacity-100 star" :style="style" />
</template>

<script>
import { defineComponent, ref, computed, onMounted } from '@nuxtjs/composition-api'
export default defineComponent({
  setup () {
    const style = ref({})
    const randomY = ref(null)
    const randomX = ref(null)
    const randomRadius = computed(() => Math.round(Math.random() * Math.round(4)))
    const randomDuration = computed(() => Math.round(Math.random() * Math.round(10)))

    onMounted(() => {
      randomX.value = Math.random() * Math.floor(document.documentElement.clientWidth)
      randomY.value = Math.random() * Math.floor(document.documentElement.clientHeight)
      style.value = {
        top: randomY.value + 'px',
        left: randomX.value + 'px',
        height: randomRadius.value + 'px',
        width: randomRadius.value + 'px',
        animationDuration: randomDuration.value + 's'
      }
    })

    return {
      style,
      randomRadius,
      randomDuration,
      randomY,
      randomX
    }
  }
})
</script>
<style lang="postcss" scoped>
/* Stars */
.star {
  animation-name: fade;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  animation-direction: alternate;
}
</style>
