# Example how to test Nuxt.js app with Jest and Puppeteer

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
- [jest]()
- [puppeteer](https://pptr.dev/)
