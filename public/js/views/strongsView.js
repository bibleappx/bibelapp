import * as state from '../state.js';
import * as utils from '../utils.js';
import { router } from '../router.js';
import { fetchAPI } from '../api.js';
import { createPagination, createFilterPillsHTML } from '../ui/components.js';
import { processStrongsContentForDisplay } from '../services/contentProcessor.js';

const appContainer = document.getElementById('app-container');

export async function renderStrongsDetailView(strongId) {
    let entry = state.strongsConcordance.get(strongId);
    if (!entry) {
        try {
            entry = await fetchAPI(`/api/strongs/${strongId}`, true);
            if (entry) state.strongsConcordance.set(strongId, entry);
        } catch (error) {
            console.warn(`Konkordanz-Eintrag für ${strongId} nicht auf dem Server gefunden.`);
            entry = null;
        }
    }

    const currentIndex = state.strongsArray.findIndex(item => item.topic === strongId);
    let paginationHTML = '';
    if (currentIndex > -1) {
        const neighbors = [];
        const window = 5;
        for (let i = -window; i <= window; i++) {
            const neighborIndex = currentIndex + i;
            if (neighborIndex >= 0 && neighborIndex < state.strongsArray.length) {
                neighbors.push(state.strongsArray[neighborIndex]);
            }
        }
        paginationHTML = `<nav class="pagination strongs-pagination mb-4">${neighbors.map(n => `
            <a href="/strongs/${n.topic}" data-link class="page-item ${n.topic === strongId ? 'active' : ''}">${n.topic}</a>
        `).join('')}</nav>`;
    }
    
    let detailCardHTML = '';
    if (entry) {
        const processedDefinition = processStrongsContentForDisplay(entry.definition);
        detailCardHTML = `
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h1 class="view-title mb-0" style="font-size: 1.5rem;">${entry.lexeme} (${entry.transliteration})</h1>
                    <span class="badge bg-secondary">${strongId}</span>
                </div>
                <div class="card-body">
                    ${entry.pronunciation ? `<p class="strongs-pronunciation"><em>${entry.pronunciation}</em></p>` : ''}
                    <div class="strongs-content-wrapper">
                        <div class="strongs-content">${processedDefinition}</div>
                        <button class="strongs-expand-btn">Mehr...</button>
                    </div>
                </div>
            </div>`;
    } else {
        detailCardHTML = `
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h1 class="view-title mb-0" style="font-size: 1.5rem;">Eintrag ${strongId}</h1>
                </div>
                <div class="card-body">
                    <p class="text-tertiary">Für diese Strong's-Nummer wurde kein Konkordanz-Eintrag gefunden.</p>
                </div>
            </div>`;
    }

    const strongsTranslations = state.availableTranslations.filter(t => t.hasStrongs);
    const translationButtonsHTML = strongsTranslations.map((t, index) =>
        `<button type="button" class="btn btn-sm btn-outline-secondary ${index === 0 ? 'active' : ''}" data-translation-id="${t.id}">${t.name}</button>`
    ).join('');

    const randomEntries = [];
    const pickedIndices = new Set(currentIndex > -1 ? [currentIndex] : []);
    if (state.strongsArray.length > 1) {
        while (randomEntries.length < 5 && pickedIndices.size < state.strongsArray.length) {
            const randomIndex = Math.floor(Math.random() * state.strongsArray.length);
            if (!pickedIndices.has(randomIndex) && state.strongsArray[randomIndex]) {
                pickedIndices.add(randomIndex);
                randomEntries.push(state.strongsArray[randomIndex]);
            }
        }
    }
    const randomEntriesHTML = randomEntries.map(rand => `
        <a href="/strongs/${rand.topic}" data-link class="list-group-item list-group-item-action">
            <strong>${rand.topic}:</strong> ${rand.lexeme || ''} <span class="text-tertiary">(${rand.transliteration})</span>
        </a>
    `).join('');

    appContainer.innerHTML = `
        ${paginationHTML}
        ${detailCardHTML}
        
        <div class="card mt-4">
            <div class="card-header">
                <h3 class="view-subheader mb-0">Vorkommen in der Bibel</h3>
            </div>
            <div class="card-body">
                <div class="filter-pills mb-3">${translationButtonsHTML}</div>
                <div id="strongs-occurrences-list"></div>
            </div>
        </div>

        <div class="mt-5">
            <h3 class="view-subheader">Weitere Einträge entdecken</h3>
            <div class="list-group">
                ${randomEntriesHTML}
            </div>
        </div>
    `;

    // ***HIER IST DER KORRIGIERTE AUFRUF VON scrollToElement OHNE OFFSET!***
    utils.scrollToElement('.card', 240); // Offset ist jetzt 0

    const expandBtn = appContainer.querySelector('.strongs-expand-btn');
    const contentWrapper = appContainer.querySelector('.strongs-content-wrapper');
    if (expandBtn && contentWrapper) {
        if (contentWrapper.querySelector('.strongs-content').scrollHeight <= 250) {
            expandBtn.style.display = 'none';
            contentWrapper.classList.add('expanded');
        }

        expandBtn.addEventListener('click', () => {
            const isExpanded = contentWrapper.classList.toggle('expanded');
            expandBtn.textContent = isExpanded ? 'Weniger' : 'Mehr...';
        });
    }

    const createStrongsExcerpt = (originalVerseText, strongId) => {
        if (!originalVerseText) return "Text nicht verfügbar.";
        const strongNumber = strongId.substring(1);
        const marker = `__MARKER_${strongNumber}__`;
        const regex = new RegExp(`([\\w\ü\ä\ö\ß\.'-]+) *<S>${strongNumber}<\\/S>`, 'i');
        let textWithMarker = originalVerseText.replace(regex, `${marker}$1${marker}`);
        let plainText = textWithMarker.replace(/<S>\d+<\/S>/g, '');
        plainText = plainText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        const markerIndex = plainText.indexOf(marker);
        if (markerIndex !== -1) {
            const word = plainText.substring(markerIndex + marker.length, plainText.lastIndexOf(marker));
            const markedText = `<mark>${word}</mark>`;
            const beforeText = plainText.substring(0, markerIndex);
            const afterText = plainText.substring(plainText.lastIndexOf(marker) + marker.length);
            const contextLength = 35;
            const prefix = beforeText.length > contextLength ? '... ' : '';
            const suffix = afterText.length > contextLength ? ' ...' : '';
            const beforeExcerpt = beforeText.slice(-contextLength);
            const afterExcerpt = afterText.slice(0, contextLength);
            return `${prefix}${beforeExcerpt}${markedText}${afterExcerpt}${suffix}`;
        } else {
            let cleanFallback = originalVerseText.replace(/<S>\d+<\/S>/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            return cleanFallback.substring(0, 80) + '...';
        }
    };
    
    const displayStrongsOccurrences = (translationId) => {
        const listContainer = document.getElementById('strongs-occurrences-list');
        const occurrences = state.strongsVerseIndex.get(translationId)?.get(strongId) || [];

        if (occurrences.length === 0) {
            listContainer.innerHTML = '<p class="text-tertiary">Keine Vorkommen in dieser Übersetzung gefunden.</p>';
            return;
        }

        const groupedByBook = occurrences.reduce((acc, verseRef) => {
            if (!acc[verseRef.b]) acc[verseRef.b] = [];
            acc[verseRef.b].push(verseRef);
            return acc;
        }, {});
        
        const sortedBookNumbers = Object.keys(groupedByBook).sort((a, b) => a - b);
        const bookCount = sortedBookNumbers.length;
        const verseCount = occurrences.length;
        const bookLabel = bookCount === 1 ? 'Buch' : 'Büchern';
        const verseLabel = verseCount === 1 ? 'Vers' : 'Versen';
        const summaryHeader = `<div class="occurrences-header">Gefunden in <strong>${verseCount} ${verseLabel}</strong> in <strong>${bookCount} ${bookLabel}</strong>.</div>`;

        let accordionHtml = '<div class="accordion-container strongs-occurrences-accordion">';
        sortedBookNumbers.forEach(bookNum => {
            const book = utils.getBook(parseInt(bookNum));
            const verseRefs = groupedByBook[bookNum];
            verseRefs.sort((a, b) => a.c - b.c || a.v - b.v);

            const contentHTML = verseRefs.map(vr => {
                const originalVerseText = utils.getVerseText(vr.b, vr.c, vr.v, translationId);
                const excerpt = createStrongsExcerpt(originalVerseText, strongId);
                const jumpLink = `/bible/${utils.getPrimaryShortName(book)}/${vr.c}/${vr.v}`;

                return `
                    <div class="strongs-occurrence-item">
                        <a href="${jumpLink}" data-link class="flex-grow-1" style="min-width: 0;">
                            <span class="search-result-ref">${utils.getPrimaryShortName(book)} ${vr.c}:${vr.v}</span>
                            <span class="search-result-snippet">${excerpt}</span>
                        </a>
                    </div>`;
            }).join('');

            accordionHtml += `
                <div class="accordion-item">
                    <button class="accordion-button">
                        <span>${book.long_name}</span>
                        <div class="controls">
                            <span class="badge">${verseRefs.length}</span>
                        </div>
                    </button>
                    <div class="accordion-content" style="display: none;">
                        <div class="list-group">${contentHTML}</div>
                    </div>
                </div>`;
        });
        accordionHtml += '</div>';
        
        listContainer.innerHTML = summaryHeader + accordionHtml;

        listContainer.querySelectorAll('.accordion-button').forEach(button => {
            button.addEventListener('click', () => {
                const content = button.nextElementSibling;
                const isVisible = content.style.display === 'block';
                button.classList.toggle('expanded', !isVisible);
                content.style.display = isVisible ? 'none' : 'block';
            });
        });
    };
    
    const filterPills = appContainer.querySelector('.filter-pills');
    if(filterPills) {
        filterPills.addEventListener('click', e => {
            const button = e.target.closest('button');
            if (button) {
                filterPills.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                displayStrongsOccurrences(button.dataset.translationId);
            }
        });
    }

    if (strongsTranslations.length > 0) {
        displayStrongsOccurrences(strongsTranslations[0].id);
    }
}

export function renderStrongsDashboard() {
    const displayEntries = () => {
        const currentPage = utils.getCurrentPage();
        const itemsPerPage = 20;
        const searchTerm = document.getElementById('strongs-search-input').value.toLowerCase();
        const languageFilter = document.querySelector('#strongs-filter-pills .btn.active')?.dataset.filter || 'all';
        const sortBy = document.getElementById('strongs-sort-select').value;

        let filtered = state.strongsArray.filter(entry => {
            const langMatch = languageFilter === 'all' || (languageFilter === 'G' && entry.topic.startsWith('G')) || (languageFilter === 'H' && entry.topic.startsWith('H'));
            const searchMatch = !searchTerm || entry.topic.toLowerCase().includes(searchTerm) || entry.lexeme.toLowerCase().includes(searchTerm) || entry.transliteration.toLowerCase().includes(searchTerm);
            return langMatch && searchMatch;
        });

        filtered.sort((a, b) => {
            if (sortBy === 'topic') {
                return a.topic.localeCompare(b.topic, undefined, { numeric: true });
            } else if (sortBy === 'lexeme') {
                return a.lexeme.localeCompare(b.lexeme);
            }
            return 0;
        });

        const totalPages = Math.ceil(filtered.length / itemsPerPage);
        const paginatedEntries = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

        const listHTML = paginatedEntries.map(entry => `
            <a href="/strongs/${entry.topic}" data-link class="list-group-item list-group-item-action">
                <strong>${entry.topic}:</strong> ${entry.lexeme || ''} <span class="text-tertiary">(${entry.transliteration})</span>
            </a>
        `).join('');

        document.getElementById('strongs-list').innerHTML = listHTML || '<p class="text-tertiary p-3">Keine Einträge gefunden.</p>';
        document.getElementById('pagination-container').innerHTML = createPagination(currentPage, totalPages);
    };

    const filterPillsHTML = createFilterPillsHTML([
        { filter: 'all', icon: 'fa-solid fa-globe', title: 'Alle' },
        { filter: 'G', icon: 'fa-solid fa-bold', title: 'Griechisch' },
        { filter: 'H', icon: 'fa-solid fa-italic', title: 'Hebräisch' }
    ]);

    appContainer.innerHTML = `
        <h1 class="view-title">Konkordanz-Übersicht</h1>
        <div class="card mb-4">
            <div class="card-body d-flex flex-wrap gap-3">
                <div class="flex-grow-1"><input type="search" id="strongs-search-input" placeholder="Nach Nummer, Lexem oder Transliteration suchen..."></div>
                <select id="strongs-sort-select" class="form-select w-auto"><option value="topic">Nach Nummer</option><option value="lexeme">Nach Lexem (A-Z)</option></select>
                <div id="strongs-filter-pills" class="filter-pills">${filterPillsHTML}</div>
            </div>
        </div>
        <div id="strongs-list" class="list-group"></div>
        <div id="pagination-container" class="mt-4"></div>
    `;

    document.getElementById('strongs-search-input').addEventListener('keyup', utils.debounce(displayEntries, 300));
    document.getElementById('strongs-sort-select').addEventListener('change', displayEntries);
    document.getElementById('strongs-filter-pills').addEventListener('click', e => {
        const button = e.target.closest('button[data-filter]');
        if (button) {
            document.querySelectorAll('#strongs-filter-pills .btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            displayEntries();
        }
    });
    displayEntries();
};
