# Penumbra

Penumbra is a field handbook for the Legacy clan in TERA, with directions for Giovia and beyond. Browse areas, guild masters, mobs, and NPCs; filter by name or level; sort the results; and click a route to copy its directions.

## Run locally

The site is static and has no build step or package dependencies. From the repository directory, start a local web server:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. The server is needed because the page loads its entries from `directions.json`.

## Project files

- `index.html` — page structure and theme choices.
- `styles.css` — responsive layout, visual themes, and background patterns.
- `app.js` — filtering, sorting, route copying, and saved theme selection.
- `directions.json` — location, level, category, and route data.
- `penumbra-atlas-4k.svg` — Giovia atlas displayed at the top of the page.

Theme selection is saved in the browser's local storage.

## Deployment

Pushing to `main` deploys the static site to GitHub Pages using [`.github/workflows/pages.yml`](.github/workflows/pages.yml). Run it manually from the Actions tab with the **Deploy to GitHub Pages** workflow if needed.
