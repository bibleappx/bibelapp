import * as state from '../state.js';
import * as utils from '../utils.js';
import { router } from '../router.js';
import { getProcessedEntry } from '../services/contentProcessor.js';
import { initializeMarkdownEditor } from '../ui/editor.js';
import { createPagination, createFilterPillsHTML } from '../ui/components.js';

const appContainer = document.getElementById('app-container');

export function createTagsInput(id, label, items, placeholder) {
    const itemsHtml = items.map(item => `<span class="tag-badge" data-value="${item}"><span>${item}</span><button type="button" class="remove-btn">×</button></span>`).join('');
    const addButtonHtml = id === 'bibleVerses' ? `<button type="button" id="add-bibleVerses-btn" class="btn btn-secondary btn-sm"><i class="fa-solid fa-plus"></i></button>` : '';
    return `
        <div class="editor-form-group">
            <label for="new-${id}-input" class="form-label">${label}</label>
            <div id="${id}-input-container" class="tags-input-container">
                ${itemsHtml}
                <div class="tags-input-wrapper">
                    <input type="text" id="new-${id}-input" placeholder="${placeholder}" class="form-control">
                    <div id="${id}-error-message" class="invalid-feedback"></div>
                </div>
                ${addButtonHtml}
            </div>
        </div>`;
};

export function setupTagInput(type) {
    const container = document.getElementById(`${type}-input-container`);
    const input = document.getElementById(`new-${type}-input`);
    const addButton = document.getElementById(`add-${type}-btn`);
    const addTagElement = (trimmedValue) => {
        const tagEl = document.createElement('span');
        tagEl.className = 'tag-badge';
        tagEl.innerHTML = `<span>${trimmedValue}</span><button type="button" class="remove-btn">×</button>`;
        tagEl.dataset.value = trimmedValue;
        container.insertBefore(tagEl, input.closest('.tags-input-wrapper'));
    };
    const addTagsFromInput = (value) => {
        const valuesToAdd = value.split(',').map(val => val.trim()).filter(val => val.length > 0);
        const currentTagsInDOM = new Set(
            Array.from(container.querySelectorAll('.tag-badge')).map(el => el.dataset.value)
        );
        let addedAny = false;
        valuesToAdd.forEach(trimmedValue => {
            if (!currentTagsInDOM.has(trimmedValue)) {
                addTagElement(trimmedValue);
                currentTagsInDOM.add(trimmedValue);
                addedAny = true;
            } else {
                utils.showToast(`"${trimmedValue}" ist bereits vorhanden.`, false);
            }
        });
        if (addedAny) {
            input.value = '';
        }
    };
    const addBibleVerseTag = () => {
        const value = input.value.trim();
        if (!value) return;
        const parsed = utils.parseVerseString(value);
        const errorDiv = document.getElementById('bibleVerses-error-message');
        if (parsed) {
            const book = utils.getBook(parsed.book_number);
            const verseStringFormatted = `${book.long_name} ${parsed.chapter}, ${parsed.verse}`;
            const currentTagsInDOM = new Set(
                Array.from(container.querySelectorAll('.tag-badge')).map(el => el.dataset.value)
            );
            if (currentTagsInDOM.has(verseStringFormatted)) {
                errorDiv.textContent = `"${verseStringFormatted}" ist bereits vorhanden.`;
                input.classList.add('is-invalid');
                return;
            }
            addTagElement(verseStringFormatted);
            errorDiv.textContent = '';
            input.classList.remove('is-invalid');
            input.value = '';
        } else {
            errorDiv.textContent = 'Bibelstelle nicht gefunden.';
            input.classList.add('is-invalid');
        }
    };
    container.addEventListener('click', e => {
        if (e.target.classList.contains('remove-btn')) {
            e.target.parentElement.remove();
            input.focus();
        }
    });
    if (type === 'bibleVerses') {
        addButton?.addEventListener('click', addBibleVerseTag);
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addBibleVerseTag();
            }
        });
    } else {
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addTagsFromInput(input.value);
            }
        });
        input.addEventListener('paste', e => {
            const pasteData = e.clipboardData?.getData('text');
            if (pasteData && pasteData.includes(',')) {
                e.preventDefault();
                const combinedValue = input.value + pasteData;
                addTagsFromInput(combinedValue);
            }
        });
        input.addEventListener('blur', () => {
            addTagsFromInput(input.value);
        });
    }
};

export function renderSermonListView() {
    const params = new URLSearchParams(window.location.search);
    const searchTerm = params.get('q') || '';
    const activeYear = params.get('year') || new Date().getFullYear().toString();
    const activeStatus = params.get('status') || 'active';
    const sortBy = params.get('sort') || 'newest';
    const currentPage = parseInt(params.get('page') || '1', 10);

    const currentYear = new Date().getFullYear();
    const draftAndIdeaYears = state.sermons
        .filter(s => s.status === 'draft' || s.status === 'idea')
        .map(s => new Date(s.date).getFullYear());
    const sermonYears = [...new Set([currentYear, ...draftAndIdeaYears])].sort((a, b) => b - a);

    const yearOptionsHTML = sermonYears.map(year => `<option value="${year}" ${activeYear == year ? 'selected' : ''}>${year}</option>`).join('');
    const yearFilterDropdownHTML = `
        <div style="min-width: 150px;">
            <select id="sermon-year-select" class="form-select">
                <option value="all">Alle Jahre</option>
                ${yearOptionsHTML}
            </select>
        </div>
    `;

    const statusFilters = [
        { filter: 'active', icon: 'fa-solid fa-file-signature', title: 'Aktuell' },
        { filter: 'all', icon: 'fa-solid fa-list-ul', title: 'Alle Status' },
        { filter: 'published', icon: 'fa-solid fa-check-circle', title: 'Veröffentlicht' },
        { filter: 'draft', icon: 'fa-solid fa-pencil-ruler', title: 'Entwurf' },
        { filter: 'idea', icon: 'fa-solid fa-lightbulb', title: 'Idee' }
    ];
    const statusFilterButtonsHTML = createFilterPillsHTML(statusFilters, activeStatus);
    
    appContainer.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1 class="view-title mb-0">Meine Predigten</h1>
            <a href="/sermons/new" data-link class="btn btn-primary"><i class="fa-solid fa-plus"></i> Neue Predigt</a>
        </div>
        <div class="card mb-4">
            <div class="card-body">
                <div class="d-flex flex-wrap gap-3 mb-3">
                    <div class="flex-grow-1"><input type="search" id="sermon-filter-input" placeholder="Predigten durchsuchen..." value="${searchTerm}"></div>
                    <div style="min-width: 200px;"><select id="sermon-sort-select" class="form-select"><option value="newest">Neueste zuerst</option><option value="oldest">Älteste zuerst</option><option value="az">Titel (A-Z)</option><option value="za">Titel (Z-A)</option></select></div>
                    ${yearFilterDropdownHTML}
                </div>
                <div id="sermon-status-filters" class="filter-pills d-flex flex-wrap gap-2">
                    ${statusFilterButtonsHTML}
                </div>
            </div>
        </div>
        <div id="sermon-list" class="list-group"></div>
        <div id="pagination-container" class="mt-4"></div>
    `;

    document.getElementById('sermon-sort-select').value = sortBy;

    const displaySermons = () => {
        const currentParams = new URLSearchParams(window.location.search);
        const currentSearch = currentParams.get('q') || '';
        const currentYear = currentParams.get('year') || new Date().getFullYear().toString();
        const currentStatus = currentParams.get('status') || 'active';
        const currentSort = currentParams.get('sort') || 'newest';
        const page = parseInt(currentParams.get('page') || '1', 10);
        
        let processedSermons = state.sermons.filter(sermon => {
            const searchMatch = (sermon.title?.toLowerCase().includes(currentSearch)) || (getProcessedEntry(sermon).plainTextContent?.toLowerCase().includes(currentSearch)) || (sermon.tags?.some(t => t.toLowerCase().includes(currentSearch)));
            const yearMatch = currentYear === 'all' ? true : new Date(sermon.date).getFullYear() == currentYear;
            
            let statusMatch;
            if (currentStatus === 'all') {
                statusMatch = true;
            } else if (currentStatus === 'active') {
                statusMatch = sermon.status === 'draft' || sermon.status === 'idea';
            } else {
                statusMatch = sermon.status === currentStatus;
            }
            return searchMatch && yearMatch && statusMatch;
        });

        processedSermons.sort((a, b) => {
            switch (currentSort) {
                case 'newest': return new Date(b.date) - new Date(a.date);
                case 'oldest': return new Date(a.date) - new Date(b.date);
                case 'az': return (a.title || '').localeCompare(b.title || '');
                case 'za': return (b.title || '').localeCompare(a.title || '');
                default: return 0;
            }
        });
        
        const itemsPerPage = 10;
        const totalPages = Math.ceil(processedSermons.length / itemsPerPage);
        const paginatedSermons = processedSermons.slice((page - 1) * itemsPerPage, page * itemsPerPage);
        
        const sermonsHTML = paginatedSermons.map(sermon => {
            let statusBadge = '';
            if (sermon.status === 'draft') {
                statusBadge = '<span class="badge bg-secondary ms-2">Entwurf</span>';
            } else if (sermon.status === 'idea') {
                statusBadge = '<span class="badge bg-info ms-2">Idee</span>';
            }
            return `
            <div class="list-group-item">
                <a href="/sermons/view/${sermon.id}" data-link class="flex-grow-1">
                    <span class="journal-item-title">${sermon.title || 'Ohne Titel'}${statusBadge}</span>
                    <small class="journal-item-date">${utils.formatDate(sermon.date)}</small>
                </a>
                <div class="list-item-actions">
                    <a href="/sermons/edit/${sermon.id}" data-link class="btn-icon" title="Bearbeiten"><i class="fa-solid fa-pencil"></i></a>
                    <button class="btn-icon delete-sermon-btn" data-id="${sermon.id}" data-back-link="/sermons/list" title="Löschen"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`;
        }).join('');
        
        document.getElementById('sermon-list').innerHTML = sermonsHTML || '<p class="text-tertiary p-3">Keine Predigten für diese Auswahl gefunden.</p>';
        document.getElementById('pagination-container').innerHTML = createPagination(page, totalPages, new URL(window.location));
    };

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
        displaySermons();
    };

    document.getElementById('sermon-filter-input').addEventListener('input', utils.debounce(e => updateUrlAndRender({ q: e.target.value }), 300));
    document.getElementById('sermon-sort-select').addEventListener('change', e => updateUrlAndRender({ sort: e.target.value }));
    document.getElementById('sermon-year-select').addEventListener('change', e => updateUrlAndRender({ year: e.target.value }));
    document.getElementById('sermon-status-filters').addEventListener('click', (e) => {
        const button = e.target.closest('button[data-filter]');
        if (button) {
            document.querySelectorAll('#sermon-status-filters .btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            updateUrlAndRender({ status: button.dataset.filter });
        }
    });
    
    displaySermons();
};

export function renderSermonDetailView(id) {
    const sermon = state.sermons.find(s => s.id === id);
    if (!sermon) {
        utils.showToast('Predigt nicht gefunden', false);
        history.pushState(null, '', '/sermons');
        router();
        return;
    }
    const processedSermon = getProcessedEntry(sermon);
    const tagsHtml = (sermon.tags || []).map(tag => `<a href="/tags/${encodeURIComponent(tag)}" data-link class="tag-badge">${tag}</a>`).join('');
    const bibleVersesHtml = (sermon.bibleVerses || []).map(verseString => {
        const verseRef = utils.parseVerseString(verseString);
        if (verseRef) {
            const book = utils.getBook(verseRef.book_number);
            return `<a href="/bible/${utils.getPrimaryShortName(book)}/${verseRef.chapter}/${verseRef.verse}" data-link class="sermon-bible-verse-link">${verseString}</a>`;
        }
        return `<span>${verseString}</span>`;
    }).join(', ');
    appContainer.innerHTML = `
        <div class="mb-3 d-flex justify-content-between align-items-center">
            <a href="/sermons" data-link class="back-button"><i class="fa-solid fa-arrow-left"></i> Zurück zur Liste</a>
            <div class="editor-actions p-0 border-0">
                <a href="/sermons/edit/${sermon.id}" data-link class="btn btn-primary btn-sm"><i class="fa-solid fa-pencil"></i> Bearbeiten</a>
                <button class="btn btn-sm btn-danger delete-sermon-btn" data-id="${sermon.id}" data-back-link="/sermons"><i class="fa-solid fa-trash"></i> Löschen</button>
            </div>
        </div>
        <div class="card">
            <div class="card-body">
                <h1 class="view-title">${sermon.title}</h1>
                <div class="detail-meta">
                    <p><i class="fa-solid fa-calendar-day"></i> ${utils.formatDate(sermon.date)} · ${sermon.time || ''} Uhr</p>
                    <p><i class="fa-solid fa-book-open"></i> ${bibleVersesHtml || 'Keine Bibelstellen angegeben'}</p>
                    <p><i class="fa-solid fa-tags"></i> <span class="tags-container">${tagsHtml || 'Keine Tags'}</span></p>
                </div>
                <hr>
                <div class="entry-detail-content markdown-body">${processedSermon.processedContent || ''}</div>
            </div>
        </div>`;
};

export function renderSermonEditorView(id = null) {
    const isEditing = id !== null;
    const sermon = isEditing ? state.sermons.find(s => s.id === id) : {};
    if (isEditing && !sermon) {
        utils.showToast('Zu bearbeitende Predigt nicht gefunden.', false);
        history.pushState(null, '', '/sermons');
        router();
        return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const verseFromParam = urlParams.get('verse');
    const initialBibleVerses = sermon.bibleVerses || (verseFromParam ? [decodeURIComponent(verseFromParam)] : []);
    appContainer.innerHTML = `
    <div class="d-flex justify-content-between align-items-center">
        <h1 class="view-title">${isEditing ? 'Predigt bearbeiten' : 'Neue Predigt erstellen'}</h1>
        <a href="${isEditing ? `/sermons/view/${id}` : '/sermons'}" data-link class="btn btn-secondary btn-sm">Abbrechen</a>
    </div>
    <div class="card"><div class="card-body">
        <form id="sermon-editor-form">
            <input type="hidden" id="sermonId" value="${sermon.id || ''}">
            <div class="editor-form-group"><label for="editorTitle" class="form-label">Titel</label><input type="text" id="editorTitle" class="form-control" value="${sermon.title || ''}" required></div>
            <div class="row">
                <div class="col-md-4 editor-form-group"><label for="editorDate" class="form-label">Datum</label><input type="date" id="editorDate" class="form-control" value="${sermon.date || new Date().toISOString().split('T')[0]}"></div>
                <div class="col-md-4 editor-form-group"><label for="editorTime" class="form-label">Uhrzeit</label><input type="time" id="editorTime" class="form-control" value="${sermon.time || '10:00'}"></div>
                <div class="col-md-4 editor-form-group">
                    <label for="editorStatus" class="form-label">Status</label>
                    <select id="editorStatus" class="form-select">
                        <option value="published">Veröffentlicht</option>
                        <option value="draft">Entwurf</option>
                        <option value="idea">Idee</option>
                    </select>
                </div>
            </div>
            ${createTagsInput('bibleVerses', 'Bibelstellen', initialBibleVerses, 'z.B. Gen 1,1')}
            ${createTagsInput('tags', 'Tags', sermon.tags || [], 'Tag hinzufügen (Enter oder Komma)')}
            <div class="editor-form-group"><label class="form-label">Inhalt</label><div id="sermon-editor-container"></div></div>
            <div class="editor-actions"><a href="${isEditing ? `/sermons/view/${id}` : '/sermons'}" data-link class="btn btn-secondary">Abbrechen</a><button type="submit" id="save-sermon-btn" class="btn btn-primary"><i class="fa-solid fa-save"></i> Speichern</button></div>
        </form>
    </div></div>`;
    initializeMarkdownEditor('#sermon-editor-container', sermon.content);
    document.getElementById('editorStatus').value = sermon.status || 'published';
    ['bibleVerses', 'tags'].forEach(setupTagInput);
};