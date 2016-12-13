# Defining custom routes with Nuxt.js

> Nuxt.js is based on vue-router and allows you to defined custom routes :rocket:

## Concept

Nuxt.js detect and generate automatically the vue-router config according to your file tree of .vue files inside the `pages` directory.

## Basic routes

This file tree:

```bash
/pages
|-> /team
    |-> index.vue
    |-> about.vue
|-> index.vue
```

will automatically generate:

```js
router: {
  routes: [
    {
      name: 'index',
      path: '/',
      component: 'pages/index'
    },
    {
      name: 'team',
      path: '/team',
      component: 'pages/team/index'
    },
    {
      name: 'team-about',
      path: '/team/about',
      component: 'pages/team/about'
    }
  ]
}
```

## Dynamic routes

To define a dynamic route with a param, you need to define a .vue file prefixed by an underscore.

This file tree:

```bash
/pages
|-> /projects
    |-> index.vue
    |-> _slug.vue
```

will automatically generate:

```js
router: {
  routes: [
    {
      name: 'projects',
      path: '/projects',
      component: 'pages/projects/index'
    },
    {
      name: 'projects-slug',
      path: '/projects/:slug',
      component: 'pages/projects/_slug'
    }
  ]
}
```

### Additional feature : validate (optional)

Nuxt.js allows you to define a validator function inside your dynamic route component (In this example: `pages/projects/_slug.vue`).

If validate function fails, Nuxt.js will automatically load the 404 error page.

```js
<script>
export default {
  validate ({ params }) {
    return /^[A-z]+$/.test(params.slug)
  }
}
</script>
```

## Nested Routes (children)

To define a nested route, you need to define a .vue file with the same name as the directory wich contain your children views.
> Don't forget to put `<router-view></router-view>` inside your parent .vue file.

This file tree:

```bash
/pages
|-> /users
    |-> _id.vue
|-> users.vue
```

will automatically generate:

```js
router: {
  routes: [
    {
			path: '/users',
			component: 'pages/users',
			children: [
				{
					path: ':id',
					component: 'pages/users/_id',
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
/pages
|-> /posts
    |-> /_slug
        |-> _name.vue
        |-> _comments.vue
    |-> _slug.vue
    |-> index.vue
|-> posts.vue
```

will automatically generate:

```js
router: {
  routes: [
    {
			path: '/posts',
      component: 'pages/posts',
			children: [
				{
					path: "",
					component: 'pages/posts/index',
					name: 'posts'
				},
				{
					path: ':slug',
					component: 'pages/posts/_slug',
					children: [
						{
							path: 'comments',
							component: 'pages/posts/_slug/comments',
							name: 'posts-slug-comments'
						},
						{
							path: ':name',
							component: 'pages/posts/_slug/_name',
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
