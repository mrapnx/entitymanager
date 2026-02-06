// Store the selected type IDs for filtering (shared with Cards view theoretically, but local scope here)
// To keep consistency, we can attach it to the window or use a shared state.
// For now, let's keep it consistent within the view module.
let tableSelectedTypeIds = new Set();

window.renderTable = ({ data, renderCurrentView, openNewEntityModal }) => {
    const tableContainer = document.querySelector('#table-view .table-container');
    const filterContainer = document.querySelector('#table-view .filter-container');

    // --- Render Filter Chips ---
    filterContainer.innerHTML = '<span>Filter nach Typ:</span>';
    data.types.forEach(type => {
        const chip = document.createElement('div');
        chip.classList.add('filter-chip');
        if (tableSelectedTypeIds.has(type.id)) {
            chip.classList.add('active');
        }
        chip.textContent = type.name;
        chip.dataset.id = type.id;
        chip.addEventListener('click', () => {
            if (tableSelectedTypeIds.has(type.id)) {
                tableSelectedTypeIds.delete(type.id);
            } else {
                tableSelectedTypeIds.add(type.id);
            }
            // Re-render the table with the new filter
            window.renderTable({ data, renderCurrentView, openNewEntityModal });
        });
        filterContainer.appendChild(chip);
    });

    // --- Filter Entities ---
    const filteredEntities = tableSelectedTypeIds.size === 0 
        ? data.entities 
        : data.entities.filter(e => tableSelectedTypeIds.has(e.typeId));

    if (!filteredEntities || filteredEntities.length === 0) {
        tableContainer.innerHTML = '<p>No entities found matching the selected filters.</p>';
        return;
    }

    // Determine all unique attributes across selected types to build columns
    // If no types are selected (showing all), we need a strategy for columns.
    // Strategy: Show Name, Type, and a union of all attributes (or just common ones? Union is better but can be wide).
    // Let's go with Union of attributes from the types of the displayed entities.
    
    // Get types involved in the filtered entities
    const involvedTypeIds = new Set(filteredEntities.map(e => e.typeId));
    const involvedTypes = data.types.filter(t => involvedTypeIds.has(t.id));

    // Collect all unique attribute names
    const allAttributeNames = new Set();
    involvedTypes.forEach(t => {
        t.attributes.forEach(attr => allAttributeNames.add(attr.name));
    });
    const sortedAttributeNames = Array.from(allAttributeNames).sort();

    // --- Table Header ---
    let tableHTML = '<table class="entity-table">';
    tableHTML += '<thead><tr>';
    tableHTML += '<th>Name</th>';
    tableHTML += '<th>Type</th>';
    sortedAttributeNames.forEach(attrName => {
        tableHTML += `<th>${attrName}</th>`;
    });
    tableHTML += '<th>Actions</th>';
    tableHTML += '</tr></thead>';

    // --- Table Body ---
    tableHTML += '<tbody>';
    filteredEntities.forEach(entity => {
        const type = data.types.find(t => t.id === entity.typeId);
        
        tableHTML += `<tr>`;
        tableHTML += `<td>${entity.name}</td>`;
        tableHTML += `<td>${type ? type.name : 'Unknown'}</td>`;
        
        sortedAttributeNames.forEach(attrName => {
            // Find the attribute definition in the entity's type
            const attrDef = type ? type.attributes.find(a => a.name === attrName) : null;
            const value = entity.attributes[attrName] || '';
            
            let cellContent = value;
            
            if (attrDef && attrDef.type === 'Link') {
                 const linkedEntity = data.entities.find(e => e.id === value);
                 if (linkedEntity) {
                    const linkedType = data.types.find(t => t.id === linkedEntity.typeId);
                    cellContent = `<span class="badge link-badge">${linkedType ? linkedType.name : 'Unknown'}: ${linkedEntity.name}</span>`;
                 } else {
                     cellContent = '<span class="text-muted">-</span>';
                 }
            } else if (!value) {
                cellContent = '<span class="text-muted">-</span>';
            }

            tableHTML += `<td>${cellContent}</td>`;
        });

        tableHTML += `
            <td class="actions">
                <button class="icon-btn edit-entity-btn" data-id="${entity.id}" title="Edit">✎</button>
                <button class="icon-btn delete-entity-btn" data-id="${entity.id}" title="Delete">🗑</button>
            </td>
        `;
        tableHTML += `</tr>`;
    });
    tableHTML += '</tbody></table>';

    tableContainer.innerHTML = tableHTML;

    // --- Event Listeners ---
    tableContainer.onclick = async (event) => {
        const target = event.target;
        
        if (target.classList.contains('edit-entity-btn')) {
            openNewEntityModal(target.getAttribute('data-id'));
        }

        if (target.classList.contains('delete-entity-btn')) {
            const entityIdToDelete = target.getAttribute('data-id');
            if (confirm('Are you sure you want to delete this entity?')) {
                await fetch(`/api/entities/${entityIdToDelete}`, { method: 'DELETE' });
                // We need to reload data to refresh the view correctly.
                // Since renderTable is called with 'data', we should ideally trigger a reload from main.js
                // But main.js passes renderCurrentView which does the reload flow if implemented there?
                // Actually renderCurrentView in main.js calls window.renderTable(viewDependencies).
                // It does NOT refetch data. We need to refetch data.
                // Since we don't have direct access to 'loadData' here (unless passed), 
                // we rely on the fact that the delete happened on server.
                // However, the local 'data' object is stale.
                // Ideally, main.js should handle the data reload or we should trigger a custom event.
                // For simplicity, let's assume the main app will handle reload if we reload the page or 
                // if we had a callback for data update.
                // WAIT: In main.js, we see renderCurrentView passes `loadData`? No.
                // But in main.js delete listener, it calls `renderCurrentView`.
                // We need to trigger the full reload cycle.
                // Let's dispatch a custom event or force reload.
                location.reload(); // Quickest fix for data sync in this architecture without refactoring main.js heavily
            }
        }
    };
};
