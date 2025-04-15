---
navigation.title: 'Nuxt Security'
title: Nuxt security
description: Best practices for making Nuxt apps more secure.
---

Nuxt applications can be affected by the same security risks as any other web application. To protect against them, it is crucial to be aware what kind of attacks and risks are out there. This guide outlines best practices to make your Nuxt application more secure.

## Risks

The best source of knowledge for most popular security risks is the [OWASP Top 10](https://owasp.org/www-project-top-ten/) that is a standard awareness document for developers and web application security. Let's talk about few of them that we can handle on Nuxt.

### Broken Access Control

Access control ensures users can only perform actions within their permissions. Failures can lead to unauthorized data access, changes, deletion, or misuse of business functions.

A simple example attack scenarion can be:
```
An attacker tries to access admin page when unauthenticated or not-admin user and gets the access to
https://example.com/admin/sensitive-data
```

To protect against such attack, you could implement a proper authorization. Check out Nuxt Authorization [below](#nuxt-authorization).

:read-more{title="Broken Access Control" to="https://owasp.org/Top10/A01_2021-Broken_Access_Control/"}

### Denial of Service

A Denial of Service (DoS) attack focuses on making a resource (such as a site, application, or server) unavailable for its intended purpose. This can be achieved through various methods, including manipulating network packets, exploiting programming or logical vulnerabilities, or mismanaging resources, among others.

A simple example attack scenarion can be:
```
An attacker tries to overload the application server with too many or too heavy requests to make it unable to respond and stop working properly.
```

To protect against such attack, you could implement a proper rate limiting solution. Check out Nuxt Security [below](#nuxt-security).

:read-more{title="Denial of Service" to="https://owasp.org/www-community/attacks/Denial_of_Service"}

### Injections

An application is vulnerable when user input isn't properly validated or sanitized, dynamic queries lack parameterization or escaping, and untrusted data is used in ORM queries or concatenated into SQL, commands, or stored procedures. Some of the more common injections are SQL, NoSQL, OS command, Object Relational Mapping (ORM), LDAP, and Expression Language (EL) or Object Graph Navigation Library (OGNL) injection.

A simple example attack scenarion can be:

```
An application uses untrusted data in the construction of the following vulnerable SQL call:
SELECT \* FROM accounts WHERE custID='" + request.getParameter("id") + "';
```

To protect against such attack, you could implement a proper sanitization and escaping. Check out Nuxt Security [below](#nuxt-security).

:read-more{title="Injection" to="https://owasp.org/Top10/A03_2021-Injection/"}

### Outdated components

You're likely vulnerable if you lack visibility into the versions of all components (including nested dependencies), use outdated, unsupported, or vulnerable software across your stack, fail to regularly scan for vulnerabilities or track security bulletins, delay patching or upgrades due to rigid schedules, skip compatibility testing after updates, or neglect to secure component configurations.

A simple example attack scenarion can be:

```
An application uses an outdated version of the package that contains a malicious code or is vulnerable to attacks
```

To protect against such attack, you could implement a proper scanning for vulnerabilities in your project. Check out [Snyk](https://snyk.io/).

:read-more{title="Vulnerable and Outdated Components" to="https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/"}

### Authentication failures

Authentication and session management are vital to security. Weaknesses may include allowing automated attacks (e.g., credential stuffing, brute force), using default or weak passwords, poor password recovery methods, storing passwords insecurely, lacking proper multi-factor authentication, exposing session IDs in URLs, reusing session IDs after login, and failing to invalidate sessions on logout or inactivity.

A simple example attack scenarion can be:

```
A user uses a public computer to access an application. Instead of selecting "logout," the user simply closes the browser tab and walks away. An attacker uses the same browser an hour later, and the user is still authenticated.
```

To protect against such attack, you could implement a proper authentication method. Check out Nuxt Auth Utils [below](#nuxt-auth-utils).

:read-more{title="Identification and Authentication Failures" to="https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/"}

## Content Security Policy

Content Security Policy (CSP) helps prevent unwanted content from being injected/loaded into your webpages. This can mitigate cross-site scripting (XSS) vulnerabilities, clickjacking, formjacking, malicious frames, unwanted trackers, and other web client-side attacks.

:read-more{title="Content Security Policy" to="https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP"}

The CSP header can have the following structure:

```
Content-Security-Policy: default-src 'self'; img-src 'self' example.com
```

Currently, a proper Content Security Policy can be enabled by using the Nuxt Security module but we are working on making it part of the core framework. If you are interested in learning more about it, check out [this RFC](https://github.com/nuxt/nuxt/discussions/30404).

Nuxt Security helps you increase the security of your site by enabling Strict CSP support for both SSR and SSG applications.

1. For `SSR` applications, Nuxt Security implements strict CSP via nonces. A one-time cryptographically-generated random nonce is generated at runtime by the server for each request of a page. In this rendering mode, you can also use all security headers in a regular form of a response header (including headers such as Cross Origin Embeder Policy, Cross Origin Opener Policy, etc).
2. For `SSG` applications, Nuxt Security implements strict CSP via hashes. At static build-time, Nuxt Security computes the SHA hashes of the elements that are allowed to execute on your site. The CSP header value is then delivered as `<meta http-equiv>` tag and you can also implement Subresource Integrity that enables the browser to verify that the static assets that your application is loading have not been altered.

:read-more{title="Strict Content Security Policy" to="https://nuxt-security.vercel.app/advanced/strict-csp"}


## Third-party modules

To solve the problems mentioned in the previous section, you may use the third-party modules built by the community members.

### Nuxt Security

[Nuxt Security](https://nuxt-security.vercel.app/) automatically configures your app to follow OWASP security patterns and principles by using HTTP Headers and Middleware. It comes with features such as:

* Security response headers
* Request Size & Rate Limiters
* Cross Site Scripting (XSS) Validation
* Cross-Origin Resource Sharing (CORS) support
* Allowed HTTP Methods
* Cross Site Request Forgery (CSRF) protection

:video-accordion{title="Watch the video by Jakub Andrzejewski about Nuxt Security" videoId="sJVeU0KGmv4"}

The module does not need any configuration but if you need to adjust the default settings you can do so like following:

```ts
export default defineNuxtConfig({
  security: {
    headers: {
      // certain header
      xXSSProtection: '1',
    },

    // certain middleware
    rateLimiter: {
      // options
    }
  }
})
```

The module allows to configure the settings and disable certain ones globally and per route.

:read-more{title="Nuxt Security" to="https://nuxt-security.vercel.app/"}

### Nuxt Auth Utils

[Nuxt Auth Utils](https://github.com/atinux/nuxt-auth-utils) allows to add Authentication to Nuxt applications with secured & sealed cookies sessions. It comes with the following features:

* Hybrid Rendering support (SSR / CSR / SWR / Prerendering)
* 40+ OAuth Providers
* Password Hashing
* WebAuthn (passkey)
* `useUserSession()` Vue composable
* Tree-shakable server utils
* `<AuthState>` component
* Extendable with hooks
* WebSocket support

After installing the module and providing necessary environment variables, we can start using it as following:

```html
<script setup>
const { loggedIn, user, session, fetch, clear, openInPopup } = useUserSession()
</script>

<template>
  <div v-if="loggedIn">
    <h1>Welcome {{ user.login }}!</h1>
    <p>Logged in since {{ session.loggedInAt }}</p>
    <button @click="clear">Logout</button>
  </div>
  <div v-else>
    <h1>Not logged in</h1>
    <a href="/auth/github">Login with GitHub</a>
    <!-- or open the OAuth route in a popup -->
    <button @click="openInPopup('/auth/github')">Login with GitHub</button>
  </div>
</template>
```

Remember that this module only works with a Nuxt server running as it uses server API routes and it won't work with `nuxt generate`. You can anyway use Hybrid Rendering to pre-render pages of your application or disable server-side rendering completely.

:read-more{title="Nuxt Auth Utils" to="https://github.com/atinux/nuxt-auth-utils"}

### Nuxt Authorization

[Nuxt Authorization](https://github.com/barbapapazes/nuxt-authorization) is a module offers a simple yet powerful method for managing authorization in a Nuxt application, applicable to both client and server. It is authentication system agnostic but can be seamlessly integrated with nuxt-auth-utils. It comes with the following features:

* Works on both the client (Nuxt) and the server (Nitro)
* Write abilities once and use them everywhere
* Agnostic of the authentication layer
* Use components to conditionally show part of the UI
* Primitives are can be accessed for a full customization

Abilities constitute the rules that embody the `authorization logic`. They take a user and one or more resources and yield a deny or an allow condition. While they can be grouped by resource, they remain independent of one another.

```ts
export const editBook = defineAbility((user: User, book: Book) => {
  return user.id === book.authorId
})
```

The `defineAbility` function acts as a factory that creates an ability but nothing beyond that. It needs to be used with bouncer functions. In a server endpoint, the `authorize` function can be employed to grant access to a resource based on the abilities

```ts
export default defineEventHandler(async (event) => {
  await authorize(event, editBook)

  const books = await db.query.books.findMany()

  return books
})
```

:read-more{title="Nuxt Authorization" to="https://soubiran.dev/posts/nuxt-going-full-stack-how-to-handle-authorization"}


## Common problems

When building more complex Nuxt applications, you will probably encounter some of the problems listed below. Understanding these problems and fixing them will help make your website more secure.

### Returning entities with sensitive data

**Problem**: When fetching the data from external source (i.e. Database) and returning it in the Nuxt API endpoint, you may return the whole table entity (such as User) to the browser and handle it there. This can lead to unintentional leaking of sensitive information that may not even be needed. 

**Solution**: Utilize `pick` or use `interceptors` concepts for both `useAsyncData` and `useFetch` to sanitize what you get from the server without leaking confidential data.

```ts
const { data } = await useFetch('/api/modules', {
  pick: ['title']
})
```

:read-more{title="useFetch" to="/docs/api/composables/use-fetch#usage"}

### Handling State with Care in Nuxt SSR

**Problem**: Using `ref` in Nuxt SSR applications can lead to unintentionally share the state between requests, leading to potential data leaks and inconsistent application behavior.

```ts
const unsafeGlobal = ref<number>(1);

export function useSafeRef() {
  const safeRef = ref<number>(2);

  return {
    unsafeGlobal,
    safeRef
  }
}
```

:read-more{title="CrossRequestStatePollution" to="https://vuejs.org/guide/scaling-up/ssr.html#cross-request-state-pollution"}

**Solution**: For enhanced safety and to adhere to Nuxt's best practices, it's recommended to manage state using abstractions with `useState`:

```ts
const safeGlobal = useState<number>('safeGlobal', () => 5);

export function useSafeRef() {
  const safeRef = useState<number>('safeRef', () => 2);

  return {
    safeGlobal,
    safeRef
  }
}
```

This utility function is specifically designed for Nuxt applications to ensure state is isolated per request, effectively preventing cross-request state pollution

Note: useState is global across components. Use a unique key if you want to keep them separate.

:read-more{title="State Management" to="/docs/getting-started/state-management#best-practices"}

### Hardcoding sensitive data

**Problem**: Hardcoding sensitive data like API keys or passwords in your source code can lead to security vulnerabilities.

:video-accordion{title="Watch the video by Alex Lichter about Nuxt Runtime Config" videoId="2tKOZc3Z1dk"}

**Solution**: Avoid hardcoding sensitive data and use Nuxt Runtime Config like following:

```ts
export default defineNuxtConfig({
  runtimeConfig: {
    // The private keys which are only available within server-side
    apiSecret: '123',
    // Keys within public, will be also exposed to the client-side
    public: {
      apiBase: '/api'
    }
  }
})
```

:read-more{title="Runtime Config" to="/docs/guide/going-further/runtime-config"}

You can also use a service such as [Git Guardian](https://www.gitguardian.com/) to continously scan your repository for leaked secrets.

## Useful Resources

To learn more about various techniques for improving security, take a look at the following resources:

1. [OWASP Top 10](https://owasp.org/www-project-top-ten/)
2. [Web Application Security by Cloudflare](https://www.cloudflare.com/en-gb/learning/security/what-is-web-application-security/)
3. [Web Security Academy - Free Online Training from PortSwigger](https://portswigger.net/web-security)
