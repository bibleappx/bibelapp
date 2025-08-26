import * as state from '../state.js';

/**
 * Passt die Höhe einer Textarea dynamisch an ihren Inhalt an.
 * @param {HTMLTextAreaElement} textarea - Das Textarea-Element.
 */
function adjustTextareaHeight(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(textarea.scrollHeight + 2, 250)}px`;
}

/**
 * Initialisiert den Markdown-Editor in einem bestimmten Container.
 * @param {string} containerSelector - Der CSS-Selektor für den Container.
 * @param {string} [initialContent=''] - Der anfängliche Inhalt für den Editor.
 */
export const initializeMarkdownEditor = (containerSelector, initialContent = '') => {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    // HTML-Struktur für den Editor mit den neuen Schaltflächen
    container.innerHTML = `
        <div class="markdown-editor-wrapper">
            <div class="markdown-editor-toolbar">
                <div class="markdown-editor-view-toggle">
                    <button type="button" class="btn btn-sm btn-secondary active" data-view="write">Schreiben</button>
                    <button type="button" class="btn btn-sm btn-secondary" data-view="preview">Vorschau</button>
                </div>
                <div class="markdown-editor-format-buttons">
                    <button type="button" class="btn btn-sm btn-secondary" data-md="bold" title="Fett (Ctrl/Cmd+B)"><i class="fa-solid fa-bold"></i></button>
                    <button type="button" class="btn btn-sm btn-secondary" data-md="italic" title="Kursiv (Ctrl/Cmd+I)"><i class="fa-solid fa-italic"></i></button>
                    <button type="button" class="btn btn-sm btn-secondary" data-md="strikethrough" title="Durchgestrichen (Ctrl/Cmd+Shift+S)"><i class="fa-solid fa-strikethrough"></i></button>
                    <button type="button" class="btn btn-sm btn-secondary" data-md="heading" title="Überschrift"><i class="fa-solid fa-heading"></i></button>
                    <button type="button" class="btn btn-sm btn-secondary" data-md="link" title="Link (Ctrl/Cmd+K)"><i class="fa-solid fa-link"></i></button>
                    <button type="button" class="btn btn-sm btn-secondary" data-md="image" title="Bild einfügen"><i class="fa-solid fa-image"></i></button>
                    <button type="button" class="btn btn-sm btn-secondary" data-md="quote" title="Zitat"><i class="fa-solid fa-quote-right"></i></button>
                    <button type="button" class="btn btn-sm btn-secondary" data-md="code" title="Inline Code"><i class="fa-solid fa-code"></i></button>
                    <button type="button" class="btn btn-sm btn-secondary" data-md="code-block" title="Code-Block"><i class="fa-solid fa-file-code"></i></button>
                    <button type="button" class="btn btn-sm btn-secondary" data-md="list-ul" title="Ungeordnete Liste"><i class="fa-solid fa-list-ul"></i></button>
                    <button type="button" class="btn btn-sm btn-secondary" data-md="list-ol" title="Geordnete Liste"><i class="fa-solid fa-list-ol"></i></button>
                    <button type="button" class="btn btn-sm btn-secondary" data-md="list-task" title="Aufgabenliste"><i class="fa-solid fa-list-check"></i></button>
                    <button type="button" class="btn btn-sm btn-secondary" data-md="table" title="Tabelle"><i class="fa-solid fa-table"></i></button>
                    <button type="button" class="btn btn-sm btn-secondary" data-md="hr" title="Horizontale Linie"><i class="fa-solid fa-minus"></i></button>
                </div>
            </div>
            <textarea id="markdown-editor" class="form-control" style="min-height: 250px; overflow-y: hidden; resize: vertical;"></textarea>
            <div id="markdown-editor-preview" class="markdown-body" style="display: none; min-height: 250px; padding: var(--spacing-md);"></div>
        </div>
    `;

    const textarea = container.querySelector('#markdown-editor');
    const preview = container.querySelector('#markdown-editor-preview');

    if (textarea && preview) {
        textarea.value = initialContent;
        setupMarkdownToolbar(container, textarea);
        setupKeyboardShortcuts(textarea);
        setupPreviewToggle(container, textarea, preview);
        adjustTextareaHeight(textarea);
        textarea.addEventListener('input', () => {
            const oldWindowScroll = window.scrollY;
            adjustTextareaHeight(textarea);
            window.scrollTo(0, oldWindowScroll);
        });
    }
};

/**
 * Richtet den Umschalter zwischen Schreib- und Vorschauansicht ein.
 */
function setupPreviewToggle(container, textarea, preview) {
    container.querySelector('.markdown-editor-view-toggle').addEventListener('click', (e) => {
        const button = e.target.closest('button[data-view]');
        if (!button) return;

        const view = button.dataset.view;
        const writeButton = container.querySelector('button[data-view="write"]');
        const previewButton = container.querySelector('button[data-view="preview"]');
        const formatButtons = container.querySelector('.markdown-editor-format-buttons');

        if (view === 'preview') {
            const markdownText = textarea.value;
            preview.innerHTML = state.markdownConverter.makeHtml(markdownText);
            textarea.style.display = 'none';
            preview.style.display = 'block';
            formatButtons.style.visibility = 'hidden';
            previewButton.classList.add('active');
            writeButton.classList.remove('active');
        } else {
            textarea.style.display = 'block';
            preview.style.display = 'none';
            formatButtons.style.visibility = 'visible';
            writeButton.classList.add('active');
            previewButton.classList.remove('active');
        }
    });
}

/**
 * Richtet die Event-Listener für die Formatierungsleiste ein.
 */
function setupMarkdownToolbar(container, textarea) {
    container.querySelector('.markdown-editor-format-buttons').addEventListener('click', (e) => {
        const button = e.target.closest('button[data-md]');
        if (!button) return;
        e.preventDefault();
        const action = button.dataset.md;
        applyMarkdown(textarea, action);
    });
}

/**
 * Richtet die Tastaturkürzel für den Editor ein.
 */
function setupKeyboardShortcuts(textarea) {
    textarea.addEventListener('keydown', (e) => {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;

        // Spezielle Behandlung für Tab und Enter
        if (e.key === 'Tab' || e.key === 'Enter') {
            e.preventDefault();
            const oldWindowScroll = window.scrollY;

            if (e.key === 'Tab') {
                textarea.value = value.substring(0, start) + '\t' + value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 1;
            } else { // Enter-Taste
                const lineStart = value.lastIndexOf('\n', start - 1) + 1;
                const currentLine = value.substring(lineStart, start);
                let newContentToInsert = '\n';
                let newCursorPosition = start + 1;
                let updatedValue = '';
                const ulMatch = currentLine.match(/^(\s*[-*+])\s*(.*)/);
                const olMatch = currentLine.match(/^(\s*\d+\.)\s*(.*)/);
                const taskListMatch = currentLine.match(/^(\s*[-*+]\s*\[[ xX]\])\s*(.*)/);

                if (taskListMatch) {
                    const indentAndMarker = taskListMatch[1];
                    newContentToInsert = '\n' + indentAndMarker.replace(/\[[ xX]\]/, '[ ]') + ' ';
                    newCursorPosition = start + newContentToInsert.length;
                    updatedValue = value.substring(0, start) + newContentToInsert + value.substring(end);
                } else if (ulMatch) {
                    const indentAndMarker = ulMatch[1];
                    const contentAfterMarker = ulMatch[2];
                    const indent = indentAndMarker.match(/^(\s*)/)[1];
                    if (contentAfterMarker.trim() === '') {
                        if (indent.length >= 2) {
                            newContentToInsert = '\n' + indent.substring(0, indent.length - 2);
                            newCursorPosition = lineStart + newContentToInsert.length;
                            updatedValue = value.substring(0, lineStart) + newContentToInsert + value.substring(start);
                        } else {
                            newContentToInsert = '';
                            newCursorPosition = lineStart;
                            updatedValue = value.substring(0, lineStart) + newContentToInsert + value.substring(start);
                        }
                    } else {
                        newContentToInsert = '\n' + indentAndMarker + ' ';
                        newCursorPosition = start + newContentToInsert.length;
                        updatedValue = value.substring(0, start) + newContentToInsert + value.substring(end);
                    }
                } else if (olMatch) {
                    const indentAndNumber = olMatch[1];
                    const currentNumber = parseInt(indentAndNumber.match(/\d+/)[0], 10);
                    const contentAfterMarker = olMatch[2];
                    const indent = indentAndNumber.match(/^(\s*)/)[1];
                    if (contentAfterMarker.trim() === '') {
                        if (indent.length >= 2) {
                            newContentToInsert = '\n' + indent.substring(0, indent.length - 2);
                            newCursorPosition = lineStart + newContentToInsert.length;
                            updatedValue = value.substring(0, lineStart) + newContentToInsert + value.substring(start);
                        } else {
                            newContentToInsert = '';
                            newCursorPosition = lineStart;
                            updatedValue = value.substring(0, lineStart) + newContentToInsert + value.substring(start);
                        }
                    } else {
                        newContentToInsert = '\n' + indentAndNumber.replace(/\d+\./, `${currentNumber + 1}.`) + ' ';
                        newCursorPosition = start + newContentToInsert.length;
                        updatedValue = value.substring(0, start) + newContentToInsert + value.substring(end);
                    }
                } else {
                    updatedValue = value.substring(0, start) + newContentToInsert + value.substring(end);
                }

                textarea.value = updatedValue;
                textarea.selectionStart = newCursorPosition;
                textarea.selectionEnd = newCursorPosition;
            }

            adjustTextareaHeight(textarea);
            window.scrollTo(0, oldWindowScroll);

        } else if (e.ctrlKey || e.metaKey) {
            let handled = false;
            if (e.key === 'b') { applyMarkdown(textarea, 'bold'); handled = true; }
            if (e.key === 'i') { applyMarkdown(textarea, 'italic'); handled = true; }
            if (e.key === 'k') { applyMarkdown(textarea, 'link'); handled = true; }
            // Neues Kürzel für Durchgestrichen
            if (e.key === 's' && e.shiftKey) { applyMarkdown(textarea, 'strikethrough'); handled = true; }
            
            if (handled) {
                e.preventDefault();
            }
        }
    });
}

/**
 * Wendet die ausgewählte Markdown-Formatierung auf die Textarea an.
 */
function applyMarkdown(textarea, action) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const selectedText = value.substring(start, end);
    let newText = '';
    let newCursorPos = 0;
    let modificationsDone = false;
    const oldWindowScroll = window.scrollY;

    const wrap = (prefix, suffix = prefix) => {
        const newContent = prefix + selectedText + suffix;
        return { text: newContent, pos: start + prefix.length };
    };

    let contentBefore = value.substring(0, start);
    let contentAfter = value.substring(end);

    switch (action) {
        case 'bold': { const { text, pos } = wrap('**'); newText = text; newCursorPos = pos; modificationsDone = true; break; }
        case 'italic': { const { text, pos } = wrap('*'); newText = text; newCursorPos = pos; modificationsDone = true; break; }
        case 'strikethrough': { const { text, pos } = wrap('~~'); newText = text; newCursorPos = pos; modificationsDone = true; break; }
        case 'code': { const { text, pos } = wrap('`'); newText = text; newCursorPos = pos; modificationsDone = true; break; }
        // NEU: Logik für Code-Blöcke
        case 'code-block': {
            const template = '```\n' + selectedText + '\n```';
            newText = template;
            newCursorPos = start + 3; // Positioniert den Cursor nach den drei Backticks
            if (!selectedText) { newCursorPos += 1; }
            modificationsDone = true;
            break;
        }
        case 'link': {
            const { text, pos } = wrap('[', '](url)');
            newText = text;
            newCursorPos = pos + selectedText.length + 3;
            if (!selectedText) { newCursorPos = start + 1; }
            modificationsDone = true;
            break;
        }
        // NEU: Logik für Bilder
        case 'image': {
            const { text, pos } = wrap('![Beschreibung](', 'url)');
            newText = text;
            newCursorPos = pos;
            if (!selectedText) { newCursorPos = start + 2; }
            modificationsDone = true;
            break;
        }
        case 'heading': {
            const lineStart = value.lastIndexOf('\n', start - 1) + 1;
            const lineEnd = value.indexOf('\n', end);
            const currentLine = value.substring(lineStart, lineEnd > 0 ? lineEnd : value.length);
            const headingMatch = currentLine.match(/^(#+)\s*(.*)/);
            contentBefore = value.substring(0, lineStart);
            contentAfter = value.substring(lineEnd > 0 ? lineEnd : value.length);
            if (headingMatch) {
                const existingHashes = headingMatch[1].length;
                const restOfLine = headingMatch[2].trim();
                if (existingHashes < 6) {
                    newText = '#'.repeat(existingHashes + 1) + ' ' + restOfLine;
                } else {
                    newText = restOfLine;
                }
            } else {
                newText = '# ' + currentLine.trim();
            }
            modificationsDone = true;
            textarea.value = contentBefore + newText + contentAfter;
            newCursorPos = lineStart + newText.length;
            break;
        }
        case 'quote': {
            const lines = selectedText ? selectedText.split('\n') : [value.substring(start, end)];
            newText = lines.map(line => '> ' + line).join('\n');
            newCursorPos = start + newText.length;
            modificationsDone = true;
            break;
        }
        case 'list-ul': {
            const lines = selectedText ? selectedText.split('\n') : [value.substring(start, end)];
            newText = lines.map(line => '- ' + line).join('\n');
            newCursorPos = start + newText.length;
            modificationsDone = true;
            break;
        }
        case 'list-ol': {
            const lines = selectedText ? selectedText.split('\n') : [value.substring(start, end)];
            let i = 1;
            newText = lines.map(line => `${i++}. ` + line).join('\n');
            newCursorPos = start + newText.length;
            modificationsDone = true;
            break;
        }
        // NEU: Logik für Aufgabenlisten
        case 'list-task': {
            const lines = selectedText ? selectedText.split('\n') : [value.substring(start, end)];
            newText = lines.map(line => '- [ ] ' + line).join('\n');
            newCursorPos = start + newText.length;
            modificationsDone = true;
            break;
        }
        case 'hr': {
            const prefix = (start === 0 || value.charAt(start - 1) === '\n') ? '' : '\n';
            newText = prefix + '\n---\n';
            newCursorPos = start + newText.length;
            modificationsDone = true;
            break;
        }
        case 'table': {
            const tableTemplate =
                '| Spalte 1 | Spalte 2 |\n' +
                '|----------|----------|\n' +
                '| Zelle 1  | Zelle 2  |';
            const prefix = (start === 0 || value.charAt(start - 1) === '\n') ? '' : '\n';
            newText = prefix + '\n' + tableTemplate + '\n';
            newCursorPos = start + prefix.length + 2;
            modificationsDone = true;
            break;
        }
        default: return;
    }

    if (modificationsDone) {
        if (action !== 'heading') {
            textarea.value = contentBefore + newText + contentAfter;
        }
        textarea.focus();
        if (newCursorPos) {
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        } else {
            textarea.setSelectionRange(start + newText.length, start + newText.length);
        }

        adjustTextareaHeight(textarea);
        window.scrollTo(0, oldWindowScroll);
    }
}
