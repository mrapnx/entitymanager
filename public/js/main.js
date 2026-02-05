document.addEventListener('DOMContentLoaded', () => {
    const views = {
        cards: document.getElementById('cards-view'),
        table: document.getElementById('table-view'),
        mindmap: document.getElementById('mindmap-view'),
    };

    const buttons = {
        cards: document.getElementById('cards-view-btn'),
        table: document.getElementById('table-view-btn'),
        mindmap: document.getElementById('mindmap-view-btn'),
    };

    const switchView = (viewName) => {
        for (const view in views) {
            views[view].classList.remove('active');
            buttons[view].classList.remove('active');
        }
        views[viewName].classList.add('active');
        buttons[viewName].classList.add('active');
        loadData(viewName);
    };

    buttons.cards.addEventListener('click', () => switchView('cards'));
    buttons.table.addEventListener('click', () => switchView('table'));
    buttons.mindmap.addEventListener('click', () => switchView('mindmap'));

    const loadData = async (viewName) => {
        try {
            const response = await fetch('/api/data');
            const data = await response.json();
            if (viewName === 'cards') {
                window.renderCards(data);
            } else if (viewName === 'table') {
                window.renderTable(data);
            } else if (viewName === 'mindmap') {
                window.renderMindmap(data);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    };

    // Initial load
    switchView('cards');
});
