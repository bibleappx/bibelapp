import * as state from '../state.js';
import * as utils from '../utils.js';
import { processStrongsContentForDisplay } from '../services/contentProcessor.js';
import { createPagination } from '../ui/components.js';

const appContainer = document.getElementById('app-container');

function findEntryIndex(dictionaryData, topic) {
    return dictionaryData.findIndex(item => item.topic.toLowerCase() === topic.toLowerCase());
}

function createEntryNavigation(dictionary, currentIndex) {
    const prevEntry = currentIndex > 0 ? dictionary.data[currentIndex - 1] : null;
    const nextEntry = currentIndex < dictionary.data.length - 1 ? dictionary.data[currentIndex + 1] : null;

    let prevLink = prevEntry ? `<a href="/dictionary/${dictionary.id}/${encodeURIComponent(prevEntry.topic.toLowerCase())}" data-link class="btn btn-outline-secondary"><i class="fa-solid fa-chevron-left"></i> ${prevEntry.topic}</a>` : `<div></div>`;
    let nextLink = nextEntry ? `<a href="/dictionary/${dictionary.id}/${encodeURIComponent(nextEntry.topic.toLowerCase())}" data-link class="btn btn-outline-secondary">${nextEntry.topic} <i class="fa-solid fa-chevron-right"></i></a>` : `<div></div>`;

    return `
        <div class="d-flex justify-content-between mt-4">
            ${prevLink}
            ${nextLink}
        </div>
    `;
}

function renderRelatedEntries(currentEntry, dictionary) {
    const currentTopics = currentEntry.topic.toLowerCase().split(/\s+/);
    const related = dictionary.data.filter(entry => {
        if (entry.topic.toLowerCase() === currentEntry.topic.toLowerCase()) {
            return false;
        }
        const entryTopics = entry.topic.toLowerCase().split(/\s+/);
        return currentTopics.some(t => entryTopics.includes(t));
    }).slice(0, 5);

    if (related.length === 0) return '';

    const relatedLinks = related.map(entry => `<li><a href="/dictionary/${dictionary.id}/${encodeURIComponent(entry.topic.toLowerCase())}" data-link>${entry.topic}</a></li>`).join('');

    return `
        <div class="card mt-4">
            <div class="card-header">Verwandte Themen</div>
            <div class="card-body"><ul class="related-entries-list">${relatedLinks}</ul></div>
        </div>
    `;
}

export function renderDictionaryDetailView(dictionaryId, topic) {
    const dictionary = state.availableDictionaries.find(d => d.id === dictionaryId);
    if (!dictionary) {
        appContainer.innerHTML = `<div class="card card-body text-danger">Wörterbuch nicht gefunden.</div>`;
        return;
    }
    
    dictionary.data.sort((a, b) => a.topic.localeCompare(b.topic));
    
    const currentIndex = findEntryIndex(dictionary.data, topic);

    if (currentIndex === -1) {
        appContainer.innerHTML = `<div class="card card-body text-danger">Eintrag "${topic}" nicht gefunden.</div>`;
        return;
    }
    
    const entry = dictionary.data[currentIndex];
    const processedDefinition = processStrongsContentForDisplay(entry.definition);
    const entryNavigation = createEntryNavigation(dictionary, currentIndex);
    const relatedEntriesHTML = renderRelatedEntries(entry, dictionary);

    appContainer.innerHTML = `
        <a href="/dictionary/${dictionaryId}" data-link class="btn btn-secondary btn-sm mb-4"><i class="fa-solid fa-arrow-left"></i> Zurück zur Übersicht</a>
        <h1 class="view-title">${entry.topic}</h1>
        <div class="card">
            <div class="card-body dictionary-definition-content markdown-body">
                ${processedDefinition}
            </div>
        </div>
        ${entryNavigation}
        ${relatedEntriesHTML}
    `;
}

export function renderDictionaryDashboard(dictionaryId) {
    const currentDictionary = state.availableDictionaries.find(d => d.id === dictionaryId);
    if (!currentDictionary) {
        const firstDictId = state.availableDictionaries[0]?.id;
        if (firstDictId) {
            history.replaceState(null, '', `/dictionary/${firstDictId}`);
            renderDictionaryDashboard(firstDictId);
        } else {
            appContainer.innerHTML = `<div class="card card-body text-danger">Keine Wörterbücher verfügbar.</div>`;
        }
        return;
    }

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const alphaButtonsHTML = alphabet.map(letter => `<button class="btn btn-secondary" data-letter="${letter}">${letter}</button>`).join('');

    const dictButtonsHTML = state.availableDictionaries.map(dict =>
        `<a href="/dictionary/${dict.id}" data-link class="btn btn-sm ${dict.id === dictionaryId ? 'btn-primary' : 'btn-outline-secondary'}">${dict.name}</a>`
    ).join('');

    appContainer.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h1 class="view-title mb-0">Wörterbuch</h1>
            <div class="filter-pills">${dictButtonsHTML}</div>
        </div>
        <div class="card mb-4">
            <div class="card-body dictionary-controls">
                <div class="flex-grow-1"><input type="search" id="dict-search-input" placeholder="Thema in '${currentDictionary.name}' suchen..."></div>
                <button id="random-entry-btn" class="btn btn-outline-primary ms-2" title="Zufälliger Eintrag"><i class="fa-solid fa-random"></i></button>
                <div class="alpha-filter">
                    <button class="btn btn-secondary" data-letter="all">Alle</button>
                    ${alphaButtonsHTML}
                </div>
            </div>
        </div>
        <div id="dictionary-list" class="list-group"></div>
        <div id="pagination-container" class="mt-4"></div>
        <button id="scroll-to-top" title="Nach oben"><i class="fa-solid fa-arrow-up"></i></button>
    `;

    const displayEntries = () => {
        const params = new URLSearchParams(window.location.search);
        const searchTerm = params.get('q') || '';
        const activeLetter = params.get('letter') || 'all';
        const currentPage = parseInt(params.get('page') || '1', 10);
        
        document.getElementById('dict-search-input').value = searchTerm;
        document.querySelectorAll('.alpha-filter .btn').forEach(btn => {
            btn.classList.remove('active', 'btn-primary');
            btn.classList.add('btn-secondary');
            if (btn.dataset.letter.toLowerCase() === activeLetter.toLowerCase()) {
                btn.classList.add('active', 'btn-primary');
                btn.classList.remove('btn-secondary');
            }
        });

        let filtered = currentDictionary.data.filter(entry => {
            const searchMatch = !searchTerm || entry.topic.toLowerCase().includes(searchTerm.toLowerCase());
            const letterMatch = activeLetter === 'all' || entry.topic.toLowerCase().startsWith(activeLetter.toLowerCase());
            return searchMatch && letterMatch;
        });

        filtered.sort((a, b) => a.topic.localeCompare(b.topic));

        const itemsPerPage = 50;
        const totalPages = Math.ceil(filtered.length / itemsPerPage);
        const paginatedEntries = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

        const listHTML = paginatedEntries.map(entry => `
            <a href="/dictionary/${dictionaryId}/${encodeURIComponent(entry.topic.toLowerCase())}" data-link class="list-group-item list-group-item-action dictionary-list-item">
                ${entry.topic}
            </a>
        `).join('');

        document.getElementById('dictionary-list').innerHTML = listHTML || '<p class="text-tertiary p-3">Keine Einträge für diese Auswahl gefunden.</p>';
        document.getElementById('pagination-container').innerHTML = createPagination(currentPage, totalPages, new URL(window.location));
        document.getElementById('scroll-to-top').style.display = paginatedEntries.length > 15 ? 'block' : 'none';
    };

    document.getElementById('dict-search-input').addEventListener('input', utils.debounce(e => {
        const params = new URLSearchParams(window.location.search);
        if (e.target.value) {
            params.set('q', e.target.value);
            params.set('page', '1');
        } else {
            params.delete('q');
            params.delete('page');
        }
        history.pushState(null, '', `?${params.toString()}`);
        displayEntries();
    }, 300));
    
    document.querySelector('.alpha-filter').addEventListener('click', e => {
        const button = e.target.closest('button[data-letter]');
        if (button) {
            const params = new URLSearchParams(window.location.search);
            const letter = button.dataset.letter;
            if (letter !== 'all') {
                params.set('letter', letter);
            } else {
                params.delete('letter');
            }
            params.delete('q');
            params.set('page', '1');
            history.pushState(null, '', `?${params.toString()}`);
            displayEntries();
        }
    });

    document.getElementById('random-entry-btn').addEventListener('click', () => {
        const randomIndex = Math.floor(Math.random() * currentDictionary.data.length);
        const randomTopic = currentDictionary.data[randomIndex].topic.toLowerCase();
        const link = document.createElement('a');
        link.href = `/dictionary/${dictionaryId}/${encodeURIComponent(randomTopic)}`;
        link.dataset.link = '';
        appContainer.appendChild(link);
        link.click();
        link.remove();
    });
    
    document.getElementById('scroll-to-top').addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    displayEntries();
}