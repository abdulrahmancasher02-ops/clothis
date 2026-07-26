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

## Deploy to GitHub Pages

1. Create a new GitHub repo and push the contents of this folder to it
   (`index.html` should sit at the repo root, or at the root of the
   folder you point Pages at).
2. In the repo: **Settings → Pages → Source** → choose the branch
   (usually `main`) and folder (`/root`).
3. Wait a minute, then visit `https://<your-username>.github.io/<repo-name>/`.

That's it — everything (Fabric.js, Three.js) loads from a CDN over
HTTPS, so there's nothing else to configure.

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

Open `js/garments.js` and add an entry to the `GARMENTS` object:

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

Nothing else needs to change — the garment picker, the 2D canvas, and
the 3D preview all read from this one config object.

## Notes and current limitations

- The 3D preview is a stylized "flat mockup" (two textured faces plus
  a thin edge), not a fully sculpted, seamed 3D garment. It's built to
  give an accurate, fast, rotatable preview of your artwork on every
  device without needing large 3D asset files. If you want photoreal
  sculpted models later, swap `buildGarment()` in `scene3d.js` to load
  a `.glb` per garment type instead of generating one from the 2D
  outline.
- PNG/JPG export downloads the flat mockup of whichever side (front/
  back) you're currently viewing. The `.glb` export always includes
  both sides.
- Everything runs entirely in the browser — no uploads, no accounts,
  no server-side storage.
