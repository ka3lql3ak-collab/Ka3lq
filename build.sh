#!/usr/bin/env bash
# Rebuild every KDP file into output/.
set -euo pipefail
cd "$(dirname "$0")"
python3 tools/build_cover.py
python3 tools/build_epub.py
python3 tools/build_pdf.py
