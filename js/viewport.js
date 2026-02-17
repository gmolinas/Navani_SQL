// SQL Diagram - Viewport (Pan, Zoom, Fit to Screen)

function applyViewportTransform() {
    const transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;

    elements.canvas.style.transformOrigin = '0 0';
    elements.canvas.style.transform = transform;

    if (elements.relationshipsSvg && elements.relationshipsSvg.parentElement !== elements.canvas) {
        elements.relationshipsSvg.style.transformOrigin = '0 0';
        elements.relationshipsSvg.style.transform = transform;
    } else if (elements.relationshipsSvg) {
        elements.relationshipsSvg.style.transform = '';
    }

    elements.zoomDisplay.textContent = `${Math.round(state.zoom * 100)}%`;
}

function setZoom(zoom, anchorClientPoint = null) {
    const nextZoom = clamp(zoom, 0.25, 2);

    if (anchorClientPoint && elements.canvasContainer) {
        const rect = elements.canvasContainer.getBoundingClientRect();
        const anchorX = anchorClientPoint.x - rect.left;
        const anchorY = anchorClientPoint.y - rect.top;

        const worldX = (anchorX - state.panX) / state.zoom;
        const worldY = (anchorY - state.panY) / state.zoom;

        state.zoom = nextZoom;
        state.panX = anchorX - (worldX * state.zoom);
        state.panY = anchorY - (worldY * state.zoom);
    } else {
        state.zoom = nextZoom;
    }

    applyViewportTransform();
}

function fitToScreen() {
    if (state.tables.length === 0 || !elements.canvasContainer) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const table of state.tables) {
        const dims = getTableDimensions(table);
        minX = Math.min(minX, table.x);
        minY = Math.min(minY, table.y);
        maxX = Math.max(maxX, table.x + dims.width);
        maxY = Math.max(maxY, table.y + dims.height);
    }

    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);
    const padding = 70;
    const containerRect = elements.canvasContainer.getBoundingClientRect();

    const scaleX = (containerRect.width - (padding * 2)) / contentWidth;
    const scaleY = (containerRect.height - (padding * 2)) / contentHeight;

    state.zoom = clamp(Math.min(scaleX, scaleY, 1), 0.25, 2);
    state.panX = ((containerRect.width - (contentWidth * state.zoom)) / 2) - (minX * state.zoom);
    state.panY = ((containerRect.height - (contentHeight * state.zoom)) / 2) - (minY * state.zoom);

    applyViewportTransform();
}

function initPanZoom() {
    let container = elements.canvasContainer;
    if (!container) {
        container = elements.canvas || elements.canvasArea;
    }

    if (!container) return;

    let marqueeEl = null;
    let marqueeStartClient = null;
    let isMarquee = false;
    const DRAG_THRESHOLD = 5;

    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(state.zoom + delta, { x: e.clientX, y: e.clientY });
    }, { passive: false });

    document.addEventListener('mousedown', (e) => {
        if (state.isDraggingTable || state.connectionDraft) return;

        const isMiddleButton = e.button === 1 || (e.buttons & 4) === 4;
        const insideCanvasContainer = container.contains(e.target);

        if (!insideCanvasContainer) return;

        const isTableInteraction = !!e.target.closest('.table-card');
        const isLeftOnEmpty = e.button === 0 && !isTableInteraction;

        if (isMiddleButton) {
            // Middle button always pans
            state.isPanning = true;
            state.panStart = { x: e.clientX, y: e.clientY };
            container.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
            e.preventDefault();
            return;
        }

        if (!isLeftOnEmpty) return;

        // Left-click on empty: prepare for marquee or click-to-deselect
        marqueeStartClient = { x: e.clientX, y: e.clientY };
        isMarquee = false;
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        // Pan (middle button)
        if (state.isPanning) {
            const dx = e.clientX - state.panStart.x;
            const dy = e.clientY - state.panStart.y;
            state.panX += dx;
            state.panY += dy;
            state.panStart = { x: e.clientX, y: e.clientY };
            applyViewportTransform();
            return;
        }

        // Marquee selection (left-click on empty)
        if (!marqueeStartClient) return;

        const dx = e.clientX - marqueeStartClient.x;
        const dy = e.clientY - marqueeStartClient.y;

        if (!isMarquee && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
            isMarquee = true;
            marqueeEl = document.createElement('div');
            marqueeEl.className = 'selection-marquee';
            container.appendChild(marqueeEl);
        }

        if (isMarquee && marqueeEl) {
            const containerRect = container.getBoundingClientRect();
            const sx = marqueeStartClient.x - containerRect.left;
            const sy = marqueeStartClient.y - containerRect.top;
            const cx = e.clientX - containerRect.left;
            const cy = e.clientY - containerRect.top;

            marqueeEl.style.left = Math.min(sx, cx) + 'px';
            marqueeEl.style.top = Math.min(sy, cy) + 'px';
            marqueeEl.style.width = Math.abs(cx - sx) + 'px';
            marqueeEl.style.height = Math.abs(cy - sy) + 'px';
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (state.isPanning) {
            state.isPanning = false;
            container.style.cursor = 'grab';
            document.body.style.userSelect = '';
        }

        if (marqueeStartClient) {
            if (isMarquee && marqueeEl) {
                // Compute world-space selection rect
                const containerRect = container.getBoundingClientRect();
                const sx = marqueeStartClient.x - containerRect.left;
                const sy = marqueeStartClient.y - containerRect.top;
                const cx = e.clientX - containerRect.left;
                const cy = e.clientY - containerRect.top;

                const worldLeft = (Math.min(sx, cx) - state.panX) / state.zoom;
                const worldTop = (Math.min(sy, cy) - state.panY) / state.zoom;
                const worldRight = (Math.max(sx, cx) - state.panX) / state.zoom;
                const worldBottom = (Math.max(sy, cy) - state.panY) / state.zoom;

                // Find tables within the marquee rect
                const selected = [];
                for (const table of state.tables) {
                    const dims = getTableDimensions(table);
                    const tRight = table.x + dims.width;
                    const tBottom = table.y + dims.height;

                    // Table overlaps the selection rect
                    if (table.x < worldRight && tRight > worldLeft &&
                        table.y < worldBottom && tBottom > worldTop) {
                        selected.push(table.name);
                    }
                }

                if (selected.length > 0) {
                    if (e.ctrlKey || e.metaKey) {
                        // Add to existing selection
                        for (const name of selected) {
                            if (!state.selectedTables.includes(name)) {
                                state.selectedTables.push(name);
                            }
                        }
                    } else {
                        state.selectedTables = selected;
                    }
                    renderTables();
                }

                marqueeEl.remove();
                marqueeEl = null;
            } else {
                // Short click on empty: deselect all
                if (state.selectedTables.length > 0) {
                    state.selectedTables = [];
                    renderTables();
                }
            }

            marqueeStartClient = null;
            isMarquee = false;
            document.body.style.userSelect = '';
        }

        if (e.button === 1) {
            e.preventDefault();
        }
    });

    container.addEventListener('contextmenu', (e) => {
        if (e.button === 1) {
            e.preventDefault();
        }
    });
}
