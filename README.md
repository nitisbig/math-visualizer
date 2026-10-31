# Math, Visually

Interactive companion site for the channel. Viewers move from a video to a page where they can play with the concept themselves.
It's a static Astro site. Each widget is a small island written against the React API and runs on Preact (compat), so each concept page ships about 20–25 KB of gzipped JS in total.

## Commands

```bash
npm install
npm run dev       # http://localhost:4321
npm test          # vitest: the math behind every widget
npm run check     # astro check (types)
npm run build     # static site → dist/
npm run preview   # serve dist/
```

## Layout

| Path | Role |
|---|---|
| `src/site.config.ts` | Site name, tagline, channel URL, categories |
| `src/styles/tokens.css` | Color/type tokens, the same palette as the videos (`theme.py`). `src/lib/theme.ts` is the canvas copy |
| `src/styles/widgets.css` | Shared look for every widget: frame, sliders, buttons, readouts, legend |
| `src/content/concepts/*.mdx` | One file per concept: frontmatter, short text, widgets, equations |
| `src/layouts/ConceptLayout.astro` | Concept page template: intro, content, video, next concept |
| `src/components/Equation.astro` | KaTeX rendered at build time (no math JS in the browser) |
| `src/components/LiteYouTube.astro` | Video thumbnail that loads the YouTube iframe only on click |
| `src/components/ui/` | `Slider` (with log scale), `Segmented`, `Toggle`, `PlayControls`, `Readout`, `Legend` |
| `src/lib/canvas.ts` | `useCanvas` (DPR + resize), `useRaf`, `scale`, `glow`, `arrow`, `axes`, `dotGrid` |
| `src/lib/urlState.ts` | `useUrlState` / `useUrlNumber`: widget settings mirrored into the query string |
| `src/lib/contours.ts` | Marching-squares contour lines for any 2D field |
| `src/visualizers/<concept>/` | Widgets for one concept plus their pure math and tests |
| `public/og/<slug>.png` | 1200×630 share cards (falls back to `og/site.png`) |

## Adding a concept (for a new video)

1. Create `src/visualizers/<slug>/`. Keep the math in a plain `math.ts` with a `math.test.ts` next to it. Build each widget as a `.tsx` component using `useCanvas`, the `ui/` controls, and color tokens from `lib/theme.ts`.
2. Create `src/content/concepts/<slug>.mdx` with frontmatter: `title`, `category` (Math / AI / Physics / Engineering), `hook`, `description`, `videoId`, `videoTitle`, `order`. Quote any value that contains a colon. Import widgets and add them with `client:visible`.
3. Add a thumbnail branch for the slug in `src/components/Thumb.astro`. Optionally add `public/og/<slug>.png`.
4. Run `npm test && npm run check && npm run build`.

Conventions:
- **One meaning per color on a page**, and every widget has a `Legend`. Gradient descent: cyan = loss, amber = position/path, magenta = slope/gradient, lime = minimum, red = diverged.
- Short text: the widget teaches. Aim for 3–4 "What you're seeing" steps.
- Give every URL key a unique name across the widgets on one page (`lr1` vs `lr`).
- Handle pointer events (mouse and touch) and keep the native range inputs so the keyboard works. `prefersReducedMotion()` turns animations into jumps.

## Linking from a video

Every control is saved in the URL, so you can link to a specific setup. For example:
`/gradient-descent/?surf=wells&opt=momentum&lr=0.3` opens the "two minima" surface with momentum on.

## Deploy

Before deploying, set `site` in `astro.config.mjs` to the real domain; canonical and share URLs use it. `dist/` is a plain static folder that runs on Cloudflare Pages, Vercel or Netlify with build command `npm run build` and output `dist`.
