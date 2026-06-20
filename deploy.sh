#!/bin/bash
# One-shot GitHub Pages deploy for the prep-flashcards PWA.
# Needs a GitHub classic Personal Access Token with the "repo" scope (add "gist" too if you
# want flashcard sync from the same token). Provide it ONE of these ways:
#   echo "ghp_xxx" > ~/prep-flashcards/.gh_token      (gitignored; recommended)
#   or:  GH_TOKEN=ghp_xxx ./deploy.sh
# Re-runnable: creates the repo if missing, pushes, enables Pages, waits until live.
set -euo pipefail
REPO="prep-flashcards"
cd "$HOME/prep-flashcards"

TOKEN="${GH_TOKEN:-}"
[ -z "$TOKEN" ] && [ -f .gh_token ] && TOKEN="$(tr -d ' \r\n' < .gh_token)"
[ -z "$TOKEN" ] && { echo "❌ No token. Put a classic PAT (repo scope) in ~/prep-flashcards/.gh_token"; exit 1; }

API="https://api.github.com"
A=(-H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28")

LOGIN=$(curl -fsS "${A[@]}" "$API/user" | python3 -c 'import sys,json;print(json.load(sys.stdin)["login"])') \
  || { echo "❌ Token rejected by GitHub. Check it has the 'repo' scope."; exit 1; }
echo "✓ Token belongs to: $LOGIN"

# create repo if it doesn't exist (PUBLIC — Pages on the free plan only publishes public repos)
code=$(curl -s -o /dev/null -w "%{http_code}" "${A[@]}" "$API/repos/$LOGIN/$REPO")
if [ "$code" = "404" ]; then
  echo "→ Creating public repo $LOGIN/$REPO ..."
  curl -fsS "${A[@]}" -X POST "$API/user/repos" \
    -d "{\"name\":\"$REPO\",\"private\":false,\"description\":\"NVIDIA prep flashcards PWA\",\"homepage\":\"https://$LOGIN.github.io/$REPO/\"}" >/dev/null
  echo "✓ Repo created"
else
  echo "✓ Repo already exists (HTTP $code)"
fi

# push main (token used inline only — NOT persisted in .git/config)
git branch -M main
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$LOGIN/$REPO.git"
echo "→ Pushing..."
git push "https://$LOGIN:$TOKEN@github.com/$LOGIN/$REPO.git" main:main -f >/dev/null 2>&1
echo "✓ Pushed"

# enable Pages (main / root). POST to create; if already configured, PUT to update.
echo "→ Enabling GitHub Pages..."
pc=$(curl -s -o /dev/null -w "%{http_code}" "${A[@]}" -X POST "$API/repos/$LOGIN/$REPO/pages" \
      -d '{"source":{"branch":"main","path":"/"}}')
if [ "$pc" != "201" ] && [ "$pc" != "409" ]; then
  curl -s -o /dev/null "${A[@]}" -X PUT "$API/repos/$LOGIN/$REPO/pages" \
      -d '{"source":{"branch":"main","path":"/"}}' || true
fi
echo "✓ Pages requested (HTTP $pc)"

URL="https://$LOGIN.github.io/$REPO/"
echo "→ Waiting for first build at $URL (can take 1-2 min)..."
for i in $(seq 1 30); do
  s=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
  printf "   attempt %2d/30: HTTP %s\n" "$i" "$s"
  if [ "$s" = "200" ]; then echo "🎉 LIVE: $URL"; exit 0; fi
  sleep 10
done
echo "⏳ Not 200 yet — give it another minute, then open: $URL"
echo "   (Check repo → Settings → Pages if it stays 404.)"
