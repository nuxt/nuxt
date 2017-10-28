# Nuxt.js server-side benchmarks

> Taken from [Next.js benchmarks](https://github.com/zeit/next.js/tree/master/bench), if you like React, we recommend you to try [Next.js](https://github.com/zeit/next.js).

## Installation

Follow the steps in [CONTRIBUTING.md](../CONTRIBUTING.md).

Both benchmarks use `ab`. So make sure you have it installed.

## Usage

Before running the test:

```
npm run start
```

Then run one of these tests:

- Stateless application which renders `<h1>My component!</h1>`. Runs 3000 http requests.
```
npm run bench:stateless
```

- Stateless application which renders `<li>This is row {i}</li>` 10.000 times. Runs 500 http requests.
```
npm run bench:stateless-big
```