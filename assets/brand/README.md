# Brand assets

| File | Use |
|---|---|
| `icon.svg` | Vector source (black rounded square, piano keys, landmark arch). |
| `icon.png` | Master app icon (512×512). Source for web favicons and Streamlit `page_icon`. |

Web-served derivatives live in `web/public/` (`favicon.png`, `apple-touch-icon.png`,
`icon-192.png`, `icon-512.png`). Regenerate those after changing this master; the
React product UI and Streamlit interim UI both consume the brand mark.

Unoptimized source clips (landing photo/video masters) live in sibling
`assets/source/` and are gitignored. Optimized copies served by the site are
`web/public/landing/photo-mode.mp4` and `web/public/landing/video-mode.mp4`.
