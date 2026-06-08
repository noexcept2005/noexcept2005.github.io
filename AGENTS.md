# AGENTS.md

## Project Overview

- This is a Hugo static site for `www.wormwake.com` / `noexcept2005.github.io`.
- Main configuration lives in `config.yaml`.
- Site content lives under `content/`.
- Hugo layouts and page templates live under `layouts/`.
- Static assets live under `static/`; theme/frontend assets live under `assets/`.
- Generated output is in `public/` and should generally not be edited directly.

## JackalClient Pages

- JackalClient content is under `content/jackalclient/`.
- The shared JackalClient page layout is `layouts/_default/jackalclient.html`.
- JackalClient pages use front matter like `layout: "jackalclient"`.

## JackalClient I18n Mechanism

- JackalClient uses a lightweight client-side i18n system in `layouts/_default/jackalclient.html`.
- The language selector is in the JackalClient navbar, to the left of the nav links.
- The selector is styled as an animated slider switch; keep the `.language-switcher.lang-en` state class in sync when changing the language logic.
- On first visit, JavaScript checks `navigator.languages` / `navigator.language`:
  - Chinese browser languages use Chinese.
  - All other browser languages use English.
- Manual language choice is stored in `localStorage` under `jackalclient-lang`.
- Translatable elements use `data-i18n="key.name"`.
- Translation strings are stored in the `JACKAL_I18N` object in `layouts/_default/jackalclient.html`.
- When adding JackalClient text that should switch languages, add a `data-i18n` key and update both `zh` and `en` dictionaries.
- Download page button spacing uses `.download-actions` and `.domestic-download-wrap`; keep password/helper text above the domestic download button.

## Development Notes

- Prefer minimal, focused changes.
- Keep JackalClient-specific UI or i18n changes inside `layouts/_default/jackalclient.html` unless a content page needs `data-i18n` markers.
- Validate site changes with `hugo --quiet` when possible.
- Hugo may warn that `resources.ToCSS` is deprecated; this is an existing theme/config warning unless directly related to your change.
