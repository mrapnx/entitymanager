// Store the selected type IDs for filtering
let mapSelectedTypeIds = new Set();

window.renderMindmap = ({ data, openEntity, openNewEntityModal, renderCurrentView }) => {
    const canvas = document.getElementById('mindmap-canvas');
    const container = document.getElementById('mindmap-view');
    const filterContainer = document.querySelector('#mindmap-view .filter-container');
    
    // --- Render Filter Chips ---
    filterContainer.innerHTML = '<span>Filter nach Typ:</span>';
    data.types.forEach(type => {
        const chip = document.createElement('div');
        chip.classList.add('filter-chip');
        if (mapSelectedTypeIds.has(type.id)) {
            chip.classList.add('active');
        }
        chip.textContent = type.name;
        chip.dataset.id = type.id;
        chip.addEventListener('click', () => {
            if (mapSelectedTypeIds.has(type.id)) {
                mapSelectedTypeIds.delete(type.id);
            } else {
                mapSelectedTypeIds.add(type.id);
            }
            // Re-render the map with the new filter
            window.renderMindmap({ data, openEntity, openNewEntityModal, renderCurrentView });
        });
        filterContainer.appendChild(chip);
    });

    // --- Filter Entities ---
    let filteredEntities = data.entities;
    if (mapSelectedTypeIds.size > 0) {
        filteredEntities = data.entities.filter(e => mapSelectedTypeIds.has(e.typeId));
    }

    // Canvas sizing setup
    const filterHeight = filterContainer.offsetHeight;
    const availableHeight = Math.max(container.offsetHeight - filterHeight - 20, 600);
    
    canvas.width = container.offsetWidth;
    canvas.height = availableHeight;
    
    const ctx = canvas.getContext('2d');

    if (!filteredEntities || filteredEntities.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.fillText('Keine Entitäten für die gewählten Filter gefunden.', canvas.width / 2, canvas.height / 2);
        return;
    }

    const NODE_WIDTH = 220; 
    const H_GAP = 350; 
    const PADDING = 10;
    const BTN_SIZE = 24;
    const BTN_PADDING = 5; 

    // --- Layout Data Preparation ---
    let maxNodeHeight = 120; // Track max height for V_GAP

    const nodes = filteredEntities.map(entity => {
        const type = data.types.find(t => t.id === entity.typeId);
        
        // Calculate dynamic height based on non-link attributes
        let visibleAttrCount = 0;
        if (type && type.attributes) {
            visibleAttrCount = type.attributes.filter(a => a.type !== 'Link').length;
        }
        // Base height (header + separator + padding) ~ 70px. Each attribute ~18px. Min height 120.
        const calculatedHeight = 70 + (visibleAttrCount * 18) + 10;
        const height = Math.max(120, calculatedHeight);
        
        if (height > maxNodeHeight) maxNodeHeight = height;

        return {
            id: entity.id,
            entity: entity,
            type: type,
            label: entity.name,
            x: 0,
            y: 0,
            width: NODE_WIDTH,
            height: height,
            rank: -1
        };
    });

    // Set V_GAP based on the tallest node found + spacing
    const V_GAP = maxNodeHeight + 40; 

    const nodeMap = new Map(nodes.map(node => [node.id, node]));

    const links = [];
    filteredEntities.forEach(entity => {
        const type = data.types.find(t => t.id === entity.typeId);
        if (type) {
            type.attributes.forEach(attr => {
                if (attr.type === 'Link') {
                    const targetId = entity.attributes[attr.name];
                    // Only include links where both source and target are in the filtered set
                    if (targetId && nodeMap.has(targetId)) {
                        links.push({ from: entity.id, to: targetId });
                    }
                }
            });
        }
    });

    // --- Rank-Based Layered Layout ---
    const inDegree = new Map();
    nodes.forEach(n => inDegree.set(n.id, 0));
    links.forEach(l => {
        inDegree.set(l.to, (inDegree.get(l.to) || 0) + 1);
    });

    const queue = [];
    const visited = new Set();

    nodes.forEach(n => {
        if (inDegree.get(n.id) === 0) {
            queue.push({ id: n.id, rank: 0 });
            visited.add(n.id);
        }
    });

    if (queue.length === 0 && nodes.length > 0) {
        queue.push({ id: nodes[0].id, rank: 0 });
        visited.add(nodes[0].id);
    }

    while (queue.length > 0) {
        const { id, rank } = queue.shift();
        const node = nodeMap.get(id);
        node.rank = rank;

        const outgoing = links.filter(l => l.from === id);
        outgoing.forEach(l => {
            if (!visited.has(l.to)) {
                visited.add(l.to);
                queue.push({ id: l.to, rank: rank + 1 });
            }
        });

        if (queue.length === 0 && visited.size < nodes.length) {
            const unvisited = nodes.find(n => !visited.has(n.id));
            if (unvisited) {
                queue.push({ id: unvisited.id, rank: 0 });
                visited.add(unvisited.id);
            }
        }
    }

    const layers = {};
    let maxRank = 0;
    nodes.forEach(node => {
        const r = node.rank;
        if (!layers[r]) layers[r] = [];
        layers[r].push(node);
        maxRank = Math.max(maxRank, r);
    });

    Object.keys(layers).forEach(r => {
        const rank = parseInt(r);
        const layerNodes = layers[rank];
        const layerHeight = layerNodes.length * V_GAP;
        const startY = -(layerHeight / 2) + (V_GAP / 2);

        layerNodes.forEach((node, idx) => {
            node.x = rank * H_GAP;
            node.y = startY + idx * V_GAP;
        });
    });

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(n => {
        minX = Math.min(minX, n.x - n.width/2);
        maxX = Math.max(maxX, n.x + n.width/2);
        minY = Math.min(minY, n.y - n.height/2);
        maxY = Math.max(maxY, n.y + n.height/2);
    });

    const paddingX = 100;
    const paddingY = 100;
    const contentWidth = maxX - minX + paddingX * 2;
    const contentHeight = maxY - minY + paddingY * 2;

    if (contentWidth > canvas.width || contentHeight > canvas.height) {
        canvas.width = Math.max(canvas.width, contentWidth);
        canvas.height = Math.max(canvas.height, contentHeight);
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const offsetX = (canvas.width - (maxX - minX)) / 2 - minX;
    const offsetY = (canvas.height - (maxY - minY)) / 2 - minY;

    nodes.forEach(n => {
        n.x += offsetX;
        n.y += offsetY;
    });


    // --- Helper for Button Coords ---
    function getButtonCoords(node) {
        const cardRight = node.x + node.width / 2;
        const cardTop = node.y - node.height / 2;
        
        // Delete button (Rightmost)
        const delX = cardRight - PADDING - BTN_SIZE;
        const delY = cardTop + PADDING;
        
        // Edit button (Left of Delete)
        const editX = delX - BTN_PADDING - BTN_SIZE;
        const editY = cardTop + PADDING;
        
        return {
            edit: { x: editX, y: editY, w: BTN_SIZE, h: BTN_SIZE },
            del: { x: delX, y: delY, w: BTN_SIZE, h: BTN_SIZE }
        };
    }

    // --- Drawing Functions ---

    function drawCard(node) {
        const x = node.x - node.width / 2;
        const y = node.y - node.height / 2;

        // Card Background
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;
        ctx.fillRect(x, y, node.width, node.height);
        
        // Reset Shadow for text/borders
        ctx.shadowColor = 'transparent';
        
        // Border
        ctx.strokeStyle = '#dddfe2';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, node.width, node.height);

        // Header (Type Name)
        ctx.fillStyle = '#606770';
        ctx.font = 'italic 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(node.type ? node.type.name : 'Unknown', x + PADDING, y + PADDING + 10);

        // Title (Entity Name)
        ctx.fillStyle = '#1c1e21';
        ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
        ctx.fillText(node.label, x + PADDING, y + PADDING + 35);
        
        // Separator
        ctx.strokeStyle = '#eee';
        ctx.beginPath();
        ctx.moveTo(x + PADDING, y + 50);
        ctx.lineTo(x + node.width - PADDING, y + 50);
        ctx.stroke();

        // Content Preview
        let attrY = y + 70;
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
        ctx.fillStyle = '#1c1e21';
        
        if (node.type && node.type.attributes) {
            for (const attr of node.type.attributes) {
                // Skip rendering link attributes text as requested
                if (attr.type === 'Link') continue;
                
                const val = node.entity.attributes[attr.name];
                let displayVal = val || '-';
                
                if (attr.type === 'Währung') {
                     if (val !== '' && !isNaN(parseFloat(val))) {
                         displayVal = parseFloat(val).toFixed(2) + ' €';
                     }
                }
                
                const text = `${attr.name}: ${displayVal}`;
                ctx.fillText(text, x + PADDING, attrY);
                attrY += 18;
            }
        }

        // --- Draw Action Buttons ---
        const btns = getButtonCoords(node);

        // Edit Button
        ctx.fillStyle = '#f0f2f5';
        ctx.strokeStyle = '#dddfe2';
        ctx.lineWidth = 1;
        ctx.fillRect(btns.edit.x, btns.edit.y, btns.edit.w, btns.edit.h);
        ctx.strokeRect(btns.edit.x, btns.edit.y, btns.edit.w, btns.edit.h);
        
        ctx.fillStyle = '#606770';
        ctx.font = '16px serif'; 
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✎', btns.edit.x + btns.edit.w/2, btns.edit.y + btns.edit.h/2 + 1);

        // Delete Button
        ctx.fillStyle = '#f0f2f5';
        ctx.fillRect(btns.del.x, btns.del.y, btns.del.w, btns.del.h);
        ctx.strokeRect(btns.del.x, btns.del.y, btns.del.w, btns.del.h);
        
        ctx.fillStyle = '#606770';
        ctx.fillText('🗑', btns.del.x + btns.del.w/2, btns.del.y + btns.del.h/2 + 1);
        
        // Reset Alignment
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }

    function drawBezierLink(fromNode, toNode) {
        const startX = fromNode.x + fromNode.width / 2; 
        const startY = fromNode.y;
        const endX = toNode.x - toNode.width / 2;     
        const endY = toNode.y;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        
        const dist = Math.abs(endX - startX);
        const cpOffset = Math.max(dist * 0.5, 50); 

        const cp1x = startX + cpOffset;
        const cp1y = startY;
        const cp2x = endX - cpOffset;
        const cp2y = endY;
        
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
        
        ctx.strokeStyle = '#1877f2'; 
        ctx.lineWidth = 2;
        ctx.stroke();

        const headlen = 8;
        const dx = endX - cp2x;
        const dy = endY - cp2y;
        const angle = Math.atan2(dy, dx);

        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - headlen * Math.cos(angle - Math.PI / 6), endY - headlen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(endX - headlen * Math.cos(angle + Math.PI / 6), endY - headlen * Math.sin(angle + Math.PI / 6));
        ctx.fillStyle = '#1877f2';
        ctx.fill();
    }

    // --- Render Loop ---
    links.forEach(link => {
        const from = nodeMap.get(link.from);
        const to = nodeMap.get(link.to);
        if (from && to) {
            drawBezierLink(from, to);
        }
    });

    nodes.forEach(node => {
        drawCard(node);
    });

    // --- Interaction ---
    canvas.onclick = async (event) => {
        const rect = canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;

        for (let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i];
            
            // Check Buttons
            const btns = getButtonCoords(node);
            
            // Edit
            if (clickX >= btns.edit.x && clickX <= btns.edit.x + btns.edit.w &&
                clickY >= btns.edit.y && clickY <= btns.edit.y + btns.edit.h) {
                if (typeof openNewEntityModal === 'function') {
                    openNewEntityModal(node.id);
                } else {
                    console.error('openNewEntityModal is not a function');
                }
                return;
            }
            
            // Delete
            if (clickX >= btns.del.x && clickX <= btns.del.x + btns.del.w &&
                clickY >= btns.del.y && clickY <= btns.del.y + btns.del.h) {
                if (confirm('Are you sure you want to delete this entity?')) {
                     await fetch(`/api/entities/${node.id}`, { method: 'DELETE' });
                     if (typeof renderCurrentView === 'function') {
                        renderCurrentView(); 
                     } else {
                         location.reload();
                     }
                }
                return;
            }

            // Check Card Body
            const left = node.x - node.width / 2;
            const right = node.x + node.width / 2;
            const top = node.y - node.height / 2;
            const bottom = node.y + node.height / 2;

            if (clickX >= left && clickX <= right && clickY >= top && clickY <= bottom) {
                openEntity(node.id);
                break;
            }
        }
    };
};
