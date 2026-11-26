# Groundwork module builder: notes for Claude

- Owner is Cam, a learning designer (not a developer). Explain changes in plain NZ English.
- A module is one `modules/<ID>/module.yaml` plus `assets/`. Agents write these files; never hand-edit build output.
- After changing a module, template or the runtime: `npm run check -- <module.yaml>`, then `npm test`.
- Templates live in `src/templates/` (schema + render). New templates must keep WCAG 2.2 AA, keyboard access and
  a click alternative to any drag and drop; add them to `src/templates/index.js` and cover them in `tests/`.
- Colours only come from `themes/*/theme.yaml`; never hard-code colours in `runtime/base.css`.
- Packages must make no calls to outside websites (fonts and images bundled).
- Learner-facing text: NZ English spelling, plain language, international examples.
