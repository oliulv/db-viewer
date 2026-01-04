# db-viewer

A CLI tool that parses your schema.ts and index.ts files and spins up a local web UI to visualize your database schema and query functions. Like Supabase's dashboard but for local SQLite projects using bun:sqlite.

## Setup

```bash
git clone https://github.com/YOUR_USERNAME/db-viewer.git
cd db-viewer
bun install
```

## Usage

### Run locally (development)

```bash
bun run dev
```

### Install globally

```bash
bun install -g .
```

Then run from any project:

```bash
db-viewer
```

### CLI Options

```
db-viewer [options] [path]

Options:
  -s, --schema <path>     Path to schema.ts file
  -f, --functions <path>  Path to index.ts (db functions file)
  -p, --port <number>     Server port (default: 3456)
  -o, --open              Open browser automatically
  -h, --help              Show help
```

### Examples

```bash
# Auto-detect files in ./src/db/
db-viewer

# Specify a directory
db-viewer ./src/db

# Specify files explicitly
db-viewer --schema ./db/schema.ts --functions ./db/index.ts

# Custom port and auto-open browser
db-viewer -p 4000 -o
```

## Development

```bash
bun run typecheck    # Type check
bun run lint         # Lint and format check
bun run lint:fix     # Fix lint and format issues
bun run test         # Run tests
```

## License

MIT
