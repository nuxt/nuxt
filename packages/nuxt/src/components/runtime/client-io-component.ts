import { defineComponent } from "vue"
export default defineComponent({
  emits: ['intersected'],
  setup() {
    const data = ref(null);
    const isIntersecting = ref(false);
    const target = ref(null);
    let observer: Ref<IntersectionObserver | null> = ref(null)
    onMounted(() => {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            isIntersecting.value = true;
            emit('intersected');
            observer.unobserve(target.value);
          }
        });
      });
      observer.observe(target.value);
    });

    return {
      isIntersecting
    };
  }
});
