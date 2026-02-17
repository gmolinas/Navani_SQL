// SQL Diagram - Export Functions (PNG, SQL, Copy)

// FontAwesome 6 class → unicode codepoint map (for canvas rendering)
const FA_UNICODE = {
    'fa-table':          '\uf0ce',
    'fa-users':          '\uf0c0',
    'fa-user':           '\uf007',
    'fa-shopping-cart':  '\uf07a',
    'fa-box':            '\uf466',
    'fa-file-alt':       '\uf15c',
    'fa-comment':        '\uf075',
    'fa-tags':           '\uf02c',
    'fa-cog':            '\uf013',
    'fa-lock':           '\uf023',
    'fa-credit-card':    '\uf09d',
    'fa-envelope':       '\uf0e0',
    'fa-image':          '\uf03e',
    'fa-map-marker-alt': '\uf3c5',
    'fa-calendar':       '\uf133',
    'fa-chart-bar':      '\uf080',
    'fa-bell':           '\uf0f3',
    'fa-star':           '\uf005',
    'fa-folder':         '\uf07b',
    'fa-database':       '\uf1c0',
    'fa-key':            '\uf084',
    'fa-link':           '\uf0c1',
};

// Build the PNG canvas (returns { canvas, schemaName } without side effects)
function buildPNGCanvas() {
    const schemaName = (elements.schemaNameInput && elements.schemaNameInput.value.trim())
        || 'Untitled Schema';

    const pad = 60;
    const titleBarH = 48;

    const cs = getComputedStyle(document.documentElement);
    const tv = (name) => cs.getPropertyValue(name).trim();

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const table of state.tables) {
        const dims = getTableDimensions(table);
        minX = Math.min(minX, table.x);
        minY = Math.min(minY, table.y);
        maxX = Math.max(maxX, table.x + dims.width);
        maxY = Math.max(maxY, table.y + dims.height);
    }

    const offsetX = -minX + pad;
    const offsetY = -minY + pad + titleBarH;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width  = (maxX - minX) + pad * 2;
    canvas.height = (maxY - minY) + pad * 2 + titleBarH;

    ctx.fillStyle = tv('--export-bg');
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title bar
    ctx.fillStyle = tv('--export-title-bg');
    ctx.fillRect(0, 0, canvas.width, titleBarH);
    ctx.strokeStyle = tv('--export-title-border');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, titleBarH - 0.5);
    ctx.lineTo(canvas.width, titleBarH - 0.5);
    ctx.stroke();
    ctx.fillStyle = tv('--export-title-text');
    ctx.font = '600 16px JetBrains Mono';
    ctx.textAlign = 'left';
    ctx.fillText(schemaName, pad, titleBarH / 2 + 5);
    ctx.fillStyle = tv('--export-title-meta');
    ctx.font = '11px JetBrains Mono';
    ctx.textAlign = 'right';
    ctx.fillText(`${state.tables.length} tables · Navani SQL`, canvas.width - pad, titleBarH / 2 + 4);

    // Relationship routes
    const routes = [];
    const laneCountByPort = new Map();

    for (const rel of state.relationships) {
        const fromTable = state.tables.find(t => t.name === rel.fromTable);
        const toTable   = state.tables.find(t => t.name === rel.toTable);
        if (!fromTable || !toTable) continue;

        const fromColIndex = fromTable.columns.findIndex(c => c.name === rel.fromColumn);
        const toColIndex   = toTable.columns.findIndex(c => c.name === rel.toColumn);
        if (fromColIndex === -1 || toColIndex === -1) continue;

        const { fromX, fromY, toX, toY, fromSide, toSide } =
            getSmartConnectionPoints(fromTable, toTable, fromColIndex, toColIndex);

        const fromPortKey = `${rel.fromTable}:${rel.fromColumn}:${fromSide}`;
        const toPortKey   = `${rel.toTable}:${rel.toColumn}:${toSide}`;

        laneCountByPort.set(fromPortKey, (laneCountByPort.get(fromPortKey) || 0) + 1);
        laneCountByPort.set(toPortKey,   (laneCountByPort.get(toPortKey)   || 0) + 1);

        routes.push({
            rel, fromTable, toTable, fromColIndex, toColIndex,
            fromX, fromY, toX, toY, fromSide, toSide, fromPortKey, toPortKey
        });
    }

    const laneUsageByPort = new Map();
    const laneStep = 10;

    for (const route of routes) {
        const fromPortCount = laneCountByPort.get(route.fromPortKey) || 1;
        const toPortCount   = laneCountByPort.get(route.toPortKey)   || 1;
        const fromPortIndex = laneUsageByPort.get(route.fromPortKey) || 0;
        const toPortIndex   = laneUsageByPort.get(route.toPortKey)   || 0;
        laneUsageByPort.set(route.fromPortKey, fromPortIndex + 1);
        laneUsageByPort.set(route.toPortKey,   toPortIndex   + 1);

        const fromLaneOffset = getCenteredLaneOffset(fromPortIndex, fromPortCount, laneStep);
        const toLaneOffset   = getCenteredLaneOffset(toPortIndex,   toPortCount,   laneStep);

        const isSelfRef = route.rel.fromTable === route.rel.toTable;

        const fromPoint = offsetPointAlongSide({ x: route.fromX, y: route.fromY }, route.fromSide, fromLaneOffset);
        const toPoint   = offsetPointAlongSide({ x: route.toX,   y: route.toY },   route.toSide,  toLaneOffset);

        const fromNormal = getSideNormal(route.fromSide);
        const toNormal   = getSideNormal(route.toSide);
        const markerGap = 28;

        const fromPathPt = { x: fromPoint.x + fromNormal.x * markerGap, y: fromPoint.y + fromNormal.y * markerGap };
        const toPathPt   = { x: toPoint.x   + toNormal.x   * markerGap, y: toPoint.y   + toNormal.y   * markerGap };

        const polyline = buildOrthogonalPolyline(fromPathPt, toPathPt, route.fromSide, route.toSide, isSelfRef);

        const fromCol = route.fromTable.columns[route.fromColIndex];
        const toCol   = route.toTable.columns[route.toColIndex];
        const isOptional = !(fromCol && fromCol.notNull);
        const fromIsOne  = !!(fromCol && (fromCol.unique || fromCol.pk));
        const toIsOne    = !!(toCol   && (toCol.unique   || toCol.pk));

        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.strokeStyle = tv('--export-rel-line');
        ctx.lineWidth = 1.6;
        ctx.lineJoin = 'round';
        ctx.lineCap  = 'round';
        if (isOptional) ctx.setLineDash([8, 4]);
        else ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(polyline[0].x, polyline[0].y);
        for (let i = 1; i < polyline.length; i++) {
            ctx.lineTo(polyline[i].x, polyline[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        const barDist = 10;
        const fromBarPt = { x: fromPoint.x + fromNormal.x * barDist, y: fromPoint.y + fromNormal.y * barDist };
        const toBarPt   = { x: toPoint.x   + toNormal.x   * barDist, y: toPoint.y   + toNormal.y   * barDist };
        drawCanvasCardinalityBars(ctx, fromBarPt, fromNormal, fromIsOne);
        drawCanvasCardinalityBars(ctx, toBarPt,   toNormal,   toIsOne);

        ctx.fillStyle = tv('--export-rel-label');
        ctx.font = '9px JetBrains Mono';
        const fromTangent = getSideTangent(route.fromSide);
        const toTangent   = getSideTangent(route.toSide);
        const lnDist = 26, ltDist = 10;

        ctx.textAlign = getLabelAnchorBySide(route.fromSide) === 'end' ? 'right'
                       : getLabelAnchorBySide(route.fromSide) === 'start' ? 'left' : 'center';
        ctx.fillText(route.rel.fromColumn,
            fromPoint.x + fromNormal.x * lnDist + fromTangent.x * ltDist,
            fromPoint.y + fromNormal.y * lnDist + fromTangent.y * ltDist + 3);

        ctx.textAlign = getLabelAnchorBySide(route.toSide) === 'end' ? 'right'
                       : getLabelAnchorBySide(route.toSide) === 'start' ? 'left' : 'center';
        ctx.fillText(route.rel.toColumn,
            toPoint.x + toNormal.x * lnDist + toTangent.x * ltDist,
            toPoint.y + toNormal.y * lnDist + toTangent.y * ltDist + 3);

        let fromCardText = fromIsOne ? '1' : 'N';
        if (fromCol && !fromCol.notNull && !fromCol.pk) fromCardText = fromIsOne ? '0..1' : '0..N';
        const toCardText = toIsOne ? '1' : 'N';
        const cardText = `${fromCardText}:${toCardText}`;

        const totalLen = getPolylineLength(polyline);
        const mid = getPointAndDirectionAtDistance(polyline, totalLen / 2);
        const midNorm = normalizeVector({ x: -mid.direction.y, y: mid.direction.x });

        ctx.fillStyle = tv('--export-rel-card');
        ctx.font = '9px JetBrains Mono';
        ctx.textAlign = 'center';
        ctx.fillText(cardText, mid.point.x + midNorm.x * 12, mid.point.y + midNorm.y * 12 + 3);

        ctx.restore();
    }

    // Draw tables
    for (const table of state.tables) {
        const dims = getTableDimensions(table);
        const tx = table.x + offsetX;
        const ty = table.y + offsetY;
        const r = 6;

        ctx.fillStyle = tv('--export-table-bg');
        drawRoundedRect(ctx, tx, ty, dims.width, dims.height, r);
        ctx.fill();

        // Header
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(tx + r, ty);
        ctx.lineTo(tx + dims.width - r, ty);
        ctx.arcTo(tx + dims.width, ty, tx + dims.width, ty + r, r);
        ctx.lineTo(tx + dims.width, ty + 42);
        ctx.lineTo(tx, ty + 42);
        ctx.lineTo(tx, ty + r);
        ctx.arcTo(tx, ty, tx + r, ty, r);
        ctx.closePath();
        ctx.fillStyle = table.color ? table.color + '20' : tv('--export-table-header');
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = tv('--export-table-border');
        ctx.lineWidth = 1;
        drawRoundedRect(ctx, tx, ty, dims.width, dims.height, r);
        ctx.stroke();

        if (table.color) {
            ctx.save();
            ctx.strokeStyle = table.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(tx + 0.5, ty + r);
            ctx.lineTo(tx + 0.5, ty + dims.height - r);
            ctx.stroke();
            ctx.restore();
        }

        ctx.strokeStyle = tv('--export-table-border');
        ctx.beginPath();
        ctx.moveTo(tx, ty + 42);
        ctx.lineTo(tx + dims.width, ty + 42);
        ctx.stroke();

        const iconClass = table.icon || 'fa-table';
        const iconChar = FA_UNICODE[iconClass] || FA_UNICODE['fa-table'];
        ctx.fillStyle = tv('--export-table-icon');
        ctx.font = '900 12px "Font Awesome 6 Free"';
        ctx.textAlign = 'left';
        ctx.fillText(iconChar, tx + 10, ty + 26);

        ctx.fillStyle = tv('--export-table-name');
        ctx.font = '600 13px JetBrains Mono';
        ctx.fillText(table.name, tx + 28, ty + 26);

        ctx.font = '11px JetBrains Mono';
        for (let i = 0; i < table.columns.length; i++) {
            const col = table.columns[i];
            const cy = ty + 58 + i * 24;

            if (col.pk) {
                ctx.fillStyle = tv('--export-pk');
                ctx.font = '9px JetBrains Mono';
                ctx.fillText('PK', tx + 8, cy);
                ctx.font = '11px JetBrains Mono';
            } else if (col.fk || col.refTable) {
                ctx.fillStyle = tv('--export-fk');
                ctx.font = '9px JetBrains Mono';
                ctx.fillText('FK', tx + 8, cy);
                ctx.font = '11px JetBrains Mono';
            }

            ctx.fillStyle = tv('--export-col-text');
            ctx.fillText(col.name, tx + 28, cy);

            ctx.fillStyle = tv('--export-col-type');
            ctx.font = 'italic 10px JetBrains Mono';
            ctx.fillText(col.type, tx + 130, cy);
            ctx.font = '11px JetBrains Mono';
        }
    }

    return { canvas, schemaName };
}

// Open PNG export modal with preview
function exportPNG() {
    if (state.tables.length === 0) {
        showToast('No tables to export', 'warning');
        return;
    }

    const { canvas, schemaName } = buildPNGCanvas();

    // Show preview in modal
    const container = $('#pngPreviewContainer');
    container.innerHTML = '';
    container.appendChild(canvas);

    // Store reference for download/clipboard actions
    state._pngExportCanvas = canvas;
    state._pngExportName = schemaName;

    $('#pngModal').classList.remove('hidden');
}

function downloadPNG() {
    const canvas = state._pngExportCanvas;
    const schemaName = state._pngExportName || 'schema';
    if (!canvas) return;

    const safeName = schemaName.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'schema';
    const link = document.createElement('a');
    link.download = `${safeName}.png`;
    link.href = canvas.toDataURL();
    link.click();

    $('#pngModal').classList.add('hidden');
    showToast('PNG downloaded', 'success');
}

function copyPNGToClipboard() {
    const canvas = state._pngExportCanvas;
    if (!canvas) return;

    canvas.toBlob((blob) => {
        if (!blob) {
            showToast('Failed to generate image', 'error');
            return;
        }
        navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]).then(() => {
            $('#pngModal').classList.add('hidden');
            showToast('PNG copied to clipboard', 'success');
        }).catch(() => {
            showToast('Clipboard access denied', 'error');
        });
    }, 'image/png');
}

function closePngModal() {
    $('#pngModal').classList.add('hidden');
    state._pngExportCanvas = null;
    state._pngExportName = null;
}

// Helper: draw cardinality bars on canvas 2D
function drawCanvasCardinalityBars(ctx, point, direction, isOne) {
    const dir = normalizeVector(direction);
    const normal = normalizeVector({ x: -dir.y, y: dir.x });
    const halfBar = 7;
    const offsets = isOne ? [0] : [-4, 4];

    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--export-rel-bar').trim();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    for (const offset of offsets) {
        const cx = point.x + dir.x * offset;
        const cy = point.y + dir.y * offset;
        ctx.beginPath();
        ctx.moveTo(cx + normal.x * halfBar, cy + normal.y * halfBar);
        ctx.lineTo(cx - normal.x * halfBar, cy - normal.y * halfBar);
        ctx.stroke();
    }
}

// Helper: rounded rectangle path
function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

function exportJSON() {
    if (state.tables.length === 0) {
        showToast('No tables to export', 'warning');
        return;
    }

    const schemaName = (elements.schemaNameInput && elements.schemaNameInput.value.trim()) || 'Untitled Schema';
    const safeName = schemaName.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'schema';

    const icons = {};
    const colors = {};
    for (const t of state.tables) {
        if (t.icon && t.icon !== 'fa-table') icons[t.name] = t.icon;
        if (t.color) colors[t.name] = t.color;
    }

    const dsl = DBPARSER.generate(state.tables, state.relationships, { includeStyle: state.showStyleAttrs });
    const data = {
        name: schemaName,
        dsl,
        tables: state.tables,
        relationships: state.relationships,
        icons,
        colors,
        exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${safeName}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    showToast('JSON exported successfully', 'success');
}

function copySQL() {
    const sql = DBPARSER.generate(state.tables, state.relationships, { includeStyle: state.showStyleAttrs });
    navigator.clipboard.writeText(sql).then(() => {
        showToast('DSL copied to clipboard', 'success');
    });
}

function shareDiagram() {
    const btn = $('#shareBtn');
    if (btn) {
        btn.classList.remove('clicked');
        void btn.offsetWidth;
        btn.classList.add('clicked');
        btn.addEventListener('animationend', () => btn.classList.remove('clicked'), { once: true });
    }

    const dsl = elements.sqlInput.value.trim();
    if (!dsl) {
        showToast('Nothing to share', 'warning');
        return;
    }

    try {
        // Collect custom icons and colors
        const icons = {};
        const colors = {};
        for (const t of state.tables) {
            if (t.icon && t.icon !== 'fa-table') icons[t.name] = t.icon;
            if (t.color) colors[t.name] = t.color;
        }
        const schemaName = (elements.schemaNameInput && elements.schemaNameInput.value.trim()) || '';
        const payload = JSON.stringify({ dsl, icons, colors, schemaName });
        const encoded = btoa(unescape(encodeURIComponent(payload)));
        const url = `${window.location.origin}${window.location.pathname}#schema=${encoded}`;

        navigator.clipboard.writeText(url).then(() => {
            showToast('Share link copied to clipboard', 'success');
        }).catch(() => {
            prompt('Copy this share link:', url);
        });

        history.replaceState(null, '', `#schema=${encoded}`);
    } catch (e) {
        showToast('Failed to generate share link', 'error');
    }
}

function loadFromShareURL() {
    const hash = window.location.hash;
    if (!hash) return false;

    try {
        let encoded, dsl, icons = {}, colors = {};

        let schemaName = '';

        if (hash.startsWith('#schema=')) {
            encoded = hash.slice(8);
            const payload = JSON.parse(decodeURIComponent(escape(atob(encoded))));
            dsl = payload.dsl;
            icons = payload.icons || {};
            colors = payload.colors || {};
            schemaName = payload.schemaName || '';
        } else if (hash.startsWith('#dsl=')) {
            encoded = hash.slice(5);
            dsl = decodeURIComponent(escape(atob(encoded)));
        } else {
            return false;
        }

        if (dsl && dsl.trim()) {
            elements.sqlInput.value = dsl;
            updateLineNumbers();
            // Store icons and colors to apply after parsing
            state._pendingIcons = icons;
            state._pendingColors = colors;
            // Restore schema name
            if (schemaName && elements.schemaNameInput) {
                elements.schemaNameInput.value = schemaName;
                document.title = `${schemaName} — Navani SQL`;
            }
            return true;
        }
    } catch (e) {
        // Invalid hash, ignore
    }
    return false;
}
