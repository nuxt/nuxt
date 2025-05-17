<template>
  <div>
    <NuxtPage />
  </div>
</template>

<style>
body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  margin: 0;
  padding: 0;
  color: #003543;
  background: #fafafa;
}

.test-component {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.test-component h2 {
  margin-top: 0;
  color: #003543;
}

.test-description {
  padding: 0.75rem;
  background: #f0f9f6;
  border-left: 4px solid #00DC82;
  margin-bottom: 1.5rem;
}

.component-display {
  padding: 1.5rem;
  background-color: #f8f9fa;
  border-radius: 6px;
  margin-bottom: 1.5rem;
  border: 1px solid #e9ecef;
}

button, .test-button {
  background: #00DC82;
  color: #003543;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  text-decoration: none;
  display: inline-block;
}

button:hover, .test-button:hover {
  background: #00c476;
}

.test-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 1rem;
}
</style>
