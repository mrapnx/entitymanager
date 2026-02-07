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
            if (!attributeDefs[attr.name] || (attr.type === 'Ganzzahl' || attr.type === 'Dezimalzahl' || attr.type === 'Währung')) {
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
                if (attrType === 'Ganzzahl' || attrType === 'Dezimalzahl' || attrType === 'Währung') {
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

    // --- Helper: Update Entity on Change ---
    const updateEntityField = async (entityId, fieldName, value) => {
        const entity = data.entities.find(e => e.id === entityId);
        if (!entity) return;

        // If fieldName is 'name', update top-level property
        if (fieldName === 'name') {
            entity.name = value;
        } else {
            // Otherwise, update attributes
            entity.attributes[fieldName] = value;
        }

        try {
            await fetch(`/api/entities/${entityId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entity)
            });
            // Re-render on change to update Sums
            window.renderTable({ data, renderCurrentView, openNewEntityModal });
        } catch (e) {
            console.error("Failed to update entity", e);
            alert("Fehler beim Speichern.");
        }
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
        if (type === 'Ganzzahl' || type === 'Dezimalzahl' || type === 'Währung') {
            sums[attrName] = 0;
        }
    });

    filteredEntities.forEach(entity => {
        const type = data.types.find(t => t.id === entity.typeId);
        
        tableHTML += `<tr>`;
        
        // Editable Name
        tableHTML += `<td><input type="text" class="table-input" data-id="${entity.id}" data-field="name" value="${entity.name}"></td>`;
        
        // Type (Read-only usually)
        tableHTML += `<td>${type ? type.name : 'Unknown'}</td>`;
        
        sortedAttributeNames.forEach(attrName => {
            const attrType = attributeDefs[attrName]; 
            const specificAttrDef = type ? type.attributes.find(a => a.name === attrName) : null;
            const value = entity.attributes[attrName] !== undefined ? entity.attributes[attrName] : '';
            
            // Add to Sum
            if ((attrType === 'Ganzzahl' || attrType === 'Dezimalzahl' || attrType === 'Währung') && value !== '') {
                sums[attrName] += Number(value);
            }
            
            let cellContent = '';

            if (specificAttrDef) {
                if (specificAttrDef.type === 'Link') {
                    const linkedEntities = data.entities.filter(e => !specificAttrDef.linkedTypeId || e.typeId === specificAttrDef.linkedTypeId);
                    
                    let options = `<option value="">-</option>`;
                    linkedEntities.forEach(le => {
                        const leType = data.types.find(t => t.id === le.typeId);
                        const selected = le.id === value ? 'selected' : '';
                        options += `<option value="${le.id}" ${selected}>${leType ? leType.name : '?'}: ${le.name}</option>`;
                    });
                    
                    cellContent = `<select class="table-select" data-id="${entity.id}" data-field="${attrName}">${options}</select>`;
                } else if (specificAttrDef.type === 'Ganzzahl') {
                    cellContent = `<input type="number" step="1" class="table-input" data-id="${entity.id}" data-field="${attrName}" value="${value}">`;
                } else if (specificAttrDef.type === 'Dezimalzahl') {
                    cellContent = `<input type="number" step="any" class="table-input" data-id="${entity.id}" data-field="${attrName}" value="${value}">`;
                } else if (specificAttrDef.type === 'Währung') {
                    // Similar to Decimal but perhaps display currency symbol in cell?
                    // Input usually doesn't support suffix text nicely without CSS wrapper.
                    // For inline edit simplicity, just input number.
                    cellContent = `
                        <div style="display:flex; align-items:center;">
                            <input type="number" step="0.01" class="table-input" data-id="${entity.id}" data-field="${attrName}" value="${value}">
                            <span style="margin-left:4px;">€</span>
                        </div>
                    `;
                } else {
                    // Text
                    cellContent = `<input type="text" class="table-input" data-id="${entity.id}" data-field="${attrName}" value="${value}">`;
                }
            } else {
                cellContent = '<span class="text-muted">-</span>';
            }

            tableHTML += `<td>${cellContent}</td>`;
        });

        tableHTML += `
            <td class="actions">
                <button class="icon-btn edit-entity-btn" data-id="${entity.id}" title="Details">✎</button>
                <button class="icon-btn delete-entity-btn" data-id="${entity.id}" title="Delete">🗑</button>
            </td>
        `;
        tableHTML += `</tr>`;
    });

    // --- Sum Row ---
    const hasNumeric = Object.keys(sums).length > 0;
    if (hasNumeric) {
        tableHTML += '<tr class="sum-row">';
        tableHTML += '<td>Summe</td>'; 
        tableHTML += '<td></td>';     
        sortedAttributeNames.forEach(attrName => {
            if (sums[attrName] !== undefined) {
                const sumVal = Math.round((sums[attrName] + Number.EPSILON) * 100) / 100;
                // Add currency symbol if ANY type in this column is Currency?
                // The collected definition helps.
                const isCurrency = attributeDefs[attrName] === 'Währung';
                tableHTML += `<td>${sumVal}${isCurrency ? ' €' : ''}</td>`;
            } else {
                tableHTML += '<td></td>';
            }
        });
        tableHTML += '<td></td>'; 
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

    // Inline Edit Handling (Delegation)
    tableContainer.onchange = (event) => {
        const target = event.target;
        if (target.classList.contains('table-input') || target.classList.contains('table-select')) {
            const entityId = target.dataset.id;
            const field = target.dataset.field;
            const value = target.value;
            updateEntityField(entityId, field, value);
        }
    };

    tableContainer.onclick = async (event) => {
        const target = event.target;
        
        // Handle sort click propagation if clicking on icon inside th
        if (target.closest('th.sortable')) {
             // handled above
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
