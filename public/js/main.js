document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selection ---
    const views = {
        cards: document.getElementById('cards-view'),
        table: document.getElementById('table-view'),
        mindmap: document.getElementById('mindmap-view'),
    };
    const viewButtons = {
        cards: document.getElementById('cards-view-btn'),
        table: document.getElementById('table-view-btn'),
        mindmap: document.getElementById('mindmap-view-btn'),
    };
    const configBtn = document.getElementById('config-btn');
    const newEntityBtn = document.getElementById('new-entity-btn');

    // Configuration Modal Elements
    const configModal = document.getElementById('config-modal');
    const closeConfigBtn = configModal.querySelector('.close-btn');
    const typeManagementContainer = document.getElementById('type-management');
    const newTypeBtn = document.getElementById('new-type-btn');
    const newTypeFormContainer = document.getElementById('new-type-form-container');
    const newTypeNameInput = document.getElementById('new-type-name');
    const saveNewTypeBtn = document.getElementById('save-new-type-btn');
    const cancelNewTypeBtn = document.getElementById('cancel-new-type-btn');

    // New Entity Modal Elements
    const newEntityModal = document.getElementById('new-entity-modal');
    const closeNewEntityBtn = newEntityModal.querySelector('.close-btn');
    const newEntityForm = document.getElementById('new-entity-form');
    const newEntityModalTitle = document.getElementById('new-entity-modal-title');

    // JSON Import/Export Elements
    const jsonImportInput = document.getElementById('json-import-input');
    const jsonImportBtn = document.getElementById('json-import-btn');
    const jsonExportBtn = document.getElementById('json-export-btn');

    // --- State Management ---
    let data = { types: [], entities: [] };
    let activeView = 'cards';
    let editingEntityId = null;

    // --- Core Functions ---

    /**
     * Fetches initial data from the server and renders the initial view.
     */
    const loadData = async () => {
        try {
            console.log('[DEBUG] Fetching data from /api/data...');
            const response = await fetch('/api/data');
            if (!response.ok) throw new Error('Failed to load data.');
            data = await response.json();
            console.log('[DEBUG] Data loaded successfully:', data);
            renderCurrentView();
        } catch (error) {
            console.error('[DEBUG] Error loading data:', error);
            alert('Could not load data from the server.');
        }
    };

    /**
     * Switches between the different application views (Cards, Table, Mindmap).
     * @param {string} viewName - The name of the view to switch to.
     */
    const switchView = (viewName) => {
        console.log(`[DEBUG] Switching to view: ${viewName}`);
        activeView = viewName;
        Object.values(views).forEach(view => view.style.display = 'none');
        Object.values(viewButtons).forEach(btn => btn.classList.remove('active'));
        
        views[viewName].style.display = 'block';
        viewButtons[viewName].classList.add('active');
        renderCurrentView();
    };

    /**
     * Calls the appropriate render function based on the currently active view.
     */
    const renderCurrentView = () => {
        console.log(`[DEBUG] Rendering current view: ${activeView}`);
        // We pass the core functions to the views so they can trigger actions
        const viewDependencies = { data, renderCurrentView: loadData, openNewEntityModal, openEntity, highlightEntity };
        if (activeView === 'cards') {
            window.renderCards(viewDependencies);
        } else if (activeView === 'table') {
            window.renderTable(viewDependencies);
        } else if (activeView === 'mindmap') {
            window.renderMindmap(viewDependencies);
        }
    };

    /**
     * Scrolls to a specific entity card and highlights it.
     * @param {string} entityId - The ID of the entity to focus on.
     */
    const openEntity = (entityId) => {
        if (activeView !== 'cards') {
            switchView('cards');
        }
        // Use a short timeout to ensure the view has switched before scrolling
        setTimeout(() => {
            const entityCard = document.querySelector(`.card[data-id="${entityId}"]`);
            if (entityCard) {
                entityCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                highlightEntity(entityId);
            }
        }, 100);
    };

    /**
     * Temporarily adds a 'highlight' class to an entity card.
     * @param {string} entityId - The ID of the entity to highlight.
     */
    const highlightEntity = (entityId) => {
        const entityCard = document.querySelector(`.card[data-id="${entityId}"]`);
        if (entityCard) {
            entityCard.classList.add('highlight');
            setTimeout(() => {
                entityCard.classList.remove('highlight');
            }, 2000);
        }
    };

    // --- Configuration Modal (Types & Attributes) ---

    /**
     * Renders the list of types and their attributes in the config modal.
     */
    const renderTypeManagement = () => {
        console.log('[DEBUG] renderTypeManagement called. Current data.types:', data.types);
        
        if (!typeManagementContainer) {
            console.error('[DEBUG] typeManagementContainer NOT FOUND in DOM!');
            return;
        }

        typeManagementContainer.innerHTML = '';
        console.log(`[DEBUG] Cleared typeManagementContainer. Starting loop over ${data.types.length} types.`);

        data.types.forEach((type, index) => {
            console.log(`[DEBUG] Rendering type ${index + 1}/${data.types.length}:`, type);
            const typeElement = document.createElement('div');
            typeElement.classList.add('type-item');
            typeElement.setAttribute('data-id', type.id);
            typeElement.innerHTML = `
                <div class="type-header">
                    <h3 class="type-name-display"></h3>
                    <div>
                        <button class="edit-type-btn">Name bearbeiten</button>
                        <button class="delete-type-btn">Typ löschen</button>
                    </div>
                </div>
                <div class="attributes-list"></div>
                <div class="add-attribute-form-container" style="display:none;"></div>
                <button class="add-attribute-btn">Neues Attribut</button>
            `;
            // Use textContent to prevent HTML injection issues with type names
            typeElement.querySelector('.type-name-display').textContent = type.name;

            typeManagementContainer.appendChild(typeElement);
            console.log(`[DEBUG] Appended typeElement for ID: ${type.id} to container.`);
            renderAttributesList(type.id);
        });
        
        console.log('[DEBUG] renderTypeManagement loop finished.');
    };

    /**
     * Renders the attributes for a single type.
     * @param {string} typeId - The ID of the type whose attributes should be rendered.
     */
    const renderAttributesList = (typeId) => {
        console.log(`[DEBUG] renderAttributesList called for typeId: ${typeId}`);
        const type = data.types.find(t => t.id === typeId);
        if (!type) {
             console.warn(`[DEBUG] Type with ID ${typeId} not found in data.types.`);
             return;
        }

        // Find the correct type element and then the attributes list inside it
        const typeElement = typeManagementContainer.querySelector(`.type-item[data-id="${typeId}"]`);
        if (!typeElement) {
            console.error(`[DEBUG] Could find .type-item[data-id="${typeId}"] in DOM.`);
            return;
        }
        const attributesList = typeElement.querySelector('.attributes-list');
        if (!attributesList) {
            console.error(`[DEBUG] Could find .attributes-list within type element for ID ${typeId}.`);
            return;
        }
        
        attributesList.innerHTML = ''; // Clear previous list

        type.attributes.forEach((attr, index) => {
            const attrElement = document.createElement('div');
            attrElement.classList.add('attribute-item');
            attrElement.dataset.index = index;
            attrElement.innerHTML = `
                <div class="drag-handle" style="cursor: grab; margin-right: 10px;">☰</div>
                <span style="flex-grow: 1;"></span>
                <div>
                  <button class="edit-attribute-btn" data-index="${index}">Bearbeiten</button>
                  <button class="delete-attribute-btn" data-index="${index}">Löschen</button>
                </div>
            `;
            
            let typeDisplay = attr.type;
            if (attr.type === 'Link') {
                const linkedType = data.types.find(t => t.id === attr.linkedTypeId);
                typeDisplay += ` (${linkedType ? linkedType.name : 'Any Type'})`;
            }
            attrElement.querySelector('span').textContent = `${attr.name} (${typeDisplay})`;
            
            attributesList.appendChild(attrElement);
        });
        
        // Initialize SortableJS for drag-and-drop
        if (window.Sortable) {
            Sortable.create(attributesList, {
                animation: 150,
                handle: '.drag-handle', // Restrict drag to the handle
                onEnd: async (evt) => {
                    const [removed] = type.attributes.splice(evt.oldIndex, 1);
                    type.attributes.splice(evt.newIndex, 0, removed);
                    await updateTypeOnServer(typeId);
                    renderAttributesList(typeId); // Re-render to ensure DOM is correct
                }
            });
        }
    };
    
    /**
     * Shows the form for adding a new attribute to a type.
     * @param {string} typeId - The ID of the type to add an attribute to.
     * @param {HTMLElement} addButton - The "Add Attribute" button that was clicked.
     */
    function showAddAttributeForm(typeId, addButton) {
        const typeItem = typeManagementContainer.querySelector(`.type-item[data-id="${typeId}"]`);
        if (!typeItem) return;
        const formContainer = typeItem.querySelector('.add-attribute-form-container');
        if (!formContainer) return;

        formContainer.style.display = 'block';
        if(addButton) addButton.style.display = 'none';

        const linkTypeOptions = '<option value="">Jeder Typ</option>' + data.types.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

        formContainer.innerHTML = `
            <input type="text" class="new-attr-name" placeholder="Attribute Name" style="margin-bottom: 5px;">
            <select class="new-attr-type" style="margin-bottom: 5px;">
                <option>Text</option>
                <option>Ganzzahl</option>
                <option>Dezimalzahl</option>
                <option>Link</option>
            </select>
            <div class="link-type-select-container" style="display:none; margin-bottom: 5px;">
                <label>Zieltyp:</label>
                <select class="new-attr-link-type">
                    ${linkTypeOptions}
                </select>
            </div>
            <button class="save-attribute-btn">Speichern</button>
            <button class="cancel-attribute-btn">Abbrechen</button>
        `;

        formContainer.querySelector('.new-attr-type').addEventListener('change', e => {
            const linkTypeContainer = formContainer.querySelector('.link-type-select-container');
            linkTypeContainer.style.display = e.target.value === 'Link' ? 'block' : 'none';
        });
    }

    /**
     * Persists a type object to the server.
     * @param {string} typeId - The ID of the type to update.
     */
    async function updateTypeOnServer(typeId) {
        const type = data.types.find(t => t.id === typeId);
        if (type) {
            await fetch(`/api/types/${typeId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(type)
            });
        }
    }

    // --- Event Listeners ---
    
    // View switching
    Object.keys(viewButtons).forEach(key => {
        if (viewButtons[key]) {
            viewButtons[key].addEventListener('click', () => switchView(key));
        }
    });

    // Configuration Modal
    if (configBtn) {
        configBtn.addEventListener('click', () => {
            console.log('[DEBUG] Configuration button clicked.');
            configModal.style.display = 'block';
            renderTypeManagement();
        });
    }
    
    if (closeConfigBtn) {
        closeConfigBtn.addEventListener('click', () => configModal.style.display = 'none');
    }

    // "New Type" button actions
    if (newTypeBtn) {
        newTypeBtn.addEventListener('click', () => {
            newTypeFormContainer.style.display = 'block';
            newTypeBtn.style.display = 'none';
        });
    }
    
    if (cancelNewTypeBtn) {
        cancelNewTypeBtn.addEventListener('click', () => {
            newTypeFormContainer.style.display = 'none';
            newTypeBtn.style.display = 'block';
            newTypeNameInput.value = '';
        });
    }
    
    if (saveNewTypeBtn) {
        saveNewTypeBtn.addEventListener('click', async () => {
            const typeName = newTypeNameInput.value.trim();
            if (typeName) {
                const newType = { name: typeName, attributes: [] };
                const response = await fetch('/api/types', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newType)
                });
                const result = await response.json();
                data.types.push(result.type);
                renderTypeManagement();
                newTypeNameInput.value = '';
                newTypeFormContainer.style.display = 'none';
                newTypeBtn.style.display = 'block';
            }
        });
    }

    // Event Delegation for all actions inside the Type Management container
    if (typeManagementContainer) {
        typeManagementContainer.addEventListener('click', async (event) => {
            const target = event.target;
            const typeItem = target.closest('.type-item');
            if (!typeItem) return;
            const typeId = typeItem.getAttribute('data-id');
            const type = data.types.find(t => t.id === typeId);

            // --- Add Attribute ---
            if (target.classList.contains('add-attribute-btn')) {
                showAddAttributeForm(typeId, target);
            }
            // --- Cancel Add Attribute ---
            else if (target.classList.contains('cancel-attribute-btn')) {
                const formContainer = target.closest('.add-attribute-form-container');
                formContainer.style.display = 'none';
                formContainer.innerHTML = '';
                typeItem.querySelector('.add-attribute-btn').style.display = 'block';
            }
            // --- Save New Attribute ---
            else if (target.classList.contains('save-attribute-btn')) {
                const formContainer = target.closest('.add-attribute-form-container');
                const name = formContainer.querySelector('.new-attr-name').value.trim();
                const attrType = formContainer.querySelector('.new-attr-type').value;

                if (!name) {
                    alert('Attribute name cannot be empty.');
                    return;
                }

                const newAttr = { name, type: attrType };
                if (attrType === 'Link') {
                    newAttr.linkedTypeId = formContainer.querySelector('.new-attr-link-type').value;
                }

                type.attributes.push(newAttr);
                await updateTypeOnServer(typeId);
                renderAttributesList(typeId);
                
                formContainer.style.display = 'none';
                formContainer.innerHTML = '';
                typeItem.querySelector('.add-attribute-btn').style.display = 'block';
                renderCurrentView(); // Update views in case attributes changed
            }
            // --- Delete Attribute ---
            else if (target.classList.contains('delete-attribute-btn')) {
                const attrIndex = parseInt(target.dataset.index, 10);
                if (confirm('Are you sure you want to delete this attribute?')) {
                    type.attributes.splice(attrIndex, 1);
                    await updateTypeOnServer(typeId);
                    renderAttributesList(typeId);
                    renderCurrentView();
                }
            }
            // --- Edit Attribute ---
            else if (target.classList.contains('edit-attribute-btn')) {
                const attrIndex = parseInt(target.dataset.index, 10);
                const attr = type.attributes[attrIndex];
                const newName = prompt('Enter new attribute name:', attr.name);
                
                if (newName && newName.trim() !== '' && newName !== attr.name) {
                    // Update attribute name in type definition
                    const oldName = attr.name;
                    attr.name = newName.trim();

                    // Rename attribute in all entities of this type
                    const entitiesToUpdate = data.entities.filter(e => e.typeId === typeId);
                    for (const entity of entitiesToUpdate) {
                        if (entity.attributes.hasOwnProperty(oldName)) {
                            entity.attributes[attr.name] = entity.attributes[oldName];
                            delete entity.attributes[oldName];
                            
                            // Update entity on server
                            await fetch(`/api/entities/${entity.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(entity)
                            });
                        }
                    }

                    await updateTypeOnServer(typeId);
                    renderAttributesList(typeId);
                    renderCurrentView();
                }
            }
            // --- Edit Type Name ---
            else if (target.classList.contains('edit-type-btn')) {
                const newName = prompt('Enter the new name for the type:', type.name);
                if (newName && newName.trim() !== type.name) {
                    type.name = newName.trim();
                    await updateTypeOnServer(typeId);
                    renderTypeManagement(); // Re-render all types as name has changed
                    renderCurrentView();
                }
            }
            // --- Delete Type ---
            else if (target.classList.contains('delete-type-btn')) {
                if (confirm(`Are you sure you want to delete the type "${type.name}"? This will also delete all entities of this type.`)) {
                    // Delete all entities of this type first
                    data.entities = data.entities.filter(e => e.typeId !== typeId);
                    
                    // Then delete the type itself
                    data.types = data.types.filter(t => t.id !== typeId);
                    
                    // Push the entire updated data object to the server
                    await fetch('/api/data', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });

                    renderTypeManagement();
                    renderCurrentView();
                }
            }
        });
    }

    // --- New/Edit Entity Modal ---
    if (newEntityBtn) {
        newEntityBtn.addEventListener('click', () => openNewEntityModal());
    }
    
    if (closeNewEntityBtn) {
        closeNewEntityBtn.addEventListener('click', () => newEntityModal.style.display = 'none');
    }
    
    const openNewEntityModal = (entityId = null) => {
        editingEntityId = entityId;
        newEntityModal.style.display = 'block';
        const entity = editingEntityId ? data.entities.find(e => e.id === editingEntityId) : null;
        newEntityModalTitle.textContent = editingEntityId ? 'Edit Entity' : 'Create New Entity';
        
        const typeId = entity ? entity.typeId : (data.types[0]?.id || null);
        renderNewEntityForm(typeId, entity);
    };

    const renderNewEntityForm = (typeId, entity = null) => {
        newEntityForm.innerHTML = ''; // Clear form
        if (data.types.length === 0) {
            newEntityForm.innerHTML = '<p>Please create a type in the configuration menu first.</p>';
            return;
        }

        const type = data.types.find(t => t.id === typeId);
        
        let attributesHTML = '';
        if (type) {
            type.attributes.forEach(attr => {
                const value = entity?.attributes[attr.name] || '';
                let fieldHTML = '';
                if (attr.type === 'Link') {
                    const linkedEntities = data.entities.filter(e => !attr.linkedTypeId || e.typeId === attr.linkedTypeId);
                    const options = linkedEntities
                        .map(e => {
                            const linkedType = data.types.find(t => t.id === e.typeId);
                            const typeName = linkedType ? linkedType.name : 'Unknown';
                            return `<option value="${e.id}" ${e.id === value ? 'selected' : ''}>${typeName}: ${e.name}</option>`;
                        })
                        .join('');
                    fieldHTML = `
                        <label for="attr-${attr.name}">${attr.name}:</label>
                        <select id="attr-${attr.name}" name="${attr.name}">
                            <option value="">None</option>
                            ${options}
                        </select>
                    `;
                } else if (attr.type === 'Ganzzahl') {
                    fieldHTML = `
                        <label for="attr-${attr.name}">${attr.name}:</label>
                        <input type="number" step="1" id="attr-${attr.name}" name="${attr.name}" value="${value}">
                    `;
                } else if (attr.type === 'Dezimalzahl') {
                    fieldHTML = `
                        <label for="attr-${attr.name}">${attr.name}:</label>
                        <input type="number" step="any" id="attr-${attr.name}" name="${attr.name}" value="${value}">
                    `;
                } else {
                     fieldHTML = `
                        <label for="attr-${attr.name}">${attr.name}:</label>
                        <input type="text" id="attr-${attr.name}" name="${attr.name}" value="${value}">
                    `;
                }
                attributesHTML += `<div class="form-field">${fieldHTML}</div>`;
            });
        }

        newEntityForm.innerHTML = `
            <label for="entity-name">Name:</label>
            <input type="text" id="entity-name" name="name" value="${entity ? entity.name : ''}" required>
            
            <label for="entity-type">Type:</label>
            <select id="entity-type" name="typeId">
                ${data.types.map(t => `<option value="${t.id}" ${t.id === typeId ? 'selected' : ''}>${t.name}</option>`).join('')}
            </select>
            
            <h3>Attributes</h3>
            <div class="attributes-form-fields">${attributesHTML}</div>
            
            <button type="submit">${editingEntityId ? 'Update' : 'Create'} Entity</button>
        `;

        newEntityForm.querySelector('#entity-type').addEventListener('change', (e) => {
            renderNewEntityForm(e.target.value, entity);
        });
    };

    if (newEntityForm) {
        newEntityForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(newEntityForm);
            const typeId = formData.get('typeId');
            const type = data.types.find(t => t.id === typeId);
            const attributes = {};
            if (type) {
                type.attributes.forEach(attr => {
                    const value = formData.get(attr.name);
                    
                    // Simple Validation
                    if (attr.type === 'Ganzzahl') {
                        if (value !== '' && !Number.isInteger(Number(value))) {
                            alert(`${attr.name} must be a whole number.`);
                            throw new Error('Validation failed');
                        }
                    } else if (attr.type === 'Dezimalzahl') {
                        if (value !== '' && isNaN(Number(value))) {
                            alert(`${attr.name} must be a number.`);
                            throw new Error('Validation failed');
                        }
                    }

                    attributes[attr.name] = value || '';
                });
            }
            const entityData = {
                name: formData.get('name'),
                typeId: typeId,
                attributes: attributes
            };

            if (editingEntityId) {
                const response = await fetch(`/api/entities/${editingEntityId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(entityData)
                });
            } else {
                const response = await fetch('/api/entities', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(entityData)
                });
            }
            
            newEntityModal.style.display = 'none';
            await loadData(); // Reload all data to ensure consistency
        });
    }

    // --- JSON Import/Export ---
    if (jsonExportBtn) {
        jsonExportBtn.addEventListener('click', () => {
            const dataStr = JSON.stringify(data, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'data.json';
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    if (jsonImportBtn) {
        jsonImportBtn.addEventListener('click', () => jsonImportInput.click());
    }

    if (jsonImportInput) {
        jsonImportInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    if (!importedData.types || !importedData.entities) {
                        throw new Error('Invalid data structure.');
                    }
                    await fetch('/api/data', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(importedData)
                    });
                    data = importedData;
                    renderTypeManagement();
                    renderCurrentView();
                    configModal.style.display = 'none';
                } catch (error) {
                    console.error('Error importing JSON:', error);
                    alert('Invalid JSON file. Please ensure it has the correct structure.');
                }
            };
            reader.readAsText(file);
        });
    }

    // --- Initial Load ---
    switchView('cards'); // Set initial view
    loadData();
});
