import * as state from '../state.js';
import * as utils from '../utils.js';
import { formatVerseText, processStrongsContentForDisplay } from '../services/contentProcessor.js';

let activePopup = null;
let popupBackdrop = null;

function parseBibleUrl(url) {
    try {
        const path = new URL(url, window.location.origin).pathname;
        const parts = path.split('/').filter(p => p);
        if (parts[0] !== 'bible' || parts.length < 3) return null;

        const bookShortName = parts[1];
        const chapter = parseInt(parts[2], 10);
        const verse = parts.length > 3 ? parseInt(parts[3], 10) : null;

        const book = state.books.find(b => utils.getPrimaryShortName(b).toLowerCase() === bookShortName.toLowerCase());
        if (!book) return null;

        return { b: book.book_number, c: chapter, v: verse };
    } catch (e) {
        console.error("URL-Parsing fehlgeschlagen:", e);
        return null;
    }
}

function createPopupElement(id, ...classNames) {
    const popup = document.createElement('div');
    popup.id = id;
    popup.className = ['verse-popup', ...classNames].join(' ');
    document.body.appendChild(popup);
    return popup;
}

function getOrCreatePopup(id, ...classNames) {
    let popup = document.getElementById(id);
    if (!popup) {
        popup = createPopupElement(id, ...classNames);
    }
    return popup;
}

function toggleBackdrop(visible) {
    if (!popupBackdrop) {
        popupBackdrop = document.createElement('div');
        popupBackdrop.id = 'popup-backdrop';
        popupBackdrop.className = 'popup-backdrop';
        document.body.appendChild(popupBackdrop);
        popupBackdrop.addEventListener('click', hideActivePopup);
    }
    popupBackdrop.classList.toggle('visible', visible);
}

function showPopup(popup) {
    if (activePopup && activePopup !== popup) {
        activePopup.classList.remove('visible');
    }
    popup.classList.add('visible');
    activePopup = popup;
    toggleBackdrop(true);
}

function hideActivePopup() {
    if (activePopup) {
        activePopup.classList.remove('visible');
        activePopup = null;
    }
    toggleBackdrop(false);
}

function findVerse(bookNum, chapter, verse) {
    return state.verses.find(v => v.book_number === bookNum && v.chapter === chapter && v.verse === verse);
}

function updateVersePopupContent(popup, verses) {
    const contentDiv = popup.querySelector('.verse-popup-content, .chapter-popup-scrollable-content');
    if (!contentDiv) return;

    const verseHTML = verses.map(verseData => {
        if (!verseData) return '';
        const book = utils.getBook(verseData.book_number);
        const jumpLink = `/bible/${utils.getPrimaryShortName(book)}/${verseData.chapter}/${verseData.verse}`;
        return `
            <div class="popup-verse-item">
                <div class="popup-verse-text">
                    <strong>${utils.getPrimaryShortName(book)} ${verseData.chapter}:${verseData.verse}</strong>
                    ${verseData.text.replace(/<pb\/>/g, '')}
                </div>
                <a href="${jumpLink}" class="btn-icon popup-jump-link" data-link="" title="Zum Vers springen"><i class="fa-solid fa-arrow-right"></i></a>
            </div>`;
    }).join('');

    contentDiv.innerHTML = verseHTML;

    const verseRefs = verses.map(v => ({ b: v.book_number, c: v.chapter, v: v.verse }));
    popup.dataset.currentVerses = JSON.stringify(verseRefs);
}

export function hideVersePopup() { hideActivePopup(); }
export function hideStrongsPopup() { hideActivePopup(); }
export function hideChapterPopup() { hideActivePopup(); }
export function hideCommentaryPopup() { hideActivePopup(); }
export function hideDictionaryPopup() { hideActivePopup(); }

export function showVersePopup(triggerElement) {
    const versePopup = getOrCreatePopup('verse-popup');
    if (!versePopup.innerHTML.includes('verse-popup-controls')) {
        versePopup.innerHTML = `
            <div id="verse-popup-controls" class="verse-popup-header">
                <button class="btn-icon" data-action="prev-verse" title="Vorheriger Vers"><i class="fa-solid fa-minus"></i></button>
                <button class="btn-icon" data-action="reset-verses" title="Zurücksetzen"><i class="fa-solid fa-arrows-rotate"></i></button>
                <button class="btn-icon" data-action="next-verse" title="Nächster Vers"><i class="fa-solid fa-plus"></i></button>
            </div>
            <div class="verse-popup-content"></div>`;

        versePopup.querySelector('#verse-popup-controls').addEventListener('click', e => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;

            const action = button.dataset.action;
            const currentVerseRefs = JSON.parse(versePopup.dataset.currentVerses || '[]');
            let currentVerses = currentVerseRefs.map(ref => findVerse(ref.b, ref.c, ref.v));

            if (action === 'reset-verses') {
                const originalVerseRefs = JSON.parse(versePopup.dataset.originalVerses || '[]');
                const originalVerses = originalVerseRefs.map(ref => findVerse(ref.b, ref.c, ref.v));
                updateVersePopupContent(versePopup, originalVerses);
                return;
            }

            if (action === 'prev-verse') {
                const firstVerse = currentVerses[0];
                if (firstVerse) {
                    const prevVerse = findVerse(firstVerse.book_number, firstVerse.chapter, firstVerse.verse - 1);
                    if (prevVerse) currentVerses.unshift(prevVerse);
                }
            }

            if (action === 'next-verse') {
                const lastVerse = currentVerses[currentVerses.length - 1];
                if (lastVerse) {
                    const nextVerse = findVerse(lastVerse.book_number, lastVerse.chapter, lastVerse.verse + 1);
                    if (nextVerse) currentVerses.push(nextVerse);
                }
            }
            updateVersePopupContent(versePopup, currentVerses.filter(Boolean));
        });
    }

    const versesToLoad = JSON.parse(triggerElement.dataset.verses || '[]');
    if (versesToLoad.length === 0) return;

    versePopup.dataset.originalVerses = JSON.stringify(versesToLoad);
    const initialVerses = versesToLoad.map(ref => findVerse(ref.b, ref.c, ref.v));
    updateVersePopupContent(versePopup, initialVerses.filter(Boolean));
    showPopup(versePopup);
}

export function showStrongsPopup(triggerElement) {
    const strongsPopup = getOrCreatePopup('strongs-popup');
    const strongId = triggerElement.dataset.strongId;
    const entry = state.strongsConcordance.get(strongId);
    const jumpLink = `/strongs/${strongId}`;
    let popupHTML = '';

    if (entry) {
        const excerpt = utils.extractPlainTextFromHtml(entry.definition).replace(/\s+/g, ' ').trim().substring(0, 150) + '...';
        popupHTML = `
            <div class="popup-verse-item">
                <div class="popup-verse-text">
                    <strong>${entry.lexeme} (${strongId})</strong>
                    ${excerpt}
                </div>
                <a href="${jumpLink}" class="btn-icon popup-jump-link" data-link="" title="Zum Eintrag springen"><i class="fa-solid fa-arrow-right"></i></a>
            </div>`;
    } else {
        popupHTML = `
            <div class="popup-verse-item">
                <div class="popup-verse-text">
                    <strong>${strongId}</strong>
                    <span class="text-danger">Eintrag nicht in der Konkordanz gefunden.</span>
                </div>
                <a href="${jumpLink}" class="btn-icon popup-jump-link" data-link="" title="Zum Eintrag springen"><i class="fa-solid fa-arrow-right"></i></a>
            </div>`;
    }
    strongsPopup.innerHTML = `<div class="verse-popup-content">${popupHTML}</div>`;
    showPopup(strongsPopup);
}

function addInternalPopupNavigation(popup) {
    popup.addEventListener('click', e => {
        const link = e.target.closest('a[href^="/bible/"]');
        if (!link) return;

        e.preventDefault();
        const verseRef = parseBibleUrl(link.href);

        if (verseRef && verseRef.v) {
            const verseData = findVerse(verseRef.b, verseRef.c, verseRef.v);
            if (verseData) {
                const versePopup = getOrCreatePopup('verse-popup');
                versePopup.dataset.originalVerses = JSON.stringify([verseRef]);
                updateVersePopupContent(versePopup, [verseData]);
                showPopup(versePopup);
            }
        } else if (verseRef) {
            const chapterPopup = getOrCreatePopup('chapter-popup', 'chapter-popup');
            loadChapterContent(chapterPopup, verseRef.b, verseRef.c);
            showPopup(chapterPopup);
        }
    });
}

function loadChapterContent(popup, bookNumber, chapter) {
     const book = utils.getBook(bookNumber);
     if (!book) {
        popup.innerHTML = `<div class="chapter-popup-scrollable-content text-danger">Buch nicht gefunden.</div>`;
        return;
    }
    const chapterVerses = state.verses.filter(v => v.book_number === bookNumber && v.chapter === chapter);
    const chapterTitle = `${book.long_name} ${chapter}`;
    
    let chapterHTML = chapterVerses.map(verse => {
        const verseText = formatVerseText(verse.text, verse.book_number);
        const shortName = utils.getPrimaryShortName(book);
        const verseLink = `<a href="/bible/${shortName}/${verse.chapter}/${verse.verse}" data-link><sup>${verse.verse}</sup></a>`;
        return `<span class="chapter-single-verse">${verseLink} ${verseText}</span>`;
    }).join('');

    popup.innerHTML = `
        <div class="chapter-popup-header">
            <h2>${chapterTitle}</h2>
            <a href="/bible/${utils.getPrimaryShortName(book)}/${chapter}" data-link class="btn-icon" title="Zum Kapitel springen"><i class="fa-solid fa-arrow-right"></i></a>
        </div>
        <div class="chapter-popup-scrollable-content">
            ${chapterHTML}
        </div>`;
}

export function showChapterPopup(triggerElement) {
    const chapterPopup = getOrCreatePopup('chapter-popup', 'chapter-popup');
    if (!chapterPopup.dataset.listenerAttached) {
        addInternalPopupNavigation(chapterPopup);
        chapterPopup.dataset.listenerAttached = 'true';
    }
    const bookNumber = parseInt(triggerElement.dataset.bookNumber, 10);
    const chapter = parseInt(triggerElement.dataset.chapter, 10);
    
    loadChapterContent(chapterPopup, bookNumber, chapter);
    showPopup(chapterPopup);
}

export function showCommentaryPopup(triggerElement) {
    const commentaryPopup = getOrCreatePopup('commentary-popup', 'chapter-popup');
    if (!commentaryPopup.dataset.listenerAttached) {
        addInternalPopupNavigation(commentaryPopup);
        commentaryPopup.dataset.listenerAttached = 'true';
    }
    
    const sourceName = triggerElement.dataset.sourceName;
    const fullText = decodeURIComponent(triggerElement.dataset.fullText);
    const popupContentHtml = processStrongsContentForDisplay(fullText);

    commentaryPopup.innerHTML = `
        <div class="chapter-popup-header">
            <h2>${sourceName}</h2>
        </div>
        <div class="chapter-popup-scrollable-content">
            <div>${popupContentHtml}</div>
        </div>`;
    showPopup(commentaryPopup);
}

export function showDictionaryPopup(triggerElement) {
    const dictionaryPopup = getOrCreatePopup('dictionary-popup', 'chapter-popup');
    const clickedTopic = triggerElement.dataset.topic;

    const relatedEntries = new Map();

    state.availableDictionaries.forEach(dict => {
        dict.data.forEach(entry => {
            if (entry.topic.toLowerCase().includes(clickedTopic.toLowerCase())) {
                if (!relatedEntries.has(entry.topic)) {
                    relatedEntries.set(entry.topic, {
                        topic: entry.topic,
                        sourceId: dict.id
                    });
                }
            }
        });
    });

    const sortedEntries = Array.from(relatedEntries.values()).sort((a, b) => {
        if (a.topic.toLowerCase() === clickedTopic) return -1;
        if (b.topic.toLowerCase() === clickedTopic) return 1;
        return a.topic.localeCompare(b.topic);
    });

    let contentHTML = '';
    if (sortedEntries.length > 0) {
        const linksHTML = sortedEntries.map(entry =>
            `<li><a href="/dictionary/${entry.sourceId}/${encodeURIComponent(entry.topic.toLowerCase())}" data-link>${entry.topic}</a></li>`
        ).join('');
        contentHTML = `<ul class="related-entries-list">${linksHTML}</ul>`;
    } else {
        contentHTML = '<p class="text-tertiary p-3">Keine verwandten Einträge gefunden.</p>';
    }
    
    const capitalClickedTopic = clickedTopic.charAt(0).toUpperCase() + clickedTopic.slice(1);

    dictionaryPopup.innerHTML = `
        <div class="chapter-popup-header">
            <h2>Themen zu "${capitalClickedTopic}"</h2>
        </div>
        <div class="chapter-popup-scrollable-content">
            ${contentHTML}
        </div>`;

    showPopup(dictionaryPopup);
}