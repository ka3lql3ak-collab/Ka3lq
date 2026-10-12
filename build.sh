#!/usr/bin/env bash
# Rebuild the complete 120-page journal PDF into output/.
# (tools/make_art.py re-paints the florals in assets/; it is slow and only needed to change the artwork.)
set -euo pipefail
cd "$(dirname "$0")"
python3 tools/build_book.py
python3 tools/build_epub.py
