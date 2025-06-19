# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production (includes Workbox service worker generation)
- `npm run preview` - Preview production build
- `npm run lint` - Run Biome linter and format code
- `npm run format` - Format code with Biome
- `npm run test` - Run tests with Vitest
- `npm run test:watch` - Run tests in watch mode
- `npm run check-stations` - Check for stations without destinations using the script

## Project Architecture

### Tech Stack
- **Astro** - Static site generator with hybrid rendering
- **Preact** - React-like library for interactive components
- **TailwindCSS** - Utility-first CSS framework
- **TypeScript** - Type safety
- **Biome** - Linting and formatting
- **Vitest** - Testing framework
- **Workbox** - Service worker for PWA functionality

### Core Data Flow
1. **Data Source**: Fintraffic's Railway Traffic API (`rata.digitraffic.fi`)
2. **Station Data**: Fetched via GraphQL endpoint with extensive filtering to exclude non-passenger stations
3. **Train Data**: Fetched via REST API with intelligent caching (10s for trains, 1h for stations)
4. **Route Generation**: All possible station combinations are pre-generated as static paths

### Key Architecture Patterns

**API Layer (`src/utils/api.ts`)**
- Dual caching system with configurable TTL
- GraphQL for station metadata, REST for live train data
- Special handling for I/P train round trips and track changes
- Robust error handling with fallback to cached data

**Component Architecture**
- `StationManager` - Main orchestrator component handling state, localStorage, and URL synchronization
- `StationList` - Reusable dropdown component with search and keyboard navigation
- `TrainList` - Real-time train display with automatic refresh
- `TrainCard` - Individual train information with delay indicators

**Routing & State Management**
- URL-based routing with browser history support
- LocalStorage persistence for user preferences
- PWA launch detection for state restoration
- Automatic geolocation with Finland boundary checking

### Internationalization
- i18n system in `src/i18n/` with Finnish (fi) and English (en) support
- Translation utility in `src/utils/translations.ts`
- URL and localStorage language persistence

### Testing
- Component tests with Testing Library and jsdom
- Utility function tests for API and calculations
- Snapshot testing for UI components
- Test setup in `src/__tests__/setup.ts`

### PWA Features
- Service worker with Workbox for offline functionality
- Custom SW injection plugin in `astro.config.mjs`
- Manifest file for app installation
- Icon set for various platforms

## Development Notes

### Code Style
- Uses tabs for indentation (configured in Biome)
- Double quotes for strings
- Strict TypeScript configuration
- Component files use `.tsx` extension

### API Integration
- Rate limiting awareness with 429 status handling
- Station filtering removes freight-only and maintenance stations
- Special route handling for PSL↔HKI journeys
- Track information extraction for platform displays

### State Management
- No external state management library
- Heavy use of localStorage for persistence
- URL as single source of truth for routing
- Component-level state with props drilling