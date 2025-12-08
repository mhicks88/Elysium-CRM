#!/bin/bash
set -e

echo "EB prebuild hook: forcing fresh npm install"

# Remove any bundled node_modules so EB doesn't skip dependency install
rm -rf node_modules

# Install production dependencies
npm install --omit=dev

