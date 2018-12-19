<template>
  <div>{{ test.attributes.message }}</div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'

interface Test {
  attributes: {
    message: string
  }
}

@Component
export default class Interface extends Vue {
  test: Test = {
    attributes: {
      message: 'Interface Page'
    }
  }
}
</script>
