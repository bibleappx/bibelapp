import * as state from '../state.js';
import * as utils from '../utils.js';
import { getProcessedEntry } from './contentProcessor.js';

export function getAllEntries() {
    const allEntries = [];
    Object.entries(state.notes).forEach(([key, verseNotes]) => {
        const [b, c, v] = key.split('-');
        const book = utils.getBook(parseInt(b));
        if (book && Array.isArray(verseNotes)) {
            verseNotes.forEach(note => allEntries.push({ ...note, type: 'note', ref: `${book.long_name} ${c}:${v}`, link: `/bible/${utils.getPrimaryShortName(book)}/${c}/${v}`, verseKey: key }));
        }
    });
    Object.entries(state.journals).forEach(([name, journalEntries]) => { if (Array.isArray(journalEntries)) { journalEntries.forEach(entry => allEntries.push({ ...entry, type: 'user', ref: entry.title || name, link: `/journal/view/${encodeURIComponent(name)}/entry/${entry.id}`, journalKey: name })); } });
    Object.entries(state.booknotes).forEach(([key, bookEntries]) => { const book = utils.getBook(parseInt(key)); if (book && Array.isArray(bookEntries)) { bookEntries.forEach(entry => allEntries.push({ ...entry, type: 'book', ref: `Buch-Notiz: ${entry.title || book.long_name}`, link: `/journal/book/${key}/entry/${entry.id}`, journalKey: key })); } });
    Object.entries(state.chapternotes).forEach(([key, chapterEntries]) => {
        const [b, c] = key.split('-');
        const book = utils.getBook(parseInt(b));
        if (book && Array.isArray(chapterEntries)) {
            chapterEntries.forEach(entry => allEntries.push({ ...entry, type: 'chapter', ref: `Kapitel-Notiz: ${entry.title || `${book.long_name} ${c}`}`, link: `/journal/chapter/${key}/entry/${entry.id}`, journalKey: key }));
        }
    });
    state.sermons.forEach(sermon => {
        allEntries.push({ ...sermon, type: 'sermon', ref: `Predigt: ${sermon.title}`, link: `/sermons/view/${sermon.id}`, timestamp: sermon.date });
    });
    return allEntries;
};

function buildDictionaryIndex() {
    const wordIndex = new Set();
    state.availableDictionaries.forEach(dict => {
        if (dict.data) {
            dict.data.forEach(entry => {
                const topics = entry.topic.split(/[,;]/).map(t => t.trim().toLowerCase());
                topics.forEach(t => {
                    if (t.length > 2) {
                        wordIndex.add(t);
                    }
                });
            });
        }
    });
    state.setDictionaryWordIndex(wordIndex);
}

function rebuildAllEntriesCache() {
    const entries = getAllEntries();
    const newCache = entries.map(entry => {
        const processed = getProcessedEntry(entry);
        const title = entry.ref || '';
        const tags = processed.tags || [];
        const fullText = `${title} ${processed.plainTextContent} ${tags.join(' ')}`;
        entry.searchableText_case_sensitive = fullText;
        entry.searchableText_case_insensitive = fullText.toLowerCase();
        return entry;
    });
    state.setAllEntriesCache(newCache);
};

function buildReferenceIndexes() {
    const sermonIndex = new Map();
    const crossRefIndex = new Map();
    const chapterRefIndex = new Map();

    state.allEntriesCache.forEach(entry => {
        const processed = getProcessedEntry(entry);
        const sourceInfo = { 
            ref: entry.ref, 
            link: entry.link, 
            snippet: (entry.plainTextContent || '').substring(0, 100) + '...' 
        };

        processed.internalLinks?.forEach(link => {
            const targetVerseKey = `${link.book_number}-${link.chapter}-${link.verse}`;
            if (!crossRefIndex.has(targetVerseKey)) {
                crossRefIndex.set(targetVerseKey, []);
            }
            crossRefIndex.get(targetVerseKey).push(sourceInfo);
        });
        
        if (entry.type === 'sermon' && entry.bibleVerses) {
            entry.bibleVerses.forEach(verseString => {
                const verseRef = utils.parseVerseString(verseString);
                if (verseRef) {
                    const key = `${verseRef.book_number}-${verseRef.chapter}-${verseRef.verse}`;
                    if (!sermonIndex.has(key)) sermonIndex.set(key, []);
                    sermonIndex.get(key).push(entry);
                }
            });
        }
        
        processed.chapterLinks?.forEach(link => {
            const targetChapterKey = `${link.book_number}-${link.chapter}`;
            if (!chapterRefIndex.has(targetChapterKey)) {
                chapterRefIndex.set(targetChapterKey, []);
            }
            chapterRefIndex.get(targetChapterKey).push(sourceInfo);
        });
    });

    state.setSermonIndexByVerse(sermonIndex);
    state.setCrossReferenceIndexByVerse(crossRefIndex);
    state.setChapterReferenceIndexByChapter(chapterRefIndex);
}

function processVerseMetadata() {
    state.availableTranslations.flatMap(t => t.data).forEach(v => {
        if (!v) return;
        const verseKey = `${v.book_number}-${v.chapter}-${v.verse}`;
        const verseNotes = state.notes[verseKey] || [];
        const hasYoutube = verseNotes.some(n => getProcessedEntry(n).flags?.hasYoutube);
        const hasAudio = verseNotes.some(n => getProcessedEntry(n).flags?.hasAudio);
        const hasVideo = verseNotes.some(n => getProcessedEntry(n).flags?.hasVideo);
        v.metadata = {
            hasNote: verseNotes.length > 0,
            hasSermon: state.sermonIndexByVerse.has(verseKey),
            hasCrossReference: state.crossReferenceIndexByVerse.has(verseKey),
            hasYoutube: hasYoutube,
            hasAudio: hasAudio,
            hasVideo: hasVideo,
            hasResource: verseNotes.some(n => getProcessedEntry(n).resources?.length > 0),
            hasMedia: hasYoutube || hasAudio || hasVideo
        };
    });
}

export function buildInitialData() {
    const bibleStructure = {};
    state.verses.forEach(v => {
        if (!bibleStructure[v.book_number]) bibleStructure[v.book_number] = {};
        if (!bibleStructure[v.book_number][v.chapter] || v.verse > bibleStructure[v.book_number][v.chapter]) {
            bibleStructure[v.book_number][v.chapter] = v.verse;
        }
    });
    state.setBibleStructure(bibleStructure);
    
    const singleChapterBooks = new Set();
    Object.entries(state.bibleStructure).forEach(([bookNum, chapters]) => {
        if (Object.keys(chapters).length === 1) {
            singleChapterBooks.add(parseInt(bookNum, 10));
        }
    });
    state.setSingleChapterBooks(singleChapterBooks);

    const aliasList = state.books.flatMap(book => 
        [book.long_name, ...book.short_name.replace(/[\[\]]/g, '').split(',')].map(name => name.trim()).filter(Boolean).map(alias => ({ alias: alias.toLowerCase(), book }))
    ).sort((a, b) => b.alias.length - a.alias.length);
    state.setBookAliasList(aliasList);

    const allShortNames = state.books.flatMap(book => book.short_name.replace(/[\[\]]/g, '').split(',').map(name => name.trim().replace(/(\d)/, '$1\\s?')).filter(Boolean));
    allShortNames.sort((a, b) => b.length - a.length);
    const bookShortNamesPattern = allShortNames.join('|');
    state.setVerseMentionRegex(new RegExp(`\\b(${bookShortNamesPattern})\\s*(\\d+)(?::|,|\\s)\\s*(\\d+)\\b`, 'gi'));
    
    const strongsConcordance = new Map();
    state.strongsArray.forEach(entry => {
        strongsConcordance.set(entry.topic, entry);
    });
    state.setStrongsConcordance(strongsConcordance);

    state.verses.forEach(v => {
        if (!v.plainTextContent) v.plainTextContent = utils.extractPlainTextFromHtml(v.text);
        const book = utils.getBook(v.book_number);
        if (book) {
            v.ref = `${book.long_name} ${v.chapter}:${v.verse}`;
            v.link = `/bible/${utils.getPrimaryShortName(book)}/${v.chapter}/${v.verse}`;
            v.type = 'bible';
            const fullText = `${v.ref} ${v.plainTextContent}`;
            v.searchableText_case_sensitive = fullText;
            v.searchableText_case_insensitive = fullText.toLowerCase();
        }
    });

    buildDictionaryIndex();
    rebuildAllEntriesCache();
    buildStrongsVerseIndex();
    buildReferenceIndexes();
    processVerseMetadata();
}

export function buildStrongsVerseIndex() {
    const newIndex = new Map();
    const strongsTranslations = state.availableTranslations.filter(t => t.hasStrongs);
    strongsTranslations.forEach(translation => {
        const translationIndex = new Map();
        const versesWithStrongs = translation.data;
        if (!versesWithStrongs || versesWithStrongs.length === 0) return;
        const verseRegex = /<S>(\d+)<\/S>/g;
        versesWithStrongs.forEach(verse => {
            if (typeof verse.text !== 'string') return;
            const prefix = verse.book_number > 460 ? 'G' : 'H';
            let match;
            verseRegex.lastIndex = 0;
            while ((match = verseRegex.exec(verse.text)) !== null) {
                const number = match[1];
                const strongId = `${prefix}${number}`;
                const verseRef = { b: verse.book_number, c: verse.chapter, v: verse.verse };
                if (!translationIndex.has(strongId)) {
                    translationIndex.set(strongId, []);
                }
                translationIndex.get(strongId).push(verseRef);
            }
        });
        newIndex.set(translation.id, translationIndex);
    });
    state.setStrongsVerseIndex(newIndex);
}

export function rebuildSermonIndex() {
    const sermonIndex = new Map();
    state.sermons.forEach(sermon => {
        (sermon.bibleVerses || []).forEach(verseString => {
            const verseRef = utils.parseVerseString(verseString);
            if (verseRef) {
                const key = `${verseRef.book_number}-${verseRef.chapter}-${verseRef.verse}`;
                if (!sermonIndex.has(key)) sermonIndex.set(key, []);
                sermonIndex.get(key).push(sermon);
            }
        });
    });
    state.setSermonIndexByVerse(sermonIndex);
}