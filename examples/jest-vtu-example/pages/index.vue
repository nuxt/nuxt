<template>
  <section class="container">
    <div>
      <h1 class="title">
        jest-vtu-example
      </h1>
      <Btn label="click me!" />
    </div>
  </section>
</template>

<script>
import Btn from '~/components/Btn/Btn.vue'

export default {
  components: {
    Btn
  }
}
</script>
