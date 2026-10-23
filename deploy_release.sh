#!/usr/bin/env bash
# ==============================================================================
# deploy_release.sh - Build, Package and Release Astronomie Explorer
# ==============================================================================
set -euo pipefail

# ANSI Colors
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_info()    { echo -e "${BLUE}${BOLD}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}${BOLD}[SUCCESS]${NC} $*"; }
log_warn()    { echo -e "${YELLOW}${BOLD}[WARN]${NC} $*"; }
log_error()   { echo -e "${RED}${BOLD}[ERROR]${NC} $*" >&2; }

# Usage Information
usage() {
    cat <<EOF
Verwendung: ./deploy_release.sh [OPTIONEN]

Optionen:
  -b, --build-only      Nur TypeScript prüfen und Release-Archiv in dist/ bauen (Standard)
  -c, --cf-deploy       Release zu Cloudflare Workers ausrollen (wrangler deploy)
  -g, --github-release  GitHub-Release erstellen und Archiv hochladen (gh release create)
  -a, --all             Build, Cloudflare Deploy und GitHub Release ausführen
  -h, --help            Diese Hilfe anzeigen

Beispiele:
  ./deploy_release.sh                     # Prüfen und Archiv bauen
  ./deploy_release.sh --github-release    # Archiv bauen & auf GitHub veröffentlichen
  ./deploy_release.sh --all               # Vollständiger Release-Zyklus
EOF
}

# Parameter Parsing
DO_CF_DEPLOY=false
DO_GH_RELEASE=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        -b|--build-only)
            ;;
        -c|--cf-deploy)
            DO_CF_DEPLOY=true
            ;;
        -g|--github-release)
            DO_GH_RELEASE=true
            ;;
        -a|--all)
            DO_CF_DEPLOY=true
            DO_GH_RELEASE=true
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            log_error "Unbekannte Option: $1"
            usage
            exit 1
            ;;
    esac
    shift
done

# Check Working Directory
if [[ ! -f "package.json" ]]; then
    log_error "package.json nicht im aktuellen Verzeichnis gefunden!"
    exit 1
fi

# Determine Version
VERSION=$(node -p "require('./package.json').version")
TAG="v${VERSION}"
log_info "Projektversion: ${BOLD}${VERSION}${NC} (Tag: ${BOLD}${TAG}${NC})"

# Step 1: TypeScript Check
log_info "Führe TypeScript-Typüberprüfung durch..."
if ! npx tsc --noEmit; then
    log_error "TypeScript-Überprüfung fehlgeschlagen!"
    exit 1
fi
log_success "TypeScript-Prüfung erfolgreich abgeschlossen."

# Step 2: Build Release Archive
DIST_DIR="dist"
ARCHIVE_NAME="astronomie-explorer-${TAG}.zip"
ARCHIVE_PATH="${DIST_DIR}/${ARCHIVE_NAME}"
CHECKSUM_PATH="${DIST_DIR}/astronomie-explorer-${TAG}.sha256"

log_info "Erstelle Release-Verzeichnis: ${DIST_DIR}/"
mkdir -p "${DIST_DIR}"

log_info "Packe Release-Artefakt: ${ARCHIVE_PATH}..."
rm -f "${ARCHIVE_PATH}" "${CHECKSUM_PATH}"

# Exclude unnecessary files and pack production assets
zip -r -q "${ARCHIVE_PATH}" \
    public \
    src \
    package.json \
    package-lock.json \
    tsconfig.json \
    wrangler.toml \
    README.md \
    LICENSE \
    -x "*.DS_Store*" "*node_modules*" "*.wrangler*" "*dist*"

# Generate SHA-256 Checksum
if command -v shasum >/dev/null 2>&1; then
    (cd "${DIST_DIR}" && shasum -a 256 "${ARCHIVE_NAME}" > "$(basename "${CHECKSUM_PATH}")")
elif command -v sha256sum >/dev/null 2>&1; then
    (cd "${DIST_DIR}" && sha256sum "${ARCHIVE_NAME}" > "$(basename "${CHECKSUM_PATH}")")
fi

log_success "Release-Archiv erstellt: ${ARCHIVE_PATH}"
if [[ -f "${CHECKSUM_PATH}" ]]; then
    log_success "SHA256: $(cat "${CHECKSUM_PATH}")"
fi

# Step 3: Optional Cloudflare Deploy
if [[ "${DO_CF_DEPLOY}" == true ]]; then
    log_info "Rolle Cloudflare Worker aus (wrangler deploy)..."
    npx wrangler deploy
    log_success "Cloudflare Worker erfolgreich bereitgestellt!"
fi

# Step 4: Optional GitHub Release
if [[ "${DO_GH_RELEASE}" == true ]]; then
    if ! command -v gh >/dev/null 2>&1; then
        log_error "'gh' (GitHub CLI) ist nicht installiert oder nicht im PATH!"
        exit 1
    fi

    log_info "Erstelle GitHub-Release ${TAG}..."
    
    # Check if tag exists locally
    if ! git rev-parse "${TAG}" >/dev/null 2>&1; then
        log_warn "Git-Tag ${TAG} existiert noch nicht lokal. Erstelle Tag..."
        git tag -a "${TAG}" -m "Release ${TAG}"
    fi

    # Push tag if remote exists
    if git remote | grep -q "origin"; then
        log_info "Pushe Tag ${TAG} zu origin..."
        git push origin "${TAG}" || true
    fi

    # Release Notes
    NOTES="Astronomie Explorer ${TAG}

- Vollständiges Release-Archiv inklusive 3D-Assets, Shadern und Texturen
- Cloudflare Workers Integration
- SHA-256 Prüfsumme: $(cat "${CHECKSUM_PATH}" 2>/dev/null || echo 'N/A')"

    if gh release view "${TAG}" >/dev/null 2>&1; then
        log_info "GitHub Release ${TAG} existiert bereits. Lade Assets hoch..."
        gh release upload "${TAG}" "${ARCHIVE_PATH}" "${CHECKSUM_PATH}" --clobber
    else
        gh release create "${TAG}" "${ARCHIVE_PATH}" "${CHECKSUM_PATH}" \
            --title "Astronomie Explorer ${TAG}" \
            --notes "${NOTES}"
    fi
    log_success "GitHub Release ${TAG} erfolgreich veröffentlicht!"
fi

log_success "Alle Schritte für ${TAG} erfolgreich abgeschlossen!"
