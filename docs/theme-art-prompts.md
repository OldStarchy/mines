# Theme art — image generator prompts

The themes currently use emoji glyphs (`src/app/styles/glyphs.css` and
the per-theme overrides) and hand-drawn single-color SVG watermarks
(`src/app/assets/`). To upgrade any of them with generated art, use the
prompts below and drop the results in as follows:

- **Watermarks** (`dragon.svg`, `meadow.svg`): replace the file, keep
  the name. They render at ~5–10% opacity behind the board, so bold
  silhouettes work best; fine detail disappears.
- **Cell icons** (flag, mine, boom, wrong flag): save as
  `src/app/assets/<theme>-<icon>.svg|png` and swap the glyph rule to an
  image, e.g.
  ```css
  :root[data-theme='meadow'] .glyph-flag::before {
  	content: url('../assets/meadow-flag.svg');
  }
  ```
  Target size on screen is ~18×18 px inside a 30 px cell — ask for a
  transparent background and readable-at-small-size shapes.

Shared suffix to append to every prompt:

> …flat vector sticker style, bold clean outlines, transparent
> background, no text, centered, single subject, readable at 20 pixels.

## Meadow

- **Flag (flower)**: "A single pink daisy-like flower with five rounded
  petals and a small yellow center, on a short green stem, …"
- **Mine (beehive)**: "A tiny golden skep beehive, classic woven dome
  shape with a dark arched entrance hole, one small bee hovering
  beside it, …"
- **Boom (angry bees)**: "A small swarm of three angry cartoon bees
  bursting outward with short motion lines, …"
- **Wrong flag (wilted flower)**: "A single wilted flower drooping on
  its bent stem, two fallen petals, muted dusty pink, …"
- **Watermark**: "A tall meadow flower with layered petals and two
  leaves on a curving stem, solid one-color silhouette in deep pink
  (#d4527e), minimalist paper-cut style, …"

## Dragon

- **Flag (sword)**: "A downward-plunged medieval knight's sword stuck
  into the ground, ember-orange pommel glow, …"
- **Mine (dragon)**: "A curled sleeping dragon seen from above, wings
  folded, deep red scales with ember-orange accents, …"
- **Boom (fire)**: "A burst of dragon fire, stylized flame with three
  tongues, orange core and red edges, …"
- **Watermark**: "A coiled serpentine dragon in a circle, horned head
  with open jaw, spiked back, solid one-color silhouette in ember
  orange (#ff6b35), tribal emblem style, …"

## Dusk

- **Flag (lantern)**: "A small glowing paper lantern on a short post,
  warm amber light against violet, …"
- **Watermark**: "A crescent moon with three small stars, solid
  one-color silhouette in pale violet (#bb9af7), minimalist, …"

## Mint

- **Flag (clover)**: "A four-leaf clover on a short stem, fresh spring
  green, …"
