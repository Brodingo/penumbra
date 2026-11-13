# Penumbra

Penumbra is a field handbook for the Legacy clan in TERA, with directions for Giovia and beyond. Browse areas, guild masters, mobs, and NPCs; filter by name or level; sort the results; and click a route to copy its directions.

## Run locally

The site is static and has no build step or package dependencies. From the repository directory, start a local web server:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. The server is needed because the page loads its entries from `directions.json`.

The app is also installable as a local-first PWA: a service worker caches the shell and archive for offline access, and the browser can install it as an app shortcut from supported browsers.

## Project files

- `index.html` — page structure and theme choices.
- `styles.css` — responsive layout, visual themes, background patterns, and map viewer styling.
- `app.js` — filtering, sorting, route copying, and saved theme selection.
- `map-viewer.js` — scrollable realm map atlas, navigation, and rough-draft map sketches.
- `directions.json` — location, level, category, and route data.
- `zinobel-desert-4k.svg` — 4K landscape map of Zinobel Desert displayed in the atlas.
- `mozartia-isometric-4k.svg` — 4K isometric map of Mozartia.
- `penumbra-atlas-4k.svg` — earlier cartographic atlas of Giovia.

Theme selection is saved in the browser's local storage.

## Deployment

Pushing to `main` deploys the static site to GitHub Pages using [`.github/workflows/pages.yml`](.github/workflows/pages.yml). Run it manually from the Actions tab with the **Deploy to GitHub Pages** workflow if needed.
