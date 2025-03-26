<script setup lang="ts">
/**
 * Overview page for the runtime compiler tests
 * Explains the purpose of each test case
 */
</script>

<template>
  <div>
    <div class="test-component">
      <h2>Welcome to the Nuxt Runtime Compiler Test Suite</h2>

      <div class="test-description">
        <p>This test suite verifies that Vue's Runtime Compiler works correctly within Nuxt, testing various ways of using runtime-compiled components.</p>
      </div>

      <h3>Test Cases</h3>

      <ul class="test-case-list">
        <li>
          <strong>Basic Component</strong>
          <p>Tests a basic Vue component with a template string using defineNuxtComponent.</p>
        </li>

        <li>
          <strong>Computed Template</strong>
          <p>Tests a component defined in setup with a computed template string that updates reactively.</p>
        </li>

        <li>
          <strong>TypeScript Component</strong>
          <p>Tests a TypeScript component using runtime compiler with a render function.</p>
        </li>

        <li>
          <strong>API Template</strong>
          <p>Tests a component that loads its template from an API endpoint.</p>
        </li>

        <li>
          <strong>Full Dynamic Component</strong>
          <p>Tests a component with both template and setup script loaded from an API endpoint.</p>
        </li>
      </ul>

      <div class="note">
        <h4>For Developers</h4>
        <p>Each test case demonstrates a different use case of the runtime compiler. Feel free to use this as a reference for implementing your own runtime-compiled components.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.test-case-list {
  margin: 1.5rem 0;
  padding-left: 1.5rem;
}

.test-case-list li {
  margin-bottom: 1rem;
}

.test-case-list strong {
  color: #00947e;
}

.test-case-list p {
  margin: 0.25rem 0 0;
}

.note {
  background-color: #fffde7;
  border-left: 4px solid #ffd54f;
  padding: 0.75rem;
  margin-top: 2rem;
}

.note h4 {
  margin-top: 0;
  color: #f57c00;
}

.note p {
  margin-bottom: 0;
}
</style>
