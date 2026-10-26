# Eusun Han Lab website

A static site with no build step: plain HTML, one stylesheet and one script.
It was implemented from a Claude Design prototype.

```
site/
  index.html                  main page: you scroll from the plant down through the soil
  projects/<name>/index.html  perennialtraits, rootvision, perennialhybrids, rootpheno, deepwater, perennialsystems
  people/eusun-han/index.html PI profile
  assets/css/site.css         all styles (colour tokens at the top)
  assets/js/roots.js          root/plant canvas, depth meter, crop and segmentation toggles
  assets/img/                 optimised images (people/, methods/, projects/)
```

## Run locally

```sh
cd site && python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploy

`vercel.json` at the repo root serves `site/` as-is and redirects the old site's URLs
(`/projects/<long-slug>`, `/members/professor`) to the new pages.

## Editing

- **Text:** edit the HTML directly. Each project page is self-contained.
- **New team member:** copy a `.member` block in `index.html` and add a 400×300-ish photo to
  `assets/img/people/`. Use `style="object-position:50% 20%"` to frame the face.
- **News / publications:** copy an `.entry` block in `index.html`. Publications on the profile page are an `<ol class="pubs">`,
  and numbering is automatic.
- **Root animation:** adjust the parameters in `build()` in `roots.js`.
  Sections marked `data-layer="0…8"` drive the depth meter, so keep them in order.

Old in-page links like `/#rootvision` still work: `index.html` forwards them to the matching page.
