# Navani SQL

A browser-based database schema designer and ER diagram visualizer. Write schemas using a dbdiagram-like DSL, see them rendered as an interactive canvas with auto-routed relationship lines, and export as PNG, JSON, or shareable URLs.

**Zero dependencies** — pure HTML, CSS, and vanilla JavaScript. No build step, no framework.

## Features

### DSL Editor
- dbdiagram-compatible syntax with syntax highlighting and line numbers
- Supports tables, columns, types (`int`, `varchar(n)`, `text`, `bool`, `datetime`, `decimal(p,s)`, ...), constraints (`pk`, `not null`, `unique`, `default`, `increment`), inline `ref:` foreign keys, notes, and indexes
- Table-level style attributes: `[icon: fa-users, color: #3b82f6]`
- Toggle button to show/hide style attributes in the DSL output
- Bidirectional: edit DSL and run, or modify the diagram and see the DSL update

### Interactive Canvas
- Auto-layout with hierarchical BFS positioning based on relationships
- Drag tables freely; drag multiple selected tables as a group
- Pan (middle-click) and zoom (scroll wheel, 25%–200%) with fit-to-screen
- Marquee selection: left-click drag on empty space to select multiple tables
- Ctrl/Cmd+click for additive table selection
- Hover highlighting with animated relationship flow

### Relationships
- Drag-to-connect between tables with live preview
- Smart orthogonal polyline routing with lane offsetting for overlapping connections
- Cardinality notation (1:N, 1:1, 0..N) with bars and midpoint labels
- Dashed lines for optional (nullable) FKs, solid for required
- Click any line to edit or delete the relationship
- Self-referencing relationships supported

### Table Styling
- 20 FontAwesome icons to choose from
- 10 color accents (red, orange, yellow, green, cyan, blue, purple, pink, slate)
- Colors render as a left border stripe and tinted header background

### Export & Share
- **PNG**: preview modal with download or copy-to-clipboard options; renders with full theme colors, icons, relationship lines, and cardinality labels
- **JSON**: full schema export with DSL, tables, relationships, positions, icons, and colors
- **Copy DSL**: copies the generated dbdiagram text to clipboard
- **Share URL**: encodes the entire schema into a URL hash — open in any browser, no backend needed
- **SQL generation**: `CREATE TABLE` output with `AUTO_INCREMENT`, `NOT NULL`, `UNIQUE`, `DEFAULT`, `FOREIGN KEY`, and `PRIMARY KEY`

### Schema Management
- Save/load/delete schemas in localStorage
- Collapsible schemas panel with time-ago labels
- Re-saving a schema with the same name updates it in place

### Themes
- Light and dark themes with a single toggle
- Theme preference persisted in localStorage
- PNG export respects the active theme

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `Ctrl/Cmd + S` | Run parser |
| `Delete` | Delete selected table(s) |
| `Escape` | Close modal / cancel action |
| `Ctrl/Cmd + Click` | Multi-select tables |

## Tech Stack

- **HTML/CSS/JS** — no build tools, no npm, no bundler
- **CSS Custom Properties** for theming (6 CSS modules)
- **12 JS modules** loaded in dependency order via `<script>` tags
- **Google Fonts**: JetBrains Mono + Inter
- **Font Awesome 6** for icons

## Getting Started

1. Clone the repo
2. Open `index.html` in a browser
3. Start writing your schema or use the sample Blog DB

No server required — it's a fully client-side application.
