<script setup lang="ts">
/**
 * Test case: Full Dynamic Component
 *
 * This demonstrates using the runtime compiler with both template and script
 * fetched from an API endpoint, creating a fully dynamic component.
 */
const { data, pending } = await useAsyncData('interactiveComponent', async () => {
  const interactiveComponent = await $fetch('/api/full-component')
  return { interactiveComponent }
})

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
  <div>
    <div class="test-component">
      <h2>Full Dynamic Component Test</h2>

      <div class="test-description">
        <p>
          This test demonstrates creating a fully dynamic component where both
          template and script logic are fetched from an API endpoint. This approach
          enables completely runtime-defined components with reactive behavior.
        </p>
      </div>

      <div
        v-if="pending"
        class="loading"
      >
        Loading component definition from API...
      </div>

      <template v-else>
        <h3>Component Output:</h3>
        <div class="component-display">
          <Interactive
            data-testid="interactive"
            lastname="Doe"
            firstname="John"
          />
        </div>

        <h3>API Response (Component Definition):</h3>
        <pre class="api-response"><code>{{ JSON.stringify(data!.interactiveComponent, null, 2) }}</code></pre>

        <div class="test-instructions">
          <h4>Interactive Test</h4>
          <p>
            Click the "click here" button in the component above to test reactivity.
            The counter should increment, demonstrating that the dynamic script is
            properly executed and reactive.
          </p>
        </div>

        <h3>Implementation:</h3>
        <pre><code>
// In your page/component
const { data } = await useAsyncData('interactiveComponent', async () => {
  const interactiveComponent = await $fetch('/api/full-component')
  return { interactiveComponent }
})

const Interactive = defineComponent({
  props: data.value?.interactiveComponent.props,
  setup(props) {
    return new Function(
      'ref',
      'computed',
      'props',
      data.value?.interactiveComponent.setup ?? '',
    )(ref, computed, props)
  },
  template: data.value?.interactiveComponent.template,
})

// API Endpoint (server/api/full-component.get.ts)
import { defineHandler } from 'nitro/h3'

export default defineHandler(() => {
  return {
    props: ['lastname', 'firstname'],
    setup: `
      const fullName = computed(() => props.lastname + ' ' + props.firstname);
      const count = ref(0);
      return {fullName, count}
    `,
    template: '&lt;div&gt;my name is {\{ fullName }}, &lt;button data-testid="inc-interactive-count" @click="count++"&gt;click here&lt;/button&gt; count: &lt;span data-testid="interactive-count"&gt;{\{ count }}&lt;/span&gt;. I am defined by Interactive in the setup of App.vue. My full component definition is retrieved from the api &lt;/div&gt;',
  }
})
        </code></pre>

        <div class="note">
          <h4>Security Note</h4>
          <p>
            When using this approach in production, always sanitize templates and scripts
            from external sources. Using new Function() with untrusted content can lead to
            security vulnerabilities including code injection.
          </p>
        </div>
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
}

.test-instructions {
  background-color: #f0f9ff;
  border-left: 4px solid #0ea5e9;
  padding: 0.75rem;
  margin-bottom: 1.5rem;
}

.test-instructions h4 {
  margin-top: 0;
  color: #0369a1;
  margin-bottom: 0.5rem;
}

.test-instructions p {
  margin: 0;
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

.note {
  background-color: #fff1f2;
  border-left: 4px solid #f43f5e;
  padding: 0.75rem;
  margin-top: 1.5rem;
}

.note h4 {
  margin-top: 0;
  color: #be123c;
  margin-bottom: 0.5rem;
}

.note p {
  margin: 0;
}
</style>
