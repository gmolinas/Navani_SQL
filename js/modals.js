// SQL Diagram - Modal Functions (Add/Edit Table)

const TABLE_ICONS = [
    { value: 'fa-table', label: 'Table' },
    { value: 'fa-users', label: 'Users' },
    { value: 'fa-user', label: 'User' },
    { value: 'fa-shopping-cart', label: 'Cart' },
    { value: 'fa-box', label: 'Product' },
    { value: 'fa-file-alt', label: 'Document' },
    { value: 'fa-comment', label: 'Comment' },
    { value: 'fa-tags', label: 'Tags' },
    { value: 'fa-cog', label: 'Settings' },
    { value: 'fa-lock', label: 'Auth' },
    { value: 'fa-credit-card', label: 'Payment' },
    { value: 'fa-envelope', label: 'Email' },
    { value: 'fa-image', label: 'Media' },
    { value: 'fa-map-marker-alt', label: 'Location' },
    { value: 'fa-calendar', label: 'Event' },
    { value: 'fa-chart-bar', label: 'Analytics' },
    { value: 'fa-bell', label: 'Notification' },
    { value: 'fa-star', label: 'Favorite' },
    { value: 'fa-folder', label: 'Category' },
    { value: 'fa-database', label: 'Database' },
];

function renderIconPicker(selectedIcon) {
    const container = $('#iconPickerGrid');
    if (!container) return;
    container.innerHTML = '';

    for (const icon of TABLE_ICONS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'icon-picker-item' + (icon.value === selectedIcon ? ' selected' : '');
        btn.dataset.icon = icon.value;
        btn.title = icon.label;
        btn.innerHTML = `<i class="fas ${icon.value}"></i>`;
        btn.addEventListener('click', () => {
            container.querySelectorAll('.icon-picker-item').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
        container.appendChild(btn);
    }
}

function getSelectedIcon() {
    const selected = document.querySelector('.icon-picker-item.selected');
    return selected ? selected.dataset.icon : 'fa-table';
}

const TABLE_COLORS = [
    null, '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'
];

function renderColorPicker(selectedColor) {
    const container = $('#colorPickerGrid');
    if (!container) return;
    container.innerHTML = '';

    for (const color of TABLE_COLORS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'color-picker-item' + (color === selectedColor ? ' selected' : '');
        if (color) {
            btn.style.backgroundColor = color;
            btn.dataset.color = color;
        } else {
            btn.classList.add('no-color');
            btn.innerHTML = '<i class="fas fa-ban"></i>';
            btn.dataset.color = '';
        }
        btn.title = color || 'No color';
        btn.addEventListener('click', () => {
            container.querySelectorAll('.color-picker-item').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
        container.appendChild(btn);
    }
}

function getSelectedColor() {
    const selected = document.querySelector('.color-picker-item.selected');
    return selected && selected.dataset.color ? selected.dataset.color : null;
}

function openAddTableModal() {
    state.editingTable = null;
    $('#modalTitle').textContent = 'Add Table';
    elements.tableNameInput.value = '';
    elements.columnsContainer.innerHTML = '';
    addColumnField();
    addColumnField();
    renderIconPicker('fa-table');
    renderColorPicker(null);
    elements.tableModal.classList.remove('hidden');
}

function openEditTableModal(table) {
    state.editingTable = table;
    $('#modalTitle').textContent = 'Edit Table';
    elements.tableNameInput.value = table.name;
    elements.columnsContainer.innerHTML = '';

    for (const col of table.columns) {
        addColumnField(col);
    }

    renderIconPicker(table.icon || 'fa-table');
    renderColorPicker(table.color || null);
    elements.tableModal.classList.remove('hidden');
}

function addColumnField(col = {}) {
    const types = ['int', 'varchar(50)', 'varchar(100)', 'varchar(255)', 'text', 'bool', 'datetime', 'date', 'decimal(10,2)', 'float', 'blob'];

    let typeOptions = types.map(t =>
        `<option value="${t}" ${col.type === t ? 'selected' : ''}>${t}</option>`
    ).join('');

    const div = document.createElement('div');
    div.className = 'column-field';
    div.innerHTML = `
        <input type="text" class="form-input col-name" placeholder="name" value="${col.name || ''}">
        <select class="form-select col-type">${typeOptions}</select>
        <label class="form-checkbox">
            <input type="checkbox" class="col-pk" ${col.pk ? 'checked' : ''}>
            PK
        </label>
        <span class="col-remove" title="Remove"><i class="fas fa-times"></i></span>
    `;

    div.querySelector('.col-remove').addEventListener('click', () => {
        div.remove();
    });

    elements.columnsContainer.appendChild(div);

    // Scroll to the new column and briefly highlight it
    requestAnimationFrame(() => {
        div.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        div.classList.add('column-field-new');
        div.addEventListener('animationend', () => {
            div.classList.remove('column-field-new');
        }, { once: true });
    });
}

function saveTableFromModal() {
    const tableName = elements.tableNameInput.value.trim();
    if (!tableName) {
        showToast('Please enter a table name', 'error');
        return;
    }

    const columns = [];
    const colFields = $$('.column-field');

    for (const field of colFields) {
        const name = field.querySelector('.col-name').value.trim();
        const type = field.querySelector('.col-type').value;
        const pk = field.querySelector('.col-pk').checked;

        if (name) {
            columns.push({ name, type, pk, notNull: pk });
        }
    }

    if (columns.length === 0) {
        showToast('Please add at least one column', 'error');
        return;
    }

    const selectedIcon = getSelectedIcon();
    const selectedColor = getSelectedColor();

    if (state.editingTable) {
        const index = state.tables.findIndex(t => t.name === state.editingTable.name);
        if (index !== -1) {
            const oldTableName = state.editingTable.name;

            state.tables[index] = {
                ...state.tables[index],
                name: tableName,
                columns,
                icon: selectedIcon,
                color: selectedColor
            };

            if (oldTableName !== tableName) {
                renameTableReferences(oldTableName, tableName);
            }

            state.relationships = state.relationships.map(rel => {
                if (rel.fromTable === oldTableName) rel.fromTable = tableName;
                if (rel.toTable === oldTableName) rel.toTable = tableName;
                return rel;
            });
        }
    } else {
        const newTable = {
            name: tableName,
            columns,
            icon: selectedIcon,
            color: selectedColor,
            x: 0,
            y: 0
        };
        state.tables.push(newTable);
    }

    elements.tableModal.classList.add('hidden');
    closeRelationEditor();
    updateSQLFromState();
    renderTables();
    showToast(state.editingTable ? 'Table updated' : 'Table added', 'success');
}
