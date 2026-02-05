window.renderCards = (data) => {
    const cardsContainer = document.querySelector('.cards-container');
    cardsContainer.innerHTML = '';
    const entities = data.data.entities.entity || [];
    const types = data.data.types.type || [];

    entities.forEach(entity => {
        const type = types.find(t => t.name._text === entity.type._text);
        if (!type) return;

        const card = document.createElement('div');
        card.classList.add('card');

        let attributesHtml = '';
        if (type.attributes && type.attributes.attribute) {
            if (!Array.isArray(type.attributes.attribute)) {
                type.attributes.attribute = [type.attributes.attribute];
            }
            type.attributes.attribute.forEach(attr => {
                const attrName = attr.name._text;
                const attrValue = entity[attrName] ? entity[attrName]._text : 'N/A';
                attributesHtml += `<p><strong>${attrName}:</strong> ${attrValue}</p>`;
            });
        }

        card.innerHTML = `
            <h3>${entity.type._text}</h3>
            <h4>${entity.title ? entity.title._text : 'No Title'}</h4>
            ${attributesHtml}
            <div>
                <button class="edit-btn" data-id="${entity._attributes.id}">✎</button>
                <button class="delete-btn" data-id="${entity._attributes.id}">🗑</button>
            </div>
        `;
        cardsContainer.appendChild(card);
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Implement edit functionality
            console.log('Edit entity:', e.target.dataset.id);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const entityId = e.target.dataset.id;
            await fetch(`/api/entities/${entityId}`, { method: 'DELETE' });
            window.location.reload(); // Reload to see changes
        });
    });
};