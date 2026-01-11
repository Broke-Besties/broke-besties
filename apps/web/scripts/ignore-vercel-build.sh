#!/bin/bash

# This script is referenced in Vercel's "Ignored Build Step" setting.
# Exit code 0 = skip build
# Exit code 1 = proceed with build

echo "VERCEL_ENV: $VERCEL_ENV"

if [[ "$VERCEL_ENV" == "production" ]] ; then
  echo "🚫 Skipping Vercel build for production"
  echo "✅ Production deployments are handled by GitHub Actions"
  exit 0
else
  echo "✅ Building preview/development deployment on Vercel"
  exit 1
fi
