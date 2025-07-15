# Tech Stack & Build System

## Framework & Core Technologies
- **Astro 5.x** - Static site generator with islands architecture
- **Preact** - Lightweight React alternative for interactive components
- **TypeScript** - Strict type checking enabled
- **TailwindCSS 4.x** - Utility-first CSS framework with custom animations

## Development Tools
- **Biome** - Fast linter and formatter (replaces ESLint/Prettier)
- **Vitest** - Unit testing framework with jsdom environment
- **Workbox** - Service worker generation for PWA functionality

## Code Quality Standards
- Use **tab indentation** (configured in Biome)
- **Double quotes** for JavaScript strings
- **Strict TypeScript** configuration with Astro's strict preset
- **JSX with Preact** - `jsx: "react-jsx"` with `jsxImportSource: "preact"`

## Common Commands

### Development
```bash
npm run dev          # Start development server
npm run build        # Production build + service worker generation
npm run preview      # Preview production build
```

### Code Quality
```bash
npm run lint         # Run Biome linter with auto-fix
npm run format       # Format code with Biome
```

### Testing
```bash
npm run test         # Run unit tests
npm run test:watch   # Run tests in watch mode
```

### Utilities
```bash
npm run check-stations  # Run station validation script
```

## Build Process
1. Astro builds static site
2. Workbox generates service worker for PWA
3. Custom plugin injects service worker registration into HTML files

## API Integration
- Uses Fintraffic's digitraffic.fi Railway Traffic API
- Real-time data fetching with error handling
- No API keys required (public API)
