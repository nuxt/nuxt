#!/bin/bash

# Restore all git changes
git restore -s@ -SW  -- packages examples

# Bump versions to edge
yarn jiti ./scripts/bump-edge

# Resolve yarn
yarn

# Update token
if [[ ! -z ${NODE_AUTH_TOKEN} ]] ; then
  echo "//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}" >> ~/.npmrc
  echo "registry=https://registry.npmjs.org/" >> ~/.npmrc
  echo "always-auth=true" >> ~/.npmrc
  npm whoami
fi

# Release packages
for p in packages/* ; do
  pushd $p
  echo "Publishing $p"
  npm publish -q --access public  # --dry-run
  popd
done
