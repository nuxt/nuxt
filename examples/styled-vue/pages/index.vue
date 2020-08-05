<template>
  <div>
    <h1>styled-vue</h1>
    <a href="https://github.com/egoist/styled-vue" class="github">
      Check it out on GitHub.
    </a>
  </div>
</template>

<script>
import { css } from 'styled-vue'

export default {
  style: css`
    h1 {
      color: red;
      font-size: ${vm => vm.fontSize}px;
    }
    .github {
      color: blue;
      animation: blink 1s linear infinite;
    }
    @keyframes blink {
      50% {
        opacity: 0;
      }
    }
  `,
  data () {
    return {
      fontSize: 60
    }
  }
}
</script>
