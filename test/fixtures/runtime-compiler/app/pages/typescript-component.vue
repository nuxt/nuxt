<script setup lang="ts">
/**
 * Test case: TypeScript Component
 *
 * This demonstrates using the runtime compiler with a TypeScript component
 * that uses a render function approach.
 */
</script>

<template>
  <div>
    <div class="test-component">
      <h2>TypeScript Component Test</h2>

      <div class="test-description">
        <p>
          This test demonstrates using the runtime compiler with a TypeScript component
          that defines a template as a prop and renders it using a render function.
        </p>
      </div>

      <h3>Component Output:</h3>
      <div class="component-display">
        <Name
          data-testid="name"
          template="<div>I am the Name.ts component</div>"
        />
      </div>

      <h3>Implementation:</h3>
      <pre><code>
// Name.ts
export default defineNuxtComponent({
  props: ['template', 'name'],
  /**
   * Most of the time, Vue compiler needs at least a VNode, use h() to render the component
   */
  render () {
    return h({
      props: ['name'],
      template: this.template,
    }, {
      name: this.name,
    })
  },
})
      </code></pre>

      <div class="note">
        <h4>Note</h4>
        <p>
          This approach is useful when you need to create components programmatically
          in TypeScript with strong type checking and don't want to use string templates directly.
        </p>
      </div>
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

.note {
  background-color: #fffde7;
  border-left: 4px solid #ffd54f;
  padding: 0.75rem;
  margin-top: 1.5rem;
}

.note h4 {
  margin-top: 0;
  color: #f57c00;
  margin-bottom: 0.5rem;
}

.note p {
  margin: 0;
}
</style>
