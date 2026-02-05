window.renderTable = (data) => {
    const typeSelect = document.getElementById('type-select');
    const tableContainer = document.querySelector('.table-container');
    const types = data.data.types.type || [];
    const entities = data.data.entities.entity || [];

    typeSelect.innerHTML = types.map(t => `<option value="${t.name._text}">${t.name._text}</option>`).join('');

    const render = () => {
        const selectedType = typeSelect.value;
        const type = types.find(t => t.name._text === selectedType);
        if (!type) {
            tableContainer.innerHTML = '';
            return;
        }

        let headers = type.attributes.attribute ? (Array.isArray(type.attributes.attribute) ? type.attributes.attribute.map(a => a.name._text) : [type.attributes.attribute.name._text]) : [];
        headers = ['id', 'type', ...headers];

        let tableHtml = `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}<th>Actions</th></tr></thead><tbody>`;

        const filteredEntities = entities.filter(e => e.type._text === selectedType);

        filteredEntities.forEach(entity => {
            tableHtml += `<tr>`;
            headers.forEach(header => {
                const value = entity[header] ? entity[header]._text : (entity._attributes && header === 'id' ? entity._attributes.id : 'N/A');
                tableHtml += `<td data-id="${entity._attributes.id}" data-field="${header}">${value}</td>`;
            });
            tableHtml += `<td><button class="delete-btn" data-id="${entity._attributes.id}">🗑</button></td>`;
            tableHtml += `</tr>`;
        });

        tableHtml += `</tbody></table>`;
        tableContainer.innerHTML = tableHtml;
    };

    typeSelect.addEventListener('change', render);
    render();

    tableContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const entityId = e.target.dataset.id;
            await fetch(`/api/entities/${entityId}`, { method: 'DELETE' });
            window.location.reload();
        } else if (e.target.tagName === 'TD') {
            const td = e.target;
            const oldValue = td.innerText;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = oldValue;
            td.innerHTML = '';
            td.appendChild(input);
            input.focus();

            input.addEventListener('blur', async () => {
                const newValue = input.value;
                td.innerText = newValue;
                const entityId = td.dataset.id;
                const field = td.dataset.field;
                const body = { [field]: { _text: newValue } };
                await fetch(`/api/entities/${entityId}`, { 
                    method: 'PUT', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(body) 
                });
            });
        }
    });
};