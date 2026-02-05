window.renderCards = ({ data, renderCurrentView, openNewEntityModal, openEntity, highlightEntity }) => {
    const cardsContainer = document.querySelector('#cards-view .cards-container');
    cardsContainer.innerHTML = ''; // Clear previous render

    if (!data.entities || data.entities.length === 0) {
        cardsContainer.innerHTML = '<p>No entities found. Create one by clicking the "+ New Entity" button.</p>';
        return;
    }

    data.entities.forEach(entity => {
        const type = data.types.find(t => t.id === entity.typeId);
        if (!type) return; // Skip entity if its type doesn't exist

        const card = document.createElement('div');
        card.classList.add('card');
        card.dataset.id = entity.id;

        // --- Attributes ---
        let attributesHTML = '';
        type.attributes.forEach(attr => {
            const value = entity.attributes[attr.name] || '';
            let attributeHTML = '';
            if (attr.type === 'Link') {
                const linkedEntity = data.entities.find(e => e.id === value);
                if (linkedEntity) {
                    const linkedType = data.types.find(t => t.id === linkedEntity.typeId);
                    const typeName = linkedType ? linkedType.name : 'Unknown';
                    attributeHTML = `<p><strong>${attr.name}:</strong> <a href="#" class="entity-link" data-id="${linkedEntity.id}">${typeName}: ${linkedEntity.name}</a></p>`;
                } else {
                     attributeHTML = `<p><strong>${attr.name}:</strong> <em>None</em></p>`;
                }
            } else {
                attributeHTML = `<p><strong>${attr.name}:</strong> ${value}</p>`;
            }
            attributesHTML += attributeHTML;
        });

        // --- Backlinks ---
        const backlinks = data.entities.filter(potentialLinker => 
            Object.values(potentialLinker.attributes).includes(entity.id)
        );

        let backlinksHTML = '';
        if (backlinks.length > 0) {
            backlinksHTML = '<h4>Backlinks:</h4>';
            backlinks.forEach(backlink => {
                const backlinkType = data.types.find(t => t.id === backlink.typeId);
                backlinksHTML += `<p><a href="#" class="entity-link" data-id="${backlink.id}">${backlinkType ? backlinkType.name : 'Unknown'}: ${backlink.name}</a></p>`;
            });
        }

        card.innerHTML = `
            <h3>${entity.name}</h3>
            <p><em>${type.name}</em></p>
            <div class="attributes-section">${attributesHTML}</div>
            <div class="backlinks-section">${backlinksHTML}</div>
            <div class="card-actions">
                <button class="edit-entity-btn" data-id="${entity.id}">Edit</button>
                <button class="delete-entity-btn" data-id="${entity.id}">Delete</button>
            </div>
        `;

        cardsContainer.appendChild(card);
    });

    // --- Event Listeners for Cards ---
    // Note: Using event delegation on the container for dynamically added cards
    cardsContainer.addEventListener('click', async (event) => {
        const target = event.target;

        if (target.classList.contains('edit-entity-btn')) {
            openNewEntityModal(target.dataset.id);
        }

        else if (target.classList.contains('delete-entity-btn')) {
            const entityIdToDelete = target.dataset.id;
            if (confirm('Are you sure you want to delete this entity?')) {
                await fetch(`/api/entities/${entityIdToDelete}`, { method: 'DELETE' });
                await renderCurrentView(); // Reload data and re-render
            }
        }

        else if (target.classList.contains('entity-link')) {
            event.preventDefault();
            openEntity(target.dataset.id);
        }
    });
};
