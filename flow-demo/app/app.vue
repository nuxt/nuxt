<template>
  <ThemeToggle />
  <NuxtPage />
</template>

<style>
/* Theme variables */
:root {
  --bg: #000;
  --text: #ededed;
  --text-heading: #fff;
  --text-secondary: #a1a1a1;
  --text-muted: #888;
  --btn-bg: #fff;
  --btn-text: #000;
  --btn-hover: #e5e5e5;
  --border: #222;
  --border-light: #1a1a1a;
  --border-hover: #444;
  --border-btn: #333;
  --border-btn-hover: #555;
  --focus-ring: #fff;
  --link-hover: #666;
}

[data-theme="light"] {
  --bg: #fff;
  --text: #171717;
  --text-heading: #000;
  --text-secondary: #666;
  --text-muted: #888;
  --btn-bg: #000;
  --btn-text: #fff;
  --btn-hover: #333;
  --border: #e5e5e5;
  --border-light: #f0f0f0;
  --border-hover: #ccc;
  --border-btn: #ccc;
  --border-btn-hover: #999;
  --focus-ring: #000;
  --link-hover: #999;
}

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
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  transition: background 0.2s ease, color 0.2s ease;
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
  color: var(--text-heading);
  margin-bottom: 1rem;
}

h2 {
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin: 1.5rem 0 0.5rem;
}

p {
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

strong {
  color: var(--text-heading);
}

/* Links */
a {
  color: var(--text);
  text-decoration: none;
  transition: color 0.15s ease;
}

a:hover {
  color: var(--link-hover);
}

/* Buttons */
button {
  font-family: inherit;
  font-size: 0.875rem;
  background: var(--btn-bg);
  color: var(--btn-text);
  border: 1px solid var(--border-btn);
  border-radius: 6px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

button:hover {
  background: var(--btn-hover);
  border-color: var(--border-btn-hover);
}

button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

/* Lists */
ul {
  list-style: none;
  padding: 0;
}

li {
  padding: 0.375rem 0;
  border-bottom: 1px solid var(--border);
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
  color: var(--text-heading);
  font-weight: 600;
}

/* Blog card */
a:has(> a) {
  display: block;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 0.5rem;
  transition: border-color 0.15s ease;
}

a:has(> a):hover {
  border-color: var(--border-hover);
}

/* Section separators */
div > div + div {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-light);
}
</style>
