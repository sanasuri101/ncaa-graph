#!/bin/bash
set -e

# Usage: bash deploy.sh
# Unzips ncaa-graph.zip from ~/Downloads and deploys to ~/Code/ncaa-graph
# GitHub Pages must be set to serve from: main branch / public folder

cd ~/Downloads
rm -rf /tmp/new-build
unzip -o ncaa-graph.zip -d /tmp/new-build

cd ~/Code/ncaa-graph
git checkout main
git pull origin main

# Sync everything except .git
rsync -a --delete \
  --exclude='.git' \
  /tmp/new-build/ncaa-graph/ .

touch public/.nojekyll

git add -A
git diff --quiet && git diff --staged --quiet || \
  git commit -m "deploy $(date +'%Y-%m-%d %H:%M')"
git push origin main

echo "Deploy complete. Verify GitHub Pages is set to: main branch / public folder"
