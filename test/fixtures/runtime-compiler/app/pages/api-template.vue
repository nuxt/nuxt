<script setup lang="ts">
/**
 * Test case: API Template Component
 *
 * This demonstrates using the runtime compiler with a template
 * fetched from an API endpoint.
 */
const { data, pending } = await useAsyncData('templateString', async () => {
  const templateString = await $fetch('/api/template')
  return { templateString }
})
</script>

<template>
  <div>
    <div class="test-component">
      <h2>API Template Test</h2>

      <div class="test-description">
        <p>
          This test demonstrates using the runtime compiler with a template string
          that is fetched from an API endpoint. This is useful when templates need to be
          dynamically loaded or managed outside the application.
        </p>
      </div>

      <div
        v-if="pending"
        class="loading"
      >
        Loading template from API...
      </div>

      <template v-else>
        <h3>Component Output:</h3>
        <div class="component-display">
          <show-template
            data-testid="show-template"
            :template="data!.templateString"
            name="John"
          />
        </div>

        <h3>API Response (Template):</h3>
        <pre class="api-response"><code>{{ data!.templateString }}</code></pre>

        <h3>Implementation:</h3>
        <pre><code>
// ShowTemplate.vue
export default defineNuxtComponent({
  props: {
    template: {
      required: true,
      type: String,
    },
    name: {
      type: String,
      default: () => '(missing name prop)',
    },
  },
  setup (props) {
    const showIt = h({
      template: props.template,
      props: {
        name: {
          type: String,
          default: () => '(missing name prop)',
        },
      },
    })
    return {
      showIt,
    }
  },
})

// API Endpoint (server/api/template.get.ts)
export default defineEventHandler(() => {
  return '&lt;div data-testid="template-content"&gt;Hello my name is : {\{ name }}, i am defined by ShowTemplate.vue and my template is retrieved from the API&lt;/div&gt;'
})
        </code></pre>
      </template>
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

.loading {
  text-align: center;
  padding: 2rem;
  color: #6c757d;
  font-style: italic;
}

.api-response {
  background-color: #e9f5ff;
  color: #0366d6;
  padding: 1rem;
  border-radius: 6px;
  overflow-x: auto;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
  white-space: pre-wrap;
  word-break: break-word;
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
