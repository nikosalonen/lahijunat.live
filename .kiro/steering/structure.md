# Project Structure & Organization

## Root Level
- **Configuration files** at root: `astro.config.mjs`, `tsconfig.json`, `biome.json`, `tailwind.config.mjs`
- **Package management**: `package.json`, `package-lock.json`
- **Build output**: `dist/` (generated)
- **Static assets**: `public/` (fonts, icons, images, manifest)

## Source Code Structure (`src/`)

### Pages (`src/pages/`)
- `index.astro` - Main application page
- `[...stations].astro` - Dynamic route for station-to-station views
- `changelog.astro` - Release notes page

### Components (`src/components/`)
- **UI Components**: Preact components for interactive elements
- **Naming**: PascalCase with descriptive names (e.g., `StationManager.tsx`, `TrainCard.tsx`)
- **Testing**: Component tests in `__tests__/` subdirectory

### Utilities (`src/utils/`)
- **API layer**: `api.ts` - External API integration
- **Business logic**: `trainUtils.ts`, `location.ts`
- **App utilities**: `language.ts`, `translations.ts`, `swUpdate.ts`
- **Testing**: Co-located `.test.ts` files

### Styling & Assets
- **Global styles**: `src/styles/global.css`
- **Static assets**: `src/assets/` (SVGs, images)
- **Styling approach**: TailwindCSS utility classes with custom animations

### Internationalization
- **Translation files**: `src/i18n/` (JSON format for fi/en)
- **Language utilities**: `src/hooks/useLanguageChange.ts`

### Content & Data
- **Content collections**: `src/content/` (Astro content collections)
- **Type definitions**: `src/types.ts` (shared TypeScript types)

## Key Architectural Patterns
- **Islands Architecture**: Astro static generation with selective hydration
- **Component Co-location**: Tests and related files near components
- **Utility Organization**: Grouped by functionality (API, translations, etc.)
- **Type Safety**: Centralized type definitions with strict TypeScript

## File Naming Conventions
- **Components**: PascalCase `.tsx` files
- **Utilities**: camelCase `.ts` files
- **Pages**: lowercase `.astro` files
- **Tests**: `.test.ts` or `__tests__/` directories
