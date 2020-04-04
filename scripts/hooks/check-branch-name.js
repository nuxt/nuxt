const exec = require('child_process').exec

const checkBranchName = (name) => {
  // correspond to abc/abcd-efghij-klmnopqr
  const regex = new RegExp('^[a-z-]{3,}/[a-z-]{3,}$')

  // remove extra break-line
  const branchName = name.replace(/(\r\n|\n|\r)/gm, '')

  if (!regex.test(branchName)) {
    // eslint-disable-next-line no-console
    console.error('your branch name does\'nt respect conventionnal-commit', '\n', 'more infos: https://www.conventionalcommits.org/en/v1.0.0/#summary')
    process.exit(1)
  } else {
    process.exit(0)
  }
}

exec('git rev-parse --abbrev-ref HEAD', (error, stdout) => {
  if (error) {
    throw error
  }

  checkBranchName(stdout)
})
