<template>
  <div>
    <header>
      <h1 data-testid="page-title">
        Nuxt Runtime Compiler Tests
      </h1>
      <nav>
        <ul>
          <li>
            <NuxtLink
              to="/"
              active-class="active"
            >
              Overview
            </NuxtLink>
          </li>
          <li>
            <NuxtLink
              to="/basic-component"
              active-class="active"
            >
              Basic Component
            </NuxtLink>
          </li>
          <li>
            <NuxtLink
              to="/component-in-setup"
              active-class="active"
            >
              Computed Template
            </NuxtLink>
          </li>
          <li>
            <NuxtLink
              to="/typescript-component"
              active-class="active"
            >
              TypeScript Component
            </NuxtLink>
          </li>
          <li>
            <NuxtLink
              to="/api-template"
              active-class="active"
            >
              API Template
            </NuxtLink>
          </li>
          <li>
            <NuxtLink
              to="/full-dynamic"
              active-class="active"
            >
              Full Dynamic Component
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </header>

    <main>
      <slot />
    </main>

    <footer>
      <p>
        <small>These tests verify Vue's runtime compiler works correctly in Nuxt</small>
      </p>
    </footer>
  </div>
</template>

<style>
body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  margin: 0;
  padding: 0;
  color: #222;
  background: #fafafa;
}

header {
  background-color: #00DC82;
  color: #003543;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

h1 {
  margin-top: 0;
  margin-bottom: 1rem;
}

nav ul {
  display: flex;
  list-style: none;
  padding: 0;
  margin: 0;
  flex-wrap: wrap;
  gap: 0.5rem;
}

nav li a {
  display: block;
  padding: 0.5rem 1rem;
  text-decoration: none;
  color: #003543;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  transition: all 0.2s ease;
}

nav li a:hover {
  background-color: rgba(255, 255, 255, 0.4);
}

nav li a.active {
  background-color: #003543;
  color: white;
}

main {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 1rem 2rem;
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

.border {
  border: 1px solid burlywood;
  padding: 1rem;
  background: #fffaf0;
  border-radius: 4px;
}

button {
  background: #00DC82;
  color: #003543;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

button:hover {
  background: #00c476;
}

footer {
  text-align: center;
  padding: 1rem;
  color: #666;
  border-top: 1px solid #eee;
  margin-top: 2rem;
}
</style>
