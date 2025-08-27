export const fetchAPI = async (url, throwOnError = false) => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        if (throwOnError) {
            throw error;
        } else {
            console.error(`Fehler beim Laden von ${url}:`, error);
            document.getElementById('app-container').innerHTML = `<div class="card"><div class="card-body text-danger">Fehler beim Laden der Daten. Bitte versuchen Sie, die Seite neu zu laden.</div></div>`;
            return null;
        }
    }
};

export const postAPI = async (url, data) => {
    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return true;
    } catch (error) {
        console.error(`Fehler beim Speichern von Daten nach ${url}:`, error);
        return false;
    }
};

export const translateWithAi = async (text, targetLanguage) => {
    // Ihr API-Schlüssel ist hier korrekt eingetragen.
    const API_KEY = "AIzaSyDUgmy_ipft3Ru9qgNTKmQF6pav2nP_3O0";

    if (!window.GoogleGenerativeAI) {
        console.error("Google AI SDK wurde nicht geladen.");
        return null;
    }
    
    // DIESER BLOCK WURDE ENTFERNT, DA ER NICHT MEHR NÖTIG IST.

    try {
        const genAI = new window.GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `Übersetze den folgenden theologischen Text präzise nach ${targetLanguage}, behalte aber alle HTML-Tags wie <a> oder <span> exakt bei: "${text}"`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const translatedText = response.text();

        return { translatedText };
    } catch (error) {
        console.error('Fehler bei der Übersetzung mit Google AI:', error);
        return null;
    }
};