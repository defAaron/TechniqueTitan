# Assets

Brand and the unoptimized landing masters. The site does not serve this folder. Web-facing copies live under `web/public/`.

| Path | Tracked | What it is |
|---|---|---|
| [`brand/`](brand/README.md) | yes | `icon.svg` and the 512×512 `icon.png`. Favicons in `web/public/` are derived from the PNG. Streamlit uses it as `page_icon`. The root README embeds `brand/icon.png`. |
| `source/` | no | Original landing stills and clips. Optimized files the hero actually requests are `web/public/landing/`. |

Do not reference `/hero-*` from React unless that file exists under `web/public/`. A missing public file 404s in production even when a master sits in `source/`.
