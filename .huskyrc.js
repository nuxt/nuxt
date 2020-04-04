const tasks = t => t.join(' && ');

module.exports = {
  hooks: {
    'commit-msg': 'commitlint -E HUSKY_GIT_PARAMS',
    'pre-commit': tasks([
      'npm run lint -- --fix',
      'node ./scripts/hooks/check-branch-name.js'
    ])
  }
};
