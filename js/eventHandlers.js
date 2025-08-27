import * as state from './state.js';
import * as utils from './utils.js';
import { postAPI } from './api.js';
import { router } from './router.js';
import { showVersePopup, hideVersePopup, showStrongsPopup, hideStrongsPopup, showChapterPopup, hideChapterPopup, showCommentaryPopup, hideCommentaryPopup, showDictionaryPopup, hideDictionaryPopup } from './ui/popups.js';
import { rebuildSermonIndex, buildStrongsVerseIndex } from './services/dataBuilder.js';
import { findCommentsForVerse } from './views/bibleView.js';

function handleGlobalClick(e) {
    const anchor = e.target.closest('a[data-link]');
    if (anchor) {
        e.preventDefault();
        const rawHref = anchor.getAttribute('href');
        history.pushState(null, '', rawHref);
        router();
        hideVersePopup();
        hideStrongsPopup();
        hideChapterPopup();
        hideCommentaryPopup();
        hideDictionaryPopup();
    }
    const verseHoverTrigger = e.target.closest('.verse-mention-hover');
    const strongsHoverTrigger = e.target.closest('.strongs-mention-hover');
    const chapterHoverTrigger = e.target.closest('.chapter-mention-hover');
    const commentaryHoverTrigger = e.target.closest('.commentary-mention-hover');
    const dictionaryHoverTrigger = e.target.closest('.dictionary-mention-hover');
    const clickedInsideVersePopup = e.target.closest('#verse-popup');
    const clickedInsideStrongsPopup = e.target.closest('#strongs-popup');
    const clickedInsideChapterPopup = e.target.closest('#chapter-popup');
    const clickedInsideCommentaryPopup = e.target.closest('#commentary-popup');
    const clickedInsideDictionaryPopup = e.target.closest('#dictionary-popup');
    
    if (document.querySelector('#verse-popup.visible') && !verseHoverTrigger && !clickedInsideVersePopup) {
        hideVersePopup();
    }
    if (document.querySelector('#strongs-popup.visible') && !strongsHoverTrigger && !clickedInsideStrongsPopup) {
        hideStrongsPopup();
    }
    if (document.querySelector('#chapter-popup.visible') && !chapterHoverTrigger && !clickedInsideChapterPopup) {
        hideChapterPopup();
    }
    if (document.querySelector('#commentary-popup.visible') && !commentaryHoverTrigger && !clickedInsideCommentaryPopup && !e.target.closest('#show-full-commentary-btn')) {
        hideCommentaryPopup();
    }
    if (document.querySelector('#dictionary-popup.visible') && !dictionaryHoverTrigger && !clickedInsideDictionaryPopup) {
        hideDictionaryPopup();
    }
}

async function handleSaveNew(saveBtn) {
    const editor = document.getElementById('markdown-editor');
    if (!editor) return Promise.reject();
    const titleInput = document.getElementById('new-entry-title');
    const tagsInput = document.getElementById('new-entry-tags');
    const title = titleInput ? titleInput.value.trim() : '';
    const rawContent = editor.value;
    const tags = tagsInput ? tagsInput.value.split(',').map(t => t.trim()).filter(Boolean) : [];
    if (titleInput && !title) {
        alert('Fehler: Bitte geben Sie einen Titel ein.');
        return Promise.reject();
    }
    if (!rawContent || rawContent.trim() === '') {
        alert('Fehler: Der Inhalt darf nicht leer sein.');
        return Promise.reject();
    }
    const verseKey = saveBtn.dataset.verseKey;
    const journalType = saveBtn.dataset.journalType;
    const journalKey = saveBtn.dataset.journalKey;
    const sourceMap = {
        'note': { source: state.notes, endpoint: '/api/notes', isNote: true },
        'user': { source: state.journals, endpoint: '/api/journals' },
        'book': { source: state.booknotes, endpoint: '/api/booknotes' },
        'chapter': { source: state.chapternotes, endpoint: '/api/chapternotes' }
    };
    const typeKey = journalType || (verseKey ? 'note' : null);
    const dataKey = journalKey || verseKey;
    const config = sourceMap[typeKey];
    if (config) {
        const newEntryData = {
            content: rawContent,
            tags: tags,
            timestamp: new Date().toISOString(),
            id: `entry-${utils.generateSlugId(title, config.source[dataKey])}`
        };
        if (!config.isNote) newEntryData.title = title;
        else newEntryData.id = `${dataKey}-${(config.source[dataKey] || []).length + 1}`;
        if (!config.source[dataKey]) config.source[dataKey] = [];
        config.source[dataKey].push(newEntryData);
        if (await postAPI(config.endpoint, config.source)) {
            utils.showToast('Eintrag erfolgreich gespeichert!');
            router();
        } else {
            utils.showToast('Fehler beim Speichern des Eintrags.', false);
        }
    }
}

async function handleUpdate(updateBtn) {
    const editor = document.getElementById('markdown-editor');
    if (!editor) return Promise.reject();
    const entryId = updateBtn.dataset.entryId;
    const newRawContent = editor.value;
    const newTags = document.getElementById('edit-entry-tags').value.split(',').map(t => t.trim()).filter(Boolean);
    const backLink = updateBtn.dataset.backLink;
    let success = false;
    const sourceMap = {
        'note': { source: state.notes, endpoint: '/api/notes' },
        'user': { source: state.journals, endpoint: '/api/journals' },
        'book': { source: state.booknotes, endpoint: '/api/booknotes' },
        'chapter': { source: state.chapternotes, endpoint: '/api/chapternotes' }
    };
    const typeKey = updateBtn.dataset.journalType || (updateBtn.dataset.verseKey ? 'note' : null);
    const dataKey = updateBtn.dataset.journalKey || updateBtn.dataset.verseKey;
    const config = sourceMap[typeKey];
    if (config?.source[dataKey]) {
        const entryIndex = config.source[dataKey].findIndex(e => e.id === entryId);
        if (entryIndex > -1) {
            const updatedData = {
                content: newRawContent,
                tags: newTags,
                processedContent: null,
                plainTextContent: null,
                flags: null,
                internalLinks: null,
                chapterLinks: null,
                resources: null
            };
            if (typeKey !== 'note') {
                const newTitle = document.getElementById('edit-entry-title').value.trim();
                if (!newTitle) {
                    alert('Fehler: Der Titel darf nicht leer sein.');
                    return Promise.reject();
                }
                updatedData.title = newTitle;
            }
            Object.assign(config.source[dataKey][entryIndex], updatedData);
            if (await postAPI(config.endpoint, config.source)) {
                success = true;
            }
        }
    }
    if (success) {
        utils.showToast('Änderungen erfolgreich gespeichert!');
        history.pushState(null, '', backLink);
        router();
    } else {
        utils.showToast('Fehler beim Speichern der Änderungen.', false);
    }
}

function generateSermonId(date, title, allSermons) {
    const datePart = date || new Date().toISOString().split('T')[0];
    const sermonsOnSameDay = allSermons.filter(s => s.date === datePart);
    let maxIdForDay = 0;
    sermonsOnSameDay.forEach(s => {
        const idPart = parseInt(s.id.split('-')[3], 10);
        if (!isNaN(idPart) && idPart > maxIdForDay) maxIdForDay = idPart;
    });
    const newIdForDay = maxIdForDay + 1;
    const titleSlug = (title || 'unbenannt').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/\s+/g, '-').replace(/[^\w-]+/g, '').substring(0, 50);
    return `${datePart}-${newIdForDay}-${titleSlug}`;
};

async function saveSermon() {
    const editor = document.getElementById('markdown-editor');
    if (!editor) {
        utils.showToast('Editor nicht initialisiert.', false);
        return;
    }
    const id = document.getElementById('sermonId').value;
    const isEditing = !!id;
    const title = document.getElementById('editorTitle').value.trim();
    const date = document.getElementById('editorDate').value;
    if (!title) {
        utils.showToast('Ein Titel ist erforderlich.', false);
        return;
    }
    const getTagValues = (type) => Array.from(document.querySelectorAll(`#${type}-input-container .tag-badge`)).map(el => el.dataset.value);
    const markdownContent = editor.value;
    const sermonData = {
        id: isEditing ? id : generateSermonId(date, title, state.sermons),
        title: title,
        date: date,
        time: document.getElementById('editorTime').value,
        status: document.getElementById('editorStatus').value,
        bibleVerses: getTagValues('bibleVerses'),
        tags: getTagValues('tags'),
        content: markdownContent,
        plainTextContent: utils.extractPlainTextFromHtml(state.markdownConverter.makeHtml(markdownContent))
    };
    if (isEditing) {
        const index = state.sermons.findIndex(s => s.id === sermonData.id);
        if (index > -1) state.sermons[index] = sermonData;
    } else {
        state.sermons.push(sermonData);
    }
    if (await postAPI('/api/sermons', state.sermons)) {
        utils.showToast('Predigt erfolgreich gespeichert!', true);
        rebuildSermonIndex();
        history.pushState(null, '', `/sermons/view/${sermonData.id}`);
        router();
    } else {
        utils.showToast('Fehler beim Speichern der Predigt.', false);
    }
}

async function handleAppClicks(e) {
    const saveBtn = e.target.closest('#save-note-btn, #save-entry-btn, #update-entry-btn, #update-note-btn, #save-sermon-btn');
    if (saveBtn) {
        e.preventDefault();
        const originalHtml = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span class="spinner-sm"></span> Speichern...`;
        try {
            if (saveBtn.id === 'save-note-btn' || saveBtn.id === 'save-entry-btn') await handleSaveNew(saveBtn);
            else if (saveBtn.id === 'update-entry-btn' || saveBtn.id === 'update-note-btn') await handleUpdate(saveBtn);
            else if (saveBtn.id === 'save-sermon-btn') await saveSermon();
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalHtml;
        }
    }
    const createJournalBtn = e.target.closest('#create-journal-btn');
    if (createJournalBtn) {
        const input = document.getElementById('new-journal-name');
        const newName = input.value.trim();
        if (newName && !state.journals[newName]) {
            state.journals[newName] = [];
            if (await postAPI('/api/journals', state.journals)) {
                utils.showToast('Journal erfolgreich erstellt!');
                router();
            } else utils.showToast('Fehler beim Erstellen des Journals.', false);
        } else if (state.journals[newName]) {
            alert('Fehler: Ein Journal mit diesem Namen existiert bereits.');
        }
    }
    const deleteBtn = e.target.closest('.delete-note-btn, .delete-entry-btn, .delete-sermon-btn, .delete-journal-btn');
    if (deleteBtn) {
        e.preventDefault();
        const entryId = deleteBtn.dataset.id;
        const journalName = deleteBtn.dataset.name;
        let success = false;
        if (deleteBtn.classList.contains('delete-journal-btn')) {
            if (confirm(`Journal "${journalName}" und alle Einträge wirklich löschen?`)) {
                delete state.journals[journalName];
                if (await postAPI('/api/journals', state.journals)) {
                    utils.showToast('Journal erfolgreich gelöscht!');
                    router();
                } else {
                    utils.showToast('Fehler beim Löschen des Journals.', false);
                }
            }
            return;
        }
        if (confirm('Diesen Eintrag wirklich löschen?')) {
            const backLink = deleteBtn.dataset.backLink || window.location.pathname;
            if (deleteBtn.classList.contains('delete-sermon-btn')) {
                const initialLength = state.sermons.length;
                state.setSermons(state.sermons.filter(s => s.id !== entryId));
                if (state.sermons.length < initialLength && await postAPI('/api/sermons', state.sermons)) {
                    success = true;
                    rebuildSermonIndex();
                    buildStrongsVerseIndex();
                }
            } else {
                const sourceMap = {
                    'note': { source: state.notes, endpoint: '/api/notes' },
                    'user': { source: state.journals, endpoint: '/api/journals' },
                    'book': { source: state.booknotes, endpoint: '/api/booknotes' },
                    'chapter': { source: state.chapternotes, endpoint: '/api/chapternotes' }
                };
                const typeKey = deleteBtn.dataset.journalType || (deleteBtn.dataset.verseKey ? 'note' : null);
                const dataKey = deleteBtn.dataset.journalKey || deleteBtn.dataset.verseKey;
                if (typeKey && dataKey && sourceMap[typeKey]?.source[dataKey]) {
                    const targetArray = sourceMap[typeKey].source[dataKey];
                    const index = targetArray.findIndex(e => e.id === entryId);
                    if (index > -1) {
                        targetArray.splice(index, 1);
                        if (await postAPI(sourceMap[typeKey].endpoint, sourceMap[typeKey].source)) {
                            success = true;
                        }
                    }
                }
            }
            if (success) {
                utils.showToast('Eintrag erfolgreich gelöscht!');
                if (window.location.pathname !== backLink) history.pushState(null, '', backLink);
                router();
            } else {
                utils.showToast('Fehler beim Löschen des Eintrags.', false);
            }
        }
        return;
    }
    const verseHoverTrigger = e.target.closest('.verse-mention-hover');
    if (verseHoverTrigger) {
        e.preventDefault();
        e.stopPropagation();
        hideStrongsPopup();
        hideChapterPopup();
        hideCommentaryPopup();
        hideDictionaryPopup();
        if (document.querySelector('#verse-popup.visible')) {
            hideVersePopup();
        } else {
            showVersePopup(verseHoverTrigger);
        }
        return;
    }
    const strongsHoverTrigger = e.target.closest('.strongs-mention-hover');
    if (strongsHoverTrigger) {
        e.preventDefault();
        e.stopPropagation();
        hideVersePopup();
        hideChapterPopup();
        hideCommentaryPopup();
        hideDictionaryPopup();
        if (document.querySelector('#strongs-popup.visible')) {
            hideStrongsPopup();
        } else {
            showStrongsPopup(strongsHoverTrigger);
        }
        return;
    }
    const chapterHoverTrigger = e.target.closest('.chapter-mention-hover');
    if (chapterHoverTrigger) {
        e.preventDefault();
        e.stopPropagation();
        hideVersePopup();
        hideStrongsPopup();
        hideCommentaryPopup();
        hideDictionaryPopup();
        if (document.querySelector('#chapter-popup.visible')) {
            hideChapterPopup();
        } else {
            showChapterPopup(chapterHoverTrigger);
        }
        return;
    }
    const dictionaryHoverTrigger = e.target.closest('.dictionary-mention-hover');
    if (dictionaryHoverTrigger) {
        e.preventDefault();
        e.stopPropagation();
        hideVersePopup();
        hideStrongsPopup();
        hideChapterPopup();
        hideCommentaryPopup();
        if (document.querySelector('#dictionary-popup.visible')) {
            hideDictionaryPopup();
        } else {
            showDictionaryPopup(dictionaryHoverTrigger);
        }
        return;
    }
    const fullCommentaryBtn = e.target.closest('#show-full-commentary-btn');
    if (fullCommentaryBtn) {
        e.preventDefault();
        const bookNumber = parseInt(fullCommentaryBtn.dataset.bookNumber);
        const chapter = parseInt(fullCommentaryBtn.dataset.chapter);
        const verseNum = parseInt(fullCommentaryBtn.dataset.verse);
        const commentariesBySource = findCommentsForVerse(bookNumber, chapter, verseNum);
        if (commentariesBySource.length > 0) {
            const activeTabId = document.querySelector('#commentary-tabs .btn-primary')?.dataset.commentaryTab;
            const activeSource = commentariesBySource.find(s => s.sourceId === activeTabId);
            if (activeSource) {
                const fullText = activeSource.entries.map(e => e.text).join('<hr>');
                fullCommentaryBtn.dataset.sourceName = activeSource.name;
                fullCommentaryBtn.dataset.fullText = encodeURIComponent(fullText);
                showCommentaryPopup(fullCommentaryBtn);
            }
        }
        return;
    }
    const copyBtn = e.target.closest('#copy-share-buttons button');
    if (copyBtn) {
        e.preventDefault();
        const format = copyBtn.dataset.copyFormat;
        const verseStringElement = document.querySelector('.main-verse-card .main-verse strong');
        const verseTextElement = document.querySelector('.main-verse-card .main-verse');
        if (!verseStringElement || !verseTextElement) return;
        const verseRef = verseStringElement.textContent.trim();
        const verseTextContent = verseTextElement.cloneNode(true);
        const strongTag = verseTextContent.querySelector('strong');
        if (strongTag) strongTag.remove();
        const verseText = verseTextContent.textContent.trim();
        let textToCopy = '';
        let successMessage = '';
        switch (format) {
            case 'url':
                textToCopy = window.location.href;
                successMessage = 'URL kopiert!';
                break;
            case 'ref':
                textToCopy = verseRef;
                successMessage = 'Bibelstelle kopiert!';
                break;
            case 'text':
                textToCopy = verseText;
                successMessage = 'Verstext kopiert!';
                break;
            case 'ref-text':
                textToCopy = `${verseRef} – ${verseText}`;
                successMessage = 'Bibelstelle mit Text kopiert!';
                break;
            case 'md':
                textToCopy = `> **${verseRef}** – ${verseText}`;
                successMessage = 'Markdown-Zitat kopiert!';
                break;
            case 'html':
                textToCopy = `<p><strong>${verseRef}</strong> – ${verseText}</p>`;
                successMessage = 'HTML-Code kopiert!';
                break;
        }
        if (textToCopy && navigator.clipboard) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                utils.showToast(successMessage, true);
            }).catch(err => {
                utils.showToast('Fehler beim Kopieren', false);
            });
        }
    }
}

export function initializeGlobalEventHandlers() {
    document.body.addEventListener('click', handleGlobalClick);
    document.getElementById('app-container').addEventListener('click', handleAppClicks);
    const universalSearchInput = document.getElementById('universal-search-input');
    const universalSearchBtn = document.getElementById('universal-search-btn');
    const handleUniversalSearch = () => {
        const query = universalSearchInput.value.trim();
        if (!query) return;
        const allShortNames = state.books.flatMap(book => book.short_name.replace(/[\[\]]/g, '').split(',').map(name => name.trim().toLowerCase())).filter(Boolean);
        const queryLower = query.toLowerCase();
        const isVerseQuery = allShortNames.some(name => queryLower.startsWith(name));
        const encodedQuery = encodeURIComponent(query);
        let link;
        if (isVerseQuery) {
            link = `/bible/custom-view?q=${encodedQuery}`;
        } else {
            link = `/search?q=${encodedQuery}`;
        }
        history.pushState(null, '', link);
        router();
        universalSearchInput.value = '';
    };
    universalSearchBtn?.addEventListener('click', handleUniversalSearch);
    universalSearchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleUniversalSearch();
        }
    });
}