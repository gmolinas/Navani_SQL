# SQL Diagram - Free Database Schema Designer

## 1. Project Overview

**Project Name:** SQL Diagram  
**Project Type:** Web Application (Single HTML file with embedded CSS/JS)  
**Core Functionality:** A free alternative to dbdiagram.io that provides a split-view interface with SQL code on the left and interactive ER diagram on the right, with drag-and-drop schema editing capabilities.  
**Target Users:** Developers, database administrators, and students who need to design and visualize database schemas.

---

## 2. UI/UX Specification

### Layout Structure

**Main Layout:** Full viewport height, split into two main panels
- **Left Panel (SQL Editor):** 40% width, full height
- **Right Panel (Diagram Canvas):** 60% width, full height
- **Header:** 50px height, spans full width
- **Toolbar:** 45px height, between header and main panels

**Responsive Breakpoints:**
- Desktop (>1024px): Side-by-side panels
- Tablet/Mobile (<1024px): Stacked panels with tab switching

### Visual Design

**Color Palette:**
- Background Dark: `#0d1117`
- Panel Background: `#161b22`
- Editor Background: `#1e2530`
- Primary Accent: `#58a6ff` (bright blue)
- Secondary Accent: `#7ee787` (green for success)
- Warning: `#f0883e` (orange)
- Error: `#f85149` (red)
- Text Primary: `#e6edf3`
- Text Secondary: `#8b949e`
- Border Color: `#30363d`
- Table Header: `#21262d`
- Table Row Alternate: `#161b22`
- Primary Key: `#f0883e` (orange key icon)
- Foreign Key: `#58a6ff` (blue link icon)

**Typography:**
- Font Family (UI): `'JetBrains Mono', 'Fira Code', monospace`
- Font Family (Editor): `'JetBrains Mono', monospace`
- Header Title: 20px, bold
- Toolbar Buttons: 13px, medium
- Editor Text: 14px, regular
- Table Names: 14px, bold
- Column Names: 13px, regular
- Data Types: 12px, italic

**Spacing System:**
- Base unit: 8px
- Panel padding: 0 (edge-to-edge)
- Component padding: 12px
- Gap between elements: 8px
- Table cell padding: 8px 12px

**Visual Effects:**
- Box shadows: `0 4px 12px rgba(0,0,0,0.4)`
- Border radius: 6px for buttons, 8px for panels
- Transition duration: 200ms ease
- Draggable items: glow effect `0 0 20px rgba(88,166,255,0.3)`
- Hover states: brightness increase + subtle border glow

### Components

**Header:**
- Logo/Title: "SQL Diagram" with database icon
- Subtitle: "Free Schema Designer"
- Theme toggle button (dark/light - optional)

**Toolbar:**
- "Run SQL" button (primary action, blue)
- "Clear All" button (secondary)
- "Export PNG" button
- "Export SQL" button
- Zoom controls (+/- buttons and percentage display)
- Fit to screen button

**SQL Editor Panel:**
- Line numbers gutter
- Syntax highlighting for SQL keywords
- Auto-complete dropdown (basic)
- Error indicators (red underline)
- Placeholder text with example SQL

**Diagram Canvas:**
- Infinite pan/zoom canvas
- Grid background (subtle dots)
- Tables rendered as cards
- Relationship lines (bezier curves)
- Minimap (optional, bottom-right)

**Table Card (in Diagram):**
- Header: Table name with icon
- Body: List of columns
- Each column shows: icon (PK/FK), name, data type
- Draggable handle (top-left corner)
- Resize handles (corners)
- Hover state: highlight + show edit icons
- Selected state: blue border glow

**Relationship Lines:**
- Solid line for required relationships
- Dashed line for optional relationships
- Cardinality notation (1, N, 0..1, 0..N)
- Arrow heads showing direction

**Drag & Drop Interface:**
- Sidebar with available table templates
- Drag tables from sidebar to canvas
- Drag columns between tables
- Drop zone highlighting
- Visual feedback during drag

---

## 3. Functionality Specification

### Core Features

**1. SQL Parsing & Rendering**
- Parse CREATE TABLE statements
- Extract table names, columns, data types
- Extract PRIMARY KEY constraints
- Extract FOREIGN KEY constraints
- Support common data types: INT, VARCHAR, TEXT, BOOLEAN, DATE, DATETIME, TIMESTAMP, DECIMAL, FLOAT, BLOB
- Real-time parsing as user types (debounced 500ms)
- Error handling with clear error messages

**2. Bidirectional Sync**
- SQL → Diagram: Parse and render
- Diagram → SQL: Generate SQL from diagram changes
- Changes in either panel update the other

**3. Drag & Drop Schema Editing**
- Add new table by dragging from palette
- Move tables freely on canvas
- Drag columns to reorder within table
- Drag column to another table to create FK
- Double-click table to edit inline
- Right-click context menu for table operations

**4. Table Operations (via UI)**
- Add new table
- Rename table
- Delete table
- Add column
- Edit column (name, type, constraints)
- Delete column
- Set primary key
- Set foreign key
- Reorder columns

**5. Relationship Management**
- Auto-detect relationships from FK
- Manual relationship creation
- Relationship types: one-to-one, one-to-many, many-to-many
- Visual indication of relationship cardinality

**6. Canvas Interactions**
- Pan: Click and drag on empty space
- Zoom: Mouse wheel or buttons
- Select: Click on table
- Multi-select: Shift+click or drag selection box
- Move: Drag selected tables
- Delete: Select + Delete key or context menu

**7. Export Options**
- Export diagram as PNG image
- Export SQL as .sql file
- Copy SQL to clipboard

### User Interactions & Flows

**Flow 1: Create Schema from SQL**
1. User types SQL in left panel
2. System parses SQL after 500ms debounce
3. Diagram updates automatically in right panel
4. User can adjust table positions via drag

**Flow 2: Create Schema via Drag & Drop**
1. User drags table template from palette
2. Drops on canvas
3. Modal/inline form appears for table details
4. Table appears on canvas
5. SQL updates automatically in left panel

**Flow 3: Modify via Diagram**
1. User double-clicks table header to rename
2. User clicks "+" to add column
3. User sets PK by clicking key icon
4. User drags column to another table to create FK
5. SQL updates automatically

### Edge Cases

- Empty SQL: Show placeholder diagram with instructions
- Invalid SQL: Show error message, keep last valid diagram
- Circular FK references: Handle gracefully
- Very long table/column names: Truncate with tooltip
- Many tables: Performance optimization with virtualization
- Overlapping tables: Auto-arrange or collision detection

---

## 4. Acceptance Criteria

### Visual Checkpoints
- [ ] Split panel layout renders correctly
- [ ] Dark theme colors match specification
- [ ] SQL syntax highlighting works
- [ ] Tables render as styled cards
- [ ] Relationship lines connect tables properly
- [ ] Drag and drop shows visual feedback
- [ ] Toolbar buttons are styled and functional

### Functional Checkpoints
- [ ] SQL input parses and renders diagram
- [ ] Diagram changes update SQL
- [ ] Tables can be dragged on canvas
- [ ] Tables can be added via drag-drop palette
- [ ] Columns can be added/edited/deleted
- [ ] Primary/Foreign keys can be set
- [ ] Zoom and pan work smoothly
- [ ] Export to PNG works
- [ ] Export to SQL file works
- [ ] Error handling shows clear messages

### Performance Checkpoints
- [ ] Initial load < 2 seconds
- [ ] Typing response < 500ms
- [ ] Smooth 60fps animations
- [ ] Handles 20+ tables without lag
