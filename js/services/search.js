import { escapeRegExp } from '../utils.js';

export function parseSearchQuery(query) {
    const requiredTermsRegexObjs = [];
    const optionalTermsRegexObjs = [];
    const excludedTermsRegexObjs = [];
    const highlightRegexObjs = [];
    
    const tokens = query.match(/"[^"]+"|[\S]+/g) || [];

    tokens.forEach(token => {
        let isRequired = false;
        let isExcluded = false;
        let cleanToken = token;
        let termSource;

        if (cleanToken.startsWith('+')) {
            isRequired = true;
            cleanToken = cleanToken.substring(1);
        }
        if (cleanToken.startsWith('-')) {
            isExcluded = true;
            cleanToken = cleanToken.substring(1);
        }
        if (cleanToken.endsWith('*')) {
            cleanToken = cleanToken.slice(0, -1);
        }

        if (cleanToken.startsWith('"') && cleanToken.endsWith('"')) {
            const phraseContent = cleanToken.substring(1, cleanToken.length - 1).trim();
            const phraseWords = phraseContent.split(/\s+/).filter(Boolean);
            if (phraseWords.length > 0) {
                termSource = phraseWords.map(word => escapeRegExp(word)).join('\\s+');
            } else {
                return;
            }
        } else {
            termSource = `${escapeRegExp(cleanToken)}[a-zäöüß]*`;
        }
        
        const regexSource = `(^|\\W)(${termSource})\\b`;
        const regexObj = { source: regexSource, flags: 'gi' };
        
        if (isExcluded) {
            excludedTermsRegexObjs.push(regexObj);
        } else if (isRequired) {
            requiredTermsRegexObjs.push(regexObj);
            highlightRegexObjs.push(regexObj);
        } else {
            optionalTermsRegexObjs.push(regexObj);
            highlightRegexObjs.push(regexObj);
        }
    });

    return { 
        requiredTermsRegexes: requiredTermsRegexObjs, 
        optionalTermsRegexes: optionalTermsRegexObjs,
        excludedTermsRegexes: excludedTermsRegexObjs, 
        highlightRegexes: highlightRegexObjs 
    };
}

export function matchesSearchCriteria(caseSensitiveText, caseInsensitiveText, parsedQuery) {
    for (const regexObj of parsedQuery.excludedTermsRegexes) {
        if (new RegExp(regexObj.source, regexObj.flags).test(caseInsensitiveText)) return false;
    }

    for (const regexObj of parsedQuery.requiredTermsRegexes) {
        if (!new RegExp(regexObj.source, regexObj.flags).test(caseInsensitiveText)) return false;
    }

    if (parsedQuery.optionalTermsRegexes.length > 0) {
        let hasOptionalMatch = false;
        for (const regexObj of parsedQuery.optionalTermsRegexes) {
            if (new RegExp(regexObj.source, regexObj.flags).test(caseInsensitiveText)) {
                hasOptionalMatch = true;
                break;
            }
        }
        if (!hasOptionalMatch) return false;
    }

    return true;
}

export function generateHighlightedSnippet(fullPlainText, highlightRegexes, snippetLength = 200) {
    if (!fullPlainText) return '';

    let firstMatch = null;
    for (const regexObj of highlightRegexes) {
        const match = new RegExp(regexObj.source, regexObj.flags).exec(fullPlainText);
        if (match && (firstMatch === null || match.index < firstMatch.index)) {
            firstMatch = match;
        }
    }

    if (!firstMatch) {
        const snippet = fullPlainText.substring(0, snippetLength);
        return snippet + (fullPlainText.length > snippetLength ? '...' : '');
    }

    const matchIndex = firstMatch.index;
    const desiredContextBefore = 30; // Nur maximal 30 Zeichen Kontext vor dem Treffer
    
    let start = Math.max(0, matchIndex - desiredContextBefore);

    // Am Anfang des Snippets zu einer Wortgrenze zurückspringen für saubere Optik
    if (start > 0) {
        const lastSpace = fullPlainText.lastIndexOf(' ', start);
        if (lastSpace !== -1) {
            start = lastSpace + 1;
        }
    }

    const end = Math.min(fullPlainText.length, start + snippetLength);
    
    let snippetContent = fullPlainText.substring(start, end);
    let prefix = start > 0 ? '...' : '';
    let suffix = end < fullPlainText.length ? '...' : '';
    let highlightedSnippet = snippetContent;

    for (const regexObj of highlightRegexes) {
        highlightedSnippet = highlightedSnippet.replace(
            new RegExp(regexObj.source, regexObj.flags), 
            (match, prefixChar, term) => {
                const prefix = prefixChar || '';
                return `${prefix}<mark>${term}</mark>`;
            }
        );
    }
    
    return prefix + highlightedSnippet + suffix;
}