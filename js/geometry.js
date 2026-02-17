// SQL Diagram - Geometry & Routing Utilities

function getTableDimensions(table) {
    const headerHeight = 42;
    const rowHeight = 24;
    const bodyHeight = table.columns.length * rowHeight;
    return {
        width: table._renderedWidth || 220,
        height: headerHeight + bodyHeight + 4
    };
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getTableCenter(table) {
    const dims = getTableDimensions(table);
    return {
        x: table.x + dims.width / 2,
        y: table.y + dims.height / 2
    };
}

function getSideNormal(side) {
    if (side === 'left') return { x: -1, y: 0 };
    if (side === 'right') return { x: 1, y: 0 };
    if (side === 'top') return { x: 0, y: -1 };
    return { x: 0, y: 1 };
}

function getSideTangent(side) {
    if (side === 'left' || side === 'right') return { x: 0, y: 1 };
    return { x: 1, y: 0 };
}

function getLabelAnchorBySide(side) {
    if (side === 'left') return 'end';
    if (side === 'right') return 'start';
    return 'middle';
}

function getAnchorForSide(table, colIndex, side) {
    const dims = getTableDimensions(table);
    const headerHeight = 42;
    const rowHeight = 24;
    const safeColIndex = Math.max(0, colIndex);
    const rawRowY = table.y + headerHeight + (safeColIndex * rowHeight) + (rowHeight / 2);
    const minRowY = table.y + headerHeight + (rowHeight / 2);
    const maxRowY = table.y + dims.height - (rowHeight / 2) - 2;
    const rowY = clamp(rawRowY, minRowY, maxRowY);

    if (side === 'left') {
        return { x: table.x, y: rowY };
    }

    if (side === 'right') {
        return { x: table.x + dims.width, y: rowY };
    }

    const columnCount = Math.max(1, table.columns.length);
    const ratio = (safeColIndex + 0.5) / columnCount;
    const minX = table.x + 20;
    const maxX = table.x + dims.width - 20;
    const x = minX + ((maxX - minX) * clamp(ratio, 0, 1));

    return {
        x,
        y: side === 'top' ? table.y : table.y + dims.height
    };
}

function chooseConnectionSides(fromTable, toTable) {
    if (fromTable.name === toTable.name) {
        return { fromSide: 'right', toSide: 'top' };
    }

    const fromCenter = getTableCenter(fromTable);
    const toCenter = getTableCenter(toTable);
    const fromDims = getTableDimensions(fromTable);
    const toDims = getTableDimensions(toTable);

    const dx = toCenter.x - fromCenter.x;
    const dy = toCenter.y - fromCenter.y;

    const horizontalGap = dx >= 0
        ? toTable.x - (fromTable.x + fromDims.width)
        : fromTable.x - (toTable.x + toDims.width);

    const verticalGap = dy >= 0
        ? toTable.y - (fromTable.y + fromDims.height)
        : fromTable.y - (toTable.y + toDims.height);

    const preferHorizontal =
        horizontalGap > 20 ||
        (Math.abs(dx) >= Math.abs(dy) * 0.8 && horizontalGap > -40);

    const preferVertical =
        verticalGap > 20 ||
        (Math.abs(dy) > Math.abs(dx) * 0.8 && verticalGap > -40);

    if (preferHorizontal && !preferVertical) {
        return dx >= 0
            ? { fromSide: 'right', toSide: 'left' }
            : { fromSide: 'left', toSide: 'right' };
    }

    if (preferVertical && !preferHorizontal) {
        return dy >= 0
            ? { fromSide: 'bottom', toSide: 'top' }
            : { fromSide: 'top', toSide: 'bottom' };
    }

    if (Math.abs(dx) >= Math.abs(dy)) {
        return dx >= 0
            ? { fromSide: 'right', toSide: 'left' }
            : { fromSide: 'left', toSide: 'right' };
    }

    return dy >= 0
        ? { fromSide: 'bottom', toSide: 'top' }
        : { fromSide: 'top', toSide: 'bottom' };
}

function getSmartConnectionPoints(fromTable, toTable, fromColIndex, toColIndex) {
    const { fromSide, toSide } = chooseConnectionSides(fromTable, toTable);
    const fromAnchor = getAnchorForSide(fromTable, fromColIndex, fromSide);
    const toAnchor = getAnchorForSide(toTable, toColIndex, toSide);

    return {
        fromX: fromAnchor.x,
        fromY: fromAnchor.y,
        toX: toAnchor.x,
        toY: toAnchor.y,
        fromSide,
        toSide
    };
}

function offsetPointAlongSide(point, side, distance) {
    const tangent = getSideTangent(side);
    return {
        x: point.x + (tangent.x * distance),
        y: point.y + (tangent.y * distance)
    };
}

function getCenteredLaneOffset(index, count, step = 10) {
    if (count <= 1) return 0;
    return (index - ((count - 1) / 2)) * step;
}

function normalizeVector(vector) {
    const length = Math.hypot(vector.x, vector.y);
    if (!length) return { x: 1, y: 0 };
    return {
        x: vector.x / length,
        y: vector.y / length
    };
}

function manhattanDistance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function simplifyOrthogonalPoints(points) {
    const result = [];
    const epsilon = 0.1;

    for (const point of points) {
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;

        const normalized = {
            x: Math.round(point.x * 100) / 100,
            y: Math.round(point.y * 100) / 100
        };

        if (result.length > 0) {
            const prev = result[result.length - 1];
            if (Math.abs(prev.x - normalized.x) < epsilon && Math.abs(prev.y - normalized.y) < epsilon) {
                continue;
            }
        }

        result.push(normalized);

        while (result.length >= 3) {
            const a = result[result.length - 3];
            const b = result[result.length - 2];
            const c = result[result.length - 1];

            const sameX = Math.abs(a.x - b.x) < epsilon && Math.abs(b.x - c.x) < epsilon;
            const sameY = Math.abs(a.y - b.y) < epsilon && Math.abs(b.y - c.y) < epsilon;

            if (!sameX && !sameY) break;
            result.splice(result.length - 2, 1);
        }
    }

    return result;
}

function buildOrthogonalPolyline(start, end, fromSide, toSide, isSelfReference = false) {
    const clearance = 22;
    const fromNormal = getSideNormal(fromSide);
    const toNormal = getSideNormal(toSide);

    const startOut = {
        x: start.x + (fromNormal.x * clearance),
        y: start.y + (fromNormal.y * clearance)
    };
    const endOut = {
        x: end.x + (toNormal.x * clearance),
        y: end.y + (toNormal.y * clearance)
    };

    const points = [start, startOut];

    if (isSelfReference) {
        const loop = 64;

        if (fromSide === 'left' || fromSide === 'right') {
            const outerX = startOut.x + (fromNormal.x * loop);
            const topY = Math.min(startOut.y, endOut.y) - loop;
            points.push(
                { x: outerX, y: startOut.y },
                { x: outerX, y: topY },
                { x: endOut.x, y: topY }
            );
        } else {
            const outerY = startOut.y + (fromNormal.y * loop);
            const rightX = Math.max(startOut.x, endOut.x) + loop;
            points.push(
                { x: startOut.x, y: outerY },
                { x: rightX, y: outerY },
                { x: rightX, y: endOut.y }
            );
        }
    } else {
        const fromHorizontal = fromSide === 'left' || fromSide === 'right';
        const toHorizontal = toSide === 'left' || toSide === 'right';

        if (fromHorizontal && toHorizontal) {
            const midX = (startOut.x + endOut.x) / 2;
            points.push(
                { x: midX, y: startOut.y },
                { x: midX, y: endOut.y }
            );
        } else if (!fromHorizontal && !toHorizontal) {
            const midY = (startOut.y + endOut.y) / 2;
            points.push(
                { x: startOut.x, y: midY },
                { x: endOut.x, y: midY }
            );
        } else {
            const cornerA = { x: endOut.x, y: startOut.y };
            const cornerB = { x: startOut.x, y: endOut.y };

            const costA = manhattanDistance(startOut, cornerA) + manhattanDistance(cornerA, endOut);
            const costB = manhattanDistance(startOut, cornerB) + manhattanDistance(cornerB, endOut);

            points.push(costA <= costB ? cornerA : cornerB);
        }
    }

    points.push(endOut, end);
    return simplifyOrthogonalPoints(points);
}

function getPolylineLength(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return total;
}

function getPointAndDirectionAtDistance(points, distance) {
    if (points.length < 2) {
        return { point: points[0] || { x: 0, y: 0 }, direction: { x: 1, y: 0 } };
    }

    const totalLength = getPolylineLength(points);
    const target = clamp(distance, 0, totalLength);
    let traversed = 0;

    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const segmentLength = Math.hypot(b.x - a.x, b.y - a.y);

        if (segmentLength < 0.0001) continue;

        if (traversed + segmentLength >= target) {
            const t = (target - traversed) / segmentLength;
            return {
                point: {
                    x: a.x + ((b.x - a.x) * t),
                    y: a.y + ((b.y - a.y) * t)
                },
                direction: normalizeVector({
                    x: b.x - a.x,
                    y: b.y - a.y
                })
            };
        }

        traversed += segmentLength;
    }

    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    return {
        point: last,
        direction: normalizeVector({
            x: last.x - prev.x,
            y: last.y - prev.y
        })
    };
}

function pointsToSvgPath(points) {
    if (!points || points.length === 0) return '';
    let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 1; i < points.length; i++) {
        path += ` L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`;
    }
    return path;
}

function drawCardinalityBars(svg, point, direction, isOne, isHighlighted) {
    const dir = normalizeVector(direction);
    const normal = normalizeVector({ x: -dir.y, y: dir.x });
    const halfBar = 7;
    const offsets = isOne ? [0] : [-4, 4];
        const cs = getComputedStyle(document.documentElement);
    const stroke = isHighlighted
        ? cs.getPropertyValue('--rel-bar-highlighted').trim()
        : cs.getPropertyValue('--rel-bar').trim();
    const strokeWidth = isHighlighted ? 2.5 : 2;

    for (const offset of offsets) {
        const center = {
            x: point.x + (dir.x * offset),
            y: point.y + (dir.y * offset)
        };

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', center.x + (normal.x * halfBar));
        line.setAttribute('y1', center.y + (normal.y * halfBar));
        line.setAttribute('x2', center.x - (normal.x * halfBar));
        line.setAttribute('y2', center.y - (normal.y * halfBar));
        line.setAttribute('stroke', stroke);
        line.setAttribute('stroke-width', strokeWidth);
        line.setAttribute('stroke-linecap', 'round');
        svg.appendChild(line);
    }
}

function getTableRect(table, padding) {
    const dims = getTableDimensions(table);
    return {
        x: table.x - padding,
        y: table.y - padding,
        width: dims.width + (padding * 2),
        height: dims.height + (padding * 2)
    };
}

function rectsOverlap(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x &&
           a.y < b.y + b.height && a.y + a.height > b.y;
}

function resolveTableOverlaps() {
    const padding = 35;

    for (let iter = 0; iter < 60; iter++) {
        let moved = false;

        for (let i = 0; i < state.tables.length; i++) {
            for (let j = i + 1; j < state.tables.length; j++) {
                const a = state.tables[i];
                const b = state.tables[j];
                const rectA = getTableRect(a, padding);
                const rectB = getTableRect(b, padding);

                if (!rectsOverlap(rectA, rectB)) continue;

                const overlapX = Math.min(
                    rectA.x + rectA.width - rectB.x,
                    rectB.x + rectB.width - rectA.x
                );
                const overlapY = Math.min(
                    rectA.y + rectA.height - rectB.y,
                    rectB.y + rectB.height - rectA.y
                );

                if (overlapX < overlapY) {
                    const push = overlapX / 2 + 1;
                    if (a.x <= b.x) { a.x -= push; b.x += push; }
                    else { a.x += push; b.x -= push; }
                } else {
                    const push = overlapY / 2 + 1;
                    if (a.y <= b.y) { a.y -= push; b.y += push; }
                    else { a.y += push; b.y -= push; }
                }

                moved = true;
            }
        }

        if (!moved) break;
    }
}

// Hierarchical auto-layout based on relationship graph
function autoLayoutTables() {
    if (state.tables.length === 0) return;

    // Build graph: fromTable has FK -> references toTable (parent)
    const refsOut = new Map();
    const refsIn = new Map();
    for (const t of state.tables) {
        refsOut.set(t.name, new Set());
        refsIn.set(t.name, new Set());
    }
    for (const rel of state.relationships) {
        if (refsOut.has(rel.fromTable) && refsIn.has(rel.toTable)) {
            refsOut.get(rel.fromTable).add(rel.toTable);
            refsIn.get(rel.toTable).add(rel.fromTable);
        }
    }

    // Assign layers via BFS from root tables (tables with no outgoing FK refs = parents)
    const layers = new Map();
    const visited = new Set();
    const queue = [];

    for (const t of state.tables) {
        if (refsOut.get(t.name).size === 0) {
            layers.set(t.name, 0);
            visited.add(t.name);
            queue.push(t.name);
        }
    }
    // Fallback for circular references
    if (queue.length === 0) {
        layers.set(state.tables[0].name, 0);
        visited.add(state.tables[0].name);
        queue.push(state.tables[0].name);
    }

    while (queue.length > 0) {
        const current = queue.shift();
        const currentLayer = layers.get(current);
        for (const child of refsIn.get(current) || []) {
            if (!visited.has(child)) {
                layers.set(child, currentLayer + 1);
                visited.add(child);
                queue.push(child);
            }
        }
    }
    // Disconnected tables
    for (const t of state.tables) {
        if (!visited.has(t.name)) {
            layers.set(t.name, 0);
        }
    }

    // Group by layer
    const groups = new Map();
    for (const [name, layer] of layers) {
        if (!groups.has(layer)) groups.set(layer, []);
        groups.get(layer).push(name);
    }

    const colSpacing = 500;
    const rowSpacing = 80;
    const sortedLayers = [...groups.keys()].sort((a, b) => a - b);

    for (const layerNum of sortedLayers) {
        const names = groups.get(layerNum);
        let totalHeight = 0;
        const entries = [];
        for (const name of names) {
            const table = state.tables.find(t => t.name === name);
            const dims = getTableDimensions(table);
            entries.push({ table, height: dims.height });
            totalHeight += dims.height;
        }
        totalHeight += (names.length - 1) * rowSpacing;

        let y = -(totalHeight / 2);
        const x = layerNum * colSpacing;

        for (const { table, height } of entries) {
            table.x = x;
            table.y = y;
            y += height + rowSpacing;
        }
    }
}

function clientToWorldPoint(clientX, clientY) {
    if (!elements.canvasContainer) return { x: clientX, y: clientY };
    const rect = elements.canvasContainer.getBoundingClientRect();
    return {
        x: (clientX - rect.left - state.panX) / state.zoom,
        y: (clientY - rect.top - state.panY) / state.zoom
    };
}

function getTableBoundaryAnchor(table, side) {
    const dims = getTableDimensions(table);
    if (side === 'left') return { x: table.x, y: table.y + (dims.height / 2) };
    if (side === 'right') return { x: table.x + dims.width, y: table.y + (dims.height / 2) };
    if (side === 'top') return { x: table.x + (dims.width / 2), y: table.y };
    return { x: table.x + (dims.width / 2), y: table.y + dims.height };
}

function chooseSideToPoint(table, point) {
    const center = getTableCenter(table);
    const dx = point.x - center.x;
    const dy = point.y - center.y;

    if (Math.abs(dx) >= Math.abs(dy)) {
        return dx >= 0 ? 'right' : 'left';
    }

    return dy >= 0 ? 'bottom' : 'top';
}

function findTableAtWorldPoint(point) {
    for (let i = state.tables.length - 1; i >= 0; i--) {
        const table = state.tables[i];
        const dims = getTableDimensions(table);
        const insideX = point.x >= table.x && point.x <= table.x + dims.width;
        const insideY = point.y >= table.y && point.y <= table.y + dims.height;
        if (insideX && insideY) {
            return table;
        }
    }
    return null;
}
