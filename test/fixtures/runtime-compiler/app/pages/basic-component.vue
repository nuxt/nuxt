<script setup lang="ts">
/**
 * Test case: Basic Component
 *
 * This demonstrates using a basic component with a template string
 * via defineNuxtComponent.
 */
import HelloWorld from '../components/Helloworld.vue'
</script>

<template>
  <div>
    <div class="test-component">
      <h2>Basic Component Test</h2>

      <div class="test-description">
        <p>
          This test demonstrates rendering a basic Vue component with a template string
          using <code>defineNuxtComponent</code>. The template is defined directly in the
          component file without requiring separate compilation.
        </p>
      </div>

      <h3>Component Output:</h3>
      <div class="component-display">
        <HelloWorld data-testid="hello-world" />
      </div>

      <h3>Implementation:</h3>
      <pre><code>
// Helloworld.vue
export default defineNuxtComponent({
  template: '&lt;div&gt;hello, Helloworld.vue here ! &lt;/div&gt;',
})
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

pre {
  background-color: #2d2d2d;
  color: #f8f8f2;
  padding: 1rem;
  border-radius: 6px;
  overflow-x: auto;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
}

code {
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
}
</style>
