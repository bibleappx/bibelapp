export let books = [],
  verses = [],
  notes = {},
  journals = {},
  booknotes = {},
  chapternotes = {},
  sermons = [];

export let availableCommentaries = [
    { id: 'elb06c', name: 'ELB06', data: [] },
    { id: 'leoc', name: 'LEO18-RP', data: [] },
    { id: 'bidfc', name: 'bidfc', data: [] },
    { id: 'studien-c', name: 'Kautz', data: [] },
    { id: 'sch2000-c', name: 'SLT2000', data: [] },
    { id: 'stkb-c', name: 'STKB', data: [] },
    { id: 'neu-c', name: 'NEÜ', data: [] },
    { id: 'albc', name: 'Albrecht', data: [] }
];

export let availableDictionaries = [
    { id: 'jma', name: 'JMA', data: [] },
    { id: 'rienecker', name: 'Rienecker', data: [] },
    { id: 'bridge', name: 'Bridge', data: [] },
    { id: 'tcr', name: 'TCR', data: [] },
    { id: 'morrish', name: 'Morrish', data: [] }
];

export let bibleStructure = {};
export let availableTranslations = [
    { id: 'default', name: 'Standard', data: [] },
    { id: 'lutherheute', name: 'LH', data: [] },
    { id: 'neueluther09', name: 'NL09', data: [] },
    { id: 'studien', name: 'Studien', data: [] },
    { id: 'fbu', name: 'FBÜ', data: [] },
    { id: 'rst', name: 'RST', data: [] },
    { id: 'elb-csv', name: 'ELB-CSV', data: [], hasStrongs: true },
    { id: 'kjv', name: 'KJV', data: [] , hasStrongs: true},
    { id: 'bidf', name: 'BiDF', data: [] },
    { id: 'albrecht', name: 'ALB', data: [] },
    { id: 'leo-rp18', name: 'Leo-RP18+', data: [], hasStrongs: true },
    { id: 'elberfelder-bk', name: 'ELB-BK+', data: [], hasStrongs: true }
];

export let strongsArray = [];
export let bookAliasList = [];
export let strongsVerseIndex = new Map();
export let chapterReferenceIndexByChapter = new Map();
export let strongsConcordance = new Map();
export let allEntriesCache = [];
export let sermonIndexByVerse = new Map();
export let crossReferenceIndexByVerse = new Map();
export let markdownConverter;
export let verseMentionRegex;
export let dictionaryWordIndex = new Set(); // NEU

export function setBooks(data) { books = data; }
export function setVerses(data) { verses = data; }
export function setNotes(data) { notes = data || {}; }
export function setJournals(data) { journals = data || {}; }
export function setBooknotes(data) { booknotes = data || {}; }
export function setChapternotes(data) { chapternotes = data || {}; }
export function setSermons(data) { sermons = data || []; }
export function setBibleStructure(data) { bibleStructure = data; }
export function setStrongsArray(data) { strongsArray = data; }
export function setBookAliasList(data) { bookAliasList = data; }
export function setStrongsVerseIndex(map) { strongsVerseIndex = map; }
export function setChapterReferenceIndexByChapter(map) { chapterReferenceIndexByChapter = map; }
export function setStrongsConcordance(map) { strongsConcordance = map; }
export function setAllEntriesCache(data) { allEntriesCache = data; }
export function setSermonIndexByVerse(map) { sermonIndexByVerse = map; }
export function setCrossReferenceIndexByVerse(map) { crossReferenceIndexByVerse = map; }
export function setMarkdownConverter(instance) { markdownConverter = instance; }
export function setVerseMentionRegex(regex) { verseMentionRegex = regex; }
export function setDictionaryWordIndex(index) { dictionaryWordIndex = index; } // NEU