<script setup lang="ts">
/**
 * Test case: Component defined in setup with computed template
 *
 * This demonstrates defining a component with a computed template string
 * that updates reactively when state changes.
 */
const count = ref(0)

// Component with a computed template that updates when count changes
const ComponentDefinedInSetup = computed(() => defineComponent({
  template: `
<div class="border">
    <div>hello i am defined in the setup of app.vue</div>
    <div>This component template is in a computed refreshed on count</div>
    count: <span data-testid="computed-count">${count.value}</span>.
    I don't recommend doing this for performance reasons; prefer passing props for mutable data.
</div>`,
}))
</script>

<template>
  <div>
    <div class="test-component">
      <h2>Computed Template Test</h2>

      <div class="test-description">
        <p>
          This test demonstrates creating a component in setup with a computed template
          that reacts to state changes. When the count changes, the component template
          is regenerated with the new value.
        </p>
      </div>

      <h3>Component Output:</h3>
      <div class="component-display">
        <ComponentDefinedInSetup data-testid="component-defined-in-setup" />
      </div>

      <div class="controls">
        <button
          data-testid="increment-count"
          @click="count++"
        >
          Increment Count: {{ count }}
        </button>
      </div>

      <h3>Implementation:</h3>
      <pre><code>
const count = ref(0)

// Component with a computed template that updates when count changes
const ComponentDefinedInSetup = computed(() => defineComponent({
  template: `
&lt;div class="border"&gt;
    &lt;div&gt;hello i am defined in the setup of app.vue&lt;/div&gt;
    &lt;div&gt;This component template is in a computed refreshed on count&lt;/div&gt;
    count: &lt;span data-testid="computed-count"&gt;${count.value}&lt;/span&gt;.
    I don't recommend doing this for performance reasons; prefer passing props for mutable data.
&lt;/div&gt;`,
}))
      </code></pre>
    </div>
  </div>
</template>

<style scoped>
.component-display {
  padding: 1.5rem;
  background-color: #f8f9fa;
  border-radius: 6px;
  margin-bottom: 1.5rem;
  border: 1px solid #e9ecef;
}

.controls {
  margin-bottom: 1.5rem;
}

pre {
  background-color: #2d2d2d;
  color: #f8f8f2;
  padding: 1rem;
  border-radius: 6px;
  overflow-x: auto;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
  white-space: pre-wrap;
}

code {
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
}
</style>
