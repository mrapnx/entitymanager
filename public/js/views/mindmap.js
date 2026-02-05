window.renderMindmap = (data) => {
    const canvas = document.getElementById('mindmap-canvas');
    const ctx = canvas.getContext('2d');
    const entities = data.data.entities.entity || [];
    const types = data.data.types.type || [];

    // Basic node setup
    let nodes = entities.map((entity, i) => ({
        id: entity._attributes.id,
        label: entity.title ? entity.title._text : 'No Title',
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        width: 150,
        height: 100,
        vx: 0,
        vy: 0
    }));

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw links
        entities.forEach(entity => {
            const type = types.find(t => t.name._text === entity.type._text);
            if (!type || !type.attributes || !type.attributes.attribute) return;
            if (!Array.isArray(type.attributes.attribute)) type.attributes.attribute = [type.attributes.attribute];

            type.attributes.attribute.forEach(attr => {
                if (attr.dataType._text === 'link' && entity[attr.name._text]) {
                    const targetId = entity[attr.name._text]._text;
                    const sourceNode = nodes.find(n => n.id === entity._attributes.id);
                    const targetNode = nodes.find(n => n.id === targetId);
                    if (sourceNode && targetNode) {
                        ctx.beginPath();
                        ctx.moveTo(sourceNode.x + sourceNode.width / 2, sourceNode.y + sourceNode.height / 2);
                        ctx.lineTo(targetNode.x + targetNode.width / 2, targetNode.y + targetNode.height / 2);
                        ctx.stroke();
                    }
                }
            });
        });

        // Draw nodes
        nodes.forEach(node => {
            ctx.fillStyle = 'white';
            ctx.fillRect(node.x, node.y, node.width, node.height);
            ctx.strokeStyle = '#4a90e2';
            ctx.strokeRect(node.x, node.y, node.width, node.height);

            ctx.fillStyle = 'black';
            ctx.font = '16px Arial';
            ctx.fillText(node.label, node.x + 10, node.y + 20);

            // Draw buttons
            ctx.font = '20px Arial';
            ctx.fillText('✎', node.x + node.width - 50, node.y + 20);
            ctx.fillText('🗑', node.x + node.width - 25, node.y + 20);
        });
    }

    function update() {
        // Simple force-directed layout
        nodes.forEach(node1 => {
            nodes.forEach(node2 => {
                if (node1 === node2) return;
                const dx = node2.x - node1.x;
                const dy = node2.y - node1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 200) {
                    const force = -0.5;
                    node1.vx += force * (dx / distance);
                    node1.vy += force * (dy / distance);
                }
            });
        });

        nodes.forEach(node => {
            node.x += node.vx;
            node.y += node.vy;

            // Dampening
            node.vx *= 0.9;
            node.vy *= 0.9;

            // Boundary collision
            if (node.x < 0) node.x = 0;
            if (node.y < 0) node.y = 0;
            if (node.x + node.width > canvas.width) node.x = canvas.width - node.width;
            if (node.y + node.height > canvas.height) node.y = canvas.height - node.height;
        });

        draw();
        requestAnimationFrame(update);
    }

    update();
};