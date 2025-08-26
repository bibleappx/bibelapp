import * as utils from '../utils.js';

const appContainer = document.getElementById('app-container');

function saveSetting(key, value) {
    localStorage.setItem(key, value);
    applySettings();
}

export function applySettings() {
    const settings = {
        fontSize: localStorage.getItem('fontSize') || '16',
        fontFamily: localStorage.getItem('fontFamily') || 'Inter',
        lineHeight: localStorage.getItem('lineHeight') || '1.6',
        contentWidth: localStorage.getItem('contentWidth') || '800'
    };

    const root = document.documentElement;
    root.style.setProperty('--font-size-base', `${settings.fontSize}px`);
    root.style.setProperty('--font-family-base', settings.fontFamily);
    root.style.setProperty('--line-height-base', settings.lineHeight);
    root.style.setProperty('--content-width-max', `${settings.contentWidth}px`);
}

export function renderSettingsPage() {
    const currentFontSize = localStorage.getItem('fontSize') || '16';
    const currentFontFamily = localStorage.getItem('fontFamily') || 'Inter';
    const currentLineHeight = localStorage.getItem('lineHeight') || '1.6';
    const currentContentWidth = localStorage.getItem('contentWidth') || '800';

    appContainer.innerHTML = `
        <div class="page-header">
            <h1 class="view-title">Einstellungen</h1>
        </div>
        <div class="card">
            <div class="card-body">
                <div class="setting-item">
                    <label for="font-size-slider">Schriftgröße: <span id="font-size-value">${currentFontSize}px</span></label>
                    <input type="range" id="font-size-slider" class="form-range" min="12" max="24" step="1" value="${currentFontSize}">
                </div>
                <hr>
                <div class="setting-item">
                    <label for="font-family-select">Schriftart</label>
                    <select id="font-family-select" class="form-select">
                        <option value="Inter" ${currentFontFamily === 'Inter' ? 'selected' : ''}>Inter (Sans-Serif)</option>
                        <option value="Georgia, serif" ${currentFontFamily === 'Georgia, serif' ? 'selected' : ''}>Georgia (Serif)</option>
                        <option value="monospace" ${currentFontFamily === 'monospace' ? 'selected' : ''}>Monospace</option>
                    </select>
                </div>
                <hr>
                <div class="setting-item">
                    <label for="line-height-slider">Zeilenhöhe: <span id="line-height-value">${currentLineHeight}</span></label>
                    <input type="range" id="line-height-slider" class="form-range" min="1.2" max="2.2" step="0.1" value="${currentLineHeight}">
                </div>
                <hr>
                <div class="setting-item">
                    <label for="content-width-slider">Maximale Inhaltsbreite: <span id="content-width-value">${currentContentWidth}px</span></label>
                    <input type="range" id="content-width-slider" class="form-range" min="600" max="1200" step="50" value="${currentContentWidth}">
                </div>
            </div>
        </div>
    `;

    const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizeValue = document.getElementById('font-size-value');
    fontSizeSlider.addEventListener('input', () => {
        fontSizeValue.textContent = `${fontSizeSlider.value}px`;
        saveSetting('fontSize', fontSizeSlider.value);
    });

    const fontFamilySelect = document.getElementById('font-family-select');
    fontFamilySelect.addEventListener('change', () => {
        saveSetting('fontFamily', fontFamilySelect.value);
    });

    const lineHeightSlider = document.getElementById('line-height-slider');
    const lineHeightValue = document.getElementById('line-height-value');
    lineHeightSlider.addEventListener('input', () => {
        lineHeightValue.textContent = lineHeightSlider.value;
        saveSetting('lineHeight', lineHeightSlider.value);
    });

    const contentWidthSlider = document.getElementById('content-width-slider');
    const contentWidthValue = document.getElementById('content-width-value');
    contentWidthSlider.addEventListener('input', () => {
        contentWidthValue.textContent = `${contentWidthSlider.value}px`;
        saveSetting('contentWidth', contentWidthSlider.value);
    });
}
