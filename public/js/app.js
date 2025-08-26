// --- Datei: app.js ---

import * as api from './api.js';
import * as state from './state.js';
import { router } from './router.js';
import { initializeGlobalEventHandlers } from './eventHandlers.js';
import { buildInitialData } from './services/dataBuilder.js';

function setupNavigation() {
    const mainNavContainer = document.getElementById('main-navigation');
    const rightNavContainer = document.getElementById('right-nav-container');
    const firstDictionaryId = state.availableDictionaries[0]?.id || 'jma';

    const navLinks = [
        { href: '/', icon: 'fa-solid fa-house', text: 'Bibelübersicht' },
        { href: `/dictionary/${firstDictionaryId}`, icon: 'fa-solid fa-book-atlas', text: 'Wörterbuch' },
        { href: '/strongs', icon: 'fa-solid fa-font', text: 'Konkordanz' },
        { href: '/sermons', icon: 'fa-solid fa-book-bible', text: 'Predigten' },
        { href: '/recent', icon: 'fa-solid fa-clock-rotate-left', text: 'Aktivitäten' },
        { href: '/journals', icon: 'fa-solid fa-book-journal-whills', text: 'Journale' },
        { href: '/tags', icon: 'fa-solid fa-tags', text: 'Tags' },
            { href: '/ebook', icon: 'fa-solid fa-book-open-reader', text: 'Ebook' },

        { href: '/search', icon: 'fa-solid fa-magnifying-glass', text: 'Suche' }
    ];

    mainNavContainer.innerHTML = navLinks.map(link => `<li class="nav-item"><a class="nav-link" href="${link.href}" data-link title="${link.text}"><i class="${link.icon}"></i> <span>${link.text}</span></a></li>`).join('');

    if (rightNavContainer) {
        rightNavContainer.innerHTML = `
            <button id="theme-toggle" class="btn-icon" title="Theme umschalten">
                <i class="fa-solid fa-sun light-icon"></i>
                <i class="fa-solid fa-moon dark-icon"></i>
            </button>`;
        setupTheme();
    }
    const toggler = document.querySelector('.navbar-toggler');
    const collapse = document.querySelector('.navbar-collapse');
    toggler.addEventListener('click', () => collapse.classList.toggle('show'));
    document.body.addEventListener('click', (e) => {
        if (!e.target.closest('.main-navbar') && !e.target.closest('.navbar-toggler')) {
            collapse.classList.remove('show');
        }
    }, true);
    mainNavContainer.addEventListener('click', () => {
        if (collapse.classList.contains('show')) {
            collapse.classList.remove('show');
        }
    });
}

function setupTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    const docElement = document.documentElement;

    const applyTheme = (theme) => {
        body.classList.toggle('dark-mode', theme === 'dark');
        docElement.setAttribute('data-theme', theme);

        if (themeToggle) {
            themeToggle.querySelector('.light-icon').style.display = theme === 'dark' ? 'none' : 'inline-block';
            themeToggle.querySelector('.dark-icon').style.display = theme === 'dark' ? 'inline-block' : 'none';
        }
    };

    themeToggle?.addEventListener('click', () => {
        const newTheme = body.classList.contains('dark-mode') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });

    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
}

async function loadInitialData() {
    document.getElementById('app-container').innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;

    const translationFetches = state.availableTranslations.map(t => {
        const url = t.id === 'default' ? '/api/verses' : `/api/verses/${t.id}`;
        return api.fetchAPI(url);
    });
    
    const dictionaryFetches = state.availableDictionaries.map(dict => 
        api.fetchAPI(`/api/dictionary/${dict.id}`)
    );

    const commentaryFetches = state.availableCommentaries.map(comm => 
        api.fetchAPI(`/api/commentary/${comm.id}`)
    );

    const [
        loadedBooks,
        ...loadedTranslations
    ] = await Promise.all([
        api.fetchAPI('/api/books'),
        ...translationFetches
    ]);
    
    const [
        loadedStrongs,
        loadedNotes,
        loadedJournals,
        loadedBooknotes,
        loadedChapternotes,
        loadedSermons,
        ...loadedData
    ] = await Promise.all([
        api.fetchAPI('/api/strongs'),
        api.fetchAPI('/api/notes'),
        api.fetchAPI('/api/journals'),
        api.fetchAPI('/api/booknotes'),
        api.fetchAPI('/api/chapternotes'),
        api.fetchAPI('/api/sermons'),
        ...commentaryFetches,
        ...dictionaryFetches
    ]);

    if (!loadedBooks) {
        document.getElementById('app-container').innerHTML = `<div class="card card-body text-danger">Wichtige Daten konnten nicht geladen werden.</div>`;
        return false;
    }

    state.setBooks(loadedBooks);
    state.availableTranslations.forEach((t, index) => {
        t.data = loadedTranslations[index] || [];
    });
    
    const numCommentaries = state.availableCommentaries.length;
    state.availableCommentaries.forEach((comm, index) => {
        comm.data = loadedData[index] || [];
    });
    state.availableDictionaries.forEach((dict, index) => {
        dict.data = loadedData[numCommentaries + index] || [];
    });

    state.setVerses(state.availableTranslations[0].data);
    state.setStrongsArray(loadedStrongs || []);
    state.setNotes(loadedNotes);
    state.setJournals(loadedJournals);
    state.setBooknotes(loadedBooknotes);
    state.setChapternotes(loadedChapternotes);
    state.setSermons(loadedSermons);
    state.setMarkdownConverter(new showdown.Converter({ tables: true, simpleLineBreaks: true, strikethrough: true, emoji: true }));
    
    buildInitialData();
    return true;
}

async function main() {
    setupNavigation();
    const dataLoaded = await loadInitialData();
    if (dataLoaded) {
        initializeGlobalEventHandlers();
        router();
        window.addEventListener('popstate', router);
    }
}

main();
