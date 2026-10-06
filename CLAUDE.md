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

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**This project has a knowledge graph. Start with the code-review-graph
MCP tools to narrow scope, then read the source.** The graph is cheaper than scanning files and
gives you structural context (callers, dependents, test coverage) that file search cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes_tool` or `query_graph_tool` instead of Grep
- **Understanding impact**: `get_impact_radius_tool` instead of manually tracing imports
- **Code review**: `detect_changes_tool` + `get_review_context_tool` instead of reading entire files
- **Finding relationships**: `query_graph_tool` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview_tool` + `list_communities_tool`

### Verify in the source

- Narrow scope with the graph, then read the source. Do not change code from graph output alone.
- For any non-trivial change, read the implementation and the relevant tests before concluding.
- Verify the exact source when touching behavior, database logic, migrations, retries, fallbacks,
  recovery, or compatibility code.
- When the graph and the source disagree, the source wins. The graph may be stale or may not
  model that relationship.
- An empty graph result can mean "not indexed" or "not statically visible", not "does not exist".

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes_tool` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context_tool` | Need source snippets for review — token-efficient |
| `get_impact_radius_tool` | Understanding blast radius of a change |
| `get_affected_flows_tool` | Finding which execution paths are impacted |
| `query_graph_tool` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes_tool` | Finding functions/classes by name or keyword |
| `get_architecture_overview_tool` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes_tool` for code review.
3. Use `get_affected_flows_tool` to understand impact.
4. Use `query_graph_tool` pattern="tests_for" to check coverage.
<!-- /code-review-graph MCP tools -->
