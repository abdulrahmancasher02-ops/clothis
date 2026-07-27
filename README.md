# Threadwork — Custom Clothing Designer

A static, no-backend web app for designing custom apparel in 2D and 3D:
pick a garment, change its color, add text and images, preview it in a
rotatable 3D view, and download your work as PNG, JPG, or a `.glb` 3D model.

No build step, no server, no API keys — just static files. Perfect for
GitHub Pages.

## Run it locally

Because it uses ES modules, open it through a local server (not by
double-clicking the file):

```bash
cd customizer
python3 -m http.server 8080
# then open http://localhost:8080
```

## Deploy to GitHub Pages (via GitHub Actions)

This repo includes `.github/workflows/deploy.yml`, so it deploys itself —
no build step is needed since it's plain HTML/CSS/JS, the workflow just
publishes the folder.

1. Create a new GitHub repo and push the contents of this folder to it,
   with `index.html` at the repo root and `.github/workflows/deploy.yml`
   included.
2. In the repo: **Settings → Pages → Build and deployment → Source** →
   choose **GitHub Actions** (not "Deploy from a branch").
3. Push to `main` (or run the workflow manually from the **Actions** tab).
   The included workflow checks out the repo and publishes it with
   `actions/upload-pages-artifact` + `actions/deploy-pages`.
4. After the workflow finishes, visit `https://<your-username>.github.io/<repo-name>/`.

Everything else (Fabric.js, Three.js) loads from a CDN over HTTPS, so
there's nothing to install or build.

## How it's built

| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `css/styles.css` | All styling, design tokens, responsive layout |
| `js/garments.js` | **Garment shape config — add new garment types here** |
| `js/editor2d.js` | The 2D canvas editor (Fabric.js): garment silhouette, text, images, layers, PNG/JPG export |
| `js/scene3d.js` | The 3D preview (Three.js): builds a front/back textured card from the same garment outline, GLB export |
| `js/app.js` | Wires the UI controls to both editors and keeps them in sync |

The 2D silhouette and the 3D model are generated from the **same path
data**, so whatever you draw in 2D always matches the 3D preview
automatically — there's only one shape to maintain per garment.

## Adding a new garment type manually

Two small config edits — nothing else needs to change:

**1. `js/garments.js`** — the 2D flat-lay silhouette and print zone:

```js
tanktop2: {
  label: 'My New Garment',
  outline: [
    ['M', 130, 480], ['L', 130, 140], /* ...more points... */ ['Z']
  ],
  zone: { x: 150, y: 150, w: 100, h: 120 } // the printable area
}
```

- `outline` is a single closed path (a flat-lay silhouette) in a
  400×520 coordinate box. `M` = move to, `L` = line to,
  `Q` = quadratic curve to, `Z` = close the path.
- `zone` is the rectangle where text/images are allowed to sit (the
  dashed guide box you see on the canvas).

**2. `js/scene3d.js`** — the 3D shape, in the `GARMENT_3D` config:

```js
tanktop2: { sleeve: 'short', collar: 'crew', hood: false, pocket: false, placket: false, ribHem: false }
```

- `sleeve`: `'none'` | `'short'` | `'long'`
- `collar`: `'crew'` | `'small'`
- `hood` / `pocket` / `placket` / `ribHem`: `true`/`false` toggles for
  the optional parts

The garment picker, the 2D canvas, and the 3D preview all read from
these two config objects automatically.

## Notes and current limitations

- The 3D preview is built from simple primitives (a tapered cylinder torso,
  cylinder sleeves, a torus collar, a hood/pocket/placket where relevant) —
  not a cloth-simulated mesh. This is a deliberate tradeoff: it's fast,
  dependency-free, and — importantly — always produces a valid, watertight
  shape. All the proportions live in the `FIT` object at the top of
  `scene3d.js` if you want a slimmer/boxier fit, longer sleeves, a deeper
  hood, etc. — nudge the numbers and reload.
- Garment color is applied directly to the 3D materials; your text/image
  design is a separate transparent decal layered on the chest/back, sized to
  match the 2D print zone's proportions.
- PNG/JPG export downloads the flat mockup of whichever side (front/back)
  you're currently viewing. The `.glb` export always includes both sides.
- Everything runs entirely in the browser — no uploads, no accounts, no
  server-side storage.

## Customization included

- Garment type, base color (presets + custom picker), front/back side
- Text: content, color, font, size, bold, italic
- Images: drag, resize, rotate (Fabric.js default handles)
- Opacity control and forward/backward layer ordering for any selected element
- Layer list with click-to-select and delete
