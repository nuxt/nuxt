This codemod converts paths emitted by Nuxt's builder:watch hook from relative to absolute, enhancing support for external directories and complex patterns.

🚦 **Impact Level**: Minimal

## What Changed

The Nuxt `builder:watch` hook now emits a path that is absolute rather than relative to your project `srcDir`.

## Reasons for Change

This change allows support for watching paths that are outside your `srcDir`, and offers better support for layers and other more complex patterns.


## Before

```jsx
nuxt.hook('builder:watch', (event, path) => {
  someFunction();
});
```

## After

```jsx
nuxt.hook('builder:watch', (event, path) => {
  path = relative(nuxt.options.srcDir, resolve(nuxt.options.srcDir, path));
  refreshFunction();
});
```
