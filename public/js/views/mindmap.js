window.renderMindmap = ({ data, openEntity }) => {
    const canvas = document.getElementById('mindmap-canvas');
    const ctx = canvas.getContext('2d');

    // Basic canvas setup
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!data.entities || data.entities.length === 0) {
        ctx.font = '16px Arial';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.fillText('No entities to display in the mindmap.', canvas.width / 2, canvas.height / 2);
        return;
    }

    const nodes = [];
    const edges = [];

    // --- Node and Edge Creation ---
    data.entities.forEach(entity => {
        nodes.push({ id: entity.id, label: entity.name, x: 0, y: 0, radius: 40 });
        const type = data.types.find(t => t.id === entity.typeId);
        if (type) {
            type.attributes.forEach(attr => {
                if (attr.type === 'Link') {
                    const linkedEntityId = entity.attributes[attr.name];
                    if (linkedEntityId && data.entities.some(e => e.id === linkedEntityId)) {
                        edges.push({ from: entity.id, to: linkedEntityId });
                    }
                }
            });
        }
    });

    // --- Simple Circular Layout ---
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) * 0.8;
    const angleStep = (2 * Math.PI) / nodes.length;

    nodes.forEach((node, i) => {
        node.x = centerX + radius * Math.cos(i * angleStep);
        node.y = centerY + radius * Math.sin(i * angleStep);
    });

    const nodeMap = new Map(nodes.map(node => [node.id, node]));

    // --- Drawing ---
    // Draw edges
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 2;
    edges.forEach(edge => {
        const fromNode = nodeMap.get(edge.from);
        const toNode = nodeMap.get(edge.to);
        if (fromNode && toNode) {
            ctx.beginPath();
            ctx.moveTo(fromNode.x, fromNode.y);
            ctx.lineTo(toNode.x, toNode.y);
            ctx.stroke();
        }
    });

    // Draw nodes
    nodes.forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#1877f2';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw label
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label, node.x, node.y);
    });

    // --- Click Handler ---
    canvas.onclick = (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        for (const node of nodes) {
            const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
            if (distance < node.radius) {
                openEntity(node.id);
                break;
            }
        }
    };
};
