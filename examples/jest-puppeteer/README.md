# Nuxt with [Jest](https://jestjs.io/) and [Puppeteer](https://developers.google.com/web/tools/puppeteer/)

> Jest is a delightful JavaScript Testing Framework with a focus on simplicity.

> Puppeteer is a Node library which provides a high-level API to control headless Chrome or Chromium over the DevTools Protocol.

# Install deps
```
npm install
```

# Run tests
```
npm run test
```

## It will
- Build app
- Run server
- Run tests

### Output
```
 PASS  test/index.spec.js
  Index page
    √ test index title (53ms)
    √ test navigate to about page (2ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   2 passed, 2 total
Time:        0.992s, estimated 1s
Ran all test suites.
```

## Check configuration files:
- `jest.config.js`
- `jest-puppeteer.config.js`

## Documentation
- [jest-puppeteer](https://github.com/smooth-code/jest-puppeteer)
- [jest](https://jestjs.io/)
- [puppeteer](https://pptr.dev/)
