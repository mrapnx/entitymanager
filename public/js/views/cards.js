// Store the selected type IDs for filtering
let selectedTypeIds = new Set();

window.renderCards = ({ data, renderCurrentView, openNewEntityModal, openEntity, highlightEntity }) => {
    const cardsContainer = document.querySelector('#cards-view .cards-container');
    const filterContainer = document.querySelector('#cards-view .filter-container');
    
    // --- Render Filter Chips ---
    filterContainer.innerHTML = '<span>Filter nach Typ:</span>';
    data.types.forEach(type => {
        const chip = document.createElement('div');
        chip.classList.add('filter-chip');
        if (selectedTypeIds.has(type.id)) {
            chip.classList.add('active');
        }
        chip.textContent = type.name;
        chip.dataset.id = type.id;
        chip.addEventListener('click', () => {
            if (selectedTypeIds.has(type.id)) {
                selectedTypeIds.delete(type.id);
            } else {
                selectedTypeIds.add(type.id);
            }
            // Re-render the cards with the new filter
            window.renderCards({ data, renderCurrentView, openNewEntityModal, openEntity, highlightEntity });
        });
        filterContainer.appendChild(chip);
    });

    // --- Render Cards ---
    cardsContainer.innerHTML = ''; // Clear previous render

    const filteredEntities = selectedTypeIds.size === 0 
        ? data.entities 
        : data.entities.filter(e => selectedTypeIds.has(e.typeId));

    if (!filteredEntities || filteredEntities.length === 0) {
        cardsContainer.innerHTML = '<p>No entities found matching the selected filters.</p>';
        return;
    }

    filteredEntities.forEach(entity => {
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
            } else if (attr.type === 'Währung') {
                let displayVal = value;
                if (value !== '' && !isNaN(parseFloat(value))) {
                    displayVal = parseFloat(value).toFixed(2) + ' €';
                }
                attributeHTML = `<p><strong>${attr.name}:</strong> ${displayVal}</p>`;
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
            backlinksHTML = '<strong>Backlinks:</strong>';
            backlinks.forEach(backlink => {
                const backlinkType = data.types.find(t => t.id === backlink.typeId);
                backlinksHTML += `<p><a href="#" class="entity-link" data-id="${backlink.id}">${backlinkType ? backlinkType.name : 'Unknown'}: ${backlink.name}</a></p>`;
            });
        }

        card.innerHTML = `
            <div class="card-top-actions">
                <button class="edit-entity-btn" data-id="${entity.id}" title="Edit">✎</button>
                <button class="delete-entity-btn" data-id="${entity.id}" title="Delete">🗑</button>
            </div>
            <h3>${entity.name}</h3>
            <p><em>${type.name}</em></p>
            <div class="attributes-section">${attributesHTML}</div>
            <div class="backlinks-section">${backlinksHTML}</div>
        `;

        cardsContainer.appendChild(card);
    });

    // --- Event Listeners for Cards ---
    // Note: Re-binding listeners using a cleaner approach than node cloning
    // We remove the old listener by replacing the element's innerHTML (already done) 
    // and then adding a new one. But delegation is better on a static parent if possible.
    // Let's use a one-time assignment for the container's onclick if we're not using delegation properly.
    
    cardsContainer.onclick = async (event) => {
        const target = event.target;
        console.log('[DEBUG] Card container clicked, target:', target);

        if (target.classList.contains('edit-entity-btn')) {
            const id = target.getAttribute('data-id');
            console.log('[DEBUG] Edit button clicked for ID:', id);
            openNewEntityModal(id);
        }

        else if (target.classList.contains('delete-entity-btn')) {
            const entityIdToDelete = target.getAttribute('data-id');
            console.log('[DEBUG] Delete button clicked for ID:', entityIdToDelete);
            if (confirm('Are you sure you want to delete this entity?')) {
                console.log(`[DEBUG] Attempting DELETE request for /api/entities/${entityIdToDelete}`);
                try {
                    const response = await fetch(`/api/entities/${entityIdToDelete}`, { method: 'DELETE' });
                    console.log('[DEBUG] DELETE response status:', response.status);
                    if (response.ok) {
                        console.log('[DEBUG] DELETE successful, calling renderCurrentView (loadData)');
                        await renderCurrentView(); 
                    } else {
                        console.error('[DEBUG] DELETE failed on server.');
                    }
                } catch (err) {
                    console.error('[DEBUG] Fetch error during DELETE:', err);
                }
            }
        }

        else if (target.classList.contains('entity-link')) {
            event.preventDefault();
            const id = target.getAttribute('data-id');
            console.log('[DEBUG] Entity link clicked for ID:', id);
            openEntity(id);
        }
    };
};
