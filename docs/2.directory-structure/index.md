---
title: 'Nuxt Directory Structure'
description: 'Learn about the directory structure of a Nuxt application and how to use it.'
navigation: false
---

Nuxt applications have a specific directory structure that is used to organize the code. This structure is designed to be easy to understand and to be used in a consistent way.

## Root Directory

The root directory of a Nuxt application is the directory that contains the `nuxt.config.ts` file. This file is used to configure the Nuxt application.

## App Directory

The `app/` directory is the main directory of the Nuxt application. It contains the following subdirectories:
- [`assets/`](/docs/directory-structure/app/assets): website's assets that the build tool (Vite or webpack) will process
- [`components/`](/docs/directory-structure/app/components): Vue components of the application
- [`composables/`](/docs/directory-structure/app/composables): add your Vue composables
- [`layouts/`](/docs/directory-structure/app/layouts): Vue components that wrap around your pages and avoid re-rendering between pages
- [`middleware/`](/docs/directory-structure/app/middleware): run code before navigating to a particular route
- [`pages/`](/docs/directory-structure/app/pages): file-based routing to create routes within your web application
- [`plugins/`](/docs/directory-structure/app/plugins): use Vue plugins and more at the creation of your Nuxt application
- [`utils/`](/docs/directory-structure/app/utils): add functions throughout your application that can be used in your components, composables, and pages.

This directory also includes specific files:
- [`app.config.ts`](/docs/directory-structure/app/app-config): a reactive configuration within your application
- [`app.vue`](/docs/directory-structure/app/app): the root component of your Nuxt application
- [`error.vue`](/docs/directory-structure/app/error): the error page of your Nuxt application

## Public Directory

The [`public/`](/docs/directory-structure/public) directory is the directory that contains the public files of the Nuxt application. Files contained within this directory are served at the root and are not modified by the build process.

This is suitable for files that have to keep their names (e.g. `robots.txt`) _or_ likely won't change (e.g. `favicon.ico`).

## Server Directory

The [`server/`](/docs/directory-structure/server) directory is the directory that contains the server-side code of the Nuxt application. It contains the following subdirectories:
- [`api/`](/docs/directory-structure/server#server-routes): contains the API routes of the application.
- [`routes/`](/docs/directory-structure/server#server-routes): contains the server routes of the application (e.g. dynamic `/sitemap.xml`).
- [`middleware/`](/docs/directory-structure/server#server-middleware): run code before a server route is processed
- [`plugins/`](/docs/directory-structure/server#server-plugins): use plugins and more at the creation of the Nuxt server
- [`utils/`](/docs/directory-structure/server#server-utilities): add functions throughout your application that can be used in your server  code.

## Shared Directory

The [`shared/`](/docs/directory-structure/shared) directory is the directory that contains the shared code of the Nuxt application and Nuxt server. This code can be used in both the Vue app and the Nitro server.

## Content Directory

The [`content/`](/docs/directory-structure/content) directory is enabled by the [Nuxt Content](https://content.nuxt.com) module. It is used to create a file-based CMS for your application using Markdown files.

## Modules Directory

The [`modules/`](/docs/directory-structure/modules) directory is the directory that contains the local modules of the Nuxt application. Modules are used to extend the functionality of the Nuxt application.

## Nuxt Files

- [`nuxt.config.ts`](/docs/directory-structure/nuxt-config) file is the main configuration file for the Nuxt application.
- [`.nuxtrc`](/docs/directory-structure/nuxtrc) file is another syntax for configuring the Nuxt application (useful for global configurations).
- [`.nuxtignore`](/docs/directory-structure/nuxtignore) file is used to ignore files in the root directory during the build phase.

