import * as state from './state.js';
import { router } from './router.js';

export const getBook = (bookNumber) => state.books.find(b => b.book_number === bookNumber);

export const getPrimaryShortName = (book) => {
    if (!book?.short_name) return '';
    return book.short_name.replace(/[\[\]]/g, '').split(',')[0]?.trim() ?? '';
};

export const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' });
};

export const debounce = (func, delay) => {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
};

export const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const extractPlainTextFromHtml = (htmlContent) => {
    if (!htmlContent) return '';
    const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
    doc.querySelectorAll('.file-resource').forEach(el => el.remove());
    return doc.body.textContent ?? '';
};

export const parseVerseList = (verseListStr) => {
    const verses = new Set();
    if (!verseListStr) return [];
    
    const parts = verseListStr.split(/[;.,]/);

    for (const part of parts) {
        const trimmedPart = part.trim();
        if (!trimmedPart) continue;

        const rangeMatch = trimmedPart.match(/^(\d+)[-–—](\d+)$/);
        if (rangeMatch) {
            const start = parseInt(rangeMatch[1], 10);
            const end = parseInt(rangeMatch[2], 10);
            if (!isNaN(start) && !isNaN(end) && start <= end) {
                for (let i = start; i <= end; i++) {
                    verses.add(i);
                }
            }
        } else {
            const verseNum = parseInt(trimmedPart, 10);
            if (!isNaN(verseNum)) {
                verses.add(verseNum);
            }
        }
    }
    return Array.from(verses).sort((a, b) => a - b);
};

export const getBookShortNamesPattern = () => {
    const allShortNames = state.books.flatMap(book =>
        book.short_name.replace(/[\[\]]/g, '').split(',').map(name => {
            let cleanName = name.trim();
            if (!cleanName) return null;
            cleanName = escapeRegExp(cleanName);
            cleanName = cleanName.replace(/(\d)/, '$1\\s?');
            return cleanName;
        }).filter(Boolean)
    );
    allShortNames.sort((a, b) => b.length - a.length);
    return allShortNames.join('|');
};

export const findBookByAlias = (alias) => {
    const cleanAlias = alias.toLowerCase();
    return state.books.find(b =>
        b.short_name.replace(/[\[\]]/g, '').split(',').some(name => name.trim().toLowerCase() === cleanAlias) ||
        b.long_name.toLowerCase() === cleanAlias
    );
};

export const findBookMatch = (inputString) => {
    const cleanInput = inputString.trim().toLowerCase();
    for (const entry of state.bookAliasList) {
        if (cleanInput.startsWith(entry.alias)) {
            const nextChar = cleanInput[entry.alias.length];
            if (nextChar === undefined || !/[a-zäöüß]/.test(nextChar)) {
                return {
                    book: entry.book,
                    matchedAlias: inputString.trim().substring(0, entry.alias.length)
                };
            }
        }
    }
    return null;
};

export const parseVerseString = (verseString) => {
    if (!verseString || typeof verseString !== 'string') return null;
    const bookMatch = findBookMatch(verseString);
    if (!bookMatch) return null;
    const { book, matchedAlias } = bookMatch;
    const remainingString = verseString.substring(matchedAlias.length).trim();
    const numberMatch = remainingString.match(/^(\d+)\s*[,:\s]\s*(\d+)/);
    if (numberMatch && numberMatch.length === 3) {
        return {
            book_number: book.book_number,
            chapter: parseInt(numberMatch[1], 10),
            verse: parseInt(numberMatch[2], 10)
        };
    }
    return null;
};

export const parseMultiVerseQuery = (query) => {
    const allVerses = [];
    if (!query || !query.trim()) return allVerses;
    const bookShortNamesPattern = getBookShortNamesPattern();
    const chunkRegex = new RegExp(`(?:\\b(${bookShortNamesPattern})\\s*)?(\\d+)\\s*(?:,|:|\\s)\\s*([\\d,.-–;]+)`, 'gi');
    let lastSeenBook = null;
    let match;
    while ((match = chunkRegex.exec(query)) !== null) {
        let [, bookName, chapterStr, verseListStr] = match;
        if (bookName) {
            lastSeenBook = findBookByAlias(bookName.trim().toLowerCase());
        }
        const currentChapter = parseInt(chapterStr, 10);
        if (lastSeenBook && !isNaN(currentChapter) && verseListStr) {
            const verseNumbers = parseVerseList(verseListStr);
            verseNumbers.forEach(vNum => {
                const verseData = state.verses.find(v => v.book_number === lastSeenBook.book_number && v.chapter === currentChapter && v.verse === vNum);
                if (verseData) allVerses.push(verseData);
            });
        }
    }
    return allVerses;
};

export const getVerseText = (bookNumber, chapter, verseNum, translationId) => {
    const translation = state.availableTranslations.find(t => t.id === translationId);
    if (!translation || !translation.data) return null;
    const verseData = translation.data.find(v =>
        v.book_number === bookNumber && v.chapter === chapter && v.verse === verseNum
    );
    return verseData ? verseData.text : null;
};

export const getTextColorForBg = (hexColor) => {
    if (!hexColor) return '#000000';
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return brightness > 155 ? '#000000' : '#ffffff';
};

export const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const getFileIconClass = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    const iconMap = { 'pdf': 'fa-solid fa-file-pdf', 'doc': 'fa-solid fa-file-word', 'docx': 'fa-solid fa-file-word', 'xls': 'fa-solid fa-file-excel', 'xlsx': 'fa-solid fa-file-excel', 'ppt': 'fa-solid fa-file-powerpoint', 'pptx': 'fa-solid fa-file-powerpoint', 'zip': 'fa-solid fa-file-archive', 'rar': 'fa-solid fa-file-archive', 'txt': 'fa-solid fa-file-alt', 'jpg': 'fa-solid fa-file-image', 'jpeg': 'fa-solid fa-file-image', 'png': 'fa-solid fa-file-image', 'gif': 'fa-solid fa-file-image', 'mp3': 'fa-solid fa-file-audio', 'wav': 'fa-solid fa-file-audio', 'mp4': 'fa-solid fa-file-video', 'mov': 'fa-solid fa-file-video' };
    return iconMap[extension] || 'fa-solid fa-file';
};

export const showToast = (message, isSuccess = true) => {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'app-toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }, 3000);
    }, 10);
};

export const getCurrentPage = () => parseInt(new URLSearchParams(window.location.search).get('page') || '1');

export const scrollToElement = (selector, offset = 0) => {
    const element = document.querySelector(selector);
    if (element) {
        window.requestAnimationFrame(() => {
            const elementRect = element.getBoundingClientRect();
            window.scrollTo({
                top: window.scrollY + elementRect.top - offset,
                behavior: 'smooth'
            });
        });
    }
};

export const navigateTo = (path) => {
    history.pushState(null, '', path);
    router();
};

export const generateSlugId = (title, existingEntries = []) => {
    const baseSlug = (title || 'unbenannt').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/\s+/g, '-').replace(/[^\w-]+/g, '').substring(0, 50);
    
    let slug = baseSlug;
    let counter = 1;
    
    while(existingEntries.some(e => e.id === `entry-${slug}`)) {
        counter++;
        slug = `${baseSlug}-${counter}`;
    }

    return slug;
};
