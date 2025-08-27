import * as utils from '../utils.js';
// NEU: formatVerseText wird hier importiert.
import { getProcessedEntry, formatVerseText } from '../services/contentProcessor.js';
import { generateHighlightedSnippet } from '../services/search.js';

export function createPagination(currentPage, totalPages, location = window.location) {
    if (totalPages <= 1) return '';
    const getPageLink = (page) => { const params = new URLSearchParams(location.search); params.set('page', page); return `${location.pathname}?${params.toString()}`; };
    let pages = []; const windowSize = 1;
    pages.push({ content: '<i class="fa-solid fa-caret-left"></i>', href: getPageLink(currentPage - 1), isDisabled: currentPage === 1, isIcon: true });
    if (1 < currentPage - windowSize) { pages.push({ content: '1', href: getPageLink(1), isCurrent: currentPage === 1 }); if (1 < currentPage - windowSize - 1) pages.push({ content: '...', isDisabled: true }); }
    for (let i = Math.max(1, currentPage - windowSize); i <= Math.min(totalPages, currentPage + windowSize); i++) pages.push({ content: i, href: getPageLink(i), isCurrent: currentPage === i });
    if (totalPages > currentPage + windowSize) { if (totalPages > currentPage + windowSize + 1) pages.push({ content: '...', isDisabled: true }); pages.push({ content: totalPages, href: getPageLink(totalPages), isCurrent: currentPage === totalPages }); }
    pages.push({ content: '<i class="fa-solid fa-caret-right"></i>', href: getPageLink(currentPage + 1), isDisabled: currentPage === totalPages, isIcon: true });
    const html = pages.map(page => { const Tag = page.isDisabled ? 'span' : 'a'; const currentClass = page.isCurrent ? 'active' : ''; const iconClass = page.isIcon ? 'icon' : ''; const disabledClass = page.isDisabled ? 'disabled' : ''; const href = !page.isDisabled ? `href="${page.href}" data-link` : ''; return `<${Tag} ${href} class="page-item ${currentClass} ${iconClass} ${disabledClass}">${page.content}</${Tag}>`; }).join('');
    return `<nav class="pagination">${html}</nav>`;
};

export function createFilterPillsHTML(filters, activeFilter = 'all') {
    return filters.map(filter => `<button class="btn btn-sm ${filter.filter === activeFilter ? 'active' : ''}" data-filter="${filter.filter}" title="${filter.title}"><i class="${filter.icon}"></i></button>`).join('');
}

export function renderTagsHTML(tags) {
    if (!tags?.length) return '';
    return `<div class="tags-container">${tags.map(tag => `<a href="/tags/${encodeURIComponent(tag)}" data-link class="tag-badge">${tag}</a>`).join('')}</div>`;
};

export function renderVerseBlockHTML(verse) {
    if (!verse) return '';
    const meta = verse.metadata || {};
    const book = utils.getBook(verse.book_number);
    const primaryShortName = utils.getPrimaryShortName(book);
    const indicators = [];
    if (meta.hasNote) indicators.push('<i class="fa-solid fa-pencil" title="Hat Notizen" style="color:var(--accent-teal);"></i>');
    if (meta.hasSermon) indicators.push('<i class="fa-solid fa-book-bible" title="Kommt in Predigt(en) vor" style="color:var(--accent-purple);"></i>');
    if (meta.hasCrossReference) indicators.push('<i class="fa-solid fa-link" title="Hat Querverweise" style="color:var(--secondary-color);"></i>');
    if (meta.hasYoutube) indicators.push('<i class="fa-brands fa-youtube" title="Hat YouTube-Videos" style="color:red;"></i>');
    if (meta.hasAudio) indicators.push('<i class="fa-solid fa-file-audio" title="Hat Audio-Dateien" style="color:var(--bs-blue);"></i>');
    if (meta.hasVideo) indicators.push('<i class="fa-solid fa-file-video" title="Hat Video-Dateien" style="color:var(--bs-purple);"></i>');
    if (meta.hasResource) indicators.push('<i class="fa-solid fa-paperclip" title="Hat Ressourcen" style="color:var(--bs-orange);"></i>');
    const dataAttrs = `
    data-has-note="${meta.hasNote}" 
    data-has-sermon="${meta.hasSermon}" 
    data-has-crossref="${meta.hasCrossReference}" 
    data-has-media="${meta.hasMedia}" 
    data-has-resource="${meta.hasResource}"`;
    // NEU: Der Text wird jetzt durch die formatVerseText-Funktion verarbeitet.
    const formattedText = formatVerseText(verse.text, verse.book_number);
    return `
    <a href="/bible/${primaryShortName}/${verse.chapter}/${verse.verse}" data-link class="verse-block" ${dataAttrs}>
        <div class="verse-block-header">
            <span class="verse-block-ref">${primaryShortName} ${verse.chapter}:${verse.verse}</span>
            <span class="verse-block-indicators">${indicators.join('')}</span>
        </div>
        <p class="verse-block-text">${formattedText}</p>
    </a>`;
};

export function renderEntryListItemHTML(entry) {
    const processedEntry = getProcessedEntry(entry);
    const snippet = (processedEntry.plainTextContent || '').substring(0, 150).trim() + '...';
    let editLink = '#', deleteButtonHTML = '';
    const baseDeleteAttrs = `data-id="${entry.id}" data-back-link="${window.location.pathname}"`;
    switch (entry.type) {
        case 'note':
            editLink = `/bible-note/edit/${entry.verseKey}/${entry.id}`;
            deleteButtonHTML = `<button class="btn-icon delete-note-btn" ${baseDeleteAttrs} data-verse-key="${entry.verseKey}" title="Löschen"><i class="fa-solid fa-trash"></i></button>`;
            break;
        case 'sermon':
            editLink = `/sermons/edit/${entry.id}`;
            deleteButtonHTML = `<button class="btn-icon delete-sermon-btn" ${baseDeleteAttrs} title="Löschen"><i class="fa-solid fa-trash"></i></button>`;
            break;
        default:
            const pathType = entry.type === 'user' ? 'view' : entry.type;
            const pathKey = entry.type === 'user' ? encodeURIComponent(entry.journalKey) : entry.journalKey;
            editLink = `/journal/${pathType}/${pathKey}/entry/${entry.id}/edit`;
            deleteButtonHTML = `<button class="btn-icon delete-entry-btn" ${baseDeleteAttrs} data-journal-type="${entry.type}" data-journal-key="${entry.journalKey}" title="Löschen"><i class="fa-solid fa-trash"></i></button>`;
            break;
    }
    const indicators = [];
    if (processedEntry.flags?.hasCrossReference) indicators.push('<i class="fa-solid fa-link" title="Hat Querverweise" style="color:var(--secondary-color);"></i>');
    if (processedEntry.flags?.hasYoutube) indicators.push('<i class="fa-brands fa-youtube" title="Hat YouTube-Videos" style="color:red;"></i>');
    if (processedEntry.flags?.hasAudio) indicators.push('<i class="fa-solid fa-file-audio" title="Hat Audio-Dateien" style="color:var(--bs-blue);"></i>');
    if (processedEntry.flags?.hasVideo) indicators.push('<i class="fa-solid fa-file-video" title="Hat Video-Dateien" style="color:var(--bs-purple);"></i>');
    if (processedEntry.resources?.length > 0) indicators.push('<i class="fa-solid fa-paperclip" title="Hat Ressourcen" style="color:var(--bs-orange);"></i>');
    if (entry.type === 'sermon') indicators.push('<i class="fa-solid fa-book-bible" title="Predigt" style="color:var(--accent-purple);"></i>');
    const dataAttrs = `
    data-has-note="${entry.type === 'note'}"
    data-has-sermon="${entry.type === 'sermon'}"
    data-has-crossref="${!!processedEntry.flags?.hasCrossReference}"
    data-has-youtube="${!!processedEntry.flags?.hasYoutube}"
    data-has-audio="${!!processedEntry.flags?.hasAudio}"
    data-has-video="${!!processedEntry.flags?.hasVideo}"
    data-has-resource="${(processedEntry.resources?.length || 0) > 0}"
`;
    return `
    <div class="list-group-item" ${dataAttrs}>
        <a href="${entry.link}" data-link class="flex-grow-1 d-flex flex-column" style="min-width: 0;">
            <span class="search-result-ref">${entry.ref}</span>
            <span class="search-result-snippet">${snippet}</span>
        </a>
        <div class="d-flex align-items-center gap-2 flex-shrink-0 ms-auto">
            <span class="entry-indicators">${indicators.join('')}</span>
            <div class="list-item-actions">
                <a href="${editLink}" data-link class="btn-icon" title="Bearbeiten"><i class="fa-solid fa-pencil"></i></a>
                ${deleteButtonHTML}
            </div>
        </div>
    </div>`;
};

export function renderSearchResultItemHTML(result, parsedQuery) {
    const highlightedSnippet = generateHighlightedSnippet(result.plainTextContent, parsedQuery.highlightRegexes);
    const indicators = [];
    if (result.flags?.hasCrossReference) indicators.push('<i class="fa-solid fa-link" title="Hat Querverweise" style="color:var(--secondary-color);"></i>');
    if (result.flags?.hasYoutube) indicators.push('<i class="fa-brands fa-youtube" title="Hat YouTube-Videos" style="color:red;"></i>');
    if (result.flags?.hasAudio) indicators.push('<i class="fa-solid fa-file-audio" title="Hat Audio-Dateien" style="color:var(--bs-blue);"></i>');
    if (result.flags?.hasVideo) indicators.push('<i class="fa-solid fa-file-video" title="Hat Video-Dateien" style="color:var(--bs-purple);"></i>');
    if (result.resources?.length > 0) indicators.push('<i class="fa-solid fa-paperclip" title="Hat Ressourcen" style="color:var(--bs-orange);"></i>');
    if (result.type === 'sermon') indicators.push('<i class="fa-solid fa-book-bible" title="Predigt" style="color:var(--accent-purple);"></i>');
    return `
        <div class="list-group-item search-result-item">
             <a href="${result.link}" data-link class="flex-grow-1 d-flex flex-column" style="min-width: 0;">
                <span class="search-result-ref">${result.ref}</span>
                <span class="search-result-snippet">${highlightedSnippet}</span>
            </a>
            <div class="d-flex align-items-center gap-2 flex-shrink-0 ms-auto">
                <span class="entry-indicators">${indicators.join('')}</span>
            </div>
        </div>`;
};