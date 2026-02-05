window.renderCards = (data, renderCurrentView, openNewEntityModal, openEntity, highlightEntity) => {
    const cardsContainer = document.querySelector('#cards-view .cards-container');
    cardsContainer.innerHTML = '';

    data.entities.forEach(entity => {
        const type = data.types.find(t => t.id === entity.typeId);
        if (!type) return;

        const card = document.createElement('div');
        card.classList.add('card');
        card.dataset.id = entity.id;

        let attributesHTML = '';
        type.attributes.forEach(attr => {
            const value = entity.attributes[attr.name] || '';
            if (attr.type === 'Link') {
                const linkedEntity = data.entities.find(e => e.id === value);
                if (linkedEntity) {
                    const linkedType = data.types.find(t => t.id === linkedEntity.typeId);
                    attributesHTML += `<p><strong>${attr.name}:</strong> <a href="#" class="entity-link" data-id="${linkedEntity.id}">${linkedType.name}: ${linkedEntity.name}</a></p>`;
                } else {
                     attributesHTML += `<p><strong>${attr.name}:</strong> </p>`;
                }
            } else {
                attributesHTML += `<p><strong>${attr.name}:</strong> ${value}</p>`;
            }
        });

        const backlinks = data.entities.filter(e => 
            Object.values(e.attributes).includes(entity.id)
        );

        let backlinksHTML = '';
        if (backlinks.length > 0) {
            backlinksHTML = '<h4>Backlinks:</h4>';
            backlinks.forEach(backlink => {
                const backlinkType = data.types.find(t => t.id === backlink.typeId);
                backlinksHTML += `<p><a href="#" class="entity-link" data-id="${backlink.id}">${backlinkType.name}: ${backlink.name}</a></p>`;
            });
        }

        card.innerHTML = `
            <h3>${entity.name}</h3>
            <p><em>${type.name}</em></p>
            ${attributesHTML}
            ${backlinksHTML}
            <button class="edit-entity-btn" data-id="${entity.id}">Edit</button>
            <button class="delete-entity-btn" data-id="${entity.id}">Delete</button>
        `;

        cardsContainer.appendChild(card);
    });

    cardsContainer.addEventListener('click', async (event) => {
        const target = event.target;
        const entityId = target.dataset.id;

        if (target.classList.contains('edit-entity-btn')) {
            openNewEntityModal(entityId);
        }

        if (target.classList.contains('delete-entity-btn')) {
            if (confirm('Are you sure you want to delete this entity?')) {
                await fetch(`/api/entities/${entityId}`, { method: 'DELETE' });
                renderCurrentView();
            }
        }

        if (target.classList.contains('entity-link')) {
            event.preventDefault();
            openEntity(entityId);
        }
    });
};
