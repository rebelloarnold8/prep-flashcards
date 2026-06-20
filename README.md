# NVIDIA Prep Flashcards — cross-device PWA

A free, offline-first spaced-repetition flashcard app (SM-2, like Anki) that runs in
Safari/Chrome on **Mac, iPad, and iPhone**. No App Store, no subscription.

## Run locally (Mac)
```bash
cd ~/prep-flashcards
python3 -m http.server 8000
# open http://localhost:8000
```
On iPad/iPhone (same Wi-Fi / hotspot): open `http://<mac-LAN-ip>:8000`.

## Deploy to GitHub Pages (recommended — works anywhere, offline after first load)
1. Create an empty repo on github.com (e.g. `prep-flashcards`). Public is fine — no secrets are in the code.
2. From this folder:
   ```bash
   cd ~/prep-flashcards
   git init && git add -A && git commit -m "Prep flashcards PWA"
   git branch -M main
   git remote add origin https://github.com/rebelloarnold8/prep-flashcards.git
   git push -u origin main
   ```
3. Repo → **Settings → Pages → Source: Deploy from a branch → main / root → Save**.
4. After ~1 min it's live at `https://rebelloarnold8.github.io/prep-flashcards/`.
5. On each device: open that URL in Safari → Share → **Add to Home Screen**. It now
   behaves like a native app, full-screen, and works **offline** (service worker caches it).

## Cross-device progress sync (free, via GitHub Gist)
localStorage is per-device. To share review progress across all three:
1. Create a token: github.com/settings/tokens → *Generate new token (classic)* → tick **only `gist`**.
2. In the app: ⚙︎ Settings → paste token → **Push** (creates a private gist, fills in the Gist ID).
3. On the other devices: paste the **same token + Gist ID** → **Pull & merge**.
4. Habit: **Pull** when you start a session, **Push** when you finish. Merge is
   last-write-wins per card (by review timestamp), so it's safe in either order.

Alternative without a token: ⚙︎ → **Export JSON** / **Import JSON** (AirDrop the file between devices).

## Study
- Tap topic chips to filter (CACHE, DRAM, GPU, CUDA, COHERENCE, CONSISTENCY, ADDRTRANS, INTERCONNECT, PERF).
- **Space** = show answer. **1/2/3/4** = Again / Hard / Good / Easy.
- "New cards per session" cap is in Settings (default 20).

## Add / edit cards
Edit `cards.json` — array of `{"topic","q","a"}`. Markdown-lite in answers: `**bold**`
and `` `code` ``. Bump `CACHE` version string in `sw.js` after edits so devices re-fetch.
Then commit + push; devices update on next online open (network-first for cards.json).

### Import your existing concepts.txt (after restoring Desktop read access)
`tools/convert_concepts.py` turns the `TOPIC ::: Q ::: A` deck into card JSON:
```bash
python3 tools/convert_concepts.py "/Users/arnoldrebello/Desktop/Interview Prep Material/Flashcards/concepts.txt" >> /tmp/extra.json
# then merge /tmp/extra.json into cards.json (it prints a JSON array)
```
