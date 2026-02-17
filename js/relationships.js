// SQL Diagram - Relationship Management (CRUD, Connection Draft, Editor)

function getReferenceColumnForTable(table) {
    return (
        table.columns.find(c => c.pk) ||
        table.columns.find(c => c.name.toLowerCase() === 'id') ||
        table.columns[0] ||
        null
    );
}

function sanitizeColumnName(name) {
    const sanitized = name
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');

    return sanitized || 'fk_id';
}

function getUniqueColumnName(table, baseName) {
    let candidate = baseName;
    let counter = 1;

    const hasColumn = (name) =>
        table.columns.some(col => col.name.toLowerCase() === name.toLowerCase());

    while (hasColumn(candidate)) {
        counter++;
        candidate = `${baseName}_${counter}`;
    }

    return candidate;
}

function renameTableReferences(oldName, newName) {
    for (const table of state.tables) {
        for (const col of table.columns) {
            if (col.refTable === oldName) {
                col.refTable = newName;
                col.fk = true;
            }
        }
    }
}

function removeTableReferencesTo(tableName) {
    for (const table of state.tables) {
        for (const col of table.columns) {
            if (col.refTable === tableName) {
                col.fk = false;
                col.refTable = null;
                col.refColumn = null;
            }
        }
    }
}

function suggestForeignKeyColumnName(toTableName, toColumnName) {
    return sanitizeColumnName(`${toTableName}_${toColumnName}`);
}

function createRelationshipBetweenTables(fromTableName, toTableName, options = {}) {
    const {
        toColumnName = null,
        fkColumnName = '',
        relationshipKind = 'many_to_one',
        isRequired = false
    } = options;

    if (fromTableName === toTableName) {
        showToast('Cannot connect a table to itself from table mode', 'warning');
        return false;
    }

    const fromTable = state.tables.find(t => t.name === fromTableName);
    const toTable = state.tables.find(t => t.name === toTableName);

    if (!fromTable || !toTable) {
        showToast('Invalid tables for relationship', 'error');
        return false;
    }

    const toColumn = toColumnName
        ? toTable.columns.find(c => c.name === toColumnName) || null
        : getReferenceColumnForTable(toTable);

    if (!toColumn) {
        showToast(`Table ${toTableName} has no columns to reference`, 'warning');
        return false;
    }

    const duplicate = state.relationships.some(r =>
        r.fromTable === fromTableName &&
        r.toTable === toTableName &&
        r.toColumn === toColumn.name
    );

    if (duplicate) {
        showToast(`Relationship ${fromTableName} -> ${toTableName} already exists`, 'warning');
        return false;
    }

    const normalizedInputName = (fkColumnName || '').trim();
    const suggestedName = normalizedInputName
        ? sanitizeColumnName(normalizedInputName)
        : suggestForeignKeyColumnName(toTableName, toColumn.name);
    const finalFkColumnName = getUniqueColumnName(fromTable, suggestedName);
    const shouldBeUnique = relationshipKind === 'one_to_one';

    fromTable.columns.push({
        name: finalFkColumnName,
        type: toColumn.type || 'int',
        pk: false,
        increment: false,
        notNull: !!isRequired,
        unique: shouldBeUnique,
        default: null,
        fk: true,
        refTable: toTableName,
        refColumn: toColumn.name
    });

    state.relationships.push({
        fromTable: fromTableName,
        fromColumn: finalFkColumnName,
        toTable: toTableName,
        toColumn: toColumn.name
    });

    updateSQLFromState();
    renderTables();
    showToast(`Connected ${fromTableName}.${finalFkColumnName} -> ${toTableName}.${toColumn.name}`, 'success');
    return true;
}

function closeRelationEditor() {
    if (!state.relationEditor) return;

    const { element, onOutsidePointerDown, onResize } = state.relationEditor;
    document.removeEventListener('pointerdown', onOutsidePointerDown, true);
    window.removeEventListener('resize', onResize);

    if (element && element.parentNode) {
        element.parentNode.removeChild(element);
    }

    state.relationEditor = null;
}

function openRelationEditor(fromTableName, toTableName, clientPoint) {
    closeRelationEditor();

    const fromTable = state.tables.find(t => t.name === fromTableName);
    const toTable = state.tables.find(t => t.name === toTableName);
    if (!fromTable || !toTable) return;
    if (!toTable.columns.length) {
        showToast(`Table ${toTableName} has no columns`, 'warning');
        return;
    }

    const defaultTargetColumn = getReferenceColumnForTable(toTable) || toTable.columns[0];
    const defaultTargetName = defaultTargetColumn.name;
    const defaultFkName = suggestForeignKeyColumnName(toTableName, defaultTargetName);

    const popover = document.createElement('div');
    popover.className = 'relation-popover';
    popover.innerHTML = `
        <div class="relation-popover-title">Define Relationship</div>
        <div class="relation-popover-subtitle">${fromTableName} -> ${toTableName}</div>

        <label class="relation-popover-label">Target column</label>
        <select class="relation-popover-select" data-role="target-column">
            ${toTable.columns.map(col => `<option value="${col.name}" ${col.name === defaultTargetName ? 'selected' : ''}>${col.name} (${col.type})</option>`).join('')}
        </select>

        <label class="relation-popover-label">FK column (source)</label>
        <input class="relation-popover-input" data-role="fk-column" value="${defaultFkName}" />

        <label class="relation-popover-label">Relationship style</label>
        <select class="relation-popover-select" data-role="relationship-kind">
            <option value="many_to_one">1 : N (default FK)</option>
            <option value="one_to_one">1 : 1 (unique FK)</option>
        </select>

        <label class="relation-popover-label">Required</label>
        <select class="relation-popover-select" data-role="required">
            <option value="false">Optional (NULL)</option>
            <option value="true">Required (NOT NULL)</option>
        </select>

        <div class="relation-popover-actions">
            <button class="relation-popover-btn secondary" data-role="cancel">Cancel</button>
            <button class="relation-popover-btn primary" data-role="create">Create</button>
        </div>
    `;

    document.body.appendChild(popover);

    const targetSelect = popover.querySelector('[data-role="target-column"]');
    const fkInput = popover.querySelector('[data-role="fk-column"]');
    const kindSelect = popover.querySelector('[data-role="relationship-kind"]');
    const requiredSelect = popover.querySelector('[data-role="required"]');
    const cancelBtn = popover.querySelector('[data-role="cancel"]');
    const createBtn = popover.querySelector('[data-role="create"]');

    let fkInputTouched = false;

    const positionPopover = () => {
        const width = popover.offsetWidth;
        const height = popover.offsetHeight;
        const left = clamp(clientPoint.x + 12, 12, window.innerWidth - width - 12);
        const top = clamp(clientPoint.y + 12, 12, window.innerHeight - height - 12);
        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
    };

    positionPopover();

    fkInput.addEventListener('input', () => {
        fkInputTouched = true;
    });

    targetSelect.addEventListener('change', () => {
        if (fkInputTouched) return;
        const suggested = suggestForeignKeyColumnName(toTableName, targetSelect.value);
        fkInput.value = suggested;
    });

    const onCancel = () => {
        closeRelationEditor();
    };

    const onCreate = () => {
        const success = createRelationshipBetweenTables(fromTableName, toTableName, {
            toColumnName: targetSelect.value,
            fkColumnName: fkInput.value,
            relationshipKind: kindSelect.value,
            isRequired: requiredSelect.value === 'true'
        });

        if (success) {
            closeRelationEditor();
        }
    };

    cancelBtn.addEventListener('click', onCancel);
    createBtn.addEventListener('click', onCreate);

    popover.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onCreate();
        }
    });

    const onOutsidePointerDown = (e) => {
        if (!state.relationEditor) return;
        if (popover.contains(e.target)) return;
        closeRelationEditor();
    };

    const onResize = () => {
        if (!state.relationEditor) return;
        positionPopover();
    };

    document.addEventListener('pointerdown', onOutsidePointerDown, true);
    window.addEventListener('resize', onResize);

    state.relationEditor = {
        element: popover,
        onOutsidePointerDown,
        onResize
    };

    fkInput.focus();
    fkInput.select();
}

function openEditRelationEditor(rel, clientPoint) {
    closeRelationEditor();

    const fromTable = state.tables.find(t => t.name === rel.fromTable);
    const toTable = state.tables.find(t => t.name === rel.toTable);
    if (!fromTable || !toTable) return;

    const fromCol = fromTable.columns.find(c => c.name === rel.fromColumn);
    if (!fromCol) return;

    const currentKind = fromCol.unique ? 'one_to_one' : 'many_to_one';
    const currentRequired = fromCol.notNull ? 'true' : 'false';

    const popover = document.createElement('div');
    popover.className = 'relation-popover';
    popover.innerHTML = `
        <div class="relation-popover-title">Edit Relationship</div>
        <div class="relation-popover-subtitle">${rel.fromTable}.${rel.fromColumn} → ${rel.toTable}.${rel.toColumn}</div>

        <label class="relation-popover-label">Target column</label>
        <select class="relation-popover-select" data-role="target-column">
            ${toTable.columns.map(col => `<option value="${col.name}" ${col.name === rel.toColumn ? 'selected' : ''}>${col.name} (${col.type})</option>`).join('')}
        </select>

        <label class="relation-popover-label">FK column name</label>
        <input class="relation-popover-input" data-role="fk-column" value="${rel.fromColumn}" />

        <label class="relation-popover-label">Relationship style</label>
        <select class="relation-popover-select" data-role="relationship-kind">
            <option value="many_to_one" ${currentKind === 'many_to_one' ? 'selected' : ''}>1 : N (default FK)</option>
            <option value="one_to_one" ${currentKind === 'one_to_one' ? 'selected' : ''}>1 : 1 (unique FK)</option>
        </select>

        <label class="relation-popover-label">Required</label>
        <select class="relation-popover-select" data-role="required">
            <option value="false" ${currentRequired === 'false' ? 'selected' : ''}>Optional (NULL)</option>
            <option value="true" ${currentRequired === 'true' ? 'selected' : ''}>Required (NOT NULL)</option>
        </select>

        <div class="relation-popover-actions">
            <button class="relation-popover-btn danger" data-role="delete">Delete</button>
            <div style="flex:1"></div>
            <button class="relation-popover-btn secondary" data-role="cancel">Cancel</button>
            <button class="relation-popover-btn primary" data-role="save">Save</button>
        </div>
    `;

    document.body.appendChild(popover);

    const targetSelect = popover.querySelector('[data-role="target-column"]');
    const fkInput = popover.querySelector('[data-role="fk-column"]');
    const kindSelect = popover.querySelector('[data-role="relationship-kind"]');
    const requiredSelect = popover.querySelector('[data-role="required"]');
    const cancelBtn = popover.querySelector('[data-role="cancel"]');
    const saveBtn = popover.querySelector('[data-role="save"]');
    const deleteBtn = popover.querySelector('[data-role="delete"]');

    const positionPopover = () => {
        const width = popover.offsetWidth;
        const height = popover.offsetHeight;
        const left = clamp(clientPoint.x + 12, 12, window.innerWidth - width - 12);
        const top = clamp(clientPoint.y + 12, 12, window.innerHeight - height - 12);
        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
    };

    positionPopover();

    const onCancel = () => closeRelationEditor();

    const onDelete = () => {
        // Remove the FK column from the source table
        fromTable.columns = fromTable.columns.filter(c => c.name !== rel.fromColumn);
        // Remove the relationship
        state.relationships = state.relationships.filter(r => r !== rel);
        closeRelationEditor();
        updateSQLFromState();
        renderTables();
        showToast(`Deleted ${rel.fromTable}.${rel.fromColumn} → ${rel.toTable}.${rel.toColumn}`, 'success');
    };

    const onSave = () => {
        const newTargetCol = targetSelect.value;
        const newFkName = (fkInput.value || '').trim();
        const newKind = kindSelect.value;
        const newRequired = requiredSelect.value === 'true';

        if (!newFkName) {
            showToast('FK column name cannot be empty', 'warning');
            return;
        }

        // Check for duplicate column name (excluding the current one)
        const duplicate = fromTable.columns.some(
            c => c.name !== rel.fromColumn && c.name.toLowerCase() === newFkName.toLowerCase()
        );
        if (duplicate) {
            showToast(`Column "${newFkName}" already exists in ${rel.fromTable}`, 'warning');
            return;
        }

        // Update the FK column properties
        fromCol.name = sanitizeColumnName(newFkName);
        fromCol.unique = newKind === 'one_to_one';
        fromCol.notNull = newRequired;
        fromCol.refColumn = newTargetCol;

        // Update the relationship record
        rel.fromColumn = fromCol.name;
        rel.toColumn = newTargetCol;

        closeRelationEditor();
        updateSQLFromState();
        renderTables();
        showToast(`Updated ${rel.fromTable}.${rel.fromColumn} → ${rel.toTable}.${rel.toColumn}`, 'success');
    };

    cancelBtn.addEventListener('click', onCancel);
    deleteBtn.addEventListener('click', onDelete);
    saveBtn.addEventListener('click', onSave);

    popover.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onSave();
        }
    });

    const onOutsidePointerDown = (e) => {
        if (!state.relationEditor) return;
        if (popover.contains(e.target)) return;
        closeRelationEditor();
    };

    const onResize = () => {
        if (!state.relationEditor) return;
        positionPopover();
    };

    document.addEventListener('pointerdown', onOutsidePointerDown, true);
    window.addEventListener('resize', onResize);

    state.relationEditor = {
        element: popover,
        onOutsidePointerDown,
        onResize
    };

    fkInput.focus();
    fkInput.select();
}

function cancelConnectionDraft() {
    if (!state.connectionDraft) return;
    state.connectionDraft = null;
    document.body.style.userSelect = '';
    renderRelationships();
}

function startConnectionFromTable(fromTable, pointerEvent) {
    if (pointerEvent.button !== 0) return;

    if (state.connectionDraft) {
        cancelConnectionDraft();
    }
    if (state.relationEditor) {
        closeRelationEditor();
    }

    const startWorld = clientToWorldPoint(pointerEvent.clientX, pointerEvent.clientY);
    const fromSide = chooseSideToPoint(fromTable, startWorld);
    const fromPoint = getTableBoundaryAnchor(fromTable, fromSide);
    const pointerId = pointerEvent.pointerId;

    state.connectionDraft = {
        pointerId,
        fromTable: fromTable.name,
        fromPoint,
        fromSide,
        currentPoint: startWorld,
        targetTable: null
    };

    document.body.style.userSelect = 'none';
    renderRelationships();

    const onPointerMove = (e) => {
        if (!state.connectionDraft || state.connectionDraft.pointerId !== e.pointerId) return;
        const worldPoint = clientToWorldPoint(e.clientX, e.clientY);
        const target = findTableAtWorldPoint(worldPoint);

        state.connectionDraft.currentPoint = worldPoint;
        state.connectionDraft.targetTable =
            target && target.name !== fromTable.name ? target.name : null;

        renderRelationships();
    };

    const finish = (e, canceled = false) => {
        if (!state.connectionDraft || state.connectionDraft.pointerId !== e.pointerId) return;

        const finalPoint = clientToWorldPoint(e.clientX, e.clientY);
        const target = findTableAtWorldPoint(finalPoint);
        const validTarget = target && target.name !== fromTable.name ? target : null;

        state.connectionDraft = null;
        document.body.style.userSelect = '';

        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('pointercancel', onPointerCancel);

        renderRelationships();

        if (canceled || !validTarget) {
            if (!canceled) {
                showToast('Connection canceled', 'warning');
            }
            return;
        }

        // The table you drag TO receives the FK column referencing
        // the table you started FROM (the parent/referenced table).
        openRelationEditor(validTarget.name, fromTable.name, {
            x: e.clientX,
            y: e.clientY
        });
    };

    const onPointerUp = (e) => finish(e, false);
    const onPointerCancel = (e) => finish(e, true);

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerCancel);
}
