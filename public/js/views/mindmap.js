// ============================================================================
// Map / Graph View
// ----------------------------------------------------------------------------
// Renders all entities as cards on a pan/zoom HTML5 canvas and connects them
// with directed arrows based on their "Link" relationships.
//
// Per spec (Prompt.txt, Ansicht 3):
//   - Nodes are small cards showing type, name and ALL attributes (incl. values),
//     modelled after the card view.
//   - Links are drawn as arrows. Incoming links attach to the LEFT edge of a
//     card, outgoing links leave from the RIGHT edge.
// ============================================================================

(function () {
    // Persist viewport (pan/zoom) across re-renders so filtering doesn't reset it.
    const viewport = { scale: 1, offsetX: 0, offsetY: 0, initialised: false };

    // Id of the entity currently focused (null = overview / layered layout).
    let focusId = null;

    // Keep references so we can detach old listeners on re-render.
    let teardown = null;

    // A soft, readable palette. Each type gets a stable colour by index.
    const PALETTE = [
        '#1877f2', '#42b72a', '#f5a623', '#e0245e', '#7b61ff',
        '#00a2ae', '#d9534f', '#8e44ad', '#16a085', '#e67e22',
        '#2c82c9', '#c0392b', '#27ae60', '#f39c12', '#9b59b6'
    ];

    function colourForType(typeId, types) {
        const idx = types.findIndex(t => t.id === typeId);
        return PALETTE[(idx < 0 ? 0 : idx) % PALETTE.length];
    }

    // Lighten a hex colour towards white by `amount` (0..1) for card headers.
    function tint(hex, amount) {
        const c = hex.replace('#', '');
        const r = parseInt(c.substring(0, 2), 16);
        const g = parseInt(c.substring(2, 4), 16);
        const b = parseInt(c.substring(4, 6), 16);
        const mix = (ch) => Math.round(ch + (255 - ch) * amount);
        return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
    }

    function formatValue(attr, raw) {
        if (raw === undefined || raw === null || raw === '') return '—';
        if (attr.type === 'Währung') {
            const n = parseFloat(raw);
            return isNaN(n) ? String(raw) : n.toFixed(2) + ' €';
        }
        return String(raw);
    }

    window.renderMindmap = ({ data, openEntity, openNewEntityModal, renderCurrentView }) => {
        const canvas = document.getElementById('mindmap-canvas');
        const wrapper = document.querySelector('.map-canvas-wrapper');
        const filterContainer = document.querySelector('#mindmap-view .filter-container');

        // Detach listeners from a previous render.
        if (teardown) { teardown(); teardown = null; }

        // ---- Filter chips -------------------------------------------------
        filterContainer.innerHTML = '<span>Filter nach Typ:</span>';
        const selectedIds = window.appState ? window.appState.selectedTypeIds : new Set();

        data.types.forEach(type => {
            const chip = document.createElement('div');
            chip.classList.add('filter-chip');
            if (selectedIds.has(type.id)) chip.classList.add('active');
            chip.textContent = type.name;
            chip.dataset.id = type.id;
            const swatch = document.createElement('span');
            swatch.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;background:${colourForType(type.id, data.types)};`;
            chip.prepend(swatch);
            chip.addEventListener('click', () => {
                if (selectedIds.has(type.id)) selectedIds.delete(type.id);
                else selectedIds.add(type.id);
                window.renderMindmap({ data, openEntity, openNewEntityModal, renderCurrentView });
            });
            filterContainer.appendChild(chip);
        });

        // ---- Filter entities ---------------------------------------------
        let filteredEntities = data.entities;
        if (selectedIds.size > 0) {
            filteredEntities = data.entities.filter(e => selectedIds.has(e.typeId));
        }

        const ctx = canvas.getContext('2d');

        // Set up a crisp canvas that matches its CSS pixel size (HiDPI aware).
        const dpr = window.devicePixelRatio || 1;
        function sizeCanvas() {
            const w = wrapper.clientWidth;
            const h = wrapper.clientHeight;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
            return { w, h };
        }
        let { w: viewW, h: viewH } = sizeCanvas();

        if (!filteredEntities || filteredEntities.length === 0) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, viewW, viewH);
            ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
            ctx.fillStyle = '#90949c';
            ctx.textAlign = 'center';
            ctx.fillText('Keine Entitäten für die gewählten Filter gefunden.', viewW / 2, viewH / 2);
            return;
        }

        // ---- Build nodes --------------------------------------------------
        const NODE_WIDTH = 240;
        const H_GAP = 160;   // horizontal gap between layers
        const V_GAP = 36;    // vertical gap between cards in a layer
        const PAD = 14;      // inner card padding
        const LINE_H = 18;   // attribute line height
        const HEADER_H = 52; // type + name header block

        const nodeMap = new Map();
        const nodes = filteredEntities.map(entity => {
            const type = data.types.find(t => t.id === entity.typeId);
            // Attribute rows = all attributes defined on the type (incl. links).
            const attrs = (type && type.attributes) ? type.attributes : [];
            const height = HEADER_H + PAD + Math.max(attrs.length, 1) * LINE_H + PAD;
            const node = {
                id: entity.id, entity, type,
                label: entity.name,
                colour: type ? colourForType(type.id, data.types) : '#888',
                attrs,
                x: 0, y: 0, width: NODE_WIDTH, height,
                rank: 0, order: 0
            };
            nodeMap.set(entity.id, node);
            return node;
        });

        // ---- Build links --------------------------------------------------
        // A link is any attribute value that resolves to another entity in the
        // current (filtered) node set. We check declared "Link" attributes AND
        // any attribute whose value matches an existing entity id, so that
        // relationships stored on entities but not declared on the type (the
        // data contains several of these) are still visualised.
        const links = [];
        const seen = new Set();
        filteredEntities.forEach(entity => {
            const type = data.types.find(t => t.id === entity.typeId);
            const declaredLinkNames = new Set(
                (type?.attributes || []).filter(a => a.type === 'Link').map(a => a.name)
            );
            Object.entries(entity.attributes || {}).forEach(([attrName, value]) => {
                if (!value) return;
                const isDeclaredLink = declaredLinkNames.has(attrName);
                const resolvesToEntity = nodeMap.has(value);
                if (!resolvesToEntity) return;
                if (!isDeclaredLink && typeof value !== 'string') return;
                // Only draw if the target survived filtering.
                const key = entity.id + '->' + value + ':' + attrName;
                if (seen.has(key)) return;
                seen.add(key);
                links.push({ from: entity.id, to: value, label: attrName });
            });
        });

        // Adjacency used by both layout modes.
        const adj = new Map();      // from -> [to]
        const radj = new Map();     // to -> [from]
        nodes.forEach(n => { adj.set(n.id, []); radj.set(n.id, []); });
        links.forEach(l => {
            if (l.from === l.to) return; // skip self loops for ranking
            adj.get(l.from).push(l.to);
            radj.get(l.to).push(l.from);
        });

        // If the focused entity isn't in the current (filtered) set, drop focus.
        if (focusId && !nodeMap.has(focusId)) focusId = null;

        // visibleNodes/visibleLinks define what actually gets drawn. All nodes
        // stay visible in both modes; focus mode only changes the arrangement
        // and which nodes are emphasised.
        let visibleNodes = nodes;
        let visibleLinks = links;

        // Focus-mode bookkeeping (populated by computeFocusLayout).
        let focusNeighbourIds = new Set();   // direct neighbours of the focus

        // ---- Layout -------------------------------------------------------
        if (focusId) {
            computeFocusLayout(focusId);
        } else {
            computeLayeredLayout();
        }

        // ---- Layered layout (longest-path ranking + barycenter ordering) --
        // Rank = longest path from a source, so arrows mostly flow left→right.
        function computeLayeredLayout() {
            const rankOf = new Map();
            const inStack = new Set();
            function computeRank(id) {
                if (rankOf.has(id)) return rankOf.get(id);
                if (inStack.has(id)) return 0; // break cycles
                inStack.add(id);
                let r = 0;
                for (const pred of radj.get(id)) {
                    r = Math.max(r, computeRank(pred) + 1);
                }
                inStack.delete(id);
                rankOf.set(id, r);
                return r;
            }
            nodes.forEach(n => { n.rank = computeRank(n.id); });

            const layers = [];
            nodes.forEach(n => {
                (layers[n.rank] = layers[n.rank] || []).push(n);
            });

            layers.forEach(layer => {
                layer.sort((a, b) => {
                    const ta = a.type?.name || '';
                    const tb = b.type?.name || '';
                    return ta.localeCompare(tb) || a.label.localeCompare(b.label);
                });
                layer.forEach((n, i) => { n.order = i; });
            });

            function barycenterSweep(useDown) {
                const start = useDown ? 1 : layers.length - 2;
                const end = useDown ? layers.length : -1;
                const step = useDown ? 1 : -1;
                for (let li = start; li !== end; li += step) {
                    const layer = layers[li];
                    if (!layer) continue;
                    const neighbourLayer = layers[li - step];
                    if (!neighbourLayer) continue;
                    const pos = new Map(neighbourLayer.map((n, i) => [n.id, i]));
                    layer.forEach(n => {
                        const neighbours = useDown ? radj.get(n.id) : adj.get(n.id);
                        const vals = neighbours.map(id => pos.get(id)).filter(v => v !== undefined);
                        n._bary = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : n.order;
                    });
                    layer.sort((a, b) => (a._bary - b._bary) || (a.order - b.order));
                    layer.forEach((n, i) => { n.order = i; });
                }
            }
            for (let i = 0; i < 4; i++) { barycenterSweep(true); barycenterSweep(false); }

            const columnX = [];
            let xCursor = 0;
            for (let r = 0; r < layers.length; r++) {
                columnX[r] = xCursor;
                xCursor += NODE_WIDTH + H_GAP;
            }

            let maxColHeight = 0;
            layers.forEach(layer => {
                const h = layer.reduce((s, n) => s + n.height + V_GAP, -V_GAP);
                if (h > maxColHeight) maxColHeight = h;
            });

            layers.forEach((layer, r) => {
                const colHeight = layer.reduce((s, n) => s + n.height + V_GAP, -V_GAP);
                let yCursor = (maxColHeight - colHeight) / 2;
                layer.forEach(n => {
                    n.x = columnX[r];
                    n.y = yCursor;
                    yCursor += n.height + V_GAP;
                });
            });

            visibleNodes = nodes;
            visibleLinks = links;
        }

        // ---- Focus layout -------------------------------------------------
        // The clicked entity sits in the centre. ALL entities stay visible, but
        // they are arranged in columns by their *directed distance* to the
        // focus: following outgoing links pushes a node to the RIGHT (column
        // +1, +2, …), following incoming links pushes it to the LEFT (−1, −2,…).
        // So "things this entity points to" fan out right, "things pointing to
        // it" fan out left — giving an immediate picture of everything attached
        // to the focused entity. Entities with no path to the focus are parked
        // in a faint column on the far right so the overview stays complete.
        function computeFocusLayout(centerId) {
            const FOCUS_H_GAP = 90;   // gap between columns
            const FOCUS_V_GAP = 26;   // gap between stacked cards

            // Signed BFS distance from the focus. Right = +, left = −.
            const col = new Map();    // id -> signed column index
            col.set(centerId, 0);
            const queue = [centerId];
            while (queue.length) {
                const id = queue.shift();
                const c = col.get(id);
                // Outgoing neighbours go one column to the right.
                adj.get(id).forEach(to => {
                    if (!col.has(to)) { col.set(to, c + 1); queue.push(to); }
                });
                // Incoming neighbours go one column to the left.
                radj.get(id).forEach(from => {
                    if (!col.has(from)) { col.set(from, c - 1); queue.push(from); }
                });
            }

            // Nodes not connected to the focus at all: collect them into a
            // dedicated "unrelated" column to the far right.
            const connected = nodes.filter(n => col.has(n.id));
            const unrelated = nodes.filter(n => !col.has(n.id));

            // Column index -> list of nodes.
            const columns = new Map();
            const pushCol = (idx, n) => {
                if (!columns.has(idx)) columns.set(idx, []);
                columns.get(idx).push(n);
            };
            connected.forEach(n => pushCol(col.get(n.id), n));

            // Park unrelated nodes one column past the rightmost connected one.
            let maxCol = 0;
            col.forEach(c => { if (c > maxCol) maxCol = c; });
            const unrelatedCol = maxCol + 1;
            unrelated.forEach(n => pushCol(unrelatedCol, n));

            // Mark which nodes are directly connected to the focus (for styling).
            focusNeighbourIds = new Set();
            adj.get(centerId).forEach(id => focusNeighbourIds.add(id));
            radj.get(centerId).forEach(id => focusNeighbourIds.add(id));

            // Order within each column: directly-connected nodes first and
            // sorted by type/name; keeps the immediate context near the centre.
            const byTypeName = (a, b) =>
                (a.type?.name || '').localeCompare(b.type?.name || '') ||
                a.label.localeCompare(b.label);
            columns.forEach(list => list.sort(byTypeName));

            // Horizontal position per column index, keyed off the centre.
            const colWidth = NODE_WIDTH + FOCUS_H_GAP;
            const xForCol = (idx) => idx * colWidth;

            // Vertical: stack each column and vertically centre the tallest one.
            let maxColHeight = 0;
            columns.forEach(list => {
                const h = list.reduce((s, n) => s + n.height + FOCUS_V_GAP, -FOCUS_V_GAP);
                if (h > maxColHeight) maxColHeight = h;
            });

            columns.forEach((list, idx) => {
                const h = list.reduce((s, n) => s + n.height + FOCUS_V_GAP, -FOCUS_V_GAP);
                let y = (maxColHeight - h) / 2;
                list.forEach(n => {
                    n.x = xForCol(idx);
                    n.y = y;
                    y += n.height + FOCUS_V_GAP;
                });
            });

            // Everything stays visible; all links are drawable.
            visibleNodes = nodes;
            visibleLinks = links;
        }

        // World bounds (based on what's visible) for fit-to-view.
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        visibleNodes.forEach(n => {
            minX = Math.min(minX, n.x);
            minY = Math.min(minY, n.y);
            maxX = Math.max(maxX, n.x + n.width);
            maxY = Math.max(maxY, n.y + n.height);
        });
        const worldW = maxX - minX;
        const worldH = maxY - minY;

        // ---- Viewport helpers --------------------------------------------
        function fitToView() {
            const margin = 40;
            const sx = (viewW - margin * 2) / worldW;
            const sy = (viewH - margin * 2) / worldH;
            viewport.scale = Math.min(sx, sy, 1.1);
            viewport.offsetX = (viewW - worldW * viewport.scale) / 2 - minX * viewport.scale;
            viewport.offsetY = (viewH - worldH * viewport.scale) / 2 - minY * viewport.scale;
        }
        if (!viewport.initialised) { fitToView(); viewport.initialised = true; }

        function worldFromScreen(px, py) {
            return {
                x: (px - viewport.offsetX) / viewport.scale,
                y: (py - viewport.offsetY) / viewport.scale
            };
        }

        // ---- Drawing ------------------------------------------------------
        function roundRect(x, y, w, h, r) {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
        }

        function drawArrow(from, to, highlight, opacity) {
            ctx.save();
            ctx.globalAlpha = opacity === undefined ? 1 : opacity;
            // Outgoing from RIGHT edge of source, incoming to LEFT edge of target.
            let sx = from.x + from.width;
            let sy = from.y + from.height / 2;
            let tx = to.x;
            let ty = to.y + to.height / 2;

            // If the target is to the left of the source (back-edge), route out
            // the left of source into the right of target so direction reads well.
            if (to.x + to.width <= from.x) {
                sx = from.x;
                tx = to.x + to.width;
            }

            const dx = Math.max(Math.abs(tx - sx) * 0.5, 40) * (tx >= sx ? 1 : -1);
            const cp2x = tx - dx;
            const cp2y = ty;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.bezierCurveTo(sx + dx, sy, cp2x, cp2y, tx, ty);
            ctx.strokeStyle = highlight ? '#1877f2' : 'rgba(96,103,112,0.45)';
            ctx.lineWidth = highlight ? 2.5 : 1.5;
            ctx.stroke();

            // Arrow head oriented along the curve's end tangent (cp2 -> end).
            const head = 9;
            const a = Math.atan2(ty - cp2y, tx - cp2x);
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx - head * Math.cos(a - Math.PI / 6), ty - head * Math.sin(a - Math.PI / 6));
            ctx.lineTo(tx - head * Math.cos(a + Math.PI / 6), ty - head * Math.sin(a + Math.PI / 6));
            ctx.closePath();
            ctx.fillStyle = highlight ? '#1877f2' : 'rgba(96,103,112,0.6)';
            ctx.fill();
            ctx.restore();
        }

        function drawCard(node, dimmed, isFocus) {
            const { x, y, width: w, height: h } = node;
            ctx.globalAlpha = dimmed ? 0.22 : 1;

            // Shadow + body
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.12)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 3;
            ctx.fillStyle = '#ffffff';
            roundRect(x, y, w, h, 10);
            ctx.fill();
            ctx.restore();

            // Coloured left accent bar
            ctx.fillStyle = node.colour;
            roundRect(x, y, 6, h, 3);
            ctx.fill();

            // Header band
            ctx.fillStyle = tint(node.colour, 0.85);
            roundRect(x, y, w, HEADER_H, 10);
            ctx.fill();
            ctx.fillRect(x, y + HEADER_H - 12, w, 12); // square off bottom of header

            // Border (focused card gets a bold blue ring)
            ctx.strokeStyle = isFocus ? '#1877f2' : '#e3e5e8';
            ctx.lineWidth = isFocus ? 3 : 1;
            roundRect(x, y, w, h, 10);
            ctx.stroke();

            // Type name (small)
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = node.colour;
            ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
            ctx.fillText((node.type ? node.type.name : 'Unbekannt').toUpperCase(), x + PAD, y + 18);

            // Entity name (title)
            ctx.fillStyle = '#1c1e21';
            ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
            ctx.fillText(truncate(node.label, w - PAD * 2, '15px'), x + PAD, y + 40);

            // Attributes
            let ay = y + HEADER_H + PAD + 4;
            ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
            if (node.attrs.length === 0) {
                ctx.fillStyle = '#b0b3b8';
                ctx.fillText('(keine Attribute)', x + PAD, ay);
            } else {
                node.attrs.forEach(attr => {
                    const raw = node.entity.attributes ? node.entity.attributes[attr.name] : '';
                    let valText;
                    if (attr.type === 'Link') {
                        // Resolve the linked ENTITY (nodeMap holds node wrappers,
                        // not entities, so read .name from the entity directly).
                        const targetNode = nodeMap.get(raw);
                        const targetEntity = targetNode ? targetNode.entity
                            : data.entities.find(e => e.id === raw);
                        valText = targetEntity ? targetEntity.name : (raw ? String(raw) : '—');
                        ctx.fillStyle = '#1877f2';
                    } else {
                        valText = formatValue(attr, raw);
                        ctx.fillStyle = '#606770';
                    }
                    // Label
                    ctx.fillStyle = '#90949c';
                    const labelText = attr.name + ': ';
                    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
                    const labelW = ctx.measureText(labelText).width;
                    ctx.fillText(labelText, x + PAD, ay);
                    // Value
                    ctx.fillStyle = attr.type === 'Link' ? '#1877f2' : '#1c1e21';
                    ctx.font = (attr.type === 'Link' ? '600 ' : '') + '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
                    ctx.fillText(truncate(valText, w - PAD * 2 - labelW, '12px'), x + PAD + labelW, ay);
                    ay += LINE_H;
                });
            }

            ctx.globalAlpha = 1;
        }

        function truncate(text, maxWidth, font) {
            text = String(text);
            if (ctx.measureText(text).width <= maxWidth) return text;
            let t = text;
            while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) {
                t = t.slice(0, -1);
            }
            return t + '…';
        }

        let hoverNodeId = null;

        function render() {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, viewW, viewH);
            ctx.setTransform(dpr * viewport.scale, 0, 0, dpr * viewport.scale,
                dpr * viewport.offsetX, dpr * viewport.offsetY);

            // Hover always highlights the hovered node's edges. In focus mode,
            // the focused node's edges are highlighted too so its immediate
            // relationships pop out while the rest of the graph stays visible.
            const highlightId = hoverNodeId || focusId;

            const activeLinks = new Set();
            const connectedNodes = new Set();
            if (highlightId) {
                connectedNodes.add(highlightId);
                visibleLinks.forEach((l, i) => {
                    if (l.from === highlightId || l.to === highlightId) {
                        activeLinks.add(i);
                        connectedNodes.add(l.from);
                        connectedNodes.add(l.to);
                    }
                });
            }

            // Edges first (non-highlighted/faint), then highlighted on top.
            visibleLinks.forEach((l, i) => {
                const from = nodeMap.get(l.from);
                const to = nodeMap.get(l.to);
                if (!from || !to) return;
                if (highlightId && activeLinks.has(i)) return;
                // In focus mode, edges unrelated to the focus are drawn faint.
                drawArrow(from, to, false, focusId ? 0.35 : 1);
            });
            if (highlightId) {
                visibleLinks.forEach((l, i) => {
                    if (!activeLinks.has(i)) return;
                    drawArrow(nodeMap.get(l.from), nodeMap.get(l.to), true);
                });
            }

            // Nodes on top. In focus mode: focus + its direct neighbours are
            // fully opaque, everything else is dimmed (but still readable) so
            // the user instantly sees what belongs to the focused entity.
            visibleNodes.forEach(n => {
                let dimmed = false;
                if (focusId) {
                    dimmed = n.id !== focusId && !focusNeighbourIds.has(n.id)
                        && !(hoverNodeId && connectedNodes.has(n.id));
                } else if (hoverNodeId) {
                    dimmed = !connectedNodes.has(n.id);
                }
                drawCard(n, dimmed, n.id === focusId);
            });
        }

        // Re-run the whole view (recomputes layout for the new focus state).
        function rerender(refit) {
            if (refit) viewport.initialised = false;
            window.renderMindmap({ data, openEntity, openNewEntityModal, renderCurrentView });
        }

        // Toggle the "back to overview" button and update the hint text.
        function updateFocusToolbar() {
            const btn = document.getElementById('map-unfocus');
            const hint = document.querySelector('#mindmap-view .map-hint');
            if (btn) btn.style.display = focusId ? 'inline-block' : 'none';
            if (hint) {
                hint.textContent = focusId
                    ? 'Fokusmodus · links: Verweise auf diese Entität · rechts: Verweise von ihr · leere Fläche klicken zum Verlassen'
                    : 'Ziehen zum Verschieben · Mausrad zum Zoomen · Karte anklicken fokussiert sie';
            }
        }

        render();
        updateFocusToolbar();

        // ---- Interaction --------------------------------------------------
        let isPanning = false;
        let panStart = { x: 0, y: 0 };
        let moved = false;

        function nodeAt(screenX, screenY) {
            const world = worldFromScreen(screenX, screenY);
            for (let i = visibleNodes.length - 1; i >= 0; i--) {
                const n = visibleNodes[i];
                if (world.x >= n.x && world.x <= n.x + n.width &&
                    world.y >= n.y && world.y <= n.y + n.height) {
                    return n;
                }
            }
            return null;
        }

        function relPos(e) {
            const rect = canvas.getBoundingClientRect();
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }

        const onMouseDown = (e) => {
            isPanning = true;
            moved = false;
            const p = relPos(e);
            panStart = { x: p.x - viewport.offsetX, y: p.y - viewport.offsetY };
            canvas.classList.add('panning');
        };

        const onMouseMove = (e) => {
            const p = relPos(e);
            if (isPanning) {
                viewport.offsetX = p.x - panStart.x;
                viewport.offsetY = p.y - panStart.y;
                moved = true;
                render();
                return;
            }
            const n = nodeAt(p.x, p.y);
            const newHover = n ? n.id : null;
            if (newHover !== hoverNodeId) {
                hoverNodeId = newHover;
                canvas.style.cursor = n ? 'pointer' : 'grab';
                render();
            }
        };

        const onMouseUp = (e) => {
            if (isPanning && !moved) {
                // A click (no drag).
                const p = relPos(e);
                const n = nodeAt(p.x, p.y);
                if (n) {
                    if (focusId === n.id) {
                        // Second click on the already-focused card opens it for editing.
                        if (typeof openNewEntityModal === 'function') openNewEntityModal(n.id);
                    } else {
                        // Focus this entity: it moves to the centre, its direct
                        // neighbours line up left (incoming) and right (outgoing).
                        focusId = n.id;
                        isPanning = false;
                        canvas.classList.remove('panning');
                        rerender(true);
                        return;
                    }
                } else if (focusId) {
                    // Click on empty space exits focus mode.
                    focusId = null;
                    isPanning = false;
                    canvas.classList.remove('panning');
                    rerender(true);
                    return;
                }
            }
            isPanning = false;
            canvas.classList.remove('panning');
        };

        const onMouseLeave = () => {
            isPanning = false;
            canvas.classList.remove('panning');
            if (hoverNodeId) { hoverNodeId = null; render(); }
        };

        const onWheel = (e) => {
            e.preventDefault();
            const p = relPos(e);
            const world = worldFromScreen(p.x, p.y);
            const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
            const newScale = Math.min(Math.max(viewport.scale * factor, 0.15), 3);
            // Zoom towards the cursor.
            viewport.offsetX = p.x - world.x * newScale;
            viewport.offsetY = p.y - world.y * newScale;
            viewport.scale = newScale;
            render();
        };

        canvas.addEventListener('mousedown', onMouseDown);
        canvas.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('mouseleave', onMouseLeave);
        canvas.addEventListener('wheel', onWheel, { passive: false });

        // Toolbar buttons
        const zoomInBtn = document.getElementById('map-zoom-in');
        const zoomOutBtn = document.getElementById('map-zoom-out');
        const fitBtn = document.getElementById('map-fit');

        function zoomBy(factor) {
            const cx = viewW / 2, cy = viewH / 2;
            const world = worldFromScreen(cx, cy);
            const newScale = Math.min(Math.max(viewport.scale * factor, 0.15), 3);
            viewport.offsetX = cx - world.x * newScale;
            viewport.offsetY = cy - world.y * newScale;
            viewport.scale = newScale;
            render();
        }
        const unfocusBtn = document.getElementById('map-unfocus');
        const onZoomIn = () => zoomBy(1.2);
        const onZoomOut = () => zoomBy(1 / 1.2);
        const onFit = () => { fitToView(); render(); };
        const onUnfocus = () => { focusId = null; rerender(true); };
        zoomInBtn.addEventListener('click', onZoomIn);
        zoomOutBtn.addEventListener('click', onZoomOut);
        fitBtn.addEventListener('click', onFit);
        unfocusBtn.addEventListener('click', onUnfocus);

        // Re-fit on window resize.
        const onResize = () => {
            const s = sizeCanvas();
            viewW = s.w; viewH = s.h;
            render();
        };
        window.addEventListener('resize', onResize);

        teardown = () => {
            canvas.removeEventListener('mousedown', onMouseDown);
            canvas.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            canvas.removeEventListener('mouseleave', onMouseLeave);
            canvas.removeEventListener('wheel', onWheel);
            zoomInBtn.removeEventListener('click', onZoomIn);
            zoomOutBtn.removeEventListener('click', onZoomOut);
            fitBtn.removeEventListener('click', onFit);
            unfocusBtn.removeEventListener('click', onUnfocus);
            window.removeEventListener('resize', onResize);
        };
    };
})();
