# CLAUDE.md

## Development Commands

- `pnpm run dev` - Start development server
- `pnpm run build` - Build for production
- `pnpm run lint` - Run Biome linter and format code
- `pnpm run lint:check` - Run Biome linter without auto-fix (used in CI)
- `pnpm run typecheck` - Run TypeScript type checking with Astro
- `pnpm run test` - Run tests with Vitest
- `pnpm run test -- src/components/__tests__/TrainCard.test.tsx` - Run a single test file

## Code Style

- Uses tabs for indentation (configured in Biome)
- Double quotes for strings
- Component files use `.tsx` extension
- Use DaisyUI components when possible
- Use conventional commits (feat:, fix:, chore:, etc.)
- Do NOT include Co-Authored-By trailer in commit messages
- Path alias: `@/*` maps to `src/*`

## Architecture

- **Astro** + **Preact** + **TailwindCSS** + **TypeScript**
- Data source: Fintraffic Railway Traffic API (`rata.digitraffic.fi`)
- GraphQL for station metadata, REST for live train data
- URL as single source of truth for routing, localStorage for persistence
- No external state management library

## Data Attribution

Train data is provided by Fintraffic's digitraffic.fi service under the CC 4.0 BY license.
