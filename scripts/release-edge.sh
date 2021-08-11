#!/bin/bash

set -xe

# Restore all git changes
git restore -s@ -SW  -- packages examples

# Bump versions to edge
yarn jiti ./scripts/bump-edge

# Resolve yarn
YARN_ENABLE_IMMUTABLE_INSTALLS=false yarn install

# Update token
if [[ ! -z ${NODE_AUTH_TOKEN} ]] ; then
  echo "//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}" >> ~/.npmrc
  echo "registry=https://registry.npmjs.org/" >> ~/.npmrc
  echo "always-auth=true" >> ~/.npmrc
  echo "npmAuthToken: ${NODE_AUTH_TOKEN}" >> ~/.yarnrc.yml
  npm whoami
fi

# Release packages
for p in {packages}/* ; do
  pushd $p
  echo "Publishing $p"
  yarn npm publish --access public --tolerate-republish
  popd
done
