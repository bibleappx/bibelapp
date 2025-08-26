import * as state from '../state.js';
import * as utils from '../utils.js';
import { router } from '../router.js';
import { initializeMarkdownEditor } from '../ui/editor.js';
import { getProcessedEntry, formatVerseText, processStrongsContentForDisplay } from '../services/contentProcessor.js';
import { createFilterPillsHTML, renderVerseBlockHTML, renderTagsHTML } from '../ui/components.js';

const appContainer = document.getElementById('app-container');
const bibleNavContainer = document.getElementById('bible-nav-container');

export function findCommentsForVerse(bookNumber, chapterNumber, verseNumber) {
    const allFoundCommentaries = [];
    if (!state.availableCommentaries) return [];
    for (const source of state.availableCommentaries) {
        const foundEntries = source.data.filter(c => {
            if (c.book_number !== bookNumber) return false;
            
            const chapterFrom = c.chapter_number_from;
            const chapterTo = c.chapter_number_to === 0 ? chapterFrom : c.chapter_number_to;
            if (chapterNumber < chapterFrom || chapterNumber > chapterTo) return false;

            const verseFrom = c.verse_number_from;
            const verseTo = c.verse_number_to === 0 ? verseFrom : c.verse_number_to;
            if (verseNumber < verseFrom || verseNumber > verseTo) return false;
            
            return true;
        });

        if (foundEntries.length > 0) {
            allFoundCommentaries.push({
                sourceId: source.id,
                name: source.name,
                entries: foundEntries
            });
        }
    }
    return allFoundCommentaries;
}

function renderBibleNav(currentBookNumber, currentChapter) {
    const book = utils.getBook(currentBookNumber);
    if (!book) return;
    const maxChapter = Math.max(0, ...state.verses.filter(v => v.book_number === currentBookNumber).map(v => v.chapter));
    const bookOptions = state.books.map(b => `<option value="${b.book_number}" ${b.book_number === currentBookNumber ? 'selected' : ''}>${b.long_name}</option>`).join('');
    const chapterOptions = Array.from({ length: maxChapter }, (_, i) => i + 1).map(c => `<option value="${c}" ${c === currentChapter ? 'selected' : ''}>Kapitel ${c}</option>`).join('');
    const currentBookIndex = state.books.findIndex(b => b.book_number === currentBookNumber);
    const prevBook = currentBookIndex > 0 ? state.books[currentBookIndex - 1] : null;
    const nextBook = currentBookIndex < state.books.length - 1 ? state.books[currentBookIndex + 1] : null;
    const prevBookBtn = prevBook ? `<a href="/bible/${utils.getPrimaryShortName(prevBook)}/1" data-link class="btn-icon" title="Vorheriges Buch: ${prevBook.long_name}"><i class="fa-solid fa-angles-left"></i></a>` : `<button class="btn-icon" disabled><i class="fa-solid fa-angles-left"></i></button>`;
    const nextBookBtn = nextBook ? `<a href="/bible/${utils.getPrimaryShortName(nextBook)}/1" data-link class="btn-icon" title="Nächstes Buch: ${nextBook.long_name}"><i class="fa-solid fa-angles-right"></i></a>` : `<button class="btn-icon" disabled><i class="fa-solid fa-angles-right"></i></button>`;
    bibleNavContainer.innerHTML = `${prevBookBtn}<select id="book-select" title="Buch auswählen" class="form-select">${bookOptions}</select><select id="chapter-select" title="Kapitel auswählen" class="form-select">${chapterOptions}</select>${nextBookBtn}`;
    document.getElementById('book-select').addEventListener('change', (e) => {
        const newBook = utils.getBook(parseInt(e.target.value));
        if (newBook) {
            history.pushState(null, '', `/bible/${utils.getPrimaryShortName(newBook)}/1`);
            router();
        }
    });
    document.getElementById('chapter-select').addEventListener('change', (e) => {
        history.pushState(null, '', `/bible/${utils.getPrimaryShortName(book)}/${e.target.value}`);
        router();
    });
}

function setupTranslationControls(bookNumber, chapter, verseNum) {
    const comparisonCard = document.getElementById('translation-comparison-card');
    const comparisonContainer = document.getElementById('comparison-verses-container');
    const allButtonsGroup = document.getElementById('translation-buttons-group');
    if (!comparisonCard || !comparisonContainer) return;
    const removeComparisonVerse = (translationId) => {
        const verseItem = comparisonContainer.querySelector(`[data-translation-id="${translationId}"]`);
        if (verseItem) verseItem.remove();
        const controlButton = allButtonsGroup.querySelector(`button[data-translation-id="${translationId}"]`);
        if (controlButton) controlButton.classList.remove('active');
    };
    const addComparisonVerse = (translationId) => {
        if (comparisonContainer.querySelector(`[data-translation-id="${translationId}"]`)) return;
        const translation = state.availableTranslations.find(t => t.id === translationId);
        const verseText = utils.getVerseText(bookNumber, chapter, verseNum, translationId);
        if (translation && verseText) {
            const verseElement = document.createElement('div');
            verseElement.className = 'comparison-verse-item';
            verseElement.dataset.translationId = translationId;
            verseElement.innerHTML = `
                <div class="comparison-verse-header">
                    <strong>${translation.name}</strong>
                    <button type="button" class="remove-comparison-btn" title="Entfernen"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <p class="comparison-verse-text">${formatVerseText(verseText, bookNumber)}</p>`;
            comparisonContainer.appendChild(verseElement);
            const button = allButtonsGroup.querySelector(`button[data-translation-id="${translationId}"]`);
            if (button) button.classList.add('active');
        }
    };
    comparisonCard.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        const translationId = target.dataset.translationId;
        if (translationId) {
            target.classList.contains('active') ? removeComparisonVerse(translationId) : addComparisonVerse(translationId);
        }
        if (target.id === 'add-all-translations-btn') {
            state.availableTranslations.forEach(t => t.id !== 'default' && addComparisonVerse(t.id));
        }
        if (target.id === 'remove-all-translations-btn') {
            comparisonContainer.querySelectorAll('.comparison-verse-item').forEach(item => removeComparisonVerse(item.dataset.translationId));
        }
    });
    comparisonContainer.addEventListener('click', (e) => {
        const removeButton = e.target.closest('.remove-comparison-btn');
        if (removeButton) {
            const verseItem = removeButton.closest('.comparison-verse-item');
            if (verseItem) removeComparisonVerse(verseItem.dataset.translationId);
        }
    });
}

function buildSectionHeader(iconClass, titleText, actionButtonsHTML = '') {
    return `
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 section-header">
            <div class="d-flex align-items-center gap-2">
                <i class="${iconClass}"></i>
                <span class="view-title mb-0" style="font-size: 1.25rem;">${titleText}</span>
            </div>
            ${actionButtonsHTML}
        </div>
    `;
}

export function renderBibleBookOverview() {
    const oldTestamentBooks = state.books.filter(b => b.book_number <= 460);
    const newTestamentBooks = state.books.filter(b => b.book_number > 460);
    const createBookButtons = (bookList) => {
        return bookList.map(book => {
            const shortName = utils.getPrimaryShortName(book);
            const bgColor = book.book_color || '#e9ecef';
            const textColor = utils.getTextColorForBg(bgColor);
            const link = `/bible/${shortName}/1`;
            return `<a href="${link}" data-link class="btn btn-sm bible-book-btn" style="background-color: ${bgColor}; color: ${textColor};">${shortName}</a>`;
        }).join('');
    };
    const otButtonsHTML = createBookButtons(oldTestamentBooks);
    const ntButtonsHTML = createBookButtons(newTestamentBooks);
    appContainer.innerHTML = `
    <div class="page-header">
        <h1 class="view-title">Bibelübersicht</h1>
    </div>
    <div class="card mb-4 page-controls">
        <div class="card-body">
            <div class="input-group">
                <input type="text" id="bible-quick-search-input" class="form-control" placeholder="Bibelstelle(n) eingeben (z.B. Joh 3,16)...">
                <button id="bible-quick-search-btn" class="btn btn-primary" title="Anzeigen"><i class="fa-solid fa-arrow-right"></i></button>
            </div>
        </div>
    </div>
    <div class="card mb-4">
        <div class="card-body">
            <h3 class="view-subheader">Altes Testament</h3>
            <div class="bible-books-grid">${otButtonsHTML}</div>
            <hr>
            <h3 class="view-subheader mt-3">Neues Testament</h3>
            <div class="bible-books-grid">${ntButtonsHTML}</div>
        </div>
    </div>`;
    const handleQuickSearch = () => {
        const input = document.getElementById('bible-quick-search-input');
        const query = input.value.trim();
        if (!query) return;
        const encodedQuery = encodeURIComponent(query);
        const link = `/bible/custom-view?q=${encodedQuery}`;
        history.pushState(null, '', link);
        router();
    };
    document.getElementById('bible-quick-search-btn').addEventListener('click', handleQuickSearch);
    document.getElementById('bible-quick-search-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleQuickSearch();
        }
    });
}

export function renderCustomVerseView(verseQuery) {
    const foundVerses = utils.parseMultiVerseQuery(verseQuery);
    foundVerses.sort((a, b) => a.book_number - b.book_number || a.chapter - b.chapter || a.verse - b.verse);
    const totalCount = foundVerses.length;
    const verseLabel = totalCount === 1 ? 'Vers' : 'Verse';
    const backButtonHTML = `<a href="/" data-link class="btn btn-secondary btn-sm"><i class="fa-solid fa-arrow-left"></i> Zurück zur Übersicht</a>`;
    const titleHTML = `<h1 class="view-title">Bibelstellen-Ansicht (${totalCount} ${verseLabel})</h1>`;
    if (totalCount === 0) {
        appContainer.innerHTML = `
        <div class="page-header d-flex justify-content-between align-items-center mb-4">
            ${titleHTML}
            ${backButtonHTML}
        </div>
        <div class="card card-body text-danger">Keine gültigen Bibelstellen in der Anfrage gefunden.</div>`;
        return;
    }
    const groupedByBook = foundVerses.reduce((acc, verse) => {
        const bookNum = verse.book_number;
        if (!acc[bookNum]) acc[bookNum] = [];
        acc[bookNum].push(verse);
        return acc;
    }, {});
    const oldTestamentHTML = [];
    const newTestamentHTML = [];
    const sortedBookNumbers = Object.keys(groupedByBook).map(Number).sort((a, b) => a - b);
    for (const bookNum of sortedBookNumbers) {
        const versesInBook = groupedByBook[bookNum];
        const book = utils.getBook(bookNum);
        let bookHtml = `<h3 class="view-subheader">${book.long_name}</h3>`;
        bookHtml += `<div class="verse-block-container mb-4">${versesInBook.map(v => renderVerseBlockHTML(v)).join('')}</div>`;
        if (book.book_number <= 460) oldTestamentHTML.push(bookHtml);
        else newTestamentHTML.push(bookHtml);
    }
    let finalHtml = `
    <div class="page-header d-flex justify-content-between align-items-center mb-4">
        ${titleHTML}
        ${backButtonHTML}
    </div>`;
    if (oldTestamentHTML.length > 0) {
        finalHtml += `<h2 class="testament-header">Altes Testament</h2>${oldTestamentHTML.join('')}`;
    }
    if (newTestamentHTML.length > 0) {
        const marginTopClass = oldTestamentHTML.length > 0 ? 'mt-5' : '';
        finalHtml += `<h2 class="testament-header ${marginTopClass}">Neues Testament</h2>${newTestamentHTML.join('')}`;
    }
    appContainer.innerHTML = finalHtml;
}

export function renderChapterView(bookNumber, chapter) {
    const book = utils.getBook(bookNumber);
    if (!book) return;
    renderBibleNav(bookNumber, chapter);
    const chapterVerses = state.verses.filter(v => v.book_number === bookNumber && v.chapter === chapter);
    const maxChapter = Math.max(0, ...state.verses.filter(v => v.book_number === bookNumber).map(v => v.chapter));
    const primaryShortName = utils.getPrimaryShortName(book);
    const prevChapterLink = chapter > 1 ? `/bible/${primaryShortName}/${chapter - 1}` : null;
    const nextChapterLink = chapter < maxChapter ? `/bible/${primaryShortName}/${chapter + 1}` : null;
    const prevChapterBtn = prevChapterLink ? `<a href="${prevChapterLink}" class="btn-icon" data-link title="Vorheriges Kapitel"><i class="fa-solid fa-caret-left"></i></a>` : `<button class="btn-icon" disabled title="Vorheriges Kapitel"><i class="fa-solid fa-caret-left"></i></button>`;
    const nextChapterBtn = nextChapterLink ? `<a href="${nextChapterLink}" class="btn-icon" data-link title="Nächstes Kapitel"><i class="fa-solid fa-caret-right"></i></a>` : `<button class="btn-icon" disabled title="Nächstes Kapitel"><i class="fa-solid fa-caret-right"></i></button>`;
    
    const commentaryButtonHTML = '';

    const filters = [
        { filter: 'all', icon: 'fa-solid fa-list-ul', title: 'Alle Verse' },
        { filter: 'note', icon: 'fa-solid fa-pencil', title: 'Verse mit Notizen' },
        { filter: 'sermon', icon: 'fa-solid fa-book-bible', title: 'Verse in Predigten' },
        { filter: 'crossref', icon: 'fa-solid fa-link', title: 'Verse mit Querverweisen' },
        { filter: 'media', icon: 'fa-solid fa-photo-film', title: 'Verse mit Medien' },
        { filter: 'resource', icon: 'fa-solid fa-paperclip', title: 'Verse mit Ressourcen' },
    ];
    const filterPillsHTML = createFilterPillsHTML(filters);
    const chapterKey = `${bookNumber}-${chapter}`;
    const chapterReferences = state.chapterReferenceIndexByChapter.get(chapterKey) || [];
    let chapterRefsButtonHTML = '';
    if (chapterReferences.length > 0) {
        const badge = `<span class="badge bg-secondary ms-2">${chapterReferences.length}</span>`;
        chapterRefsButtonHTML = `
        <button class="btn btn-sm btn-outline-secondary" id="show-chapter-refs-btn" title="Referenzen auf dieses Kapitel anzeigen">
            <i class="fa-solid fa-comments"></i> ${badge}
        </button>`;
    }
    
    const content = `
    <div class="page-header d-flex flex-wrap gap-2 justify-content-between align-items-center mb-4">
        <h1 class="view-title" style="margin-bottom: 0;">${book.long_name} ${chapter}</h1>
        <div class="d-flex gap-2">
            ${prevChapterBtn}
            ${nextChapterBtn}
        </div>
    </div>
    
    <div class="card mb-4 page-controls">
        <div class="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div class="d-flex flex-wrap align-items-center gap-2">
                <a href="/journal/chapter/${bookNumber}-${chapter}" data-link class="btn-icon" title="Kapitel-Notizen"><i class="fa-solid fa-file-lines"></i></a>
                <a href="/journal/book/${bookNumber}" data-link class="btn-icon" title="Buch-Notizen"><i class="fa-solid fa-book-bookmark"></i></a>
                <a href="/journal/book-notes-overview/${bookNumber}" data-link class="btn-icon" title="Alle Notizen dieses Buches"><i class="fa-solid fa-folder-open"></i></a>
                ${commentaryButtonHTML}
                ${chapterRefsButtonHTML}
            </div>
            <div class="filter-pills d-flex flex-wrap gap-2">${filterPillsHTML}</div>
        </div>
    </div>

    <div id="chapter-refs-container" class="mb-4"></div>
    
    <div class="verse-block-container">
        ${chapterVerses.map(verse => renderVerseBlockHTML(verse)).join('')}
    </div>`;
    appContainer.innerHTML = content;

    appContainer.querySelector('.filter-pills')?.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-filter]');
        if (button) {
            appContainer.querySelectorAll('.filter-pills .btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const filter = button.dataset.filter;
            appContainer.querySelectorAll('.verse-block').forEach(row => {
                let isVisible = false;
                if (filter === 'all') {
                    isVisible = true;
                } else {
                    switch (filter) {
                        case 'note': isVisible = row.dataset.hasNote === 'true'; break;
                        case 'sermon': isVisible = row.dataset.hasSermon === 'true'; break;
                        case 'crossref': isVisible = row.dataset.hasCrossref === 'true'; break;
                        case 'media': isVisible = row.dataset.hasMedia === 'true'; break;
                        case 'resource': isVisible = row.dataset.hasResource === 'true'; break;
                    }
                }
                row.style.display = isVisible ? 'block' : 'none';
            });
        }
    });

    const refsButton = document.getElementById('show-chapter-refs-btn');
    refsButton?.addEventListener('click', (e) => {
        const container = document.getElementById('chapter-refs-container');
        const button = e.currentTarget;
        if (container.innerHTML !== '') {
            container.innerHTML = '';
            button.classList.remove('active');
        } else {
            const listHTML = chapterReferences.map(ref => `
            <div class="list-group-item cross-reference-item-simple">
                <a href="${ref.link}" data-link>${ref.ref}</a>
                <span class="cross-reference-snippet-simple">${ref.snippet}</span>
            </div>`
            ).join('');
            container.innerHTML = `
            <div class="card card-highlight">
                <div class="card-header"><strong>Referenzen auf dieses Kapitel</strong></div>
                <div class="list-group list-group-flush">${listHTML}</div>
            </div>`;
            button.classList.add('active');
        }
    });
}

function renderContextParagraph(mainVerse, contextVerses, style = 'paragraph') {
    const contextContainer = document.getElementById('context-wrapper');
    if (!contextContainer) return;

    const contextParts = contextVerses.map(verse => {
        const isMain = verse === mainVerse;
        const book = utils.getBook(verse.book_number);
        const shortName = utils.getPrimaryShortName(book);
        const chapterInfo = verse.chapter !== mainVerse.chapter ? `${shortName} ${verse.chapter}:` : '';
        const verseLink = `<a href="/bible/${shortName}/${verse.chapter}/${verse.verse}" data-link>${chapterInfo}${verse.verse}</a>`;
        const verseText = formatVerseText(verse.text.replace(/<pb\/>/g, ''), verse.book_number);
        
        const verseHtml = isMain ? `${verseLink} <strong>${verseText}</strong>` : `${verseLink} ${verseText}`;
        return style === 'verse' ? `<div class="context-verse-item">${verseHtml}</div>` : verseHtml;
    });
    
    contextContainer.innerHTML = style === 'paragraph' ? `<p class="context-paragraph">${contextParts.join(' ')}</p>` : contextParts.join('');
}

function setupCommentaryTabs(commentariesBySource) {
    const tabsContainer = document.getElementById('commentary-tabs');
    if (!tabsContainer) {
        console.warn('Commentary tabs container not found');
        return;
    }

    tabsContainer.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent interference from parent elements
        const button = e.target.closest('button[data-commentary-tab]');
        if (!button) {
            console.log('No commentary tab button clicked', e.target);
            return;
        }

        const tabId = button.dataset.commentaryTab;
        console.log('Switching to commentary tab:', tabId);

        // Update button styles
        tabsContainer.querySelectorAll('button').forEach(btn => {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-outline-secondary');
        });
        button.classList.add('btn-primary');
        button.classList.remove('btn-outline-secondary');

        // Update panel visibility
        document.querySelectorAll('.commentary-panel').forEach(panel => {
            panel.style.display = 'none';
        });
        const targetPanel = document.getElementById(`commentary-panel-${tabId}`);
        if (targetPanel) {
            targetPanel.style.display = 'block';
        } else {
            console.warn(`Commentary panel not found for tabId: ${tabId}`);
        }

        // Update full commentary button
        const fullCommentaryBtn = document.querySelector('#commentary-card .card-footer button');
        if (fullCommentaryBtn) {
            const currentSource = commentariesBySource.find(s => s.sourceId === tabId);
            if (currentSource) {
                const fullText = currentSource.entries.map(e => e.text).join('<hr>');
                fullCommentaryBtn.dataset.sourceName = currentSource.name;
                fullCommentaryBtn.dataset.fullText = encodeURIComponent(fullText);
            } else {
                console.warn(`No source found for tabId: ${tabId}`);
            }
        }
    });
}

export function renderVerseDetailView(bookNumber, chapter, verseNum) {
    const book = utils.getBook(bookNumber);
    const mainVerse = state.verses.find(v => v.book_number === bookNumber && v.chapter === chapter && v.verse === verseNum);
    if (!book || !mainVerse) { 
        appContainer.innerHTML = `<div class="card"><div class="card-body text-danger">Fehler: Dieser Vers wurde nicht gefunden.</div></div>`; 
        return; 
    }

    renderBibleNav(bookNumber, chapter);
    
    const commentariesBySource = findCommentsForVerse(bookNumber, chapter, verseNum);
    console.log('Commentaries found:', commentariesBySource); // Debug log
    
    let commentaryHTML = '';
    if (commentariesBySource.length > 0) {
        const totalComments = commentariesBySource.reduce((acc, source) => acc + source.entries.length, 0);

        const commentaryTabsHTML = commentariesBySource.map((source, index) => `
            <button class="btn btn-sm ${index === 0 ? 'btn-primary' : 'btn-outline-secondary'}" data-commentary-tab="${source.sourceId}">
                ${source.name}
            </button>
        `).join('');

        const commentaryPanelsHTML = commentariesBySource.map((source, index) => {
            const itemsHTML = source.entries.map(comment => 
                `<div class="commentary-item markdown-body">${processStrongsContentForDisplay(comment.text)}</div>`
            ).join('<hr class="my-3">');
            
            return `<div class="commentary-panel" id="commentary-panel-${source.sourceId}" style="display: ${index === 0 ? 'block' : 'none'};">
                ${itemsHTML}
            </div>`;
        }).join('');

        commentaryHTML = `
        <div class="card mb-4" id="commentary-card">
            <button class="accordion-button d-flex justify-content-between align-items-center card-header" id="commentary-toggle-btn">
                <span>
                    <i class="fa-solid fa-comment-dots me-2"></i>Kommentar(e)
                    <span class="badge bg-secondary ms-2">${totalComments}</span>
                </span>
            </button>
            <div class="accordion-content" id="commentary-content" style="display: none;">
                <div class="card-header bg-light">
                    <div class="d-flex flex-wrap gap-2" id="commentary-tabs">
                        ${commentaryTabsHTML}
                    </div>
                </div>
                <div class="card-body">
                    ${commentaryPanelsHTML}
                </div>
                <div class="card-footer">
                    <button id="show-full-commentary-btn" class="btn btn-sm btn-link p-0" data-book-number="${bookNumber}" data-chapter="${chapter}" data-verse="${verseNum}" data-source-name="Kommentare in der Vollansicht">Kommentare in der Vollansicht</button>
                </div>
            </div>
        </div>`;
    }
    
    const getAdjacentVerse = (b, c, v, direction) => {
        const currentIndex = state.verses.findIndex(verse => verse.book_number === b && verse.chapter === c && verse.verse === v);
        if (currentIndex === -1) return null;
        const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
        if (targetIndex < 0 || targetIndex >= state.verses.length) return null;
        const adjacentVerse = state.verses[targetIndex];
        const book = utils.getBook(adjacentVerse.book_number);
        const primaryShortName = utils.getPrimaryShortName(book);
        return { href: `/bible/${primaryShortName}/${adjacentVerse.chapter}/${adjacentVerse.verse}`, text: `${book.long_name} ${adjacentVerse.chapter}:${adjacentVerse.verse}` };
    };

    const prevVerseLink = getAdjacentVerse(bookNumber, chapter, verseNum, 'prev');
    const nextVerseLink = getAdjacentVerse(bookNumber, chapter, verseNum, 'next');
    const prevBtn = prevVerseLink ? `<a href="${prevVerseLink.href}" class="btn btn-secondary btn-sm" data-link title="${prevVerseLink.text}"><i class="fa-solid fa-arrow-left"></i></a>` : `<button class="btn btn-secondary btn-sm" disabled><i class="fa-solid fa-arrow-left"></i></button>`;
    const nextBtn = nextVerseLink ? `<a href="${nextVerseLink.href}" class="btn btn-secondary btn-sm" data-link title="${nextVerseLink.text}"><i class="fa-solid fa-arrow-right"></i></a>` : `<button class="btn btn-secondary btn-sm" disabled><i class="fa-solid fa-arrow-right"></i></button>`;
    const verseNavHTML = `<div class="verse-navigation d-flex gap-2">${prevBtn}${nextBtn}</div>`;
    const verseString = `${book.long_name} ${chapter}:${verseNum}`;
    const verseTextOnly = mainVerse.text.replace(/<pb\/>/g, '');
    
    const copyShareButtonsHTML = `
    <div id="copy-share-buttons" class="d-flex flex-wrap gap-2">
        <a href="/sermons/new?verse=${encodeURIComponent(verseString)}" data-link class="btn btn-primary btn-sm btn-icon" title="Predigt erstellen"><i class="fa-solid fa-book-open"></i></a>
        <button class="btn btn-sm btn-secondary" data-copy-format="url" title="URL in die Zwischenablage kopieren"><i class="fa-solid fa-link"></i></button>
        <button class="btn btn-sm btn-secondary" data-copy-format="ref" title="Nur die Bibelstelle kopieren"><i class="fa-solid fa-quote-left"></i></button>
        <button class="btn btn-sm btn-secondary" data-copy-format="ref-text" title="Bibelstelle mit Text kopieren"><i class="fa-solid fa-paragraph"></i></button>
        <button class="btn btn-sm btn-secondary" data-copy-format="text" title="Nur den Verstext kopieren"><i class="fa-regular fa-paste"></i></button>
        <button class="btn btn-sm btn-secondary" data-copy-format="md" title="Als Markdown-Zitat kopieren"><i class="fa-brands fa-markdown"></i></button>
        <button class="btn btn-sm btn-secondary" data-copy-format="html" title="Als HTML kopieren"><i class="fa-solid fa-code"></i></button>
    </div>`;

    const mainVerseHTML = `
    <div id="main-verse-display" class="card mb-4 main-verse-card">
        <div class="card-body">
            <p class="main-verse">
                <strong>${verseString} (${state.availableTranslations[0].name})</strong> ${formatVerseText(verseTextOnly, bookNumber)}
            </p>
            <hr>
            <div class="verse-actions d-flex justify-content-between">${verseNavHTML}${copyShareButtonsHTML}</div>
        </div>
    </div>`;
    
    const translationCompareHTML = `
    <div class="card mb-4" id="translation-comparison-card"> 
        <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div class="d-flex align-items-center gap-2">
                <i class="fa-solid fa-right-left"></i>
                <span>Übersetzungen vergleichen</span>
            </div>
            <div id="translation-actions" class="btn-group btn-group-sm flex-wrap" role="group">
                <button type="button" class="btn btn-primary btn-icon" id="add-all-translations-btn" title="Alle Übersetzungen anzeigen"><i class="fa-solid fa-angles-down"></i></button>
                <button type="button" class="btn btn-outline-secondary btn-icon" id="remove-all-translations-btn" title="Alle Übersetzungen entfernen"><i class="fa-solid fa-xmark"></i></button>
            </div>
        </div>
        <div class="card-body">
            <div id="translation-buttons-group" class="d-flex flex-wrap gap-2 mb-3">
                ${state.availableTranslations.filter(t => t.id !== 'default').map(t => `<button type="button" class="btn btn-sm btn-outline-secondary" data-translation-id="${t.id}">${t.name}</button>`).join('')}
            </div>
            <div id="comparison-verses-container" class="mt-3"></div>
        </div>
    </div>`;

    const contextHTML = `
    <div class="card context-card">
        <div class="card-header d-flex justify-content-between align-items-center">
            <span>Kontext</span>
            <div class="d-flex align-items-center gap-2">
                <div class="context-controls d-flex gap-1 mb-0">
                    <button class="load-context-btn btn-icon" data-direction="before" title="Mehr laden"><i class="fa-solid fa-angles-up"></i></button>
                    <button class="load-context-btn btn-icon" id="reset-context-btn" style="display: none;" title="Auf Standard zurücksetzen"><i class="fa-solid fa-rotate-left"></i></button>
                    <button class="load-context-btn btn-icon" data-direction="after" title="Mehr laden"><i class="fa-solid fa-angles-down"></i></button>
                </div>
                <div class="context-style-toggle">
                    <button class="btn-icon active" data-style="paragraph" title="Absatz-Ansicht"><i class="fa-solid fa-paragraph"></i></button>
                    <button class="btn-icon" data-style="verse" title="Vers-für-Vers-Ansicht"><i class="fa-solid fa-list-ol"></i></button>
                </div>
            </div>
        </div>
        <div class="card-body">
            <div id="context-wrapper"></div>
        </div>
    </div>`;
    
    const verseKey = `${bookNumber}-${chapter}-${verseNum}`;
    const verseNotes = (state.notes[verseKey] || []).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    const notesHTML = verseNotes.map((note, index) => {
        const processedNote = getProcessedEntry(note);
        const indicators = [];
        if (processedNote.flags?.hasCrossReference) indicators.push('<i class="fa-solid fa-link" title="Hat Querverweise" style="color:var(--secondary-color);"></i>');
        if (processedNote.flags?.hasYoutube) indicators.push('<i class="fa-brands fa-youtube" title="Hat YouTube-Videos" style="color:red;"></i>');
        if (processedNote.flags?.hasAudio) indicators.push('<i class="fa-solid fa-file-audio" title="Hat Audio-Dateien" style="color:var(--bs-blue);"></i>');
        if (processedNote.flags?.hasVideo) indicators.push('<i class="fa-solid fa-file-video" title="Hat Video-Dateien" style="color:var(--bs-purple);"></i>');
        if (processedNote.resources?.length > 0) indicators.push(`<i class="fa-solid fa-paperclip" title="Hat ${processedNote.resources.length} Ressource(n)" style="color:var(--bs-orange);"></i>`);
        return `<div class="card"><div class="card-header d-flex justify-content-between align-items-center"><div class="d-flex align-items-center gap-3"><strong>Notiz ${index + 1}</strong><div class="entry-indicators">${indicators.join('')}</div><small class="text-tertiary">${new Date(processedNote.timestamp).toLocaleString()}</small></div><div class="list-item-actions"><a href="/bible-note/edit/${verseKey}/${processedNote.id}" data-link class="btn-icon" title="Bearbeiten"><i class="fa-solid fa-pencil"></i></a><button class="btn-icon delete-note-btn" data-id="${processedNote.id}" data-verse-key="${verseKey}" data-back-link="${window.location.pathname}" title="Löschen"><i class="fa-solid fa-trash"></i></button></div></div><div class="card-body markdown-body">${processedNote.processedContent}${renderTagsHTML(processedNote.tags)}</div></div>`;
    }).join('');

    const crossReferences = state.crossReferenceIndexByVerse.get(verseKey) || [];
    const verseSermons = state.sermonIndexByVerse.get(verseKey) || [];
    const allResources = verseNotes.flatMap(note => getProcessedEntry(note).resources || []);
    const uniqueResources = Array.from(new Map(allResources.map(res => [res.url, res])).values());
    const resourcesHTML = uniqueResources.length > 0 ? `<div class="list-group list-group-flush mb-4">${uniqueResources.map(res => `<div class="list-group-item resource-item d-flex justify-content-between align-items-center"><span class="resource-name"><i class="${utils.getFileIconClass(res.name)} me-2"></i>${res.name}</span><span class="d-flex align-items-center"><span class="resource-size me-3 text-tertiary">${utils.formatBytes(res.size)}</span><a href="${res.url}" download="${res.name}" class="btn btn-sm btn-outline-secondary" title="Herunterladen"><i class="fa-solid fa-download"></i></a></span></div>`).join('')}</div>` : '';
    const sermonsHTML = verseSermons.length > 0 ? `<div class="list-group list-group-flush mb-4">${verseSermons.map(s => `<a href="/sermons/view/${s.id}" data-link class="list-group-item list-group-item-action">${s.title} (${utils.formatDate(s.date)})</a>`).join('')}</div>` : '';
    const crossRefsHTML = crossReferences.length > 0 ? `<div class="list-group list-group-flush mb-4">${crossReferences.map(ref => `<div class="list-group-item cross-reference-item-simple"><a href="${ref.link}" data-link>${ref.ref}</a><span class="cross-reference-snippet-simple">${ref.snippet}</span></div>`).join('')}</div>` : '';
    
    const allInternalVerseLinks = new Map();
    verseNotes.forEach(note => getProcessedEntry(note).internalLinks?.forEach(link => { 
        const linkKey = `${link.book_number}-${link.chapter}-${link.verse}`; 
        if (!allInternalVerseLinks.has(linkKey)) allInternalVerseLinks.set(linkKey, link); 
    }));
    
    const buildAccordion = (toggleId, contentId, title, iconClass, badgeCount, contentHTML, emptyMessage) => {
        const badge = badgeCount > 0 ? `<span class="badge ms-2">${badgeCount}</span>` : '';
        const buttonContent = `<span><i class="${iconClass} me-2"></i><span class="view-title mb-0" style="font-size: 1.25rem;">${title}</span>${badge}</span>`;
        return `<div class="accordion mt-4"><div class="card"><button class="accordion-button d-flex justify-content-between align-items-center card-header" id="${toggleId}">${buttonContent}</button><div class="accordion-content" id="${contentId}" style="display: none;">${contentHTML || `<p class="text-tertiary p-3">${emptyMessage}</p>`}</div></div></div>`;
    };

    const resourcesAndRefsContent = resourcesHTML + sermonsHTML + crossRefsHTML;
    const resourcesAccordionHTML = buildAccordion('resources-toggle-btn', 'resources-content', 'Ressourcen, Predigten & Querverweise', 'fa-solid fa-folder-open', uniqueResources.length + verseSermons.length + crossReferences.length, resourcesAndRefsContent, 'Keine verwandten Inhalte gefunden.');
    
    appContainer.innerHTML = `
        ${mainVerseHTML}
        ${commentaryHTML}
        ${translationCompareHTML}
        <div class="card-header d-flex justify-content-between align-items-center mt-4 section-header">
            <span>
                <i class="fa-solid fa-pencil me-2"></i>
                <span class="view-title mb-0" style="font-size: 1.25rem;">Notizen</span>
            </span>
            <button class="btn btn-sm btn-outline-primary" id="add-note-btn-toggle">
                <i class="fa-solid fa-plus me-2"></i> Neu
            </button>
        </div>
        <div class="d-grid gap-3 mb-4">${notesHTML || '<p class="text-tertiary p-3">Noch keine Notizen vorhanden.</p>'}</div>
        <div class="accordion" id="add-note-accordion">
            <div class="card">
                <div class="accordion-content" id="add-note-content" style="display: none;">
                    <div id="editor-container"></div>
                    <input type="text" id="new-entry-tags" placeholder="Tags, durch Komma getrennt" class="mt-3">
                    <button id="save-note-btn" class="btn btn-primary" style="margin-top: 1rem;" data-verse-key="${verseKey}">
                        <i class="fa-solid fa-save"></i> Speichern
                    </button>
                </div>
            </div>
        </div>
        ${contextHTML}
        ${resourcesAccordionHTML}`;
    
    const mainVerseIndex = state.verses.findIndex(v => v === mainVerse);
    let contextVerses = [];
    let contextStyle = 'paragraph';
    
    const getInitialContext = () => {
        let initialVerses = [];
        if (mainVerseIndex > -1) {
            for (let i = 2; i >= 1; i--) { 
                const index = mainVerseIndex - i; 
                if (index >= 0) initialVerses.push(state.verses[index]); 
            }
            initialVerses.push(mainVerse);
            for (let i = 1; i <= 2; i++) { 
                const index = mainVerseIndex + i; 
                if (index < state.verses.length) initialVerses.push(state.verses[index]); 
            }
        }
        return initialVerses;
    };
    
    contextVerses = getInitialContext();
    renderContextParagraph(mainVerse, contextVerses, contextStyle);

    document.querySelectorAll('.load-context-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const direction = e.currentTarget.dataset.direction;
            const loadCount = 5;

            if (direction === 'before') {
                const firstVerseInContext = contextVerses[0];
                const firstVerseIndex = state.verses.findIndex(v => v === firstVerseInContext);
                const newVerses = state.verses.slice(Math.max(0, firstVerseIndex - loadCount), firstVerseIndex);
                contextVerses = [...newVerses, ...contextVerses];
            } else if (direction === 'after') {
                const lastVerseInContext = contextVerses[contextVerses.length - 1];
                const lastVerseIndex = state.verses.findIndex(v => v === lastVerseInContext);
                const newVerses = state.verses.slice(lastVerseIndex + 1, lastVerseIndex + 1 + loadCount);
                contextVerses = [...contextVerses, ...newVerses];
            } else if (direction === 'reset') {
                contextVerses = getInitialContext();
                document.getElementById('reset-context-btn').style.display = 'none';
            }

            renderContextParagraph(mainVerse, contextVerses, contextStyle);
            if (direction !== 'reset') {
                document.getElementById('reset-context-btn').style.display = 'inline-flex';
            }
        });
    });

    document.querySelector('.context-style-toggle')?.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (button) {
            contextStyle = button.dataset.style;
            document.querySelectorAll('.context-style-toggle button').forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            renderContextParagraph(mainVerse, contextVerses, contextStyle);
        }
    });
    
    document.getElementById('add-note-btn-toggle')?.addEventListener('click', (e) => { 
        const div = document.getElementById('add-note-content'); 
        const isHidden = div.style.display === 'none'; 
        div.style.display = isHidden ? 'block' : 'none'; 
        if (isHidden) initializeMarkdownEditor('#editor-container');
        e.currentTarget.classList.toggle('expanded', isHidden); 
    });
    
    const setupAccordionToggle = (toggleId, contentId) => {
        document.getElementById(toggleId)?.addEventListener('click', (e) => { 
            const contentDiv = document.getElementById(contentId);
            const isHidden = contentDiv.style.display === 'none';
            contentDiv.style.display = isHidden ? 'block' : 'none';
            e.currentTarget.classList.toggle('expanded', isHidden);
        });
    };

    setupAccordionToggle('resources-toggle-btn', 'resources-content');
    
    document.getElementById('commentary-toggle-btn')?.addEventListener('click', (e) => {
        const contentDiv = document.getElementById('commentary-content');
        const isHidden = contentDiv.style.display === 'none';
        contentDiv.style.display = isHidden ? 'block' : 'none';
        e.currentTarget.classList.toggle('expanded', isHidden);
    });

    setupCommentaryTabs(commentariesBySource);

    setupTranslationControls(bookNumber, chapter, verseNum);

    setTimeout(() => {
        const targetElement = document.getElementById('main-verse-display');
        const navHeight = document.querySelector('.main-navbar')?.offsetHeight || 0;
        const contextNavHeight = document.querySelector('.context-nav')?.offsetHeight || 0;
        const totalOffset = navHeight + contextNavHeight + 16; 
        if (targetElement) {
            window.scrollTo({
                top: targetElement.getBoundingClientRect().top + window.pageYOffset - totalOffset,
                behavior: "smooth"
            });
        }
    }, 100);
}
