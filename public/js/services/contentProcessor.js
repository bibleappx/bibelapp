import * as state from '../state.js';
import * as utils from '../utils.js';

function extractResourcesFromContent(htmlContent) {
    if (!htmlContent) return [];
    const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
    const resources = [];
    doc.querySelectorAll('.file-resource').forEach(el => {
        resources.push({ url: el.dataset.url, name: el.dataset.filename, size: parseInt(el.dataset.filesize, 10) });
    });
    return resources;
};

function processContentForDisplay(content) {
    let processedContent = content ?? '';
    const flags = { hasYoutube: false, hasAudio: false, hasVideo: false, hasCrossReference: false };
    const internalLinks = [];
    const chapterLinks = [];
    
    // Regex für YouTube-Links
    const youtubeRegex = /(?:<p>)?(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:<\/p>)?/g;
    if (youtubeRegex.test(processedContent)) {
        flags.hasYoutube = true;
        processedContent = processedContent.replace(youtubeRegex, (match, videoId) => `<div class="media-container auto-embedded"><div class="media-wrapper"><iframe src="https://www.youtube-nocookie.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div><div class="media-source"><i class="fa-brands fa-youtube"></i><a href="https://www.youtube.com/watch?v=${videoId}" target="_blank" rel="noopener noreferrer">https://www.youtube.com/watch?v=${videoId}</a></div></div>`);
    }

    // Regex für Audio/Video-Dateien
    const mediaFileRegex = /(?:<p>)?(https?:\/\/[^\s<]+\.(?:mp4|mp3))(?:<\/p>)?/g;
    processedContent = processedContent.replace(mediaFileRegex, (match, url) => {
        const isVideo = url.endsWith('.mp4');
        if (isVideo) flags.hasVideo = true; else flags.hasAudio = true;
        const mediaTag = isVideo ? `<video controls src="${url}"></video>` : `<audio controls src="${url}"></audio>`;
        const iconClass = isVideo ? 'fa-solid fa-file-video' : 'fa-solid fa-file-audio';
        return `<div class="media-container auto-embedded"><div class="media-wrapper">${mediaTag}</div><div class="media-source"><i class="${iconClass}"></i><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></div></div>`;
    });

    if (state.verseMentionRegex) {
        // Regex-Quellen für Verserwähnungen und Strong-Nummern
        const verseMentionSource = `\\b(?:(${utils.getBookShortNamesPattern()})\\s*)?(\\d+)(?::|,|\\s)\\s*([\\d-–—.,;]+)\\b|(?:in\\s)?Vers\\s([\\d-–—]+)\\b|(?:im\\s)?(nächsten|vorherigen)\\sKapitel(?:(?:,|\\svers|\\s)\\s*([\\d-–—]+))?\\b|\\b(${utils.getBookShortNamesPattern()})\\s+(\\d+)\\b(?!\\s*[:,])`;
        const strongsMentionSource = `\\b([GH]\\d{1,5})\\b`;
        const combinedRegex = new RegExp(`(${verseMentionSource})|(${strongsMentionSource})`, 'gi');
        
        const root = document.createElement('div');
        root.innerHTML = processedContent;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        const textNodes = [];
        
        while (walker.nextNode()) {
            const parent = walker.currentNode.parentElement;
            // Sicherstellen, dass Textknoten nicht bereits in Links oder bestimmten Hover-Elementen sind
            if (parent.tagName !== 'A' && parent.tagName !== 'BUTTON' && parent.tagName !== 'SCRIPT' && parent.tagName !== 'STYLE' && !parent.closest('.file-resource') && !parent.closest('.verse-mention-hover')) {
                textNodes.push(walker.currentNode);
            }
        }
        
        const uniqueLinks = new Map();
        let lastSeenBook = null;
        let lastSeenChapter = null;

        textNodes.forEach(node => {
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            let match;
            while ((match = combinedRegex.exec(node.nodeValue)) !== null) {
                fragment.appendChild(document.createTextNode(node.nodeValue.slice(lastIndex, match.index)));
                const [
                    fullMatch, verseFullMatch, bookName, chapterStr, verseListStr, relVerseStr,
                    relChapterDir, relChapterVerseStr, chapOnlyBookName, chapOnlyChapterStr,
                    strongsFullMatch, strongsId
                ] = match;

                if (strongsFullMatch) {
                    const trigger = document.createElement('span');
                    trigger.className = 'strongs-mention-hover';
                    trigger.dataset.strongId = strongsId.toUpperCase();
                    trigger.textContent = fullMatch;
                    fragment.appendChild(trigger);
                } else if (chapOnlyBookName && chapOnlyChapterStr) {
                    const foundBook = utils.findBookByAlias(chapOnlyBookName.trim().toLowerCase());
                    if (foundBook) {
                        flags.hasCrossReference = true;
                        const trigger = document.createElement('span'); 
                        trigger.className = 'chapter-mention-hover';
                        trigger.dataset.bookNumber = foundBook.book_number;
                        trigger.dataset.chapter = chapOnlyChapterStr;
                        trigger.textContent = fullMatch;
                        fragment.appendChild(trigger);
                        chapterLinks.push({ book_number: foundBook.book_number, chapter: parseInt(chapOnlyChapterStr, 10), matchedText: fullMatch });
                    } else {
                        fragment.appendChild(document.createTextNode(fullMatch));
                    }
                } else {
                    let versesToAdd = [];
                    let currentBook = lastSeenBook;
                    let currentChapter = lastSeenChapter;
                    
                    if (chapterStr) {
                        if (bookName) {
                            currentBook = utils.findBookByAlias(bookName.trim().toLowerCase());
                        }
                        if (currentBook) {
                            currentChapter = parseInt(chapterStr, 10);
                            versesToAdd = utils.parseVerseList(verseListStr).map(v => ({ book: currentBook, chapter: currentChapter, verse: v }));
                        }
                    } else if (relVerseStr) {
                        if (currentBook && currentChapter) versesToAdd = utils.parseVerseList(relVerseStr).map(v => ({ book: currentBook, chapter: currentChapter, verse: v }));
                    } else if (relChapterDir) {
                        if (currentBook && currentChapter) {
                            currentChapter = relChapterDir.toLowerCase() === 'nächsten' ? currentChapter + 1 : currentChapter - 1;
                            const verseStr = relChapterVerseStr || '1';
                            versesToAdd = utils.parseVerseList(verseStr).map(v => ({ book: currentBook, chapter: currentChapter, verse: v }));
                        }
                    }
                    
                    if (versesToAdd.length > 0) {
                        flags.hasCrossReference = true;
                        lastSeenBook = versesToAdd[0].book;
                        lastSeenChapter = versesToAdd[0].chapter;
                        const verseDataString = JSON.stringify(versesToAdd.map(v => ({ b: v.book.book_number, c: v.chapter, v: v.verse })));
                        const trigger = document.createElement('span');
                        trigger.className = 'verse-mention-hover';
                        trigger.dataset.verses = verseDataString;
                        trigger.textContent = fullMatch;
                        fragment.appendChild(trigger);
                        versesToAdd.forEach(v => {
                            const linkKey = `${v.book.book_number}-${v.chapter}-${v.verse}`;
                            if (!uniqueLinks.has(linkKey) && state.bibleStructure[v.book.book_number]?.[v.chapter] >= v.verse) {
                                uniqueLinks.set(linkKey, { book_number: v.book.book_number, chapter: v.chapter, verse: v.verse, matchedText: fullMatch });
                            }
                        });
                    } else {
                        fragment.appendChild(document.createTextNode(fullMatch));
                    }
                }
                lastIndex = combinedRegex.lastIndex;
            }
            fragment.appendChild(document.createTextNode(node.nodeValue.slice(lastIndex)));
            node.parentNode.replaceChild(fragment, node);
        });
        processedContent = root.innerHTML;
        internalLinks.push(...Array.from(uniqueLinks.values()));
    }
    return { processedContent, flags, internalLinks, chapterLinks };
}

export function getProcessedEntry(entry) {
    if (entry.processedContent && entry.chapterLinks !== undefined) {
        return entry;
    }
    
    const htmlContent = state.markdownConverter.makeHtml(entry.content || '');
    const { processedContent, flags, internalLinks, chapterLinks } = processContentForDisplay(htmlContent);
    
    entry.processedContent = processedContent;
    entry.flags = flags;
    entry.internalLinks = internalLinks;
    entry.chapterLinks = chapterLinks;
    entry.resources = extractResourcesFromContent(htmlContent);
    entry.plainTextContent = utils.extractPlainTextFromHtml(processedContent);
    return entry;
};

export function formatVerseText(rawText, bookNumber) {
    if (!rawText) return '';
    let formattedText = rawText;
    const prefix = bookNumber > 390 ? 'G' : 'H';
    formattedText = formattedText.replace(/〈.*?〉/g, '');
    formattedText = formattedText.replace(/\[.*?\]/g, '');
    formattedText = formattedText.replace(/<pb\/?>/g, '').replace(/<br\/?>/g, '');
    formattedText = formattedText.replace(/<S>(\d+)<\/S>/g, 
        `<sup><span class="strongs-mention-hover" data-strong-id="${prefix}$1">$1</span></sup>`);
    return formattedText.trim();
};

export function processStrongsContentForDisplay(htmlContent) {
    if (!htmlContent) return '';

    const root = document.createElement('div');
    root.innerHTML = htmlContent;

    // --- Start der Änderungen für die korrekte Bibelvers-Bereichserkennung ---
    root.querySelectorAll("a[href^='B:']").forEach(a => {
        const href = a.getAttribute('href');
        // Regex, um Buch, Kapitel und optional einen einzelnen Vers aus dem href zu extrahieren.
        // Der letzte Teil `(?::(\d+))?` macht den Vers optional.
        const hrefMatch = href.match(/B:(\d+)[:\s](\d+)(?::(\d+))?/);
        
        if (hrefMatch) {
            const bookNumFromHref = parseInt(hrefMatch[1], 10);
            const chapterFromHref = parseInt(hrefMatch[2], 10);

            if (isNaN(bookNumFromHref) || isNaN(chapterFromHref)) return;

            let versesToAdd = [];
            const textContent = a.textContent.trim();
            
            const detailedTextParseRegex = /(?:\b(?:[a-zA-ZäöüÄÖÜß]+\s*))?(\d+)(?:[,:\s]+)([\d-–—.,;]+)\b/;
            // Fallback-Regex, um nur Versnummern wie "12-14" zu erfassen, wenn kein Kapitel im Text erkannt wird
            const simpleTextParseRegex = /([\d-–—.,;]+)\b/; 

            const matchDetailed = textContent.match(detailedTextParseRegex);
            if (matchDetailed) {
                const chapterInText = parseInt(matchDetailed[1], 10);
                const versesInText = matchDetailed[2];
                // Wenn das Kapitel im Text mit dem Kapitel aus dem href übereinstimmt,
                // verwende dessen Versliste, um den Bereich zu parsen.
                if (chapterInText === chapterFromHref) {
                    versesToAdd = utils.parseVerseList(versesInText);
                }
            }

            // Wenn die detaillierte Analyse fehlschlug oder die Kapitel nicht übereinstimmten,
            // versuchen Sie eine einfachere Analyse nur für Versnummern im Text.
            if (versesToAdd.length === 0) {
                const matchSimple = textContent.match(simpleTextParseRegex);
                if (matchSimple) {
                    versesToAdd = utils.parseVerseList(matchSimple[1]);
                }
            }

            // Fallback: Wenn immer noch keine Verse aus dem Textinhalt geparst werden konnten,
            // verwende den einzelnen Vers aus dem href (falls vorhanden) oder standardmäßig Vers 1.
            if (versesToAdd.length === 0) {
                if (hrefMatch[3]) { // href enthielt einen spezifischen Vers (z.B. B:230 72:12)
                    versesToAdd = [parseInt(hrefMatch[3], 10)];
                } else {
                    versesToAdd = [1]; // Standardmäßig Vers 1, wenn kein spezifischer Vers im href gefunden wurde
                }
            }
            
            // Die geparsten einzelnen Verse in die endgültige Datenstruktur abbilden
            const verseData = versesToAdd.map(v => ({ b: bookNumFromHref, c: chapterFromHref, v: v }));
            const verseDataString = JSON.stringify(verseData);
            
            const span = document.createElement('span');
            span.className = 'verse-mention-hover';
            span.dataset.verses = verseDataString;
            span.textContent = a.textContent; // Den ursprünglichen Textinhalt zur Anzeige beibehalten
            a.parentNode.replaceChild(span, a);
        }
    });
    // --- Ende der Änderungen für die korrekte Bibelvers-Bereichserkennung ---
    
    root.querySelectorAll("a[href^='S:']").forEach(a => {
        const href = a.getAttribute('href');
        const strongId = href.substring(2);
        
        const span = document.createElement('span');
        span.className = 'strongs-mention-hover';
        span.dataset.strongId = strongId;
        span.textContent = a.textContent;

        span.addEventListener('click', (e) => {
            e.stopPropagation();
            history.pushState(null, '', `/strongs/${strongId}`);
        });
        
        a.parentNode.replaceChild(span, a);
    });

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) {
        // Sicherstellen, dass Textknoten nicht bereits in Links oder Hover-Elementen sind,
        // um Dopplungen oder Konflikte zu vermeiden.
        if (walker.currentNode.parentElement.tagName !== 'A' && !walker.currentNode.parentElement.classList.contains('strongs-mention-hover') && !walker.currentNode.parentElement.classList.contains('verse-mention-hover')) {
             textNodes.push(walker.currentNode);
        }
    }
    
    const strongsMentionRegex = /\b([GH]\d{1,5})\b/g;
    textNodes.forEach(node => {
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        let match;
        while ((match = strongsMentionRegex.exec(node.nodeValue)) !== null) {
            fragment.appendChild(document.createTextNode(node.nodeValue.slice(lastIndex, match.index)));
            const strongId = match[1].toUpperCase();
            
            const trigger = document.createElement('span');
            trigger.className = 'strongs-mention-hover';
            trigger.dataset.strongId = strongId;
            trigger.textContent = match[0];
            fragment.appendChild(trigger);
            
            lastIndex = strongsMentionRegex.lastIndex;
        }
        fragment.appendChild(document.createTextNode(node.nodeValue.slice(lastIndex)));
        node.parentNode.replaceChild(fragment, node);
    });

    return root.innerHTML;
};
