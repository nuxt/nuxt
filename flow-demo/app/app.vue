<template>
  <NuxtPage />
</template>

<style>
/* Reset */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* Base */
body {
  font-family: 'Geist Mono', monospace;
  background: #000;
  color: #ededed;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* Page layout */
#__nuxt > div {
  max-width: 640px;
  margin: 0 auto;
  padding: 3rem 1.5rem;
}

/* Typography */
h1 {
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: #fff;
  margin-bottom: 1rem;
}

h2 {
  font-size: 1.1rem;
  font-weight: 500;
  color: #a1a1a1;
  margin: 1.5rem 0 0.5rem;
}

p {
  color: #888;
  margin-bottom: 0.5rem;
}

strong {
  color: #fff;
}

/* Links */
a {
  color: #ededed;
  text-decoration: none;
  transition: color 0.15s ease;
}

a:hover {
  color: #666;
}

/* Buttons */
button {
  font-family: inherit;
  font-size: 0.875rem;
  background: #fff;
  color: #000;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

button:hover {
  background: #e5e5e5;
  border-color: #555;
}

button:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

/* Lists */
ul {
  list-style: none;
  padding: 0;
}

li {
  padding: 0.375rem 0;
  border-bottom: 1px solid #222;
}

li:last-child {
  border-bottom: none;
}

/* Flex button groups */
div:has(> button + button),
div:has(> button + a),
div:has(> a + button) {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-top: 1rem;
}

/* Counter large display */
p:has(+ div > button) {
  font-size: 2rem;
  color: #fff;
  font-weight: 600;
}

/* Blog card */
a:has(> a) {
  display: block;
  padding: 1rem;
  border: 1px solid #222;
  border-radius: 8px;
  margin-bottom: 0.5rem;
  transition: border-color 0.15s ease;
}

a:has(> a):hover {
  border-color: #444;
}

/* Section separators */
div > div + div {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #1a1a1a;
}
</style>
