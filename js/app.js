// SQL Diagram - Main Application (Init & Event Listeners)

// Theme toggle
const THEME_KEY = 'navani_theme';

function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || 'light';
    applyTheme(saved);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = $('#themeToggleBtn')?.querySelector('i');
    if (icon) {
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
    localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
}

// Initialize application
function init() {
    initTheme();
    initElements();
    initEventListeners();
    initDragAndDrop();
    initPanZoom();
    initResizer();
    updateLineNumbers();
    applyViewportTransform();

    // Sample schema
    const sampleSchema = `// Blog Database Schema

Table users {
  id int [pk, increment]
  name varchar(100) [not null]
  email varchar(150) [unique, not null]
}

Table posts {
  id int [pk, increment]
  user_id int [ref: > users.id]
  title varchar(200) [not null]
  content text
  created_at datetime
}

Table comments {
  id int [pk, increment]
  post_id int [ref: > posts.id]
  user_id int [ref: > users.id]
  body text [not null]
  created_at datetime
}`;

    if (!loadFromShareURL()) {
        elements.sqlInput.value = sampleSchema;
        updateLineNumbers();
    }

    setTimeout(() => {
        runParser();
    }, 500);
}

// Event Listeners
function initEventListeners() {
    $('#runBtn').addEventListener('click', runParser);

    $('#clearBtn').addEventListener('click', () => {
        state.tables = [];
        state.relationships = [];
        state.selectedTables = [];
        cancelConnectionDraft();
        closeRelationEditor();
        elements.sqlInput.value = '';
        updateLineNumbers();
        renderTables();
        showToast('Cleared all tables', 'success');
    });

    $('#exportPngBtn').addEventListener('click', exportPNG);
    $('#pngDownloadBtn').addEventListener('click', downloadPNG);
    $('#pngClipboardBtn').addEventListener('click', copyPNGToClipboard);
    $('#pngCancelBtn').addEventListener('click', closePngModal);
    $('#pngModal').addEventListener('click', (e) => {
        if (e.target === $('#pngModal')) closePngModal();
    });
    $('#exportJsonBtn').addEventListener('click', exportJSON);
    $('#copySqlBtn').addEventListener('click', copySQL);
    $('#shareBtn').addEventListener('click', shareDiagram);

    $('#zoomInBtn').addEventListener('click', () => setZoom(state.zoom + 0.1));
    $('#zoomOutBtn').addEventListener('click', () => setZoom(state.zoom - 0.1));
    $('#fitBtn').addEventListener('click', fitToScreen);
    $('#themeToggleBtn').addEventListener('click', toggleTheme);

    $('#addTableBtn').addEventListener('click', openAddTableModal);

    $('#addColumnBtn').addEventListener('click', () => addColumnField());
    $('#saveTableBtn').addEventListener('click', saveTableFromModal);
    $('#cancelTableBtn').addEventListener('click', () => elements.tableModal.classList.add('hidden'));
    $('#tableModal').addEventListener('click', (e) => {
        if (e.target === elements.tableModal) {
            elements.tableModal.classList.add('hidden');
        }
    });

    $('#styleToggleBtn').addEventListener('click', () => {
        state.showStyleAttrs = !state.showStyleAttrs;
        $('#styleToggleBtn').classList.toggle('active', state.showStyleAttrs);
        updateSQLFromState();
    });

    elements.schemaNameInput.addEventListener('input', () => {
        const name = elements.schemaNameInput.value.trim() || 'Untitled Schema';
        document.title = `${name} — Navani SQL`;
    });
    elements.schemaNameInput.addEventListener('blur', () => {
        if (!elements.schemaNameInput.value.trim()) {
            elements.schemaNameInput.value = 'Untitled Schema';
        }
    });

    elements.sqlInput.addEventListener('input', updateLineNumbers);
    elements.sqlInput.addEventListener('scroll', () => {
        if (elements.lineNumbers) {
            elements.lineNumbers.scrollTop = elements.sqlInput.scrollTop;
        }
        syncHighlightScroll();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' && state.selectedTables.length > 0) {
            const toDelete = [...state.selectedTables];
            for (const name of toDelete) {
                deleteTable(name);
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            runParser();
        }
        if (e.key === 'Escape') {
            if (!$('#pngModal').classList.contains('hidden')) {
                closePngModal();
                return;
            }
            if (state.connectionDraft) {
                cancelConnectionDraft();
                return;
            }
            if (state.relationEditor) {
                closeRelationEditor();
                return;
            }
            elements.tableModal.classList.add('hidden');
        }
    });
}

// Resizer for editor panel
function initResizer() {
    const resizer = elements.resizer;
    const editorPanel = elements.editorPanel;

    if (!resizer || !editorPanel) return;

    let isResizing = false;
    let startX, startWidth;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = editorPanel.offsetWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const diff = e.clientX - startX;
        const newWidth = Math.max(250, Math.min(startWidth + diff, window.innerWidth - 300));
        editorPanel.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

// Run parser
function runParser() {
    const text = elements.sqlInput.value;
    const { tables, relationships } = DBPARSER.parse(text);

    if (tables.length === 0) {
        showToast('No valid Table definitions found', 'warning');
        return;
    }

    // Preserve custom icons from previous state or pending share icons
    const prevIcons = new Map();
    const prevColors = new Map();
    for (const t of state.tables) {
        if (t.icon) prevIcons.set(t.name, t.icon);
        if (t.color) prevColors.set(t.name, t.color);
    }
    if (state._pendingIcons) {
        for (const [name, icon] of Object.entries(state._pendingIcons)) {
            prevIcons.set(name, icon);
        }
        delete state._pendingIcons;
    }
    if (state._pendingColors) {
        for (const [name, color] of Object.entries(state._pendingColors)) {
            prevColors.set(name, color);
        }
        delete state._pendingColors;
    }
    for (const t of tables) {
        if (prevIcons.has(t.name)) t.icon = prevIcons.get(t.name);
        if (prevColors.has(t.name) && !t.color) t.color = prevColors.get(t.name);
    }

    state.tables = tables;
    state.relationships = relationships;
    cancelConnectionDraft();
    closeRelationEditor();
    renderTables();
    showToast(`Loaded ${tables.length} table(s)`, 'success');
}

// Update SQL from state
function updateSQLFromState() {
    const sql = DBPARSER.generate(state.tables, state.relationships, { includeStyle: state.showStyleAttrs });
    elements.sqlInput.value = sql;
    updateLineNumbers();
}

// Start application
document.addEventListener('DOMContentLoaded', init);
