// Store the selected type IDs for filtering (shared with Cards view theoretically, but local scope here)
// To keep consistency, we can attach it to the window or use a shared state.
// For now, let's keep it consistent within the view module.
let tableSelectedTypeIds = new Set();
let currentSort = { column: null, direction: 'asc' }; // 'asc' or 'desc'

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
    let filteredEntities = tableSelectedTypeIds.size === 0 
        ? data.entities 
        : data.entities.filter(e => tableSelectedTypeIds.has(e.typeId));

    if (!filteredEntities || filteredEntities.length === 0) {
        tableContainer.innerHTML = '<p>No entities found matching the selected filters.</p>';
        return;
    }

    // Determine all unique attributes across selected types to build columns
    // Get types involved in the filtered entities
    const involvedTypeIds = new Set(filteredEntities.map(e => e.typeId));
    const involvedTypes = data.types.filter(t => involvedTypeIds.has(t.id));

    // Collect all unique attribute names and map them to their definitions for type checking (numeric sum)
    const allAttributeNames = new Set();
    const attributeDefs = {}; // Map name -> type def
    involvedTypes.forEach(t => {
        t.attributes.forEach(attr => {
            allAttributeNames.add(attr.name);
            // We store the attribute type. If multiple types share a name but differ in type, we prioritize numeric for sum row logic if any is numeric.
            if (!attributeDefs[attr.name] || (attr.type === 'Ganzzahl' || attr.type === 'Dezimalzahl')) {
                attributeDefs[attr.name] = attr.type;
            }
        });
    });
    const sortedAttributeNames = Array.from(allAttributeNames).sort();

    // --- Sort Logic ---
    if (currentSort.column) {
        filteredEntities.sort((a, b) => {
            let valA, valB;
            
            if (currentSort.column === 'Name') {
                valA = a.name.toLowerCase();
                valB = b.name.toLowerCase();
            } else if (currentSort.column === 'Type') {
                const typeA = data.types.find(t => t.id === a.typeId)?.name || '';
                const typeB = data.types.find(t => t.id === b.typeId)?.name || '';
                valA = typeA.toLowerCase();
                valB = typeB.toLowerCase();
            } else {
                // Attribute sort
                valA = a.attributes[currentSort.column];
                valB = b.attributes[currentSort.column];
                
                // Handle numbers
                const attrType = attributeDefs[currentSort.column];
                if (attrType === 'Ganzzahl' || attrType === 'Dezimalzahl') {
                    valA = valA === undefined || valA === '' ? -Infinity : Number(valA);
                    valB = valB === undefined || valB === '' ? -Infinity : Number(valB);
                } else {
                     valA = (valA || '').toString().toLowerCase();
                     valB = (valB || '').toString().toLowerCase();
                }
            }

            if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // --- Helper to generate sortable header ---
    const getSortIndicator = (colName) => {
        if (currentSort.column !== colName) return ' <span class="sort-icon">↕</span>';
        return currentSort.direction === 'asc' ? ' <span class="sort-icon">↑</span>' : ' <span class="sort-icon">↓</span>';
    };

    // --- Table Header ---
    let tableHTML = '<table class="entity-table">';
    tableHTML += '<thead><tr>';
    tableHTML += `<th class="sortable" data-col="Name">Name${getSortIndicator('Name')}</th>`;
    tableHTML += `<th class="sortable" data-col="Type">Type${getSortIndicator('Type')}</th>`;
    sortedAttributeNames.forEach(attrName => {
        tableHTML += `<th class="sortable" data-col="${attrName}">${attrName}${getSortIndicator(attrName)}</th>`;
    });
    tableHTML += '<th>Actions</th>';
    tableHTML += '</tr></thead>';

    // --- Table Body ---
    tableHTML += '<tbody>';
    
    // Sum Row Calculation
    const sums = {};
    sortedAttributeNames.forEach(attrName => {
        const type = attributeDefs[attrName];
        if (type === 'Ganzzahl' || type === 'Dezimalzahl') {
            sums[attrName] = 0;
        }
    });

    filteredEntities.forEach(entity => {
        const type = data.types.find(t => t.id === entity.typeId);
        
        tableHTML += `<tr>`;
        tableHTML += `<td>${entity.name}</td>`;
        tableHTML += `<td>${type ? type.name : 'Unknown'}</td>`;
        
        sortedAttributeNames.forEach(attrName => {
            const attrType = attributeDefs[attrName]; // Use collected definition or type from entity? Collected is safer for col consistency.
            const value = entity.attributes[attrName];
            
            // Add to Sum
            if ((attrType === 'Ganzzahl' || attrType === 'Dezimalzahl') && value !== undefined && value !== '') {
                sums[attrName] += Number(value);
            }
            
            let cellContent = value !== undefined ? value : '';
            
            // Re-check specific type for this entity to render links correctly if mixed
            const specificAttrDef = type ? type.attributes.find(a => a.name === attrName) : null;
            
            if (specificAttrDef && specificAttrDef.type === 'Link') {
                 const linkedEntity = data.entities.find(e => e.id === value);
                 if (linkedEntity) {
                    const linkedType = data.types.find(t => t.id === linkedEntity.typeId);
                    cellContent = `<span class="badge link-badge">${linkedType ? linkedType.name : 'Unknown'}: ${linkedEntity.name}</span>`;
                 } else {
                     cellContent = '<span class="text-muted">-</span>';
                 }
            } else if (cellContent === '') {
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

    // --- Sum Row ---
    // Check if we have any numeric columns to show a sum row
    const hasNumeric = Object.keys(sums).length > 0;
    if (hasNumeric) {
        tableHTML += '<tr class="sum-row" style="background-color: #f7f7f7; font-weight: bold;">';
        tableHTML += '<td>Summe</td>'; // Label under Name
        tableHTML += '<td></td>';     // Empty under Type
        sortedAttributeNames.forEach(attrName => {
            if (sums[attrName] !== undefined) {
                // Round to avoid floating point errors
                const sumVal = Math.round((sums[attrName] + Number.EPSILON) * 100) / 100;
                tableHTML += `<td>${sumVal}</td>`;
            } else {
                tableHTML += '<td></td>';
            }
        });
        tableHTML += '<td></td>'; // Actions col
        tableHTML += '</tr>';
    }

    tableHTML += '</tbody></table>';

    tableContainer.innerHTML = tableHTML;

    // --- Event Listeners ---
    
    // Sort Headers
    const headers = tableContainer.querySelectorAll('th.sortable');
    headers.forEach(th => {
        th.style.cursor = 'pointer';
        th.onclick = () => {
            const col = th.dataset.col;
            if (currentSort.column === col) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = col;
                currentSort.direction = 'asc';
            }
            window.renderTable({ data, renderCurrentView, openNewEntityModal });
        };
    });


    tableContainer.onclick = async (event) => {
        const target = event.target;
        
        // Handle sort click propagation if clicking on icon inside th
        if (target.closest('th.sortable')) {
             // Handled by specific listener above, but propagation might bubble here if we used delegation.
             // Since we attached directly to elements above, we are good.
        }

        if (target.classList.contains('edit-entity-btn')) {
            openNewEntityModal(target.getAttribute('data-id'));
        }

        if (target.classList.contains('delete-entity-btn')) {
            const entityIdToDelete = target.getAttribute('data-id');
            if (confirm('Are you sure you want to delete this entity?')) {
                await fetch(`/api/entities/${entityIdToDelete}`, { method: 'DELETE' });
                location.reload(); 
            }
        }
    };
};
