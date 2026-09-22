# Technique Titan — Overleaf report

Upload this folder to [Overleaf](https://www.overleaf.com) as a new project.

## Option A — zip upload (recommended)

1. Zip the contents of this directory (`main.tex` at the zip root).
2. Overleaf → **New Project** → **Upload Project**.
3. Compiler: **pdfLaTeX**. TeX Live 2024 or 2025 is fine.
4. Click **Recompile**.

## Option B — paste

Create a blank Overleaf project, replace `main.tex` with this file, and compile with pdfLaTeX.

No extra packages, fonts, or figure files are required. Diagrams are TikZ; references are a built-in `thebibliography`.

The report is written to exceed ten pages at 11pt, one-half spacing, A4.

Factual baseline for scores, roadmap, and ML status: [`../ROADMAP.md`](../ROADMAP.md),
[`../ML_UPGRADE.md`](../ML_UPGRADE.md) (heuristic hold-out macro **0.689**, Sep 2026).
