# 🪐 Astronomie Explorer

[![Version](https://img.shields.io/badge/version-0.6.0-blue.svg)](package.json)
[![Three.js](https://img.shields.io/badge/Three.js-r128-black.svg)](https://threejs.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020.svg)](https://workers.cloudflare.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-green.svg)](LICENSE)

Ein interaktiver 3D-Astronomie-Explorer zur didaktischen und spielerischen Erkundung unseres Sonnensystems und der Phänomene des Weltalls direkt im Webbrowser.

Entwickelt mit **Three.js**, modernem Vanilla JavaScript/TypeScript, GLTF/DRACO-Ladern und optimiert für Desktop- und Mobilgeräte. Bereitgestellt über **Cloudflare Workers**.

---

## ✨ Features & Module

Der Astronomie Explorer bietet sechs interaktive Erlebniswelten:

### 1. 🪐 Sonnensystem
- **Detailstufen nach Wissensniveau:** 6 anpassbare Stufen (von *ab 4* für Vorschulkinder bis *Experte* für Physik- und Astronomie-Interessierte).
- **Über 29 Monde & Begleiter:** Detaillierte 3D-Modelle für Erdmond, ISS, James-Webb-Weltraumteleskop, Galileische Monde (Io, Europa, Ganymed, Kallisto), Titan, Enceladus, Triton, Charon u. v. m.
- **Zwergplaneten & Kleinkörper:** Asteroidengürtel, Kuipergürtel, Ceres, Vesta, Pluto, Halleyscher Komet mit dynamischem Schweif, Haumea, Makemake, Eris und Sedna.
- **Ansichten-Toggle:** Umschalten zwischen realistischen Umlaufbahnen und der aufgereihten Ansicht mit dem klassischen Merkspruch (*„Mein Vater erklärt mir jeden Sonntag unseren Nachthimmel“*).
- **Filter-Modus:** Schneller Wechsel zwischen reinen Hauptplaneten und detaillierter Ansicht mit allen Begleitkörpern.

### 2. 🌙 Mondphasen
- Realitätsgetreue 3D-Visualisierung der Mondphasen (Neumond, zunehmende Sichel, Erstes Viertel, Vollmond, Letztes Viertel, abnehmende Sichel).
- Gleichzeitige Darstellung der Draufsicht im Weltraum und des Anblicks von der Erde aus.

### 3. ⭐ Sternenzyklus
- Interaktiver Entwicklungsweg von Sternen abhängig von ihrer Ausgangsmasse.
- Von der Molekülwolke und dem Protostern über Rote Riesen bis hin zu Planetarischen Nebeln, Weißen Zwergen, Supernovae, Neutronensternen und Schwarzen Löchern.

### 4. 📐 Größenvergleich
- Anschaulicher Maßstabsvergleich kosmischer Strukturen von winzigen Asteroiden über Gesteins- und Gasplaneten, Sterne verschiedener Spektralklassen (Sonne, Sirius, Beteigeuze, UY Scuti) bis hin zu Kugelsternhaufen, Galaxien und dem beobachtbaren Universum.

### 5. 🚀 Raketenstart-Simulation
- Dreistufige interaktive Flugsimulation eines Space Shuttles von der Startrampe bis zum Mars.
- Realistisches Überschall-Antriebsfeuer mit Schock-Diamanten, Rauch- und Partikeleffekten.
- Stufentrennung (Solid Rocket Boosters, externer Haupttank) und sanftes Landemanöver am Mars.

### 6. 🌍 Jahreszeiten
- Anschauliche Erklärung von Sommer, Herbst, Winter und Frühling durch die Neigung der Erdachse (23,5°).
- Dynamische Sonnenstandswinkel, Tag-/Nachtgrenze (Terminator) und Beleuchtungsstärken.

---

## 🎛️ Bedienung & Steuerung

- **Geschwindigkeitsregler:** Stufenlose Regelung von Rotation (0–200 %) und Umlaufbahnen (0–200 %) in Echtzeit oder komplettes Pausieren.
- **Kamera-Navigation:**
  - **Drehen / Orbit:** Linke Maustaste gedrückt halten und ziehen (bzw. Ein-Finger-Touch).
  - **Zoomen:** Mausrad bzw. Pinch-to-Zoom auf Touchscreens.
  - **Verschieben (Pan):** Rechte Maustaste gedrückt halten oder Zwei-Finger-Drag.
- **Fokussierung:** Klick auf einen Planeten oder Begleiter richtet die Kamera sanft auf den Himmelskörper aus und öffnet die Detail-Infokarte.
- **Minimieren / Schließen:** Infokarten können minimiert werden, um die volle 3D-Bühne im Orbit-Tracking zu genießen.

---

## 🚀 Lokale Entwicklung

### Voraussetzungen
- [Node.js](https://nodejs.org/) (Version 18+ empfohlen)
- `npm`

### Installation
```bash
# Repository klonen
git clone https://github.com/mrgoldsmitt/astronomie-explorer.git
cd astronomie-explorer

# Abhängigkeiten installieren
npm install
```

### Lokalen Server starten
```bash
# Schneller statischer HTTP-Server
npm start
# oder
npm run dev
```
Die Anwendung öffnet sich standardmäßig unter `http://localhost:8080`.

### Cloudflare Worker lokal testen
```bash
npm run cf:dev
```

---

## 📦 Deployment & Release

### Cloudflare Worker Deployment
```bash
npm run cf:deploy
```

### Release-Skript (`deploy_release.sh`)
Das mitgelieferte Skript führt Typprüfungen durch, erstellt ein reproduzierbares Release-Archiv im Verzeichnis `dist/` und kann direkt ein GitHub-Release veröffentlichen:

```bash
# Release-Artefakt bauen
./deploy_release.sh

# Release-Artefakt bauen und GitHub Release erstellen
./deploy_release.sh --github-release
```

---

## 🛠️ Technologien

- **3D-Engine:** [Three.js](https://threejs.org/) (r128) via WebGL
- **3D-Modelle & Loader:** GLTFLoader, DRACOLoader, OrbitControls, CSS2DRenderer
- **Serverless Hosting:** [Cloudflare Workers](https://workers.cloudflare.com/) & Assets
- **Sprachen:** JavaScript (ES2022), TypeScript (für Worker APIs), HTML5, CSS3 Glassmorphism

---

## 📄 Lizenz

Dieses Projekt ist unter der [ISC-Lizenz](LICENSE) lizenziert.
