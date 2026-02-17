// SQL Diagram - Render Relationship Lines (orthogonal routing)

function renderRelationships() {
    const svg = elements.relationshipsSvg;
    if (!svg) return;

    svg.innerHTML = '';

    const routes = [];
    const laneCountByPort = new Map();

    for (const rel of state.relationships) {
        const fromTable = state.tables.find(t => t.name === rel.fromTable);
        const toTable = state.tables.find(t => t.name === rel.toTable);

        if (!fromTable || !toTable) continue;

        const fromColIndex = fromTable.columns.findIndex(c => c.name === rel.fromColumn);
        const toColIndex = toTable.columns.findIndex(c => c.name === rel.toColumn);

        if (fromColIndex === -1 || toColIndex === -1) continue;

        const { fromX, fromY, toX, toY, fromSide, toSide } = getSmartConnectionPoints(
            fromTable, toTable, fromColIndex, toColIndex
        );

        const fromPortKey = `${rel.fromTable}:${rel.fromColumn}:${fromSide}`;
        const toPortKey = `${rel.toTable}:${rel.toColumn}:${toSide}`;

        laneCountByPort.set(fromPortKey, (laneCountByPort.get(fromPortKey) || 0) + 1);
        laneCountByPort.set(toPortKey, (laneCountByPort.get(toPortKey) || 0) + 1);

        routes.push({
            rel,
            fromTable,
            toTable,
            fromColIndex,
            toColIndex,
            fromX,
            fromY,
            toX,
            toY,
            fromSide,
            toSide,
            fromPortKey,
            toPortKey
        });
    }

    const laneUsageByPort = new Map();
    const laneStep = 10;

    for (const route of routes) {
        const isHighlighted = state.hoveredTable &&
            (route.rel.fromTable === state.hoveredTable || route.rel.toTable === state.hoveredTable);

        const fromPortCount = laneCountByPort.get(route.fromPortKey) || 1;
        const toPortCount = laneCountByPort.get(route.toPortKey) || 1;

        const fromPortIndex = laneUsageByPort.get(route.fromPortKey) || 0;
        const toPortIndex = laneUsageByPort.get(route.toPortKey) || 0;

        laneUsageByPort.set(route.fromPortKey, fromPortIndex + 1);
        laneUsageByPort.set(route.toPortKey, toPortIndex + 1);

        const fromLaneOffset = getCenteredLaneOffset(fromPortIndex, fromPortCount, laneStep);
        const toLaneOffset = getCenteredLaneOffset(toPortIndex, toPortCount, laneStep);

        const isSelfReference = route.rel.fromTable === route.rel.toTable;

        const fromPoint = offsetPointAlongSide(
            { x: route.fromX, y: route.fromY },
            route.fromSide,
            fromLaneOffset
        );
        const toPoint = offsetPointAlongSide(
            { x: route.toX, y: route.toY },
            route.toSide,
            toLaneOffset
        );

        const fromNormal = getSideNormal(route.fromSide);
        const toNormal = getSideNormal(route.toSide);

        // Uniform gap between table edge and polyline start (enough room for bars + labels)
        const markerGap = 28;

        const fromPathPoint = {
            x: fromPoint.x + (fromNormal.x * markerGap),
            y: fromPoint.y + (fromNormal.y * markerGap)
        };
        const toPathPoint = {
            x: toPoint.x + (toNormal.x * markerGap),
            y: toPoint.y + (toNormal.y * markerGap)
        };

        const polyline = buildOrthogonalPolyline(
            fromPathPoint,
            toPathPoint,
            route.fromSide,
            route.toSide,
            isSelfReference
        );

        const fromCol = route.fromTable.columns[route.fromColIndex];
        const toCol = route.toTable.columns[route.toColIndex];
        const isOptionalRelationship = !(fromCol && fromCol.notNull);

        const fromIsOne = !!(fromCol && (fromCol.unique || fromCol.pk));
        const toIsOne = !!(toCol && (toCol.unique || toCol.pk));

        const svgPathData = pointsToSvgPath(polyline);

        // Casing stroke: background-colored outline so line crossings are visible
        const casing = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        casing.setAttribute('d', svgPathData);
        casing.setAttribute('fill', 'none');
        casing.setAttribute('stroke', 'var(--bg-primary)');
        casing.setAttribute('stroke-width', isHighlighted ? '12' : '7');
        casing.setAttribute('stroke-linejoin', 'round');
        casing.setAttribute('stroke-linecap', 'round');
        svg.appendChild(casing);

        if (isHighlighted) {
            // Layer 1: Soft glow trail
            const glowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            glowPath.setAttribute('d', svgPathData);
            glowPath.setAttribute('class', 'rel-line-glow');
            glowPath.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(glowPath);

            // Layer 2: Solid dim backdrop
            const basePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            basePath.setAttribute('d', svgPathData);
            basePath.setAttribute('class', 'rel-line-flow-base');
            basePath.setAttribute('stroke-linejoin', 'round');
            basePath.setAttribute('stroke-linecap', 'round');
            if (isOptionalRelationship) {
                basePath.setAttribute('stroke-dasharray', '8 4');
            }
            svg.appendChild(basePath);

            // Layer 3: Animated directional dashes
            // Path always goes from fromTable → toTable (FK direction).
            // Forward animation = dashes flow start→end = FK direction.
            const flowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            flowPath.setAttribute('d', svgPathData);
            flowPath.setAttribute('class', 'rel-line-flow-forward');
            flowPath.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(flowPath);
        } else {
            // Normal non-highlighted line
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', svgPathData);
            path.setAttribute('class', 'relationship-line rel-line');
            path.setAttribute('stroke-linejoin', 'round');
            path.setAttribute('stroke-linecap', 'square');
            if (isOptionalRelationship) {
                path.setAttribute('stroke-dasharray', '8 4');
            }
            svg.appendChild(path);
        }

        // --- Clickable hit area for editing the relationship ---
        const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hitPath.setAttribute('d', svgPathData);
        hitPath.setAttribute('fill', 'none');
        hitPath.setAttribute('stroke', 'transparent');
        hitPath.setAttribute('stroke-width', '14');
        hitPath.setAttribute('pointer-events', 'stroke');
        hitPath.setAttribute('cursor', 'pointer');
        hitPath.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditRelationEditor(route.rel, { x: e.clientX, y: e.clientY });
        });
        svg.appendChild(hitPath);

        // --- Cardinality bars: drawn in the gap between table edge and polyline ---
        // Placed at fixed distance from the table edge, using the side normal as direction.
        // This guarantees visibility regardless of connection side (left/right/top/bottom).
        const barDist = 10;
        const fromBarPoint = {
            x: fromPoint.x + (fromNormal.x * barDist),
            y: fromPoint.y + (fromNormal.y * barDist)
        };
        const toBarPoint = {
            x: toPoint.x + (toNormal.x * barDist),
            y: toPoint.y + (toNormal.y * barDist)
        };

        drawCardinalityBars(svg, fromBarPoint, fromNormal, fromIsOne, isHighlighted);
        drawCardinalityBars(svg, toBarPoint, toNormal, toIsOne, isHighlighted);

        // --- Labels: placed further from table edge to avoid overlapping bars/lines ---
        const fromTangent = getSideTangent(route.fromSide);
        const toTangent = getSideTangent(route.toSide);

        const labelNormalDist = 26;
        const labelTangentDist = 10;

        const fromLabelClass = isHighlighted
            ? 'relationship-label rel-label relationship-label-highlighted rel-label-highlighted'
            : 'relationship-label rel-label';
        const toLabelClass = fromLabelClass;

        const fromLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        fromLabel.setAttribute('x', fromPoint.x + (fromNormal.x * labelNormalDist) + (fromTangent.x * labelTangentDist));
        fromLabel.setAttribute('y', fromPoint.y + (fromNormal.y * labelNormalDist) + (fromTangent.y * labelTangentDist));
        fromLabel.setAttribute('class', fromLabelClass);
        fromLabel.setAttribute('text-anchor', getLabelAnchorBySide(route.fromSide));
        fromLabel.textContent = route.rel.fromColumn;
        svg.appendChild(fromLabel);

        const toLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        toLabel.setAttribute('x', toPoint.x + (toNormal.x * labelNormalDist) + (toTangent.x * labelTangentDist));
        toLabel.setAttribute('y', toPoint.y + (toNormal.y * labelNormalDist) + (toTangent.y * labelTangentDist));
        toLabel.setAttribute('class', toLabelClass);
        toLabel.setAttribute('text-anchor', getLabelAnchorBySide(route.toSide));
        toLabel.textContent = route.rel.toColumn;
        svg.appendChild(toLabel);

        // --- Cardinality text at midpoint of polyline ---
        let fromCardinalityText = fromIsOne ? '1' : 'N';
        if (fromCol && !fromCol.notNull && !fromCol.pk) {
            fromCardinalityText = fromIsOne ? '0..1' : '0..N';
        }
        const toCardinalityText = toIsOne ? '1' : 'N';
        const cardinality = `${fromCardinalityText}:${toCardinalityText}`;

        const totalLength = getPolylineLength(polyline);
        const mid = getPointAndDirectionAtDistance(polyline, totalLength / 2);
        const midNormal = normalizeVector({ x: -mid.direction.y, y: mid.direction.x });

        const cardLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        cardLabel.setAttribute('x', mid.point.x + (midNormal.x * 12));
        cardLabel.setAttribute('y', mid.point.y + (midNormal.y * 12));
        cardLabel.setAttribute('class', isHighlighted ? 'cardinality-highlighted' : 'cardinality-label');
        cardLabel.setAttribute('text-anchor', 'middle');
        cardLabel.textContent = cardinality;
        svg.appendChild(cardLabel);
    }

    // Render connection draft preview
    if (state.connectionDraft) {
        const fromTable = state.tables.find(t => t.name === state.connectionDraft.fromTable);
        if (!fromTable) return;

        const endPoint = state.connectionDraft.currentPoint;
        const targetTable = state.connectionDraft.targetTable
            ? state.tables.find(t => t.name === state.connectionDraft.targetTable)
            : null;

        let toSide;
        let toPoint;

        if (targetTable) {
            toSide = chooseSideToPoint(targetTable, state.connectionDraft.fromPoint);
            toPoint = getTableBoundaryAnchor(targetTable, toSide);
        } else {
            toPoint = endPoint;
            const dx = endPoint.x - state.connectionDraft.fromPoint.x;
            const dy = endPoint.y - state.connectionDraft.fromPoint.y;
            if (Math.abs(dx) >= Math.abs(dy)) {
                toSide = dx >= 0 ? 'left' : 'right';
            } else {
                toSide = dy >= 0 ? 'top' : 'bottom';
            }
        }

        const previewPoints = buildOrthogonalPolyline(
            {
                x: state.connectionDraft.fromPoint.x + (getSideNormal(state.connectionDraft.fromSide).x * 18),
                y: state.connectionDraft.fromPoint.y + (getSideNormal(state.connectionDraft.fromSide).y * 18)
            },
            {
                x: toPoint.x + (getSideNormal(toSide).x * 12),
                y: toPoint.y + (getSideNormal(toSide).y * 12)
            },
            state.connectionDraft.fromSide,
            toSide,
            false
        );

        const previewPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        previewPath.setAttribute('d', pointsToSvgPath(previewPoints));
        previewPath.setAttribute('fill', 'none');
        const cs = getComputedStyle(document.documentElement);
        previewPath.setAttribute('stroke', targetTable
            ? cs.getPropertyValue('--rel-preview-active').trim()
            : cs.getPropertyValue('--rel-preview').trim());
        previewPath.setAttribute('stroke-width', targetTable ? '2' : '1.5');
        previewPath.setAttribute('stroke-dasharray', '7 5');
        svg.appendChild(previewPath);

        if (previewPoints.length > 1) {
            const previewLength = getPolylineLength(previewPoints);
            const inset = 14;
            const startPreview = getPointAndDirectionAtDistance(previewPoints, inset);
            const endPreview = getPointAndDirectionAtDistance(previewPoints, Math.max(0, previewLength - inset));
            const previewHighlighted = !!targetTable;
            drawCardinalityBars(svg, startPreview.point, startPreview.direction, true, previewHighlighted);
            drawCardinalityBars(svg, endPreview.point, endPreview.direction, false, previewHighlighted);
        }
    }
}
