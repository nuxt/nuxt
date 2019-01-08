<template>
  <div>
    <h1>styled-vue</h1>
    <a href="https://github.com/egoist/styled-vue" class="github">Check it out on GitHub.</a>
  </div>
</template>

<script>
import { css } from 'styled-vue'

export default {
  style: css`
    h1 {
      color: red;
      font-size: ${vm => vm.fontSize}px
    }
  `,
  data() {
    return {
      fontSize: 60
    }
  }
}
</script>
