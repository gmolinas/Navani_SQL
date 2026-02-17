// SQL Diagram - Table Rendering & CRUD

function setEmptyStateVisible(visible) {
    if (!elements.emptyState) return;
    elements.emptyState.classList.toggle('hidden', !visible);
    elements.emptyState.style.display = visible ? 'flex' : 'none';
}

// Lightweight hover update - toggles classes on existing cards + redraws SVG
// Does NOT destroy/recreate DOM, so animations stay alive
function updateHoverHighlights() {
    const cards = elements.canvas.querySelectorAll('.table-card');
    for (const card of cards) {
        const name = card.dataset.tableName;
        card.classList.remove('is-hovered', 'connected-to-hovered');

        if (!state.hoveredTable) continue;

        if (name === state.hoveredTable) {
            card.classList.add('is-hovered');
            continue;
        }

        const isConnected = state.relationships.some(
            r => (r.fromTable === state.hoveredTable && r.toTable === name) ||
                 (r.fromTable === name && r.toTable === state.hoveredTable)
        );
        if (isConnected) {
            card.classList.add('connected-to-hovered');
        }
    }

    renderRelationships();
}

// Render tables (full rebuild - use only when table data changes)
function renderTables() {
    const cards = elements.canvas.querySelectorAll('.table-card');
    for (const card of cards) {
        card.remove();
    }

    if (state.tables.length === 0) {
        setEmptyStateVisible(true);
        elements.relationshipsSvg.innerHTML = '';
        return;
    }

    setEmptyStateVisible(false);

    // Auto-layout: hierarchical positioning based on relationships
    const needsLayout = state.tables.every(t => t.x === 0 && t.y === 0);
    if (needsLayout) {
        autoLayoutTables();
    }

    // Render table cards
    for (const table of state.tables) {
        const card = createTableCard(table);
        elements.canvas.appendChild(card);
    }

    // Read actual widths from DOM so anchor points match rendered cards
    for (const table of state.tables) {
        const card = elements.canvas.querySelector(`[data-table-name="${table.name}"]`);
        if (card) {
            table._renderedWidth = card.offsetWidth;
        }
    }

    // Resolve any table overlaps after positioning
    resolveTableOverlaps();
    updateTableCardPositions();

    // Center viewport on tables after fresh layout
    if (needsLayout) {
        fitToScreen();
    }

    // Apply current hover highlights + render relationships
    updateHoverHighlights();
}

// Create table card element
function createTableCard(table) {
    const card = document.createElement('div');
    card.className = 'table-card';
    card.dataset.tableName = table.name;
    card.style.left = `${table.x}px`;
    card.style.top = `${table.y}px`;

    if (state.selectedTables.includes(table.name)) {
        card.classList.add('selected');
    }

    // Check if this table has relationships (indicator dot)
    const hasRelationships = state.relationships.some(
        r => r.fromTable === table.name || r.toTable === table.name
    );
    if (hasRelationships) {
        card.classList.add('has-relationships');
    }

    // Hover classes (is-hovered, connected-to-hovered) are handled
    // by updateHoverHighlights() to avoid full re-renders

    let columnsHtml = '';
    for (const col of table.columns) {
        let icon = '';
        let refHtml = '';

        if (col.pk) {
            icon = '<span class="column-icon pk"><i class="fas fa-key"></i></span>';
        } else if (col.fk || col.refTable) {
            icon = '<span class="column-icon fk"><i class="fas fa-link"></i></span>';
            if (col.refTable) {
                refHtml = `<span class="column-ref"><i class="fas fa-long-arrow-alt-right"></i> ${col.refTable}.${col.refColumn || 'id'}</span>`;
            }
        }

        columnsHtml += `
            <div class="column-row" data-column="${col.name}">
                ${icon}
                <span class="column-name">${col.name}</span>
                <span class="column-type">${col.type}</span>
                ${refHtml}
            </div>
        `;
    }

    // Apply table color
    if (table.color) {
        card.style.borderLeftWidth = '3px';
        card.style.borderLeftColor = table.color;
    }

    const headerStyle = table.color
        ? ` style="background-color: ${table.color}20;"`
        : '';

    card.innerHTML = `
        <div class="table-header"${headerStyle}>
            <span class="table-drag-handle"><i class="fas fa-grip-vertical"></i></span>
            <span class="table-icon"><i class="fas ${table.icon || 'fa-table'}"></i></span>
            <input class="table-name" value="${table.name}" readonly>
            <div class="table-actions">
                <button class="table-action-btn connect" title="Connect to table"><i class="fas fa-link"></i></button>
                <button class="table-action-btn edit" title="Edit"><i class="fas fa-pen"></i></button>
                <button class="table-action-btn delete" title="Delete"><i class="fas fa-times"></i></button>
            </div>
        </div>
        <div class="table-body">
            ${columnsHtml}
        </div>
    `;

    // Event listeners
    const nameInput = card.querySelector('.table-name');
    const connectBtn = card.querySelector('.connect');
    const editBtn = card.querySelector('.edit');
    const deleteBtn = card.querySelector('.delete');
    const header = card.querySelector('.table-header');

    // Hover to highlight connections (lightweight - no DOM rebuild)
    card.addEventListener('mouseenter', () => {
        if (state.isDraggingTable || state.connectionDraft) return;
        if (state.hoveredTable === table.name) return;
        state.hoveredTable = table.name;
        updateHoverHighlights();
    });

    card.addEventListener('mouseleave', () => {
        if (state.isDraggingTable || state.connectionDraft) return;
        if (state.hoveredTable !== table.name) return;
        state.hoveredTable = null;
        updateHoverHighlights();
    });

    // Double-click to edit name
    nameInput.addEventListener('dblclick', () => {
        nameInput.removeAttribute('readonly');
        nameInput.focus();
        nameInput.select();
    });

    nameInput.addEventListener('blur', () => {
        nameInput.setAttribute('readonly', true);
        const oldName = table.name;
        table.name = nameInput.value.trim() || oldName;

        if (table.name !== oldName) {
            renameTableReferences(oldName, table.name);
        }

        state.relationships = state.relationships.map(rel => {
            if (rel.fromTable === oldName) rel.fromTable = table.name;
            if (rel.toTable === oldName) rel.toTable = table.name;
            return rel;
        });

        updateSQLFromState();
    });

    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') nameInput.blur();
    });

    connectBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startConnectionFromTable(table, e);
    });
    connectBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditTableModal(table);
    });

    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTable(table.name);
    });

    // Drag to move table (+ multi-drag when part of selection)
    let dragState = null;

    const stopTableDrag = (pointerId) => {
        if (!dragState || dragState.pointerId !== pointerId) return;
        dragState = null;
        state.isDraggingTable = null;
        card.classList.remove('dragging');
        document.body.style.userSelect = '';

        try {
            header.releasePointerCapture(pointerId);
        } catch (_) {
            // Ignore if pointer capture was already released.
        }

        // Snap to avoid overlaps with other tables
        resolveTableOverlaps();
        updateTableCardPositions();
        renderRelationships();
    };

    header.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        if (e.target.tagName === 'INPUT' || e.target.closest('.table-actions')) return;

        // If this table is part of a multi-selection, store origins for all selected tables
        const isInSelection = state.selectedTables.includes(table.name) && state.selectedTables.length > 1;
        const groupOrigins = {};
        if (isInSelection) {
            for (const name of state.selectedTables) {
                const t = state.tables.find(tt => tt.name === name);
                if (t) groupOrigins[name] = { x: t.x, y: t.y };
            }
        }

        dragState = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            originX: table.x,
            originY: table.y,
            isGroupDrag: isInSelection,
            groupOrigins
        };

        state.isDraggingTable = table.name;
        card.classList.add('dragging');
        document.body.style.userSelect = 'none';
        header.setPointerCapture(e.pointerId);

        e.preventDefault();
        e.stopPropagation();
    });

    header.addEventListener('pointermove', (e) => {
        if (!dragState || dragState.pointerId !== e.pointerId) return;
        if (state.isDraggingTable !== table.name) return;

        const dx = (e.clientX - dragState.startX) / state.zoom;
        const dy = (e.clientY - dragState.startY) / state.zoom;

        if (dragState.isGroupDrag) {
            // Move all selected tables together
            for (const [name, origin] of Object.entries(dragState.groupOrigins)) {
                const t = state.tables.find(tt => tt.name === name);
                if (!t) continue;
                t.x = origin.x + dx;
                t.y = origin.y + dy;
                const otherCard = elements.canvas.querySelector(`[data-table-name="${name}"]`);
                if (otherCard) {
                    otherCard.style.left = `${t.x}px`;
                    otherCard.style.top = `${t.y}px`;
                }
            }
        } else {
            table.x = dragState.originX + dx;
            table.y = dragState.originY + dy;
            card.style.left = `${table.x}px`;
            card.style.top = `${table.y}px`;
        }

        renderRelationships();
    });

    header.addEventListener('pointerup', (e) => {
        stopTableDrag(e.pointerId);
    });

    header.addEventListener('pointercancel', (e) => {
        stopTableDrag(e.pointerId);
    });

    // Click to select (Ctrl/Cmd for multi-select)
    card.addEventListener('click', (e) => {
        if (e.target.closest('.table-actions')) return;
        selectTable(table.name, e.ctrlKey || e.metaKey);
    });

    return card;
}

// Update all card DOM positions from state (after overlap resolution)
function updateTableCardPositions() {
    for (const table of state.tables) {
        const card = elements.canvas.querySelector(`[data-table-name="${table.name}"]`);
        if (card) {
            card.style.left = `${table.x}px`;
            card.style.top = `${table.y}px`;
        }
    }
}

// Select table (supports multi-selection with Ctrl/Cmd)
function selectTable(tableName, additive) {
    if (additive) {
        const idx = state.selectedTables.indexOf(tableName);
        if (idx !== -1) {
            state.selectedTables.splice(idx, 1);
        } else {
            state.selectedTables.push(tableName);
        }
    } else {
        state.selectedTables = [tableName];
    }
    renderTables();
    if (state.selectedTables.length === 1) {
        scrollToTableInEditor(state.selectedTables[0]);
    }
}

// Delete table
function deleteTable(tableName) {
    if (state.connectionDraft && state.connectionDraft.fromTable === tableName) {
        cancelConnectionDraft();
    }

    if (state.relationEditor) {
        closeRelationEditor();
    }

    state.tables = state.tables.filter(t => t.name !== tableName);
    state.relationships = state.relationships.filter(r => r.fromTable !== tableName && r.toTable !== tableName);
    removeTableReferencesTo(tableName);
    state.selectedTables = state.selectedTables.filter(n => n !== tableName);
    updateSQLFromState();
    renderTables();
    showToast('Table deleted', 'success');
}
