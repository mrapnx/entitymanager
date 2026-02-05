window.renderTable = ({ data, renderCurrentView, openNewEntityModal }) => {
    const tableContainer = document.querySelector('#table-view .table-container');
    const typeSelect = document.getElementById('type-select');

    const selectedTypeId = typeSelect.value || (data.types[0]?.id || '');

    // Populate the type selector dropdown
    typeSelect.innerHTML = data.types.map(t => `<option value="${t.id}" ${t.id === selectedTypeId ? 'selected' : ''}>${t.name}</option>`).join('');

    const selectedType = data.types.find(t => t.id === selectedTypeId);
    const entities = data.entities.filter(e => e.typeId === selectedTypeId);

    if (!selectedType) {
        tableContainer.innerHTML = '<p>Please select a type to view entities.</p>';
        return;
    }

    // --- Table Header ---
    const headers = ['Name', ...selectedType.attributes.map(attr => attr.name), 'Actions'];
    let tableHTML = '<table class="entity-table">';
    tableHTML += '<thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead>';

    // --- Table Body ---
    tableHTML += '<tbody>';
    entities.forEach(entity => {
        tableHTML += `<tr>`;
        tableHTML += `<td>${entity.name}</td>`;
        
        selectedType.attributes.forEach(attr => {
            const value = entity.attributes[attr.name] || '';
            let cellValue = value;
            if (attr.type === 'Link') {
                const linkedEntity = data.entities.find(e => e.id === value);
                if(linkedEntity) {
                    const linkedType = data.types.find(t => t.id === linkedEntity.typeId);
                    cellValue = `${linkedType ? linkedType.name : 'Unknown'}: ${linkedEntity.name}`;
                } else {
                    cellValue = 'None';
                }
            }
            tableHTML += `<td>${cellValue}</td>`;
        });

        tableHTML += `
            <td class="actions">
                <button class="edit-entity-btn" data-id="${entity.id}">Edit</button>
                <button class="delete-entity-btn" data-id="${entity.id}">Delete</button>
            </td>
        `;
        tableHTML += `</tr>`;
    });
    tableHTML += '</tbody></table>';

    tableContainer.innerHTML = tableHTML;

    // --- Event Listeners ---
    typeSelect.onchange = () => renderCurrentView();

    tableContainer.addEventListener('click', async (event) => {
        const target = event.target;

        if (target.classList.contains('edit-entity-btn')) {
            openNewEntityModal(target.dataset.id);
        }

        if (target.classList.contains('delete-entity-btn')) {
            const entityIdToDelete = target.dataset.id;
            if (confirm('Are you sure you want to delete this entity?')) {
                await fetch(`/api/entities/${entityIdToDelete}`, { method: 'DELETE' });
                renderCurrentView();
            }
        }
    });
};
