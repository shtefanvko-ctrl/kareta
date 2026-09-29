# KARETA.KZ — Print Banner Rules

## Source of truth
- Use only the production full logo: `assets/onboarding/kareta_logo_full.png`.
- Never redraw, regenerate, crop, distort, stretch, recolor, or replace the KARETA.KZ logo with an approximation.
- Preserve the logo aspect ratio and safe margins.
- Target KARETA logo width: about **50% of the banner width**; it should be visibly larger than the previous draft while remaining fully inside the safe area.

## Third-party brand assets
- **Final automotive-logo rule:** BMW, Peugeot, Mercedes-Benz, Audi, and Volkswagen must appear in the banner as raster image assets (`PNG`/`JPG`/`WebP`), never as embedded SVG vehicle icons. If an approved official source is SVG-only, rasterize that exact official artwork to PNG without changing geometry, colors, or proportions, then use the PNG.
- For vehicle-marque logos, store badges, and any other third-party brand marks, use only original, recognizable assets from official or otherwise explicitly permitted sources.
- **Vehicle marque artwork used in these banners must be the original permitted brand artwork. Do not replace it with SVG icon-pack versions, traced vectors, hand-built SVG paths, generated look-alikes, or simplified recreations.**
- For BMW, Peugeot, Mercedes-Benz, Audi, and Volkswagen, use the approved original image asset exactly as supplied by the permitted source; preserve its original proportions, colors, clear space, and visual form.
- Do not convert a third-party automotive logo into a homemade SVG for convenience. If the approved source asset is a raster image, keep that original raster asset in the production layout rather than redrawing it as vector paths.
- Do not use Font Awesome, generic icon packs, generated look-alikes, invented symbols, or unofficial logo collections as replacements for official brand marks.
- Never hand-draw, trace, approximate, stylize, recolor, crop, stretch, or otherwise alter BMW, Peugeot, Mercedes-Benz, Audi, Volkswagen, Google Play, App Store, or other brand marks.
- If an approved original brand asset is unavailable, leave that asset out and flag it for sourcing; do not fabricate a replacement.
- Working previews may reference official HTTPS-hosted source assets. Before final print export, package/embed the exact approved originals so the print master is self-contained.

## Final format
- Exactly 3 banners.
- Physical size of each banner: **100 × 60 cm**.
- Aspect ratio: **5:3**.
- Master canvas may be SVG at `1000mm × 600mm` for layout and KARETA arrows, but every third-party automotive logo inside it must be a raster image asset. SVG remains forbidden for vehicle-brand icons in the final banner.
- Raster export for print, if required: **300 dpi**.
- Background: solid white.

## Layout
- Remove the text `Autoelectric` completely.
- Main direction arrow: thick, high-contrast KARETA orange `#FF6A00`.
- No black panel behind the arrow.
- Banner 01: directional arrow only.
- Banner 02: directional arrow + `200 МЕТРОВ`.
- Banner 03: clear 90° corner/turn arrow + `300 МЕТРОВ`.
- Google Play and App Store badges appear on every banner and must use approved original badge artwork.
- Bottom row spans the banner width and shows these supported marques using approved original brand assets only:
  - BMW
  - Peugeot
  - Mercedes-Benz
  - Audi
  - Volkswagen

## QA / Definition of Done
A banner is not DONE until:
1. the exact production KARETA.KZ logo is visible in full;
2. no part of the KARETA.KZ logo is clipped;
3. no `Autoelectric` text remains;
4. the background is white;
5. the arrow is orange and visually dominant;
6. the distance matches the correct banner;
7. BMW, Peugeot, Mercedes-Benz, Audi, and Volkswagen use original permitted brand artwork;
8. no vehicle-marque logo has been rebuilt as an SVG icon, traced vector, Font Awesome glyph, generic icon-pack asset, generated look-alike, or homemade substitute;
9. all third-party logos preserve original proportions, colors, and clear space without deformation or recoloring;
10. Google Play and App Store use original permitted badge artwork;
11. the final 100×60 cm proportions are preserved;
12. the final rendered preview has been visually checked before approval.
