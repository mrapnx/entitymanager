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
            const response = await fetch('/api/data');
            if (!response.ok) throw new Error('Failed to load data.');
            data = await response.json();
            renderCurrentView();
        } catch (error) {
            console.error('Error loading data:', error);
            alert('Could not load data from the server.');
        }
    };

    /**
     * Switches between the different application views (Cards, Table, Mindmap).
     * @param {string} viewName - The name of the view to switch to.
     */
    const switchView = (viewName) => {
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
        // We pass the core functions to the views so they can trigger actions
        const viewDependencies = { data, renderCurrentView, openNewEntityModal, openEntity, highlightEntity };
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
        typeManagementContainer.innerHTML = '';
        data.types.forEach(type => {
            const typeElement = document.createElement('div');
            typeElement.classList.add('type-item');
            typeElement.dataset.id = type.id;
            typeElement.innerHTML = `
                <div class="type-header">
                    <h3></h3>
                    <div>
                        <button class="edit-type-btn">Edit Name</button>
                        <button class="delete-type-btn">Delete Type</button>
                    </div>
                </div>
                <div class="attributes-list"></div>
                <div class="add-attribute-form-container" style="display:none;"></div>
                <button class="add-attribute-btn">Add Attribute</button>
            `;
            // Use textContent to prevent HTML injection issues with type names
            typeElement.querySelector('h3').textContent = type.name;

            typeManagementContainer.appendChild(typeElement);
            renderAttributesList(type.id);
        });
    };

    /**
     * Renders the attributes for a single type.
     * @param {string} typeId - The ID of the type whose attributes should be rendered.
     */
    const renderAttributesList = (typeId) => {
        const type = data.types.find(t => t.id === typeId);
        if (!type) return;

        const attributesList = typeManagementContainer.querySelector(`.type-item[data-id="${typeId}"] .attributes-list`);
        attributesList.innerHTML = ''; // Clear previous list

        type.attributes.forEach((attr, index) => {
            const attrElement = document.createElement('div');
            attrElement.classList.add('attribute-item');
            attrElement.dataset.index = index;
            attrElement.innerHTML = `
                <span></span>
                <button class="delete-attribute-btn" data-index="${index}">Delete</button>
            `;
            attrElement.querySelector('span').textContent = `${attr.name} (${attr.type})`;
            attributesList.appendChild(attrElement);
        });
        
        // Initialize SortableJS for drag-and-drop
        Sortable.create(attributesList, {
            animation: 150,
            onEnd: async (evt) => {
                const [removed] = type.attributes.splice(evt.oldIndex, 1);
                type.attributes.splice(evt.newIndex, 0, removed);
                await updateTypeOnServer(typeId);
                renderAttributesList(typeId); // Re-render to ensure DOM is correct
            }
        });
    };
    
    /**
     * Shows the form for adding a new attribute to a type.
     * @param {string} typeId - The ID of the type to add an attribute to.
     * @param {HTMLElement} addButton - The "Add Attribute" button that was clicked.
     */
    function showAddAttributeForm(typeId, addButton) {
        const formContainer = document.querySelector(`.type-item[data-id="${typeId}"] .add-attribute-form-container`);
        if (!formContainer) return;

        formContainer.style.display = 'block';
        if(addButton) addButton.style.display = 'none';

        const linkTypeOptions = data.types.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

        formContainer.innerHTML = `
            <input type="text" class="new-attr-name" placeholder="Attribute Name" style="margin-bottom: 5px;">
            <select class="new-attr-type" style="margin-bottom: 5px;">
                <option>Text</option>
                <option>Ganzzahl</option>
                <option>Dezimalzahl</option>
                <option>Link</option>
            </select>
            <select class="new-attr-link-type" style="display:none; margin-bottom: 5px;">
                ${linkTypeOptions}
            </select>
            <button class="save-attribute-btn">Save</button>
            <button class="cancel-attribute-btn">Cancel</button>
        `;

        formContainer.querySelector('.new-attr-type').addEventListener('change', e => {
            const linkTypeSelect = formContainer.querySelector('.new-attr-link-type');
            linkTypeSelect.style.display = e.target.value === 'Link' ? 'block' : 'none';
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
        viewButtons[key].addEventListener('click', () => switchView(key));
    });

    // Configuration Modal
    configBtn.addEventListener('click', () => {
        configModal.style.display = 'block';
        renderTypeManagement();
    });
    closeConfigBtn.addEventListener('click', () => configModal.style.display = 'none');

    // "New Type" button actions
    newTypeBtn.addEventListener('click', () => {
        newTypeFormContainer.style.display = 'block';
        newTypeBtn.style.display = 'none';
    });
    cancelNewTypeBtn.addEventListener('click', () => {
        newTypeFormContainer.style.display = 'none';
        newTypeBtn.style.display = 'block';
        newTypeNameInput.value = '';
    });
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

    // Event Delegation for all actions inside the Type Management container
    typeManagementContainer.addEventListener('click', async (event) => {
        const target = event.target;
        const typeItem = target.closest('.type-item');
        if (!typeItem) return;
        const typeId = typeItem.dataset.id;
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

    // --- New/Edit Entity Modal ---
    newEntityBtn.addEventListener('click', () => openNewEntityModal());
    closeNewEntityBtn.addEventListener('click', () => newEntityModal.style.display = 'none');
    
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

    newEntityForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(newEntityForm);
        const typeId = formData.get('typeId');
        const type = data.types.find(t => t.id === typeId);
        const attributes = {};
        if (type) {
            type.attributes.forEach(attr => {
                attributes[attr.name] = formData.get(attr.name) || '';
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

    // --- JSON Import/Export ---
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

    jsonImportBtn.addEventListener('click', () => jsonImportInput.click());

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

    // --- Initial Load ---
    switchView('cards'); // Set initial view
    loadData();
});
