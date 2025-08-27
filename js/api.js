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
