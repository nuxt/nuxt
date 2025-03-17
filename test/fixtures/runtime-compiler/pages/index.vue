<script setup lang="ts">
import type { Component } from 'vue'
import Helloworld from '../components/Helloworld.vue'

const count = ref(0)

const ComponentDefinedInSetup = computed(() => defineComponent({
  template: `
<div class="border">
    <div>hello i am defined in the setup of app.vue</div>
    <div>This component template is in a computed refreshed on count</div>
    count: <span data-testid="computed-count">${count.value}</span>.
    I don't recommend doing this for performance reasons; prefer passing props for mutable data.
</div>`,
}))

const { data, pending } = await useAsyncData('templates', async () => {
  const [interactiveComponent, templateString] = await Promise.all([
    $fetch('/api/full-component'),
    $fetch('/api/template'),
  ])

  return {
    interactiveComponent,
    templateString,
  }
}, {})

const Interactive = defineComponent({
  props: data.value?.interactiveComponent.props,
  setup (props) {
    return new Function(
      'ref',
      'computed',
      'props',
      data.value?.interactiveComponent.setup ?? '',
    )(ref, computed, props)
  },
  template: data.value?.interactiveComponent.template,
})
</script>

<template>
  <!-- Edit this file to play around with Nuxt but never commit changes! -->
  <div>
    <Helloworld data-testid="hello-world" />
    <ComponentDefinedInSetup data-testid="component-defined-in-setup" />
    <button
      data-testid="increment-count"
      @click="count++"
    >
      {{ count }}
    </button>
    <template v-if="!pending">
      <Name
        data-testid="name"
        template="<div>I am the Name.ts component</div>"
      />
      <show-template
        data-testid="show-template"
        :template="data?.templateString ?? ''"
        name="John"
      />
      <Interactive
        data-testid="interactive"
        lastname="Doe"
        firstname="John"
      />
    </template>
  </div>
</template>

<style>
.border {
  border: 1px solid burlywood;
}
</style>
