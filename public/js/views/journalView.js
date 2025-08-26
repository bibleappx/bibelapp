import * as state from '../state.js';
import * as utils from '../utils.js';
import { getProcessedEntry } from '../services/contentProcessor.js';
import { initializeMarkdownEditor } from '../ui/editor.js';
import { createPagination, createFilterPillsHTML, renderTagsHTML } from '../ui/components.js';

const appContainer = document.getElementById('app-container');

export function renderJournalOverviewPage() {
    let journalListHTML = Object.keys(state.journals).sort((a, b) => a.localeCompare(b)).map(name => {
        const entryCount = state.journals[name]?.length ?? 0;
        const entryLabel = entryCount === 1 ? 'Eintrag' : 'Einträge';
        return `<a href="/journal/view/${encodeURIComponent(name)}" data-link class="list-group-item"><span class="flex-grow-1">${name}</span><div class="d-flex align-items-center gap-3"><span class="badge">${entryCount} ${entryLabel}</span><button class="btn-icon delete-journal-btn" data-name="${name}" title="Journal löschen"><i class="fa-solid fa-trash"></i></button></div></a>`;
    }).join('');
    appContainer.innerHTML = `<h1 class="view-title">Meine Journale</h1><div class="card mb-4"><div class="card-header">Neues Journal erstellen</div><div class="card-body"><div class="input-group"><input type="text" id="new-journal-name" placeholder="Name des Journals"><button id="create-journal-btn" class="btn btn-primary"><i class="fa-solid fa-plus"></i> Erstellen</button></div></div></div><div class="list-group">${journalListHTML || '<div class="card card-body text-tertiary">Keine Journale erstellt.</div>'}</div>`;
};

function setupEditorStats(editorContainerSelector) {
    const container = document.querySelector(editorContainerSelector);
    if (!container) return;
    const textarea = container.querySelector('textarea');
    const statsDiv = container.querySelector('.editor-stats');
    if (!textarea || !statsDiv) return;

    const updateStats = () => {
        const text = textarea.value;
        const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
        const charCount = text.length;
        statsDiv.textContent = `Wörter: ${wordCount} | Zeichen: ${charCount}`;
    };

    textarea.addEventListener('input', updateStats);
    updateStats();
}

export function renderJournalView(config) {
    const params = new URLSearchParams(window.location.search);
    const searchTerm = params.get('q') || '';
    const sortBy = params.get('sort') || 'newest';
    const activeLetter = params.get('letter') || 'all';
    const activeContentFilter = params.get('filter') || 'all';
    const currentPage = parseInt(params.get('page') || '1', 10);
    
    let title, entries, backLink, journalType, journalKey, detailPath;
    
    if (config.type === 'user') {
        const journalKeyFromUrl = config.journalName;
        const allUserJournals = state.journals;
        const actualKey = Object.keys(allUserJournals).find(key => key.toLowerCase() === journalKeyFromUrl.toLowerCase());
        
        title = `Journal: ${actualKey || config.journalName}`;
        entries = actualKey ? allUserJournals[actualKey] : [];
        
        backLink = '/journals';
        journalKey = actualKey || journalKeyFromUrl;
        detailPath = `/journal/view/${encodeURIComponent(journalKey)}/entry`;
        journalType = 'user';
    } else {
        if (config.type === 'book') {
            const book = utils.getBook(parseInt(config.key));
            title = `Buch-Journal: ${book.long_name}`;
            entries = state.booknotes[config.key] || [];
            journalKey = config.key;
            detailPath = `/journal/book/${journalKey}/entry`;
        } else {
            const [b, c] = config.key.split('-');
            const book = utils.getBook(parseInt(b));
            title = `Kapitel-Journal: ${book.long_name} ${c}`;
            entries = state.chapternotes[config.key] || [];
            journalKey = config.key;
            detailPath = `/journal/chapter/${journalKey}/entry`;
        }
        journalType = config.type;
    }
    
    const displayEntries = () => {
        const currentParams = new URLSearchParams(window.location.search);
        const currentSearch = currentParams.get('q') || '';
        const currentSort = currentParams.get('sort') || 'newest';
        const currentLetter = currentParams.get('letter') || 'all';
        const currentFilter = currentParams.get('filter') || 'all';
        const page = parseInt(currentParams.get('page') || '1', 10);
        
        let processedEntries = entries.filter(e => {
            const processed = getProcessedEntry(e);
            const plainText = processed.plainTextContent.toLowerCase();
            const plainTitle = (e.title || '').toLowerCase();
            const searchMatch = currentSearch === '' || plainTitle.includes(currentSearch) || plainText.includes(currentSearch) || processed.tags?.some(t => t.toLowerCase().includes(currentSearch));
            const letterMatch = currentLetter === 'all' || plainTitle.startsWith(currentLetter.toLowerCase());
            let contentMatch = currentFilter === 'all';
            if (!contentMatch) {
                switch (currentFilter) {
                    case 'crossref': contentMatch = processed.flags?.hasCrossReference; break;
                    case 'youtube': contentMatch = processed.flags?.hasYoutube; break;
                    case 'audio': contentMatch = processed.flags?.hasAudio; break;
                    case 'video': contentMatch = processed.flags?.hasVideo; break;
                    case 'resource': contentMatch = processed.resources?.length > 0; break;
                }
            }
            return searchMatch && letterMatch && contentMatch;
        });

        processedEntries.sort((a, b) => {
            switch (currentSort) {
                case 'newest': return new Date(b.timestamp) - new Date(a.timestamp);
                case 'oldest': return new Date(a.timestamp) - new Date(b.timestamp);
                case 'az': return (a.title || '').localeCompare(b.title || '');
                case 'za': return (b.title || '').localeCompare(a.title || '');
                default: return 0;
            }
        });
        
        const itemsPerPage = 10;
        const totalPages = Math.ceil(processedEntries.length / itemsPerPage);
        const paginatedEntries = processedEntries.slice((page - 1) * itemsPerPage, page * itemsPerPage);
        const entriesHTML = paginatedEntries.map(entry => {
            const processed = getProcessedEntry(entry);
            const snippet = (processed.plainTextContent || '').substring(0, 150).trim() + '...';
            const indicators = [];
            if (processed.flags?.hasCrossReference) indicators.push('<i class="fa-solid fa-link" title="Hat Querverweise"></i>');
            if (processed.flags?.hasYoutube) indicators.push('<i class="fa-brands fa-youtube" title="Hat YouTube-Videos"></i>');
            if (processed.flags?.hasAudio) indicators.push('<i class="fa-solid fa-file-audio" title="Hat Audio-Dateien"></i>');
            if (processed.flags?.hasVideo) indicators.push('<i class="fa-solid fa-file-video" title="Hat Video-Dateien"></i>');
            if (processed.resources?.length > 0) indicators.push('<i class="fa-solid fa-paperclip" title="Hat Ressourcen"></i>');
            const deleteButtonHTML = `<button class="btn-icon delete-entry-btn" data-id="${entry.id}" data-journal-type="${journalType}" data-journal-key="${journalKey}" data-back-link="${window.location.pathname}" title="Löschen"><i class="fa-solid fa-trash"></i></button>`;
            const editLink = `${detailPath}/${entry.id}/edit`;
            return `
            <div class="list-group-item">
                <a href="${detailPath}/${entry.id}" data-link class="flex-grow-1 d-flex flex-column" style="min-width: 0;">
                    <span class="search-result-ref">${entry.title || 'Ohne Titel'}</span>
                    <span class="search-result-snippet">${snippet}</span>
                </a>
                <div class="d-flex align-items-center gap-2 flex-shrink-0 ms-auto">
                    <span class="entry-indicators">${indicators.join('')}</span>
                    <div class="list-item-actions">
                        <a href="${editLink}" data-link class="btn-icon" title="Bearbeiten"><i class="fa-solid fa-pencil"></i></a>
                        ${deleteButtonHTML}
                    </div>
                </div>
            </div>`;
        }).join('');
        document.getElementById('journal-entries-list').innerHTML = entriesHTML || '<p class="text-tertiary p-3">Keine Einträge für diese Auswahl gefunden.</p>';
        document.getElementById('pagination-container').innerHTML = createPagination(page, totalPages, new URL(window.location));
    };

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const alphaButtonsHTML = alphabet.map(letter => `<button class="btn ${activeLetter === letter.toLowerCase() ? 'btn-primary' : 'btn-outline-secondary'} btn-sm" data-letter="${letter}">${letter}</button>`).join('');
    const contentFilters = [
        { filter: 'all', icon: 'fa-solid fa-list-ul', title: 'Alle Inhalte' },
        { filter: 'crossref', icon: 'fa-solid fa-link', title: 'Nur mit Querverweisen' },
        { filter: 'youtube', icon: 'fa-brands fa-youtube', title: 'Nur mit YouTube' },
        { filter: 'audio', icon: 'fa-solid fa-file-audio', title: 'Nur mit Audio' },
        { filter: 'video', icon: 'fa-solid fa-file-video', title: 'Nur mit Video' },
        { filter: 'resource', icon: 'fa-solid fa-paperclip', title: 'Nur mit Ressourcen' }
    ];
    const contentFilterPillsHTML = createFilterPillsHTML(contentFilters, activeContentFilter);
    appContainer.innerHTML = `
    <h1 class="view-title">${title}</h1>
    ${backLink ? `<a href="${backLink}" data-link class="btn btn-secondary btn-sm mb-4"><i class="fa-solid fa-arrow-left"></i> Zurück zur Übersicht</a>` : ''}
    <div class="card mb-4">
        <div class="card-body">
            <div class="d-flex flex-wrap gap-3 align-items-center mb-3">
                <div class="flex-grow-1">
                    <input type="search" id="journal-filter-input" placeholder="Einträge durchsuchen..." value="${searchTerm}">
                </div>
                <div style="min-width: 200px; flex-shrink: 0;">
                    <select id="journal-sort-select" class="form-select">
                        <option value="newest">Neueste zuerst</option>
                        <option value="oldest">Älteste zuerst</option>
                        <option value="az">Titel (A-Z)</option>
                        <option value="za">Titel (Z-A)</option>
                    </select>
                </div>
            </div>
            <div class="d-flex flex-wrap gap-2 align-items-center">
                <div id="journal-content-filters" class="filter-pills d-flex flex-wrap gap-2">${contentFilterPillsHTML}</div>
                <div class="vr"></div>
                <div id="journal-alpha-filter" class="d-flex flex-wrap gap-2">
                    <button class="btn ${activeLetter === 'all' ? 'btn-primary' : 'btn-outline-secondary'} btn-sm" data-letter="all">Alle</button>
                    ${alphaButtonsHTML}
                </div>
            </div>
        </div>
    </div>
    <div id="journal-entries-list" class="list-group"></div>
    <div id="pagination-container" class="mt-4"></div>
    <div class="accordion mt-4"><div class="card"><button class="accordion-button" id="add-entry-btn-toggle"><i class="fa-solid fa-plus"></i> Neuen Eintrag hinzufügen</button><div class="accordion-content" id="add-entry-content" style="display: none;"><input type="text" id="new-entry-title" placeholder="Titel des Eintrags" class="mb-3"><div id="editor-container"></div><div id="editor-stats" class="editor-stats"></div><input type="text" id="new-entry-tags" placeholder="Tags, durch Komma getrennt" class="mt-3"><button id="save-entry-btn" class="btn btn-primary" style="margin-top: 1rem;" data-journal-type="${journalType}" data-journal-key="${journalKey}"><i class="fa-solid fa-save"></i> Speichern</button></div></div></div>`;
    
    document.getElementById('journal-sort-select').value = sortBy;

    const updateUrlAndRender = (newParams) => {
        const currentParams = new URLSearchParams(window.location.search);
        Object.entries(newParams).forEach(([key, value]) => {
            if (value && value !== 'all') {
                currentParams.set(key, value);
            } else {
                currentParams.delete(key);
            }
        });
        if (Object.keys(newParams).some(k => k !== 'page')) {
            currentParams.set('page', '1');
        }
        const newPath = `${window.location.pathname}?${currentParams.toString()}`;
        history.pushState({ path: newPath }, '', newPath);
        router();
    };
    
    document.getElementById('journal-filter-input').addEventListener('input', utils.debounce(e => updateUrlAndRender({ q: e.target.value }), 300));
    document.getElementById('journal-sort-select').addEventListener('change', e => updateUrlAndRender({ sort: e.target.value }));
    document.getElementById('journal-alpha-filter').addEventListener('click', e => {
        const button = e.target.closest('button[data-letter]');
        if (button) updateUrlAndRender({ letter: button.dataset.letter.toLowerCase() });
    });
    document.getElementById('journal-content-filters').addEventListener('click', e => {
        const button = e.target.closest('button[data-filter]');
        if (button) updateUrlAndRender({ filter: button.dataset.filter });
    });
    document.getElementById('add-entry-btn-toggle').addEventListener('click', (e) => {
        const div = document.getElementById('add-entry-content');
        const isHidden = div.style.display === 'none';
        div.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
            initializeMarkdownEditor('#editor-container');
            setupEditorStats('#add-entry-content');
        }
        e.currentTarget.classList.toggle('expanded', isHidden);
    });
    displayEntries();
};

function findJournalSource(config) {
    if (config.type === 'user') {
        const journalKeyFromUrl = config.key;
        if (!journalKeyFromUrl || !state.journals) return { source: [], actualKey: journalKeyFromUrl };
        
        const actualKey = Object.keys(state.journals).find(key => key.toLowerCase() === journalKeyFromUrl.toLowerCase());
        return { source: actualKey ? state.journals[actualKey] : [], actualKey: actualKey || journalKeyFromUrl };
    }
    const sourceMap = { 'book': state.booknotes, 'chapter': state.chapternotes };
    return { source: sourceMap[config.type]?.[config.key] || [], actualKey: config.key };
}

function renderMoreEntriesSection(currentEntry) {
    const allEntries = Object.values(state.journals).flat();
    
    const relatedByTag = allEntries.filter(entry => {
        if (entry.id === currentEntry.id || !currentEntry.tags || currentEntry.tags.length === 0) return false;
        return entry.tags && entry.tags.some(tag => currentEntry.tags.includes(tag));
    }).slice(0, 5);

    const recentEntries = allEntries
        .filter(entry => entry.id !== currentEntry.id)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 5);

    const createListHTML = (entries, title) => {
        if (entries.length === 0) return '';
        const links = entries.map(entry => {
            const journalName = Object.keys(state.journals).find(name => state.journals[name].some(e => e.id === entry.id));
            return `<li><a href="/journal/view/${encodeURIComponent(journalName)}/entry/${entry.id}" data-link>${entry.title}</a><small class="text-tertiary"> - ${journalName}</small></li>`;
        }).join('');
        return `
            <div class="card mt-4">
                <div class="card-header">${title}</div>
                <div class="card-body">
                    <ul class="related-entries-list">${links}</ul>
                </div>
            </div>`;
    };

    return createListHTML(relatedByTag, 'Verwandte Einträge (nach Tags)') + createListHTML(recentEntries, 'Neueste Einträge');
}

export function renderJournalEntryDetailView(config) {
    const { source, actualKey } = findJournalSource(config);
    const entry = source.find(e => e.id === config.entryId);
    
    if (!entry) { appContainer.innerHTML = `<div class="card"><div class="card-body text-danger">Eintrag nicht gefunden.</div></div>`; return; }

    const processedEntry = getProcessedEntry(entry);
    const backLink = `/journal/${config.type === 'user' ? 'view/' + encodeURIComponent(actualKey) : config.type + '/' + config.key}`;
    const editLink = `${backLink}/entry/${processedEntry.id}/edit`;
    const moreEntriesHTML = (config.type === 'user') ? renderMoreEntriesSection(entry) : '';

    appContainer.innerHTML = `<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2"><a href="${backLink}" data-link class="btn btn-secondary btn-sm"><i class="fa-solid fa-arrow-left"></i> Zurück zur Liste</a><div class="d-flex align-items-center gap-2"><a href="${editLink}" data-link class="btn btn-secondary btn-sm"><i class="fa-solid fa-pencil"></i> Bearbeiten</a><button class="btn-icon delete-entry-btn" data-id="${processedEntry.id}" data-journal-type="${config.type}" data-journal-key="${actualKey}" data-back-link="${backLink}" title="Löschen"><i class="fa-solid fa-trash"></i></button></div></div><h1 class="view-title">${processedEntry.title || 'Eintrag ohne Titel'}</h1><div class="card"><div class="card-header"><small class="text-tertiary">${new Date(processedEntry.timestamp).toLocaleString()}</small></div><div class="card-body entry-detail-content markdown-body">${processedEntry.processedContent}${renderTagsHTML(processedEntry.tags)}</div></div>${moreEntriesHTML}`;
};

export function renderJournalEntryEditView(config) {
    const { source, actualKey } = findJournalSource(config);
    const entry = source.find(e => e.id === config.entryId);
    
    if (!entry) { appContainer.innerHTML = `<div class="card"><div class="card-body text-danger">Eintrag nicht gefunden.</div></div>`; return; }

    const backLink = `/journal/${config.type === 'user' ? 'view/' + encodeURIComponent(actualKey) : config.type + '/' + config.key}/entry/${config.entryId}`;

    appContainer.innerHTML = `<h1 class="view-title">Eintrag bearbeiten</h1><div class="card"><div class="card-body"><div class="mb-3"><label for="edit-entry-title" class="form-label fw-bold">Titel</label><input type="text" id="edit-entry-title" value="${entry.title || ''}"></div><div class="mb-3"><label class="form-label fw-bold">Inhalt</label><div id="editor-container"></div><div id="editor-stats" class="editor-stats"></div><div class="mb-3"><label for="edit-entry-tags" class="form-label fw-bold">Tags</label><input type="text" id="edit-entry-tags" value="${(entry.tags || []).join(', ')}"></div><div class="d-flex justify-content-end gap-2 mt-4"><a href="${backLink}" data-link class="btn btn-secondary"><i class="fa-solid fa-ban"></i> Abbrechen</a><button id="update-entry-btn" class="btn btn-primary" data-journal-type="${config.type}" data-journal-key="${actualKey}" data-entry-id="${entry.id}" data-back-link="${backLink}"><i class="fa-solid fa-save"></i> Änderungen speichern</button></div></div></div>`;
    initializeMarkdownEditor('#editor-container', entry.content);
    setupEditorStats('#editor-container');
};
