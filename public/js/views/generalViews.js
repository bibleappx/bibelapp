import * as state from '../state.js';
import * as utils from '../utils.js';
import { getProcessedEntry } from '../services/contentProcessor.js';
import { getAllEntries } from '../services/dataBuilder.js';
import * as search from '../services/search.js';
import { createPagination, createFilterPillsHTML, renderEntryListItemHTML, renderSearchResultItemHTML } from '../ui/components.js';
import { initializeMarkdownEditor } from '../ui/editor.js';

const appContainer = document.getElementById('app-container');

export function renderRecentActivityPage() {
    const allEntries = getAllEntries();
    const displayEntries = () => {
        const currentPage = utils.getCurrentPage();
        const itemsPerPage = 10;
        const urlParams = new URLSearchParams(window.location.search);
        const currentFilter = urlParams.get('filter') || 'all';
        const sort = urlParams.get('sort') || 'newest';
        document.querySelectorAll('#filter-controls button').forEach(btn => btn.classList.toggle('active', btn.dataset.filter === currentFilter));
        document.getElementById('sort-controls').value = sort;
        let filtered = allEntries;
        if (currentFilter !== 'all') {
            filtered = allEntries.filter(e => {
                if (['note', 'sermon', 'user', 'book', 'chapter'].includes(currentFilter)) return e.type === currentFilter;
                const processed = getProcessedEntry(e);
                switch (currentFilter) {
                    case 'crossref': return processed.flags?.hasCrossReference;
                    case 'youtube': return processed.flags?.hasYoutube;
                    case 'audio': return processed.flags?.hasAudio;
                    case 'video': return processed.flags?.hasVideo;
                    case 'resource': return processed.resources?.length > 0;
                    default: return false;
                }
            });
        }
        filtered.sort((a, b) => sort === 'newest' ? new Date(b.timestamp) - new Date(a.timestamp) : new Date(a.timestamp) - new Date(b.timestamp));
        const totalPages = Math.ceil(filtered.length / itemsPerPage);
        const paginatedEntries = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
        const listHTML = paginatedEntries.map(renderEntryListItemHTML).join('');
        document.getElementById('recent-activity-list').innerHTML = listHTML || '<p class="text-tertiary p-3">Keine Einträge gefunden.</p>';
        document.getElementById('pagination-container').innerHTML = createPagination(currentPage, totalPages);
    };
    const filters = [
        { filter: 'all', icon: 'fa-solid fa-list-ul', title: 'Alle' },
        { filter: 'note', icon: 'fa-solid fa-pencil', title: 'Nur Vers-Notizen' },
        { filter: 'sermon', icon: 'fa-solid fa-book-bible', title: 'Nur Predigten' },
        { filter: 'user', icon: 'fa-solid fa-book-journal-whills', title: 'Nur Journale' },
        { filter: 'book', icon: 'fa-solid fa-book-bookmark', title: 'Nur Buch-Notizen' },
        { filter: 'chapter', icon: 'fa-solid fa-file-lines', title: 'Nur Kapitel-Notizen' },
        { filter: 'crossref', icon: 'fa-solid fa-link', title: 'Nur mit Querverweisen' },
        { filter: 'youtube', icon: 'fa-brands fa-youtube', title: 'Nur mit YouTube' },
        { filter: 'audio', icon: 'fa-solid fa-file-audio', title: 'Nur mit Audio' },
        { filter: 'video', icon: 'fa-solid fa-file-video', title: 'Nur mit Video' },
        { filter: 'resource', icon: 'fa-solid fa-paperclip', title: 'Nur mit Ressourcen' }
    ];
    const filterPillsHTML = createFilterPillsHTML(filters, new URLSearchParams(window.location.search).get('filter') || 'all');
    appContainer.innerHTML = `<h1 class="view-title">Letzte Aktivitäten</h1><div class="card mb-4"><div class="card-body d-flex justify-content-between flex-wrap gap-3"><div id="filter-controls" class="filter-pills justify-content-center flex-grow-1">${filterPillsHTML}</div><select id="sort-controls" class="w-auto form-select" style="min-width: 180px;"><option value="newest">Neueste zuerst</option><option value="oldest">Älteste zuerst</option></select></div></div><div id="recent-activity-list" class="list-group"></div><div id="pagination-container" class="mt-4"></div>`;
    
    const updateView = () => {
        const filter = document.querySelector('#filter-controls button.active')?.dataset.filter || 'all';
        const sort = document.getElementById('sort-controls').value;
        const params = new URLSearchParams(window.location.search);
        params.set('filter', filter);
        params.set('sort', sort);
        params.set('page', '1');
        history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
        displayEntries();
    };
    document.getElementById('filter-controls')?.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (button) {
            document.querySelectorAll('#filter-controls button').forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            updateView();
        }
    });
    document.getElementById('sort-controls').addEventListener('change', updateView);
    displayEntries();
};

export function renderAllTagsPage() {
    const tagCounts = {};
    getAllEntries().forEach(entry => {
        getProcessedEntry(entry).tags?.forEach(tag => {
            const lowerCaseTag = tag.toLowerCase(); // Tags auf Kleinbuchstaben normalisieren
            tagCounts[lowerCaseTag] = (tagCounts[lowerCaseTag] || 0) + 1;
        });
    });
    const displayTags = () => {
        const listContainer = document.getElementById('tags-list-container');
        if (!listContainer) return;
        const activeLetter = document.querySelector('#tag-controls .btn[data-letter].active')?.dataset.letter || 'all';
        const sortBy = document.getElementById('tag-sort-select')?.value || 'count-desc';
        let tagsToDisplay = Object.entries(tagCounts);
        if (activeLetter !== 'all') {
            tagsToDisplay = tagsToDisplay.filter(([tag]) => tag.toLowerCase().startsWith(activeLetter.toLowerCase()));
        }
        tagsToDisplay.sort((a, b) => {
            switch (sortBy) {
                case 'alpha-az': return a[0].localeCompare(b[0]);
                case 'alpha-za': return b[0].localeCompare(a[0]);
                case 'count-asc': return a[1] - b[1];
                case 'count-desc': default: return b[1] - a[1];
            }
        });
        const tagsHTML = tagsToDisplay.map(([tag, count]) => `
        <a href="/tags/${encodeURIComponent(tag)}" data-link class="list-group-item">
            <i class="fa-solid fa-tag me-2" style="color: var(--accent-teal);"></i>
            <span class="flex-grow-1">${tag}</span>
            <span class="badge">${count}</span>
        </a>`).join('');
        listContainer.innerHTML = tagsHTML || '<div class="card card-body text-tertiary">Keine Tags für diese Auswahl gefunden.</div>';
    };
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const alphaButtonsHTML = alphabet.map(letter => `<button class="btn btn-outline-secondary" data-letter="${letter}">${letter}</button>`).join('');
    appContainer.innerHTML = `
    <h1 class="view-title">Alle Tags</h1>
    <div class="card mb-4">
        <div class="card-body">
            <div id="tag-controls" class="d-flex flex-wrap align-items-center gap-2">
                <select id="tag-sort-select" class="form-select" style="width: auto; min-width: 220px;">
                    <option value="count-desc">Nach Häufigkeit (Meiste zuerst)</option>
                    <option value="count-asc">Nach Häufigkeit (Wenigste zuerst)</option>
                    <option value="alpha-az">Alphabetisch (A-Z)</option>
                    <option value="alpha-za">Alphabetisch (Z-A)</option>
                </select>
                <button class="btn btn-secondary active" data-letter="all">Alle</button>
                ${alphaButtonsHTML}
            </div>
        </div>
    </div>
    <div id="tags-list-container" class="list-group"></div>`;
    const controlsContainer = document.getElementById('tag-controls');
    controlsContainer.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-letter]');
        if (button) {
            controlsContainer.querySelectorAll('.btn[data-letter]').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            displayTags();
        }
    });
    document.getElementById('tag-sort-select').addEventListener('change', displayTags);
    displayTags();
};

export function renderTagDetailView(tagName) {
    const results = getAllEntries()
        .filter(entry => getProcessedEntry(entry).tags?.some(tag => tag.toLowerCase() === tagName.toLowerCase()))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    let contentHTML = '';
    if (results.length === 0) {
        contentHTML = '<div class="card card-body text-tertiary">Keine Einträge für diesen Tag gefunden.</div>';
    } else {
        const groupedResults = results.reduce((acc, entry) => {
            const type = entry.type || 'unknown';
            if (!acc[type]) acc[type] = [];
            acc[type].push(entry);
            return acc;
        }, {});
        const typeHeaders = {
            sermon: 'Predigten', note: 'Vers-Notizen', user: 'Journal-Einträge',
            book: 'Buch-Notizen', chapter: 'Kapitel-Notizen'
        };
        const groupOrder = ['sermon', 'note', 'user', 'book', 'chapter'];
        groupOrder.forEach(groupKey => {
            if (groupedResults[groupKey] && groupedResults[groupKey].length > 0) {
                contentHTML += `<h3 class="view-subheader">${typeHeaders[groupKey]}</h3>`;
                const entriesHTML = groupedResults[groupKey].map(renderEntryListItemHTML).join('');
                contentHTML += `<div class="list-group mb-4">${entriesHTML}</div>`;
            }
        });
    }
    appContainer.innerHTML = `
    <h1 class="view-title d-flex align-items-center gap-2">
        <i class="fa-solid fa-tag"></i>Tag: ${tagName}
    </h1>
    <a href="/tags" data-link class="btn btn-secondary btn-sm mb-4">
        <i class="fa-solid fa-arrow-left"></i> Zurück zu allen Tags
    </a>
    <div id="tag-results-list">
        ${contentHTML}
    </div>`;
};

export function renderBookNotesOverview(bookNumber) {
    const book = utils.getBook(bookNumber);
    if (!book) { appContainer.innerHTML = `<div class="card"><div class="card-body text-danger">Buch nicht gefunden.</div></div>`; return; }
    const bookShortNames = book.short_name.replace(/[\[\]]/g, '').split(',').map(name => name.trim().toLowerCase());
    const bookTitleAndShortNames = [book.long_name.toLowerCase(), ...bookShortNames];
    const allBookRelatedEntries = getAllEntries()
        .filter(e => {
            if (e.type === 'note' && parseInt(e.verseKey.split('-')[0]) === bookNumber) return true;
            if (e.type === 'book' && parseInt(e.journalKey) === bookNumber) return true;
            if (e.type === 'chapter' && parseInt(e.journalKey.split('-')[0]) === bookNumber) return true;
            const processed = getProcessedEntry(e);
            const hasVerseLinkToBook = processed.internalLinks?.some(link => link.book_number === bookNumber);
            const hasChapterLinkToBook = processed.chapterLinks?.some(link => link.book_number === bookNumber);
            const hasMatchingTag = processed.tags?.some(tag => bookTitleAndShortNames.includes(tag.toLowerCase()));
            let sermonHasBookVerse = false;
            if (e.type === 'sermon' && e.bibleVerses) {
                sermonHasBookVerse = e.bibleVerses.some(verseString => {
                    const verseRef = utils.parseVerseString(verseString);
                    return verseRef && verseRef.book_number === bookNumber;
                });
            }
            return hasVerseLinkToBook || hasChapterLinkToBook || hasMatchingTag || sermonHasBookVerse;
        })
        .sort((a, b) => {
            const getSortKeys = (entry) => {
                if (entry.type === 'note') { const [, c, v] = entry.verseKey.split('-').map(Number); return { chapter: c, verse: v }; }
                if (entry.type === 'chapter') { const [, c] = entry.journalKey.split('-').map(Number); return { chapter: c, verse: -1 }; }
                if (entry.type === 'book') return { chapter: -1, verse: -1 };
                if (entry.type === 'sermon') return { chapter: 999, verse: new Date(entry.timestamp).getTime() };
                return { chapter: 1000, verse: 1000 };
            };
            const aKeys = getSortKeys(a);
            const bKeys = getSortKeys(b);
            return aKeys.chapter - bKeys.chapter || aKeys.verse - bKeys.verse;
        });
    const displayEntries = () => {
        const currentPage = utils.getCurrentPage();
        const itemsPerPage = 10;
        const currentFilter = new URLSearchParams(window.location.search).get('filter') || 'all';
        document.querySelectorAll('#filter-controls-book-notes button').forEach(btn => btn.classList.toggle('active', btn.dataset.filter === currentFilter));
        const filteredEntries = allBookRelatedEntries.filter(entry => {
            if (currentFilter === 'all') return true;
            const processed = getProcessedEntry(entry);
            switch (currentFilter) {
                case 'note': return entry.type === 'note';
                case 'sermon': return entry.type === 'sermon';
                case 'crossref': return !!processed.flags?.hasCrossReference;
                case 'chapter-ref': return (processed.chapterLinks?.length || 0) > 0;
                case 'youtube': return !!processed.flags?.hasYoutube;
                case 'audio': return !!processed.flags?.hasAudio;
                case 'video': return !!processed.flags?.hasVideo;
                case 'resource': return (processed.resources?.length || 0) > 0;
                default: return false;
            }
        });
        const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
        const paginatedEntries = filteredEntries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
        const listHTML = paginatedEntries.map(renderEntryListItemHTML).join('');
        document.getElementById('book-notes-list').innerHTML = listHTML || '<p class="text-tertiary p-3">Keine Einträge für diese Auswahl gefunden.</p>';
        document.getElementById('pagination-container').innerHTML = createPagination(currentPage, totalPages);
    };
    const filters = [
        { filter: 'all', icon: 'fa-solid fa-list-ul', title: 'Alle Einträge' },
        { filter: 'note', icon: 'fa-solid fa-pencil', title: 'Nur Vers-Notizen' },
        { filter: 'sermon', icon: 'fa-solid fa-book-bible', title: 'Nur Predigten' },
        { filter: 'crossref', icon: 'fa-solid fa-link', title: 'Nur mit Querverweisen' },
        { filter: 'chapter-ref', icon: 'fa-solid fa-comments', title: 'Nur mit Kapitel-Referenzen' },
        { filter: 'youtube', icon: 'fa-brands fa-youtube', title: 'Nur mit YouTube' },
        { filter: 'audio', icon: 'fa-solid fa-file-audio', title: 'Nur mit Audio' },
        { filter: 'video', icon: 'fa-solid fa-file-video', title: 'Nur mit Video' },
        { filter: 'resource', icon: 'fa-solid fa-paperclip', title: 'Nur mit Ressourcen' }
    ];
    const filterPillsHTML = createFilterPillsHTML(filters, new URLSearchParams(window.location.search).get('filter') || 'all');
    appContainer.innerHTML = `
    <h1 class="view-title">Alle Notizen & Predigten zu ${book.long_name}</h1>
    <a href="/bible/${utils.getPrimaryShortName(book)}/1" data-link class="btn btn-secondary btn-sm mb-4"><i class="fa-solid fa-arrow-left"></i> Zurück zum Buch</a>
    <div id="filter-controls-book-notes" class="filter-pills d-flex justify-content-end mb-3">${filterPillsHTML}</div>
    <div id="book-notes-list" class="list-group"></div>
    <div id="pagination-container" class="mt-4"></div>`;
    document.getElementById('filter-controls-book-notes')?.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (button) {
            const filter = button.dataset.filter;
            const params = new URLSearchParams(window.location.search);
            params.set('filter', filter);
            params.set('page', '1');
            history.pushState(null, '', `${window.location.pathname}?${params.toString()}`);
            displayEntries();
        }
    });
    displayEntries();
};

export function renderSearchPage(initialQuery = '') {
    const urlParams = new URLSearchParams(window.location.search);
    const decodedInitialQuery = decodeURIComponent(urlParams.get('q') || initialQuery);
    const initialFilter = urlParams.get('filter') || 'all';
    const testamentFilter = urlParams.get('testament') || 'Alle';

    const filters = [
        { filter: 'all', icon: 'fa-solid fa-globe', title: 'Alles durchsuchen' },
        { filter: 'bible', icon: 'fa-solid fa-bible', title: 'Nur in der Bibel suchen' },
        { filter: 'notes', icon: 'fa-solid fa-pencil', title: 'Nur in Vers-Notizen suchen' },
        { filter: 'sermons', icon: 'fa-solid fa-book-bible', title: 'Nur in Predigten suchen' },
        { filter: 'journals', icon: 'fa-solid fa-book-journal-whills', title: 'Nur in Journalen suchen' },
        { filter: 'booknotes', icon: 'fa-solid fa-book-bookmark', title: 'Nur in Buch-Notizen suchen' },
        { filter: 'chapternotes', icon: 'fa-solid fa-file-lines', title: 'Nur in Kapitel-Notizen suchen' }
    ];
    const filterPillsHTML = createFilterPillsHTML(filters, initialFilter);

    const testamentFilterHTML = `
        <div id="testament-filter-buttons" class="btn-group mt-3" role="group" style="display: ${initialFilter === 'bible' ? 'inline-flex' : 'none'};">
            <button type="button" class="btn ${testamentFilter === 'Alle' ? 'btn-primary' : 'btn-secondary'}" data-testament-filter="Alle">Ganze Bibel</button>
            <button type="button" class="btn ${testamentFilter === 'AT' ? 'btn-primary' : 'btn-secondary'}" data-testament-filter="AT">Altes Testament</button>
            <button type="button" class="btn ${testamentFilter === 'NT' ? 'btn-primary' : 'btn-secondary'}" data-testament-filter="NT">Neues Testament</button>
        </div>
    `;

    appContainer.innerHTML = `
    <h1 class="view-title">Suche</h1>
    <div class="input-group mb-3"><input type="search" id="search-input" class="form-control" placeholder="Alles nach Titel oder Inhalt durchsuchen..." value="${decodedInitialQuery}"></div>
    <div id="search-filter-pills" class="filter-pills mb-2 justify-content-center">${filterPillsHTML}</div>
    <div class="text-center">${testamentFilterHTML}</div>
    <div id="search-results-info" class="mb-3 mt-3"></div>
    <div id="search-results" class="list-group"></div>
    <div id="pagination-container" class="mt-4"></div>`;
    
    const searchInput = document.getElementById('search-input');
    const resultsContainer = document.getElementById('search-results');
    const resultsInfoContainer = document.getElementById('search-results-info');
    const paginationContainer = document.getElementById('pagination-container');
    const filterPillsContainer = document.getElementById('search-filter-pills');
    const testamentFilterContainer = document.getElementById('testament-filter-buttons');

const performSearchAndDisplay = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const term = urlParams.get('q') || '';
    const currentPage = parseInt(urlParams.get('page') || '1');
    const activeFilter = urlParams.get('filter') || 'all';
    const activeTestament = urlParams.get('testament') || 'Alle';
    const itemsPerPage = 10;

    resultsContainer.innerHTML = '';
    paginationContainer.innerHTML = '';
    document.querySelectorAll('#search-filter-pills button').forEach(btn => btn.classList.toggle('active', btn.dataset.filter === activeFilter));
    testamentFilterContainer.style.display = activeFilter === 'bible' ? 'inline-flex' : 'none';

    if (term.length < 3 && !term.includes('"')) {
        resultsInfoContainer.innerHTML = term.length === 0 ? '<p class="text-tertiary">Bitte Suchbegriff eingeben.</p>' : '<p class="text-tertiary">Bitte mindestens 3 Zeichen für die Suche eingeben.</p>';
        return;
    }

    resultsInfoContainer.innerHTML = '';
    resultsContainer.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;

    const parsedQuery = search.parseSearchQuery(term);
    
    const filterDataAsync = (data) => new Promise(resolve => {
        setTimeout(() => {
            const results = data.filter(item => 
                search.matchesSearchCriteria(item.searchableText_case_sensitive, item.searchableText_case_insensitive, parsedQuery)
            );
            resolve(results);
        }, 50);
    });
    
    let dataToSearch;
    const filterMap = {
        notes: 'note', sermons: 'sermon', journals: 'user',
        booknotes: 'book', chapternotes: 'chapter'
    };

    if (activeFilter === 'all') {
        dataToSearch = [...state.verses, ...state.allEntriesCache];
    } else if (activeFilter === 'bible') {
        let bibleData = state.verses;
        if (activeTestament === 'AT') {
            bibleData = state.verses.filter(v => parseInt(v.book_number, 10) <= 460);
        } else if (activeTestament === 'NT') {
            bibleData = state.verses.filter(v => parseInt(v.book_number, 10) > 460);
        }
        dataToSearch = bibleData;
    } else {
        dataToSearch = state.allEntriesCache.filter(e => e.type === filterMap[activeFilter]);
    }

    const allResults = await filterDataAsync(dataToSearch);
    
    resultsInfoContainer.innerHTML = `<p class="text-tertiary">${allResults.length} Ergebnis(se) gefunden.</p>`;
    const totalPages = Math.ceil(allResults.length / itemsPerPage);
    const paginatedResults = allResults.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    
    resultsContainer.innerHTML = paginatedResults.map(res => renderSearchResultItemHTML(res, parsedQuery)).join('') || '<p class="text-tertiary p-3">Keine Ergebnisse gefunden.</p>';
    paginationContainer.innerHTML = createPagination(currentPage, totalPages, window.location);
};

    const updateURLAndSearch = () => {
        const term = searchInput.value;
        const filter = filterPillsContainer.querySelector('.active').dataset.filter;
        const params = new URLSearchParams();
        params.set('q', term);
        params.set('filter', filter);
        params.set('page', '1');
        
        if (filter === 'bible') {
            const testamentButton = testamentFilterContainer.querySelector('.btn-primary') || testamentFilterContainer.querySelector('[data-testament-filter="Alle"]');
            const testament = testamentButton.dataset.testamentFilter;
            params.set('testament', testament);
        }

        history.pushState(null, '', `${window.location.pathname}?${params.toString()}`);
        performSearchAndDisplay();
    };
    
    searchInput.addEventListener('keyup', utils.debounce(updateURLAndSearch, 300));
    filterPillsContainer.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (button) {
            filterPillsContainer.querySelector('.active').classList.remove('active');
            button.classList.add('active');
            updateURLAndSearch();
        }
    });

    testamentFilterContainer.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (button) {
            testamentFilterContainer.querySelectorAll('button').forEach(btn => {
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-secondary');
            });
            button.classList.add('btn-primary');
            button.classList.remove('btn-secondary');
            updateURLAndSearch();
        }
    });

    performSearchAndDisplay();
};

export function renderVerseNoteEditView(verseKey, noteId) {
    const note = (state.notes[verseKey] || []).find(n => n.id === noteId);
    if (!note) { appContainer.innerHTML = `<div class="card"><div class="card-body text-danger">Notiz nicht gefunden.</div></div>`; return; }
    const [b, c, v] = verseKey.split('-');
    const book = utils.getBook(parseInt(b));
    const primaryShortName = utils.getPrimaryShortName(book);
    const backLink = `/bible/${primaryShortName}/${c}/${v}`;
    appContainer.innerHTML = `<h1 class="view-title">Notiz zu ${book.long_name} ${c}:${v} bearbeiten</h1><div class="card"><div class="card-body"><div class="mb-3"><label class="form-label fw-bold">Inhalt</label><div id="editor-container"></div></div><div class="mb-3"><label for="edit-entry-tags" class="form-label fw-bold">Tags</label><input type="text" id="edit-entry-tags" value="${(note.tags || []).join(', ')}"></div><div class="d-flex justify-content-end gap-2 mt-4"><a href="${backLink}" data-link class="btn btn-secondary"><i class="fa-solid fa-ban"></i> Abbrechen</a><button id="update-note-btn" class="btn btn-primary" data-verse-key="${verseKey}" data-entry-id="${note.id}" data-back-link="${backLink}"><i class="fa-solid fa-save"></i> Änderungen speichern</button></div></div></div>`;
    initializeMarkdownEditor('#editor-container', note.content);
};
