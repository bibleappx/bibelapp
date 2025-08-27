# Bibel-Studien-App (Private Edition)

Dies ist eine moderne, schnelle und vollständig lokale Web-Anwendung für das persönliche Bibelstudium. Die App ist als Single-Page-Application (SPA) mit reinem JavaScript, HTML und CSS konzipiert und läuft vollständig im Browser, ohne dass eine externe Datenbank oder ein Server-Backend für die Kernfunktionen erforderlich ist. Alle Daten werden lokal von JSON-Dateien geladen und im Speicher gehalten, was eine extrem schnelle und private Nutzung ermöglicht.

## ✨ Features (Was die App kann)

Die Anwendung bietet eine Fülle von vernetzten Werkzeugen, die ein tiefes und interaktives Bibelstudium ermöglichen:

  * **Bibel-Reader:**

      * Übersichtliche Darstellung aller Bücher der Bibel.
      * Intuitive Navigation durch Bücher und Kapitel.
      * Farbliche Kennzeichnung der biblischen Bücher zur besseren Orientierung.
      * Hervorhebung der **Worte Jesu** in roter Schrift in unterstützten Übersetzungen.

  * **Verse Hub – Die persönliche Super-Konkordanz:**

      * Eine zentrale Dashboard-Ansicht für jeden einzelnen Vers.
      * Bündelt alle verfügbaren Informationen an einem Ort:
          * Persönliche Notizen zum Vers.
          * **Übersetzungsvergleich** mit verschiedenen Bibelausgaben.
          * Alle **Kommentare**, die diesen Vers behandeln.
          * Alle **Strongs-Nummern** des Verses mit direkter Verlinkung zur Konkordanz.
          * Eine Liste aller **Predigten und Journaleinträge**, in denen der Vers zitiert wird.

  * **Strongs-Konkordanz:**

      * Vollständige hebräische und griechische Konkordanz.
      * Detaillierte Ansicht für jede Strongs-Nummer mit Definition und Vorkommen in der Bibel.
      * Interaktive Popups für Strongs-Nummern im gesamten Text der Anwendung.

  * **Integrierte Wörterbücher:**

      * Mehrere Wörterbücher (z.B. Rienecker, JMA) sind direkt verfügbar.
      * **Intelligente Worterkennung:** Wörter, die in den Wörterbüchern vorkommen, werden im gesamten Text der App automatisch erkannt und dezent hervorgehoben.
      * Ein Klick auf ein erkanntes Wort öffnet ein Popup mit einer Liste relevanter Wörterbuch-Themen.
      * **"Faule" Worterkennung:** Erkennt auch gebeugte Wörter (z.B. wird "Gottes" erkannt, auch wenn nur "Gott" im Wörterbuch steht). Gängige Füllwörter werden ignoriert.

  * **Umfassendes Notiz-System:**

      * Erstellen Sie persönliche Notizen zu einzelnen **Versen**, ganzen **Kapiteln** oder kompletten **Büchern**.
      * Leistungsstarker Markdown-Editor zur Formatierung Ihrer Notizen.

  * **Journale & Predigten:**

      * Führen Sie private Journale oder schreiben Sie ganze Predigten im Markdown-Editor.
      * Verwalten Sie den Status Ihrer Predigten (Idee, Entwurf, Gehalten).
      * Volltextsuche innerhalb Ihrer persönlichen Einträge.

  * **Leistungsstarke Suche:**

      * Eine globale Suchfunktion, die die Bibel, Notizen, Journale und Predigten durchsucht.
      * Spezialsuche nach **Strongs-Nummern** (z.B. `G2962`), die alle Vorkommen in der Referenzübersetzung anzeigt.

  * **Vernetztes Wissen:**

      * **Tagging-System:** Verschlagworten Sie alle Ihre Einträge (Notizen, Predigten etc.), um thematische Zusammenhänge zu schaffen.
      * **Automatische Verlinkung:** Bibelstellen (z.B. `Joh 3,16` oder `Eph. 4,17ff.`) werden im gesamten Text automatisch erkannt und mit interaktiven Popups verlinkt.

  * **Benutzeroberfläche:**

      * Modernes, klares und vollständig responsives Design.
      * Umschaltbarer **Dark Mode**.

## 🚀 Technische Funktionsweise

Die App wurde bewusst ohne serverseitige Abhängigkeiten (wie PHP, Python oder eine externe Datenbank) entwickelt, um eine maximale Geschwindigkeit und Portabilität für den lokalen Gebrauch zu gewährleisten.

#### Frontend-Architektur

  * **Technologie:** Vanilla JavaScript (ES6 Modules), HTML5, CSS3.
  * **Struktur:** Die Anwendung ist als Single-Page-Application (SPA) aufgebaut. Ein client-seitiger **Router** (`router.js`) fängt Klicks auf Links ab und rendert die Ansichten dynamisch, ohne dass die Seite neu geladen werden muss.
  * **Modulares Design:** Der Code ist in logische Module unterteilt:
      * `/views`: Enthält die Logik zum Rendern der einzelnen Seiten (Bibel, Wörterbuch, etc.).
      * `/services`: Beinhaltet die Logik für Datenverarbeitung, Suche und das Erstellen von Indizes.
      * `/ui`: Stellt wiederverwendbare UI-Komponenten (wie Popups oder Paginierung) zur Verfügung.

#### Daten-Management

  * **Datenquelle:** Alle Kern-Daten (Bibeltexte, Kommentare, Wörterbücher, Strongs-Konkordanz) liegen als `JSON`-Dateien im `/api`-Verzeichnis. Dies simuliert eine API, läuft aber vollständig lokal.
  * **Initialisierung:** Beim Start der App lädt die Funktion `loadInitialData` in `app.js` alle notwendigen JSON-Dateien asynchron.
  * **In-Memory-Datenbank:** Die geladenen Daten werden in einem globalen `state`-Objekt (`state.js`) im Arbeitsspeicher gehalten.
  * **Indizierung:** Um trotz der großen Datenmengen schnelle Suchen zu ermöglichen, durchläuft die `dataBuilder.js`-Datei die Daten nach dem Laden und erstellt hocheffiziente Indizes (JavaScript `Map` und `Set` Objekte). Beispiele sind:
      * Ein Index aller Verse pro Strongs-Nummer.
      * Ein Index aller Wörterbuch-Themen für die schnelle Worterkennung.
      * Ein Index aller Erwähnungen eines Verses in Predigten.

#### Besondere technische Merkmale

  * **Content Processing:** Die `contentProcessor.js` ist das Herzstück der Interaktivität. Sie nimmt rohen Text (z.B. aus einer Notiz oder einem Kommentar) und analysiert ihn mit optimierten regulären Ausdrücken. Dabei werden Bibelstellen, Strongs-Nummern und Wörterbuch-Begriffe erkannt und mit den entsprechenden `<span>`-Tags umschlossen, die dann die Popups auslösen.

## ⚙️ Lokale Einrichtung

Um die App lokal zu betreiben, ist ein einfacher Web-Server notwendig, damit die `fetch`-Anfragen an die lokalen JSON-Dateien funktionieren.

1.  **Voraussetzungen:** Sie benötigen [Node.js](https://nodejs.org/) und npm (wird mit Node.js installiert).
2.  **Web-Server installieren:** Öffnen Sie ein Terminal und installieren Sie einen einfachen globalen Web-Server:
    ```bash
    npm install -g live-server
    ```
3.  **App starten:**
      * Navigieren Sie im Terminal in das Hauptverzeichnis Ihrer App (der Ordner, der die `index.html` enthält).
      * Führen Sie den Befehl aus:
        ```bash
        live-server
        ```
4.  Ihr Browser sollte sich automatisch öffnen und die Anwendung unter einer lokalen Adresse (z.B. `http://127.0.0.1:8080`) anzeigen.
