# Defining custom routes with Nuxt.js

> Nuxt.js is based on `vue-router` and let you to defined custom routes easily :rocket:

## Concept

Nuxt.js generates automatically the `vue-router` configuration according to your file tree of `.vue` files inside the `pages/` directory.

## Basic routes

This file tree:

```bash
pages/
--| team/
-----| index.vue
-----| about.vue
--| index.vue
```

will automatically generate:

```js
router: {
  routes: [
    {
      name: 'index',
      path: '/',
      component: 'pages/index.vue'
    },
    {
      name: 'team',
      path: '/team',
      component: 'pages/team/index.vue'
    },
    {
      name: 'team-about',
      path: '/team/about',
      component: 'pages/team/about.vue'
    }
  ]
}
```

## Dynamic routes

To define a dynamic route with a param, you need to define a `.vue` file **prefixed by an underscore**.

This file tree:

```bash
pages/
--| users/
-----| _id.vue
-----| index.vue
```

will automatically generate:

```js
router: {
  routes: [
    {
      name: 'users',
      path: '/users',
      component: 'pages/users/index.vue'
    },
    {
      name: 'users-id',
      path: '/users/:id',
      component: 'pages/users/_id.vue'
    }
  ]
}
```

### Additional feature: validate (optional)

Nuxt.js lets you define a validator function inside your dynamic route component (In this example: `pages/users/_id.vue`).

If the validate method does not return `true`, Nuxt.js will automatically load the 404 error page.

```js
<script>
export default {
  validate ({ params }) {
    return /^\d+$/.test(params.id)
  }
}
</script>
```

## Nested Routes (children)

To define a nested route, you need to create a `.vue` file with the **same name as the directory** which contain your children views.
> Don't forget to put `<nuxt-child></nuxt-child>` inside your parent `.vue` file.

This file tree:

```bash
pages/
--| users/
-----| _id.vue
--| users.vue
```

will automatically generate:

```js
router: {
  routes: [
    {
      path: '/users',
      component: 'pages/users.vue',
      children: [
        {
          path: ':id',
          component: 'pages/users/_id.vue',
          name: 'users-id'
        }
      ]
    }
  ]
}
```

## Dynamic Nested Routes

This file tree:

```bash
pages/
--| posts/
-----| _slug/
--------| _name.vue
--------| comments.vue
-----| _slug.vue
-----| index.vue
--| posts.vue
```

will automatically generate:

```js
router: {
  routes: [
    {
      path: '/posts',
      component: 'pages/posts.vue',
      children: [
        {
          path '',
          component: 'pages/posts/index.vue',
          name: 'posts'
        },
        {
          path: ':slug',
          component: 'pages/posts/_slug.vue',
          children: [
            {
              path: 'comments',
              component: 'pages/posts/_slug/comments.vue',
              name: 'posts-slug-comments'
            },
            {
              path: ':name',
              component: 'pages/posts/_slug/_name.vue',
              name: 'posts-slug-name'
            }
          ]
        }
      ]
    }
  ]
}
```

## Demo

```bash
npm install
npm start
```

Go to [http://localhost:3000](http://localhost:3000) and navigate through the pages.
