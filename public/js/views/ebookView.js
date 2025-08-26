import * as state from '../state.js';
import * as utils from '../utils.js';
// ENTFERNT: import { router } from '../router.js';
import { processStrongsContentForDisplay } from '../services/contentProcessor.js';

const appContainer = document.getElementById('app-container');

function createEbookControlsAndContentHTML(translations, currentTranslations, viewStyle, showStrongs, currentBookNumber, currentChapterNumber) {
    const translationOptions = translations.map(t => `<option value="${t.id}" ${currentTranslations.includes(t.id) ? 'selected' : ''}>${t.name}</option>`).join('');
    const maxChapter = Math.max(0, ...state.verses.filter(v => v.book_number === currentBookNumber).map(v => v.chapter));
    const bookOptions = state.books.map(b => `<option value="${b.book_number}" ${b.book_number === currentBookNumber ? 'selected' : ''}>${b.long_name}</option>`).join('');
    const chapterOptions = Array.from({ length: maxChapter }, (_, i) => i + 1).map(c => `<option value="${c}" ${c === currentChapterNumber ? 'selected' : ''}>Kapitel ${c}</option>`).join('');
    
    const readingAreaHTML = renderText(currentBookNumber, currentChapterNumber, currentTranslations, viewStyle, showStrongs);
    
    const settingsModalHTML = `
        <div id="ebook-settings-modal" class="ebook-settings-modal">
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h4>Einstellungen</h4>
                    <button id="ebook-modal-close-btn" class="btn-icon"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="modal-body">
                    <div class="setting-group">
                        <label>Buch:</label>
                        <select id="ebook-book-select" class="form-select">${bookOptions}</select>
                    </div>
                    <div class="setting-group">
                        <label>Kapitel:</label>
                        <select id="ebook-chapter-select" class="form-select">${chapterOptions}</select>
                    </div>
                    <hr>
                    <div class="setting-group">
                        <label>Übersetzungen:</label>
                        <select id="ebook-translation-select" class="form-select" multiple size="4">
                            ${translationOptions}
                        </select>
                    </div>
                    <hr>
                    <div class="setting-group">
                        <label>Anzeige:</label>
                        <div class="btn-group" role="group">
                            <button type="button" class="btn btn-secondary btn-sm ${viewStyle === 'verse' ? 'active' : ''}" data-style="verse">Vers-für-Vers</button>
                            <button type="button" class="btn btn-secondary btn-sm ${viewStyle === 'paragraph' ? 'active' : ''}" data-style="paragraph">Absatz</button>
                        </div>
                    </div>
                    <hr>
                    <div class="setting-group">
                        <div class="strongs-toggle-container">
                            <label for="strongs-toggle">Strongs-Nummern anzeigen</label>
                            <input type="checkbox" id="strongs-toggle" class="strongs-toggle-input" ${showStrongs ? 'checked' : ''}>
                            <label for="strongs-toggle" class="strongs-toggle-label"></label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    return `
        <div class="ebook-container">
            <header class="ebook-header">
                <button id="ebook-settings-toggle-btn" class="btn-icon" title="Einstellungen"><i class="fa-solid fa-gear"></i></button>
                <h1 class="view-title">${state.books.find(b => b.book_number === currentBookNumber).long_name} ${currentChapterNumber}</h1>
                ${setupEbookNav(state.books.find(b => b.book_number === currentBookNumber), currentChapterNumber)}
            </header>
            <div id="ebook-reading-area-wrapper">
                ${readingAreaHTML}
            </div>
            <div id="ebook-progress-bar" class="ebook-progress-bar">
                <div class="progress-bar-fill"></div>
                <span class="progress-label"></span>
            </div>
            ${settingsModalHTML}
        </div>
    `;
}

function renderText(bookNumber, chapterNumber, translations, viewStyle, showStrongs) {
    const verses = state.verses.filter(v => v.book_number === bookNumber && v.chapter === chapterNumber);
    if (verses.length === 0) return '<p>Kein Text für dieses Kapitel gefunden.</p>';

    const translationColumnsHTML = translations.map(t => {
        let textHTML = '';
        if (viewStyle === 'paragraph') {
            let paragraph = '';
            verses.forEach(v => {
                let verseText = utils.getVerseText(bookNumber, chapterNumber, v.verse, t.id);
                if (verseText) {
                    if (showStrongs) {
                        verseText = processStrongsContentForDisplay(verseText);
                    }
                    const verseHtml = `<sup>${v.verse}</sup>${verseText.replace(/<pb\/>/g, ' ')}`;
                    paragraph += verseHtml;
                }
            });
            textHTML = `<p>${paragraph}</p>`;
        } else {
            textHTML = verses.map(v => {
                let verseText = utils.getVerseText(bookNumber, chapterNumber, v.verse, t.id);
                if (verseText) {
                    if (showStrongs) {
                        verseText = processStrongsContentForDisplay(verseText);
                    }
                    return `<div class="ebook-verse-item" data-verse-num="${v.verse}"><sup>${v.verse}</sup> ${verseText.replace(/<pb\/>/g, ' ')}</div>`;
                }
                return '';
            }).join('');
        }
        return `
            <div class="ebook-translation-column">
                <h3 class="view-subheader">${t.name}</h3>
                <div class="ebook-text-content">
                    ${textHTML}
                </div>
            </div>
        `;
    }).join('');

    return `<div id="ebook-text-grid" class="ebook-text-grid">${translationColumnsHTML}</div>`;
}

function findAdjacentChapter(bookNumber, chapterNumber, direction) {
    const currentBook = state.books.find(b => b.book_number === bookNumber);
    if (!currentBook) return null;
    const allChaptersForBook = [...new Set(state.verses.filter(v => v.book_number === bookNumber).map(v => v.chapter))].sort((a,b) => a - b);
    const currentIndex = allChaptersForBook.indexOf(chapterNumber);
    let targetChapter = null;

    if (direction === 'prev' && currentIndex > 0) {
        targetChapter = allChaptersForBook[currentIndex - 1];
        return { book: currentBook, chapter: targetChapter };
    } else if (direction === 'next' && currentIndex < allChaptersForBook.length - 1) {
        targetChapter = allChaptersForBook[currentIndex + 1];
        return { book: currentBook, chapter: targetChapter };
    }
    return null;
}

function setupEbookNav(currentBook, currentChapter) {
    const prevChapter = findAdjacentChapter(currentBook.book_number, currentChapter, 'prev');
    const nextChapter = findAdjacentChapter(currentBook.book_number, currentChapter, 'next');

    const prevBtnHTML = prevChapter ? `<button id="ebook-nav-prev" class="btn-icon" data-book="${prevChapter.book.book_number}" data-chapter="${prevChapter.chapter}" title="Vorheriges Kapitel"><i class="fa-solid fa-chevron-left"></i></button>` : `<button class="btn-icon" disabled><i class="fa-solid fa-chevron-left"></i></button>`;
    const nextBtnHTML = nextChapter ? `<button id="ebook-nav-next" class="btn-icon" data-book="${nextChapter.book.book_number}" data-chapter="${nextChapter.chapter}" title="Nächstes Kapitel"><i class="fa-solid fa-chevron-right"></i></button>` : `<button class="btn-icon" disabled><i class="fa-solid fa-chevron-right"></i></button>`;

    return `<div class="ebook-nav-buttons">${prevBtnHTML}${nextBtnHTML}</div>`;
}

function saveEbookState(bookNumber, chapterNumber, verseNumber) {
    localStorage.setItem('ebookBookNumber', bookNumber);
    localStorage.setItem('ebookChapterNumber', chapterNumber);
    localStorage.setItem('ebookVerseNumber', verseNumber);
}

function calculateProgress(bookNumber, chapterNumber, verseNumber) {
    const allVersesInBook = state.verses.filter(v => v.book_number === bookNumber);
    const totalVersesInBook = allVersesInBook.length;
    if (totalVersesInBook === 0) return 0;
    const currentVerseIndex = allVersesInBook.findIndex(v => v.chapter === chapterNumber && v.verse === verseNumber);
    return Math.floor(((currentVerseIndex + 1) / totalVersesInBook) * 100);
}

function setupEbookEventListeners(currentBookNumber, currentChapterNumber, currentBook, savedVerseNumber) {
    // GEÄNDERT: Diese Funktion löst ein Event aus, anstatt den Router direkt aufzurufen
    const handleReRender = () => window.dispatchEvent(new CustomEvent('rerender-route'));
    
    document.getElementById('ebook-book-select').addEventListener('change', (e) => {
        localStorage.setItem('ebookBookNumber', e.target.value);
        localStorage.setItem('ebookChapterNumber', '1');
        handleReRender();
    });
    document.getElementById('ebook-chapter-select').addEventListener('change', (e) => {
        localStorage.setItem('ebookChapterNumber', e.target.value);
        handleReRender();
    });
    document.getElementById('ebook-translation-select').addEventListener('change', (e) => {
        const selectedIds = Array.from(e.target.options).filter(opt => opt.selected).map(opt => opt.value);
        localStorage.setItem('ebookTranslations', JSON.stringify(selectedIds));
        handleReRender();
    });

    document.querySelector('.ebook-settings-modal .btn-group').addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (button) {
            localStorage.setItem('ebookViewStyle', button.dataset.style);
            handleReRender();
        }
    });

    document.getElementById('ebook-nav-prev')?.addEventListener('click', (e) => {
        saveEbookState(e.currentTarget.dataset.book, e.currentTarget.dataset.chapter, '1');
        handleReRender();
    });

    document.getElementById('ebook-nav-next')?.addEventListener('click', (e) => {
        saveEbookState(e.currentTarget.dataset.book, e.currentTarget.dataset.chapter, '1');
        handleReRender();
    });

    document.getElementById('ebook-settings-toggle-btn').addEventListener('click', () => {
        document.body.classList.toggle('show-ebook-modal');
    });

    document.getElementById('ebook-modal-close-btn').addEventListener('click', () => {
        document.body.classList.remove('show-ebook-modal');
    });

    document.body.addEventListener('click', (e) => {
        const modal = document.getElementById('ebook-settings-modal');
        const isClickInsideModal = modal?.contains(e.target);
        const isClickOnToggleButton = e.target.closest('#ebook-settings-toggle-btn');
        if (modal && !isClickInsideModal && !isClickOnToggleButton && document.body.classList.contains('show-ebook-modal')) {
            document.body.classList.remove('show-ebook-modal');
        }
    });

    document.getElementById('strongs-toggle').addEventListener('change', (e) => {
        localStorage.setItem('showStrongs', e.target.checked);
        handleReRender();
    });

    window.addEventListener('scroll', utils.debounce(() => {
        const verseElements = document.querySelectorAll('.ebook-verse-item');
        let visibleVerse = null;
        for (const el of verseElements) {
            const rect = el.getBoundingClientRect();
            if (rect.top >= 0 && rect.top <= window.innerHeight / 3) {
                visibleVerse = el.dataset.verseNum;
                break;
            }
        }
        if (visibleVerse) {
            saveEbookState(currentBookNumber, currentChapterNumber, visibleVerse);
            const progress = calculateProgress(currentBookNumber, currentChapterNumber, parseInt(visibleVerse, 10));
            document.querySelector('.progress-bar-fill').style.width = `${progress}%`;
            document.querySelector('.progress-label').textContent = `${progress}%`;
        }
    }, 200));
    
    const targetVerseEl = document.querySelector(`[data-verse-num="${savedVerseNumber}"]`);
    if (targetVerseEl) {
        targetVerseEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

export function renderEbookView() {
    const currentBookNumber = parseInt(localStorage.getItem('ebookBookNumber') || '40', 10);
    const currentChapterNumber = parseInt(localStorage.getItem('ebookChapterNumber') || '3', 10);
    const savedVerseNumber = parseInt(localStorage.getItem('ebookVerseNumber') || '1', 10);
    const savedTranslations = JSON.parse(localStorage.getItem('ebookTranslations') || '["elb06c"]');
    const savedViewStyle = localStorage.getItem('ebookViewStyle') || 'verse';
    const showStrongs = localStorage.getItem('showStrongs') === 'true';

    const currentBook = utils.getBook(currentBookNumber);
    if (!currentBook || state.availableTranslations.length === 0 || !state.availableTranslations[0].data) {
        appContainer.innerHTML = `<p class="text-tertiary p-5 text-center">Wichtige Daten werden geladen...</p>`;
        return;
    }
    const currentTranslations = state.availableTranslations.filter(t => savedTranslations.includes(t.id));

    const contentHTML = createEbookControlsAndContentHTML(state.availableTranslations, currentTranslations, savedViewStyle, showStrongs, currentBookNumber, currentChapterNumber);
    
    appContainer.innerHTML = contentHTML;
    
    const progress = calculateProgress(currentBookNumber, currentChapterNumber, savedVerseNumber);
    const progressBar = document.querySelector('.progress-bar-fill');
    const progressLabel = document.querySelector('.progress-label');
    if (progressBar) progressBar.style.width = `${progress}%`;
    if (progressLabel) progressLabel.textContent = `${progress}%`;

    setupEbookEventListeners(currentBookNumber, currentChapterNumber, currentBook, savedVerseNumber);
}
