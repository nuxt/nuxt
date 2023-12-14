<script setup lang="ts">
import type { Component } from 'vue'
import Helloworld from '../components/Helloworld.vue'
const count = ref(0)

const compTemplate = computed(() => `
<div class='border'>
    <div>hello i am defined in the setup of app.vue</div>
    <div>This component template is in a computed refreshed on count</div>
    count: <span class="count">${count.value}</span>.
    I dont recommend you to do this for performance issue, prefer passing props for mutable data.
</div>`
)

const ComponentDefinedInSetup = computed(() => h({
  template: compTemplate.value
}) as Component)

const { data, pending } = await useAsyncData('templates', async () => {
  const [interactiveComponent, templateString] = await Promise.all([
    $fetch('/api/full-component'),
    $fetch('/api/template')
  ])

  return {
    interactiveComponent,
    templateString
  }
}, {})

const Interactive = h({
  template: data.value?.interactiveComponent.template,
  setup (props) {
    // eslint-disable-next-line no-new-func
    return new Function(
      'ref',
      'computed',
      'props',
      data.value?.interactiveComponent.setup ?? ''
    )(ref, computed, props)
  },
  props: data.value?.interactiveComponent.props
}) as Component
</script>

<template>
  <!-- Edit this file to play around with Nuxt but never commit changes! -->
  <div>
    <Helloworld id="hello-world" />
    <ComponentDefinedInSetup id="component-defined-in-setup" />
    <button
      id="increment-count"
      @click="count++"
    >
      {{ count }}
    </button>
    <template v-if="!pending">
      <Name
        id="name"
        template="<div>I am the Name.ts component</div>"
      />
      <show-template
        id="show-template"
        :template="data?.templateString ?? ''"
        name="John"
      />
      <Interactive
        id="interactive"
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
