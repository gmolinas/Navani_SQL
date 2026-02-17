// SQL Diagram - Saved Schemas (localStorage persistence)

const SCHEMAS_STORAGE_KEY = 'navani_saved_schemas';

function getSavedSchemas() {
    try {
        return JSON.parse(localStorage.getItem(SCHEMAS_STORAGE_KEY)) || [];
    } catch {
        return [];
    }
}

function setSavedSchemas(schemas) {
    localStorage.setItem(SCHEMAS_STORAGE_KEY, JSON.stringify(schemas));
}

function saveCurrentSchema() {
    const dsl = elements.sqlInput.value.trim();
    if (!dsl || state.tables.length === 0) {
        showToast('Nothing to save', 'warning');
        return;
    }

    const name = (elements.schemaNameInput && elements.schemaNameInput.value.trim())
        || 'Untitled Schema';

    // Collect icons and colors
    const icons = {};
    const colors = {};
    for (const t of state.tables) {
        if (t.icon && t.icon !== 'fa-table') icons[t.name] = t.icon;
        if (t.color) colors[t.name] = t.color;
    }

    const schema = {
        id: Date.now().toString(36),
        name,
        dsl,
        icons,
        colors,
        tableCount: state.tables.length,
        savedAt: Date.now()
    };

    const schemas = getSavedSchemas();

    // Check if a schema with the same name exists → update it
    const existingIdx = schemas.findIndex(s => s.name === name);
    if (existingIdx !== -1) {
        schemas[existingIdx] = { ...schema, id: schemas[existingIdx].id };
    } else {
        schemas.unshift(schema);
    }

    setSavedSchemas(schemas);
    renderSchemasList();
    showToast(`Schema "${name}" saved`, 'success');
}

function loadSchema(schema) {
    elements.sqlInput.value = schema.dsl;
    updateLineNumbers();

    if (elements.schemaNameInput) {
        elements.schemaNameInput.value = schema.name;
        document.title = `${schema.name} — Navani SQL`;
    }

    state._pendingIcons = schema.icons || {};
    state._pendingColors = schema.colors || {};
    runParser();
    showToast(`Loaded "${schema.name}"`, 'success');
}

function deleteSchema(id) {
    const schemas = getSavedSchemas().filter(s => s.id !== id);
    setSavedSchemas(schemas);
    renderSchemasList();
    showToast('Schema deleted', 'success');
}

function renderSchemasList() {
    const container = $('#schemasList');
    if (!container) return;

    const schemas = getSavedSchemas();

    if (schemas.length === 0) {
        container.innerHTML = '<div class="schemas-list-empty">No saved schemas yet.<br>Click <i class="fas fa-save"></i> to save the current one.</div>';
        return;
    }

    container.innerHTML = '';

    for (const schema of schemas) {
        const item = document.createElement('div');
        item.className = 'schema-item';

        const ago = timeAgo(schema.savedAt);

        item.innerHTML = `
            <div class="schema-item-info">
                <div class="schema-item-name">${escapeHtml(schema.name)}</div>
                <div class="schema-item-meta">${schema.tableCount} tables · ${ago}</div>
            </div>
            <button class="schema-item-delete" title="Delete"><i class="fas fa-trash"></i></button>
        `;

        item.querySelector('.schema-item-info').addEventListener('click', () => {
            loadSchema(schema);
        });

        item.querySelector('.schema-item-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSchema(schema.id);
        });

        container.appendChild(item);
    }
}

function timeAgo(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function initDragAndDrop() {
    // Initialize saved schemas panel
    $('#saveSchemaBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        saveCurrentSchema();
    });

    // Toggle collapse
    const panel = $('#schemasPanel');
    const header = panel.querySelector('.schemas-panel-header');
    header.addEventListener('click', (e) => {
        // Don't toggle when clicking the save button
        if (e.target.closest('#saveSchemaBtn')) return;
        panel.classList.toggle('collapsed');
    });

    renderSchemasList();
}
