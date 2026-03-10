# Joybuy Banner Generator

An internal web tool for creating, previewing, and exporting pixel-perfect promotional banners for the Joybuy e-commerce platform. Designed for marketing and creative teams who need to produce on-brand banners across multiple formats, languages, and devices with minimal manual effort.

## Use Case

Campaign managers and designers use this tool to:

1. **Upload a campaign image** and instantly generate banners in all required ad placements (Desktop Hero, Mobile Hero, Small Banner, Promotional Banner).
2. **Configure text content** (title, subtitle, CTA button) in English once, then auto-translate into Chinese, Dutch, French, and German via the MyMemory Translation API.
3. **Export production-ready PNGs** at exact pixel dimensions for each format and language combination, either individually or as a bulk `.zip` download.

The tool enforces Joybuy brand guidelines at every step, preventing non-compliant banners from being exported.

## Key Features

### Multi-Format Banner System
Four banner formats with precise pixel dimensions, each with defined safe areas, blocked zones, and text positioning rules:
- **Desktop Hero** (2688 x 720) - Homepage & mini homepage
- **Mobile Hero** (1125 x 720) - App, mobile web, landing pages
- **Small Banner** (2528 x 560) - Desktop promotions *(deprecated)*
- **Promotional Banner** (1053 x 636) - App & mobile web promotions *(deprecated)*

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
- **Single format**: downloads as an individual PNG
- **Export All**: cycles through all enabled languages x selected formats, rendering each at 1:1 pixel dimensions via `html-to-image`, and bundles them into a `.zip` (via JSZip) named `campaign_banners_{langs}_{date}.zip`
- File naming: `campaign_{format}_{lang}_{date}.png`
- Export progress shown via an animated progress banner

### Guide Overlay System
Three color-coded overlay zones (safe area, caution, blocked) can be toggled on each banner preview to help users position imagery correctly within format constraints.

### Guidelines Reference Page
A dedicated `/guidelines` route with 7 workflow-ordered sections covering all banner rules. Features a sticky frosted-glass scrollspy navigation bar. Content is rendered dynamically from the shared rule registry, ensuring the rules page always stays in sync with the validation engine.

## Architecture

```
/src/app
  App.tsx                         # Entry point, RouterProvider
  routes.ts                       # React Router config (/ and /guidelines)
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
```

## Tech Stack

- **React 18** with TypeScript
- **Tailwind CSS v4** for styling
- **React Router v7** (data mode) for routing
- **Motion** (formerly Framer Motion) for animations
- **html-to-image** for pixel-perfect PNG rendering
- **JSZip** for bulk export bundling
- **Lucide React** for icons
- Apple design language: frosted glass, `#0071e3` accents, rounded surfaces

## Fonts

- **Barlow** (400, 500, 600, 700) - Banner body text, subtitles, buttons
- **Poppins** (600) - Banner titles

Both loaded from Google Fonts.
