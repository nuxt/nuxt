---
title: 'Nuxt: A vision for 2023'
description: "This past year has been an exciting one. Looking into the new year, there is a lot we have planned as a team and we'd love to share it with you."
navigation: false
image: '/socials/vision-2023.jpg'
---

::blog-article
---
authors:
  - name: Daniel Roe
    avatarUrl: https://github.com/danielroe.png
    link: https://twitter.com/danielcroe
date: "Jan 17, 2023"
---
#title
Nuxt: A vision for 2023
#description
This past year has been an exciting one. Looking into the new year, there is a lot we have planned as a team and we'd love to share it with you. :sparkles:
#body

This past year has been an exciting one, with the release of Nuxt 3 and Nitro and the launch of the new [nuxt.com](http://nuxt.com/) website. It's been the culmination of years of work, and has not only resulted in a new major version of Nuxt, but a new Nuxt architecture, a full-stack server framework ([Nitro](https://nitro.unjs.io/)), and a new GitHub organisation and ecosystem ([UnJS](https://github.com/unjs/)).

Throughout that whole time, [Pooya Parsa](https://github.com/pi0) has led the Nuxt team, putting in countless hours of work and thought into building Nuxt 3.

Now, at the start of 2023, he's handing over the helm of the Nuxt open-source work to me ([Daniel Roe](https://github.com/danielroe)). Pooya will continue to be actively contributing to the Nuxt project and of course driving the development of UnJS ecosystem and Nitro project.

This is a real honour and I'm hugely pleased to be able to work with the rest of the team and the community to continue to drive Nuxt forward to be the intuitive way to build a web application using Vue. 😊

Looking into the new year, there is a lot we have planned as a team and we'd love to share it with you.

## Unifying Nuxt

One important change will be unifying Nuxt into a single repository.

As a complete rewrite of Nuxt 2, Nuxt 3 has been developed in a separate repository: `nuxt/framework`. Nuxt 3 even has its own documentation on [nuxt.com](http://nuxt.com/), versus the Nuxt 2 documentation on [nuxtjs.org](https://nuxtjs.org/). In development, this helped us move faster but meant less attention on issues for Nuxt 2. It's also a bit confusing.

So in the coming days, we'll be unifying the Nuxt repos into a single repository, `nuxt/nuxt`. We'll transfer all issues and discussions across, of course, clearly labeling them as to which version of Nuxt they affect. This will also provide us an opportunity to close out issues and RFCs that we've resolved or implemented in Nuxt 3.

## New Website

This last year brought us the launch of [nuxt.com](http://nuxt.com/) and the unveiling of Nuxt's [new logo](/design-kit).

![Screenshot of the new nuxt.com](https://user-images.githubusercontent.com/28706372/212973698-91fce9a6-e9ef-4fdc-ad63-9b3924c41704.png)

We'd like to make this website the central place for everything Nuxt. That includes:

- migrating Nuxt 2 documentation so there's a single website to check (with a version switcher)
- documentation for community modules (using multi-source to pull them from their own repositories)
- revamped [examples](/docs/examples/essentials/hello-world) that show off more real use cases, including authentication, monorepos and more

We have some other exciting plans for the website, but I don't want to reveal too much, other than to say that we'll also (of course!) be open-sourcing the website soon.

## Key Modules

The modules ecosystem is an incredibly powerful one, and we are grateful to all the module authors who extend Nuxt with so many features. Today we have more than 60 modules compatible with Nuxt 3. Our goal is to continue to empower module development as well as make sure that the most used modules in Nuxt 2 are updated or have a straightforward migration path.

The main priorities at the start of the year are `nuxt/image`, PWA and `nuxt/auth`.

We're also developing RFCs for `nuxt/font` and `nuxt/script` in conjunction with the Google Aurora team, which will make it much easier to apply best performance practices to your Nuxt apps. Watch this space!

## DX and Performance

We particularly care a lot about making Nuxt a joy to use, and we'd like to keep pushing the boundary of great developer experience, which we believe results in the best experience for users of the apps we write too.

In the coming months, there will be a continued focus on developer experience and performance. Expect to see Nuxt DevTools and CLI improvements for scaffolding - and more. On the performance side, Nuxt 3 + Nitro is a game-changer for speed, performance, and customisability, and we’ll be building on top of that to enable some amazing features. 🚀

## A New Release Cycle

It's important to know what's coming, and we're going to be spending some time making sure we communicate clearly about what's happening with Nuxt through regular updates like this one.

On top of that, we're planning a consistent release cycle, following [semver](https://semver.org/). We'll aim for major framework releases every year, with an expectation of patch releases every week or so and minor releases every month or so. They should never contain breaking changes except within options clearly marked as `experimental`.

One comment: We don't want there to be as big a gap (either in time or in breaking changes) between 3 -> 4 as there was between 2 -> 3, so, when the time comes for Nuxt 4, expect a much more gentle upgrade!

In the upcoming 3.1.0 release, you can already find a host of bug fixes as well as:

- experimental server-only components and a component island renderer
- Nitro 2, Vite 4 and Rollup 3 support

## Migrating to Nuxt 3

On December 31st, 2023, Vue 2 will reach End of Life (EOL), and with it Nuxt 2. Both Vue and Nuxt will continue being available and working for many people, but at the same time, many companies and users will want to transition to Nuxt 3 (and we'd encourage this!).

Part of our focus this year therefore will be supporting everyone who wants to migrate their apps to Nuxt 3. We'll also be working to backport key bug fixes and security fixes to Nuxt 2.

In addition, there is Nuxt Bridge. It was built as a module to bring features and bug fixes from Nuxt 3 back to Nuxt 2, although it has not yet been released in a stable version. We plan to stabilise and release it in the next month or so, but our main focus over the course of the year will be on helping people transition to Nuxt 3.

---

It’s a privilege to be part of this community, and we wish you a very Happy New Year! 💚

Daniel (on behalf of the whole Nuxt team)
::
