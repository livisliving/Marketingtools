# Joybuy Banner Generator

An internal web tool for creating, previewing, and exporting pixel-perfect promotional banners for the Joybuy e-commerce platform. Designed for marketing and creative teams who need to produce on-brand banners across multiple formats, languages, and devices with minimal manual effort.

## Use Case

Campaign managers and designers use this tool to:

1. **Upload a campaign image** and instantly generate banners in all required ad placements (Desktop Hero, Mobile Hero).
2. **Configure text content** (title, subtitle, CTA button) in English once, then auto-translate into Chinese, Dutch, French, and German via the MyMemory Translation API.
3. **Export production-ready JPEGs** at exact pixel dimensions for each format and language combination, either individually or as a bulk `.zip` download. Title, subtitle, and CTA are overlaid as live text on the customer side, so exports contain the background and gradient only; every image is compressed to stay within a 300 KB size cap while keeping the highest possible quality.

The tool enforces Joybuy brand guidelines at every step, preventing non-compliant banners from being exported.

## Key Features

### Multi-Format Banner System
Two banner formats with precise pixel dimensions, each with defined safe areas, blocked zones, and text positioning rules:
- **Desktop Hero** (2688 x 720) - Homepage & mini homepage
- **Mobile Hero** (1125 x 675) - App, mobile web, landing pages

### TintSync Color Engine
A custom CIELAB-based dominant color extraction engine (`tint-sync.ts`) analyzes uploaded images and generates a palette of complementary colors. Selected palette colors drive the gradient overlays on each banner, ensuring the text layer always has adequate contrast against the background image.

### Multi-Language Support
- Five languages: English, Chinese (Mandarin), Dutch, French, German
- Content stored as `Record<LangCode, string>` maps for title, subtitle, and button text
- Auto-translation from English via the MyMemory Translation API
- Language pills in the preview area toggle which languages are included in export
- Language-aware content validation (Latin vs. CJK rules, per-language capitalisation)

### Content Validation System
A rules engine (`content-rules.ts`) powered by a shared rule registry (`rule-registry.ts`) enforces:
- Character limits per format and field
- Capitalisation guidelines (English, French, German, Dutch, Chinese)
- ALL CAPS detection (error for entire field, warning for individual words with acronym exclusions)
- Ellipsis and excessive punctuation checks
- Mobile-specific rules (e.g., CTA button validation skipped for mobile formats)

Violations are surfaced as inline `StatusPill` components on each banner preview. Errors block export via an `ExportBlockedCard` modal; warnings are advisory only.

### Per-Format Image Transforms
Each banner format maintains independent background image controls:
- **Drag to reposition** the image within the banner frame
- **Zoom** (scale) control
- **Horizontal flip**
- **Mobile image override** - upload a separate image for mobile formats with its own transforms and independent TintSync palette

### Export Engine
- **Live text**: title, subtitle, and CTA are overlaid as live text by the page builder on the customer side, so they are **excluded from the exported image** — each export contains the background image and gradient/scrim only. The preview still shows the fully composited banner (with text) so users can see how it will look to customers; a "Live text · not in export" badge on each banner makes this explicit.
- **Single format**: downloads as an individual JPEG
- **Export All**: cycles through all enabled languages x selected formats, rendering each at 1:1 pixel dimensions via `html-to-image`, and bundles them into a `.zip` (via JSZip) named `campaign_banners_{langs}_{date}.zip`
- **Size cap**: each image is exported as JPEG and compressed to fit within a 300 KB limit. Rendering starts at quality 0.95 and, if the output exceeds the cap, binary-searches the JPEG quality down to the highest value that fits — best quality within the limit (`utils/export-image.ts`).
- File naming: `campaign_{format}_{lang}_{date}.jpg`
- Export progress shown via an animated progress banner

### Guide Overlay System
Three color-coded overlay zones (safe area, caution, blocked) can be toggled on each banner preview to help users position imagery correctly within format constraints.

### Guidelines Reference Page
A dedicated `/guidelines` route with 7 workflow-ordered sections covering all banner rules. Features a sticky frosted-glass scrollspy navigation bar. Content is rendered dynamically from the shared rule registry, ensuring the rules page always stays in sync with the validation engine.

## Architecture

```
/src/app
  App.tsx                         # Entry point, RouterProvider
  routes.ts                       # React Router hash-router config (#/ and #/guidelines)
  formats.ts                      # Banner format definitions
  /components
    Generator.tsx                  # Main generator with all state management
    RootLayout.tsx                 # Keeps Generator mounted across routes
    Sidebar.tsx                    # 380px config panel (image, text, colors, export)
    BannerPreview.tsx              # 1:1 render engine with CSS scale-down preview
    StatusPill.tsx                 # Inline validation indicator
    ContentWarnings.tsx            # Validation message display
    ExportBlockedCard.tsx          # Modal blocking export on errors
    ExportProgressBanner.tsx       # Export progress UI
    BannerDetails.tsx              # Format metadata display
    GuidelinesPage.tsx             # /guidelines reference page
  /utils
    tint-sync.ts                   # CIELAB dominant color extraction engine
    content-rules.ts               # Validation rule implementations
    rule-registry.ts               # Single source of truth for rule metadata
    translate.ts                   # MyMemory Translation API integration
    export-image.ts                # JPEG export with 300 KB size-cap quality tuning
```

## Tech Stack

- **React 18** with TypeScript
- **Tailwind CSS v4** for styling
- **React Router v7** (hash router) for routing
- **Motion** (formerly Framer Motion) for animations
- **html-to-image** for pixel-perfect JPEG rendering
- **JSZip** for bulk export bundling
- **Lucide React** for icons
- Apple design language: frosted glass, `#0071e3` accents, rounded surfaces

## Fonts

- **Barlow** (400, 500, 600, 700) - all banner text: titles (Bold 700), subtitles, body, and buttons

Loaded from Google Fonts.

## Deployment & updates

The app is deployed to **GitHub Pages** via GitHub Actions: any push to `main` triggers
`.github/workflows/deploy.yml`, which builds and publishes `dist/`. Stakeholders use the Pages URL;
their next refresh loads the latest version.

**In-app update notification:** the running build stamps its version (from `package.json`) into the
bundle. `src/app/utils/version-check.ts` polls `public/version.json`; if the deployed version is newer,
a dismissible "A new version is available — Refresh" banner appears. Offline / non-hosted copies skip
the check silently.

**Releasing a new version:**
1. Bump `version` in **both** `package.json` and `public/version.json`.
2. Commit and push to `main` — the Action deploys automatically.

**Offline / single-file build:** `npm run build:single` (via `vite-plugin-singlefile`) produces a
self-contained `dist/index.html` that runs by double-click with no server (fonts load from the CDN when
online; falls back to the system font offline). The app uses a hash router and a relative asset base
(`base: './'`) specifically so it works from `file://` and under any Pages sub-path.
