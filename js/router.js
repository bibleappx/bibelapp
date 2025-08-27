import * as state from './state.js';
import * as utils from './utils.js';
import { renderBibleBookOverview, renderChapterView, renderVerseDetailView, renderCustomVerseView } from './views/bibleView.js';
import { renderStrongsDashboard, renderStrongsDetailView } from './views/strongsView.js';
import { renderJournalOverviewPage, renderJournalView, renderJournalEntryDetailView, renderJournalEntryEditView } from './views/journalView.js';
import { renderSermonListView, renderSermonDetailView, renderSermonEditorView } from './views/sermonView.js';
import { renderRecentActivityPage, renderAllTagsPage, renderTagDetailView, renderBookNotesOverview, renderSearchPage, renderVerseNoteEditView } from './views/generalViews.js';
import { renderDictionaryDashboard, renderDictionaryDetailView } from './views/dictionaryView.js';

const appContainer = document.getElementById('app-container');
const bibleNavContainer = document.getElementById('bible-nav-container');

function updateActiveNav(path) {
    document.querySelectorAll('#main-navigation .nav-link').forEach(link => {
        const linkPath = new URL(link.href).pathname;
        let isMatch = (path === linkPath);
        if (linkPath !== '/' && path.startsWith(linkPath)) isMatch = true;
        if (linkPath === '/' && path !== '/' && !path.startsWith('/bible') && !path.startsWith('/strongs')) isMatch = false;
        if (linkPath === '/' && (path.startsWith('/bible') || path.startsWith('/strongs'))) isMatch = true;
        link.classList.toggle('active', isMatch);
    });
};

export function router() {
    const originalPath = window.location.pathname || '/';
    const path = originalPath.toLowerCase();

    if (originalPath !== path) {
        history.replaceState(null, '', path);
    }

    updateActiveNav(path);
    appContainer.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;
    bibleNavContainer.style.display = 'none';
    appContainer.classList.remove('has-context-nav');
    
    const parts = path.split('/').filter(p => p);
    const findBookByAnyName = (name) => state.books.find(b => b.short_name.replace(/[\[\]]/g, '').split(',').some(sn => sn.trim().toLowerCase() === name.toLowerCase()));

    if (path === '/') {
        document.title = 'Bibel & Predigt App - Startseite';
        renderBibleBookOverview();
    } else if (parts[0] === 'dictionary') { 
        const dictionaryId = parts[1];
        const topic = parts[2];
        const dictName = state.availableDictionaries.find(d => d.id === dictionaryId)?.name || 'Wörterbuch';
        if (topic) {
            document.title = `Bibel & Predigt App - ${decodeURIComponent(topic)} | ${dictName}`;
            renderDictionaryDetailView(dictionaryId, decodeURIComponent(topic));
        } else {
            document.title = `Bibel & Predigt App - ${dictName}`;
            renderDictionaryDashboard(dictionaryId);
        }
    
    } else if (parts[0] === 'strongs' && parts.length === 1) {
        document.title = 'Bibel & Predigt App - Konkordanz';
        renderStrongsDashboard();
    } else if (parts[0] === 'strongs' && parts.length >= 2) {
        let strongId = parts[1];
        if (strongId) {
            strongId = strongId.charAt(0).toUpperCase() + strongId.slice(1);
        }
        document.title = `Bibel & Predigt App - Strongs #${strongId} | Konkordanz`;
        renderStrongsDetailView(strongId);
    } else if (parts[0] === 'bible' && parts[1] === 'custom-view') {
        const verseQuery = new URLSearchParams(window.location.search).get('q') || '';
        document.title = 'Bibel & Predigt App - Benutzerdefinierte Ansicht';
        renderCustomVerseView(decodeURIComponent(verseQuery));
    } else if (parts[0] === 'bible' && parts.length >= 3) {
        const book = findBookByAnyName(parts[1]);
        if (book) {
            bibleNavContainer.style.display = 'flex';
            appContainer.classList.add('has-context-nav');
            if (parts.length >= 4) {
                document.title = `Bibel & Predigt App - ${book.long_name} ${parts[2]}:${parts[3]}`;
                renderVerseDetailView(book.book_number, parseInt(parts[2]), parseInt(parts[3]));
            } else {
                document.title = `Bibel & Predigt App - ${book.long_name} ${parts[2]}`;
                renderChapterView(book.book_number, parseInt(parts[2]));
            }
        } else {
            history.replaceState(null, '', '/');
            document.title = 'Bibel & Predigt App - Startseite';
            renderBibleBookOverview();
        }
    } else if (parts[0] === 'sermons') {
        const action = parts.length > 1 ? parts[1] : 'list';
        const id = parts[2];
        switch (action) {
            case 'new': 
                document.title = 'Bibel & Predigt App - Neue Predigt erstellen';
                renderSermonEditorView(); 
                break;
            case 'view': 
                document.title = 'Bibel & Predigt App - Predigt';
                renderSermonDetailView(id); 
                break;
            case 'edit': 
                document.title = 'Bibel & Predigt App - Predigt bearbeiten';
                renderSermonEditorView(id); 
                break;
            default: 
                document.title = 'Bibel & Predigt App - Predigten';
                renderSermonListView();
        }
    } else if (parts[0] === 'bible-note' && parts[1] === 'edit' && parts.length >= 4) {
        document.title = 'Bibel & Predigt App - Notiz bearbeiten';
        renderVerseNoteEditView(parts[2], parts[3]);
    } else if (parts[0] === 'tags' && parts.length >= 2) {
        document.title = `Bibel & Predigt App - Tag: ${decodeURIComponent(parts[1])}`;
        renderTagDetailView(decodeURIComponent(parts[1]));
    } else if (parts[0] === 'tags') {
        document.title = 'Bibel & Predigt App - Tags';
        renderAllTagsPage();
    } else if (parts[0] === 'journal' && parts[3] === 'entry' && parts.length >= 6 && parts[5] === 'edit') {
        document.title = 'Bibel & Predigt App - Eintrag bearbeiten';
        const type = parts[1] === 'view' ? 'user' : parts[1];
        const key = type === 'user' ? decodeURIComponent(parts[2]) : parts[2];
        renderJournalEntryEditView({ type, key, entryId: parts[4] });
    } else if (parts[0] === 'journal' && parts[3] === 'entry') {
        document.title = 'Bibel & Predigt App - Journal-Eintrag';
        const type = parts[1] === 'view' ? 'user' : parts[1];
        const key = type === 'user' ? decodeURIComponent(parts[2]) : parts[2];
        renderJournalEntryDetailView({ type, key, entryId: parts[4] });
    } else if (parts[0] === 'journal' && parts[1] === 'book-notes-overview' && parts.length >= 3) {
        document.title = 'Bibel & Predigt App - Buch-Notizen';
        renderBookNotesOverview(parseInt(parts[2]));
    } else if (parts[0] === 'search') {
        document.title = 'Bibel & Predigt App - Suche';
        const params = new URLSearchParams(window.location.search);
        const query = params.get('q') || '';
        const filter = params.get('filter') || 'all';
        const testament = params.get('testament') || 'Alle';
        renderSearchPage(query, filter, testament);
    } else if (parts[0] === 'recent') {
        document.title = 'Bibel & Predigt App - Letzte Aktivitäten';
        renderRecentActivityPage();
    } else if (parts[0] === 'journals') {
        document.title = 'Bibel & Predigt App - Meine Journale';
        renderJournalOverviewPage();
    } else if (parts[0] === 'journal' && parts.length >= 3) {
        const type = parts[1] === 'view' ? 'user' : parts[1];
        const key = type === 'user' ? decodeURIComponent(parts[2]) : key;
        document.title = `Bibel & Predigt App - Journal: ${key}`;
        renderJournalView({ type, key: type === 'user' ? key : key, journalName: key });
    } else {
        history.replaceState(null, '', '/');
        document.title = 'Bibel & Predigt App - Startseite';
        renderBibleBookOverview();
    }
};