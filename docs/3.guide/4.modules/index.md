---
title: 'Module Author Guide'
titleTemplate: '%s'
description: 'Learn how to create a Nuxt module to integrate, enhance or extend any Nuxt applications.'
navigation: false
surround: false
---

Nuxt's [configuration](/docs/4.x/api/nuxt-config) and [hooks](/docs/4.x/guide/going-further/hooks) systems make it possible to customize every aspect of Nuxt and add any integration you might need (Vue plugins, CMS, server routes, components, logging, etc.).

**Nuxt modules** are functions that sequentially run when starting Nuxt in development mode using `nuxt dev` or building a project for production with `nuxt build`.
With modules, you can encapsulate, properly test, and share custom solutions as npm packages without adding unnecessary boilerplate to your project, or requiring changes to Nuxt itself.

::card-group{class="sm:grid-cols-1"}
  ::card{icon="i-lucide-rocket" title="Create Your First Module" to="/docs/4.x/guide/modules/getting-started"}
  Learn how to create your first Nuxt module using the official starter template.
  ::
  ::card{icon="i-lucide-box" title="Understand Module Structure" to="/docs/4.x/guide/modules/module-anatomy"}
  Learn how Nuxt modules are structured and how to define them.
  ::
  ::card{icon="i-lucide-code" title="Add Plugins, Components & More" to="/docs/4.x/guide/modules/recipes-basics"}
  Learn how to inject plugins, components, composables and server routes from your module.
  ::
  ::card{icon="i-lucide-layers" title="Use Hooks & Extend Types" to="/docs/4.x/guide/modules/recipes-advanced"}
  Master lifecycle hooks, virtual files and TypeScript declarations in your modules.
  ::
  ::card{icon="i-lucide-test-tube" title="Test Your Module" to="/docs/4.x/guide/modules/testing"}
  Learn how to test your Nuxt module with unit, integration and E2E tests.
  ::
  ::card{icon="i-lucide-medal" title="Follow Best Practices" to="/docs/4.x/guide/modules/best-practices"}
  Build performant and maintainable Nuxt modules with these guidelines.
  ::
  ::card{icon="i-lucide-globe" title="Publish & Share Your Module" to="/docs/4.x/guide/modules/ecosystem"}
  Join the Nuxt module ecosystem and publish your module to npm.
  ::
::
