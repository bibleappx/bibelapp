import * as state from '../state.js';
import * as utils from '../utils.js';

const stopWords = new Set([
  'der', 'die', 'das', 'ein', 'eine', 'einer', 'eines', 'einem', 'einen',
  'und', 'oder', 'aber', 'sondern', 'als', 'dass', 'wenn', 'weil',
  'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'sich',
  'mich', 'dich', 'uns', 'euch',
  'mein', 'dein', 'sein', 'ihr', 'unser', 'euer', 'ihre', 'ihres',
  'bin', 'bist', 'ist', 'sind', 'seid', 'war', 'warst', 'waren', 'wart',
  'habe', 'hast', 'hat', 'haben', 'habt',
  'in', 'an', 'auf', 'für', 'von', 'zu', 'mit', 'nach', 'bei', 'seit', 'aus', 'durch', 'gegen', 'ohne', 'um', 'während',
  'nicht', 'auch', 'noch', 'schon', 'sehr', 'nur', 'so', 'wie',
  'hier', 'dort', 'da', 'wo', 'was', 'wer', 'wen', 'wem', 'wessen',

  // Weitere deutsche Stoppwörter und Variationen
  'am', 'zum', 'zur', 'den', 'dem', 'des', 'ins', 'ans', 'aufs', 'vors', 'hinterm', 'unterm',
  'wird', 'wurde', 'worden', 'werden', 'werde', 'wirst', 'würde', 'würdest', 'würden', 'würdet',
  'gewesen', 'geworden', 'hätten', 'hatte', 'hättest', 'hattest', 'hielte', 'hieltst',
  'konnte', 'könnte', 'könnten', 'musste', 'muss', 'müsste', 'müssten',
  'soll', 'sollte', 'sollten', 'will', 'wollte', 'wollten',
  'jede', 'jeder', 'jedes', 'alle', 'allem', 'allen', 'alles',
  'man', 'manche', 'manchem', 'manches',
  'ganz', 'fast', 'kaum', 'sehr', 'auch', 'noch', 'aber',
  'jedoch', 'allerdings', 'vielmehr', 'sogar', 'somit', 'sodass', 'damit',
  'ob', 'obgleich', 'obwohl', 'wobei', 'woher', 'wohin',
  'einmal', 'mehrmals', 'immer', 'nie', 'niemals', 'oft', 'selten',
  'bitte', 'danke',

  // Englische Stoppwörter
  'a', 'an', 'and', 'the', 'is', 'are', 'was', 'were', 'be', 'being', 'been',
  'to', 'of', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'about', 'as', 'into',
  'but', 'or', 'not', 'no', 'only', 'very', 'just', 'more', 'most', 'some', 'any', 'all',
  'he', 'she', 'it', 'they', 'we', 'you', 'me', 'us', 'him', 'her', 'them',
  'his', 'her', 'its', 'their', 'our', 'my', 'your',
  'what', 'who', 'whom', 'where', 'when', 'why', 'how', 'which',
  'this', 'that', 'these', 'those',
  'have', 'has', 'had', 'do', 'does', 'did', 'done',
  'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might',
  'down', 'up', 'out', 'off', 'on', 'then', 'now', 'once', 'here', 'there',
  'after', 'before', 'above', 'below', 'between', 'through', 'under', 'over', 'around',
  'against', 'without', 'within', 'since', 'until',
]);

function lazyCheck(word, index) {
    if (word.length < 3 || stopWords.has(word)) return null;

    if (index.has(word)) return word;

    const endings = ['es', 'en', 'er', 'em', 'e', 's'];
    for (const ending of endings) {
        if (word.endsWith(ending)) {
            const stem = word.slice(0, -ending.length);
            if (stem.length > 2 && index.has(stem)) {
                return stem;
            }
        }
    }

    return null;
}

function parsePlainTextMentions(root, context = {}) {
    const internalLinks = [];
    const chapterLinks = [];
    const uniqueLinks = new Map();
    let lastSeenBook = context.bookNumber ? utils.getBook(context.bookNumber) : null;
    let lastSeenChapter = context.chapterNumber || null;

    const explicitVerseSource = `\\b(?:(${utils.getBookShortNamesPattern()})\\s*)?(\\d+)(?::|,|\\s)\\s*([\\d-–—.,;ff]+)\\b`;
    const implicitVerseSource = `\\b(?:V\\.|Vers)\\s*([\\d.,;-]+)\\b`;
    const strongsMentionSource = `\\b([GH]\\d{1,5})\\b`;
    const combinedRegex = new RegExp(`(${explicitVerseSource})|(${implicitVerseSource})|(${strongsMentionSource})`, 'gi');
    
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    while (walker.nextNode()) {
        const parent = walker.currentNode.parentElement;
        if (parent.tagName !== 'A' && !parent.closest('.verse-mention-hover, .strongs-mention-hover, .chapter-mention-hover, .file-resource, script, style')) {
            textNodes.push(walker.currentNode);
        }
    }

    textNodes.forEach(node => {
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        let match;
        while ((match = combinedRegex.exec(node.nodeValue)) !== null) {
            fragment.appendChild(document.createTextNode(node.nodeValue.slice(lastIndex, match.index)));
            const [
                fullMatch, explicitFull, bookName, chapterStr, verseListStr,
                implicitFull, implicitVerseList,
                strongsFull, strongsId
            ] = match;

            let versesToAdd = [];

            if (strongsId) {
                const trigger = document.createElement('span');
                trigger.className = 'strongs-mention-hover';
                trigger.dataset.strongId = strongsId.toUpperCase();
                trigger.textContent = fullMatch;
                fragment.appendChild(trigger);
            } else {
                if (explicitFull) {
                    let currentBook = lastSeenBook;
                    if (bookName) {
                        currentBook = utils.findBookByAlias(bookName);
                    }
                    if (currentBook && chapterStr) {
                        const currentChapter = parseInt(chapterStr, 10);
                        versesToAdd = utils.parseVerseList(verseListStr).map(v => ({ book: currentBook, chapter: currentChapter, verse: v }));
                        lastSeenBook = currentBook;
                        lastSeenChapter = currentChapter;
                    }
                } else if (implicitFull && context.bookNumber && context.chapterNumber) {
                    const book = utils.getBook(context.bookNumber);
                    const chapter = context.chapterNumber;
                    versesToAdd = utils.parseVerseList(implicitVerseList).map(v => ({ book, chapter, verse: v }));
                }

                if (versesToAdd.length > 0) {
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

    internalLinks.push(...Array.from(uniqueLinks.values()));
    
    const wordWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const wordTextNodes = [];
    while(wordWalker.nextNode()) {
         if (!wordWalker.currentNode.parentElement.closest('.verse-mention-hover, .strongs-mention-hover, .chapter-mention-hover, .dictionary-mention-hover, a')) {
            wordTextNodes.push(wordWalker.currentNode);
        }
    }

    wordTextNodes.forEach(node => {
        const words = node.nodeValue.split(/(\s+|[.,;!?():"“„”«»])/);
        const fragment = document.createDocumentFragment();
        words.forEach(word => {
            const cleanWord = word.trim().toLowerCase();
            const matchedTopic = lazyCheck(cleanWord, state.dictionaryWordIndex);

            if (matchedTopic) {
                const span = document.createElement('span');
                span.className = 'dictionary-mention-hover';
                span.dataset.topic = matchedTopic;
                span.textContent = word;
                fragment.appendChild(span);
            } else {
                fragment.appendChild(document.createTextNode(word));
            }
        });
        node.parentNode.replaceChild(fragment, node);
    });

    return { internalLinks, chapterLinks };
}

function extractResourcesFromContent(htmlContent) {
    if (!htmlContent) return [];
    const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
    const resources = [];
    doc.querySelectorAll('.file-resource').forEach(el => {
        resources.push({ url: el.dataset.url, name: el.dataset.filename, size: parseInt(el.dataset.filesize, 10) });
    });
    return resources;
};

function processContentForDisplay(content, context = {}) {
    let processedContent = content ?? '';
    const flags = { hasYoutube: false, hasAudio: false, hasVideo: false, hasCrossReference: false };
    
    const youtubeRegex = /(?:<p>)?(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:<\/p>)?/g;
    if (youtubeRegex.test(processedContent)) {
        flags.hasYoutube = true;
        processedContent = processedContent.replace(youtubeRegex, (match, videoId) => `<div class="media-container auto-embedded"><div class="media-wrapper"><iframe src="https://www.youtube-nocookie.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div><div class="media-source"><i class="fa-brands fa-youtube"></i><a href="https://www.youtube.com/watch?v=${videoId}" target="_blank" rel="noopener noreferrer">https://www.youtube.com/watch?v=${videoId}</a></div></div>`);
    }

    const mediaFileRegex = /(?:<p>)?(https?:\/\/[^\s<]+\.(?:mp4|mp3))(?:<\/p>)?/g;
    processedContent = processedContent.replace(mediaFileRegex, (match, url) => {
        const isVideo = url.endsWith('.mp4');
        if (isVideo) flags.hasVideo = true; else flags.hasAudio = true;
        const mediaTag = isVideo ? `<video controls src="${url}"></video>` : `<audio controls src="${url}"></audio>`;
        const iconClass = isVideo ? 'fa-solid fa-file-video' : 'fa-solid fa-file-audio';
        return `<div class="media-container auto-embedded"><div class="media-wrapper">${mediaTag}</div><div class="media-source"><i class="${iconClass}"></i><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></div></div>`;
    });

    const root = document.createElement('div');
    root.innerHTML = processedContent;

    const { internalLinks, chapterLinks } = parsePlainTextMentions(root, context);
    if (internalLinks.length > 0 || chapterLinks.length > 0) {
        flags.hasCrossReference = true;
    }
    processedContent = root.innerHTML;

    return { processedContent, flags, internalLinks, chapterLinks };
}

export function getProcessedEntry(entry, context = {}) {
    if (entry.processedContent && entry.chapterLinks !== undefined) {
        return entry;
    }
    
    const htmlContent = state.markdownConverter.makeHtml(entry.content || '');
    const { processedContent, flags, internalLinks, chapterLinks } = processContentForDisplay(htmlContent, context);
    
    entry.processedContent = processedContent;
    entry.flags = flags;
    entry.internalLinks = internalLinks;
    entry.chapterLinks = chapterLinks;
    entry.resources = extractResourcesFromContent(htmlContent);
    entry.plainTextContent = utils.extractPlainTextFromHtml(processedContent);
    return entry;
};

export function formatVerseText(rawText, bookNumber, inlineStrongs = false) {
    if (!rawText) return '';
    let formattedText = rawText;
    const prefix = bookNumber > 390 ? 'G' : 'H';
    formattedText = formattedText.replace(/〈.*?〉/g, '');
    formattedText = formattedText.replace(/\[.*?\]/g, '');
    formattedText = formattedText.replace(/<pb\/?>/g, '').replace(/<br\/?>/g, '');
    formattedText = formattedText.replace(/<J>(.*?)<\/J>/g, '<span class="words-of-jesus">$1</span>');

    if (inlineStrongs) {
        formattedText = formattedText.replace(/([\w\ü\ä\ö\ß\.'-]+)\s*<S>(\d+)<\/S>/g, 
            `<span class="strongs-mention-hover" data-strong-id="${prefix}$2">$1</span>`);
        formattedText = formattedText.replace(/<S>\d+<\/S>/g, '');
    } else {
        formattedText = formattedText.replace(/<S>(\d+)<\/S>/g, 
            `<sup><span class="strongs-mention-hover" data-strong-id="${prefix}$1">$1</span></sup>`);
    }

    return formattedText.trim();
};

export function processStrongsContentForDisplay(htmlContent, context = {}) {
    if (!htmlContent) return '';

    const root = document.createElement('div');
    root.innerHTML = htmlContent;

    root.querySelectorAll("a[href^='B:']").forEach(a => {
        const prevNode = a.previousSibling;
        if (prevNode && prevNode.nodeType === Node.TEXT_NODE) {
            const prevText = prevNode.textContent.trim();
            if (utils.findBookByAlias(prevText)) {
                a.textContent = `${prevText} ${a.textContent}`;
                prevNode.remove();
            }
        }
    });

    root.querySelectorAll("a[href^='B:']").forEach(a => {
        const href = a.getAttribute('href');
        const hrefMatch = href.match(/B:(\d+)\s*:?\s*(\d+)/);
        if (!hrefMatch) return;

        const bookNumFromHref = parseInt(hrefMatch[1], 10);
        const chapterFromHref = parseInt(hrefMatch[2], 10);
        if (isNaN(bookNumFromHref) || isNaN(chapterFromHref)) return;

        const textContent = a.textContent.trim();
        let verseListString = '';

        const chapterAndVerseRegex = new RegExp(`\\b${chapterFromHref}\\s*[,.:]?\\s*([\\d-–—.,;\\s]+)\\b`);
        const textMatch = textContent.match(chapterAndVerseRegex);

        if (textMatch && textMatch[1]) {
            verseListString = textMatch[1];
        } else {
            const simpleVerseRegex = /([\d-–—.,;\s]+)$/;
            const simpleMatch = textContent.match(simpleVerseRegex);
            if (simpleMatch) {
                verseListString = simpleMatch[1];
            }
        }
        if (!verseListString) {
            const hrefVerseMatch = href.match(/B:\d+\s*:?\s*\d+\s*:?\s*(\d+)$/);
            if (hrefVerseMatch) verseListString = hrefVerseMatch[1];
        }
        if (!verseListString) verseListString = '1';

        const verses = utils.parseVerseList(verseListString);
        const finalVerses = verses.length > 0 ? verses : [1];

        const verseData = finalVerses.map(v => ({ b: bookNumFromHref, c: chapterFromHref, v: v }));
        const verseDataString = JSON.stringify(verseData);
        
        const span = document.createElement('span');
        span.className = 'verse-mention-hover';
        span.dataset.verses = verseDataString;
        span.textContent = a.textContent;
        a.parentNode.replaceChild(span, a);
    });
    
    root.querySelectorAll("a[href^='S:']").forEach(a => {
        const href = a.getAttribute('href');
        const topic = href.substring(2);
        
        const strongsRegex = /^[GH]\d{1,5}$/i;

        if (strongsRegex.test(topic)) {
            const span = document.createElement('span');
            span.className = 'strongs-mention-hover';
            span.dataset.strongId = topic.toUpperCase();
            span.textContent = a.textContent;
            a.parentNode.replaceChild(span, a);

        } else {
            let foundInDictId = state.availableDictionaries[0]?.id || 'jma';
            for (const dict of state.availableDictionaries) {
                if (dict.data.some(entry => entry.topic.toLowerCase() === topic.toLowerCase())) {
                    foundInDictId = dict.id;
                    break;
                }
            }
            
            a.setAttribute('href', `/dictionary/${foundInDictId}/${encodeURIComponent(topic.toLowerCase())}`);
            a.setAttribute('data-link', '');
        }
    });
    
    parsePlainTextMentions(root, context);

    return root.innerHTML;
};