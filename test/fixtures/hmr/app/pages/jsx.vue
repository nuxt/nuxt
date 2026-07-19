<script lang="tsx">
import { defineComponent } from 'vue'

export default defineComponent({
  setup () {
    return () => <div data-testid="jsx-content">jsx: original</div>
  },
})
</script>
