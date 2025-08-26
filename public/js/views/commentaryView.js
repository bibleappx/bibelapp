import * as state from '../state.js';
import * as utils from '../utils.js';
import { processStrongsContentForDisplay } from '../services/contentProcessor.js';

const appContainer = document.getElementById('app-container');

// Hilfsfunktion: Findet alle Kommentareinträge aus allen Quellen für einen bestimmten Vers.
function findCommentsForVerse(bookNumber, chapterNumber, verseNumber) {
    const allComments = [];
    if (!state.availableCommentaries || !bookNumber || !chapterNumber || !verseNumber) {
        return [];
    }

    // Durchsucht jede verfügbare Kommentarquelle
    for (const source of state.availableCommentaries) {
        const foundEntries = source.data.filter(c =>
            c.book_number === bookNumber &&
            chapterNumber >= c.chapter_number_from &&
            chapterNumber <= (c.chapter_number_to === 0 ? c.chapter_number_from : c.chapter_number_to) &&
            verseNumber >= c.verse_number_from &&
            verseNumber <= (c.verse_number_to === 0 ? c.verse_number_from : c.verse_number_to)
        );

        // Fügt jeden gefundenen Eintrag zusammen mit dem Namen der Quelle zur Ergebnisliste hinzu
        for (const entry of foundEntries) {
            allComments.push({
                sourceName: source.name,
                text: entry.text
            });
        }
    }
    return allComments;
}

// Hauptfunktion zum Rendern der Kommentar-Ansicht
export function renderCommentaryView() {
    const bookOptions = state.books.map(b => `<option value="${b.book_number}">${b.long_name}</option>`).join('');

    appContainer.innerHTML = `
        <h1 class="view-title">Kommentare zu einer Bibelstelle</h1>
        <div class="card commentary-selection-card mb-4">
            <div class="card-body">
                <div class="row g-3 align-items-end">
                    <div class="col-md-5">
                        <label class="form-label">Buch</label>
                        <select id="commentary-book-select" class="form-select">
                            <option value="0" selected disabled>Bitte wählen...</option>
                            ${bookOptions}
                        </select>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Kapitel</label>
                        <select id="commentary-chapter-select" class="form-select" disabled><option>--</option></select>
                    </div>
                    <div class="col-md-2">
                        <label class="form-label">Vers</label>
                        <select id="commentary-verse-select" class="form-select" disabled><option>--</option></select>
                    </div>
                    <div class="col-md-2">
                        <button id="search-commentary-btn" class="btn btn-primary w-100" disabled>
                            <i class="fa-solid fa-arrow-down"></i> Kommentare laden
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div id="commentary-results-container" class="d-grid gap-3"></div>
    `;

    const bookSelect = document.getElementById('commentary-book-select');
    const chapterSelect = document.getElementById('commentary-chapter-select');
    const verseSelect = document.getElementById('commentary-verse-select');
    const searchBtn = document.getElementById('search-commentary-btn');
    const resultsContainer = document.getElementById('commentary-results-container');

    const updateChapters = () => {
        const bookNumber = parseInt(bookSelect.value, 10);
        if (!bookNumber) return;
        
        // KORREKTUR: Logik zur Berechnung der maximalen Kapitelanzahl direkt hier implementiert.
        const maxChapter = Math.max(0, ...state.verses
            .filter(v => v.book_number === bookNumber)
            .map(v => v.chapter));
            
        chapterSelect.innerHTML = Array.from({ length: maxChapter }, (_, i) => `<option value="${i + 1}">Kapitel ${i + 1}</option>`).join('');
        chapterSelect.disabled = false;
        updateVerses();
    };

    const updateVerses = () => {
        const bookNumber = parseInt(bookSelect.value, 10);
        const chapterNumber = parseInt(chapterSelect.value, 10);
        if (!bookNumber || !chapterNumber) return;

        // KORREKTUR: Logik zur Berechnung der maximalen Versanzahl direkt hier implementiert.
        const maxVerse = Math.max(0, ...state.verses
            .filter(v => v.book_number === bookNumber && v.chapter === chapterNumber)
            .map(v => v.verse));

        verseSelect.innerHTML = Array.from({ length: maxVerse }, (_, i) => `<option value="${i + 1}">Vers ${i + 1}</option>`).join('');
        verseSelect.disabled = false;
        searchBtn.disabled = false;
    };

    bookSelect.addEventListener('change', updateChapters);
    chapterSelect.addEventListener('change', updateVerses);

    searchBtn.addEventListener('click', () => {
        const bookNumber = parseInt(bookSelect.value, 10);
        const chapterNumber = parseInt(chapterSelect.value, 10);
        const verseNumber = parseInt(verseSelect.value, 10);

        const foundComments = findCommentsForVerse(bookNumber, chapterNumber, verseNumber);

        if (foundComments.length === 0) {
            resultsContainer.innerHTML = '<div class="card card-body text-tertiary">Für diese Bibelstelle wurden keine Kommentare gefunden.</div>';
            return;
        }

        // Erstellt für jeden gefundenen Kommentar eine eigene div-Box (als "card")
        const resultsHTML = foundComments.map(comment => `
            <div class="card commentary-result-card">
                <div class="card-header">
                    ${comment.sourceName}
                </div>
                <div class="card-body markdown-body">
                    ${processStrongsContentForDisplay(comment.text)}
                </div>
            </div>
        `).join('');

        resultsContainer.innerHTML = resultsHTML;
    });
}
