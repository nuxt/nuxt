import { defineComponent, onMounted, onUnmounted, ref } from 'vue'
import type { Ref } from 'vue'

export default defineComponent({
  emits: ['intersect'],
  setup (props, { emit }) {
    const intersectionTarget: Ref<Element | null> = ref(null)
    let observer: IntersectionObserver | null = null

    const intersectionCallback: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          emit('intersect')
          observer!.unobserve(entry.target)
        }
      })
    }

    onMounted(() => {
      observer = new IntersectionObserver(intersectionCallback)
      observer.observe(intersectionTarget.value as Element)
    })

    onUnmounted(() => {
      if (observer) {
        observer.disconnect()
      }
    })

    return {
      intersectionTarget
    }
  }
})
