# Groundwork module builder

Turns one **module file** (plain text, YAML) into a finished learning module:

- a **web version** (a folder you can host anywhere, or open on your Mac), and
- a **SCORM 2004 zip** you can upload to any LMS.

It's phase 1a of the Module Builder Spec. The F3 pilot, "Your first prompts", is rebuilt from
[`modules/F3/module.yaml`](modules/F3/module.yaml) to prove it works.

## Set up on your Mac (once)

1. Install Node.js (the LTS version) from [nodejs.org](https://nodejs.org).
2. Open Terminal, go to this folder, and run:
   ```
   npm install
   ```

## Build a module

```
npm run build -- modules/F3/module.yaml
```

You'll see something like:

```
✓ Built modules/F3/module.yaml (8 screens, pass mark 4 of 5)
  Web version:  modules/F3/build/web/index.html
  SCORM 2004:   modules/F3/build/F3-your-first-prompts-SCORM2004.zip
  Contrast:     54 of 54 colour checks pass (light and dark)
```

To check a module without building it: `npm run check -- modules/F3/module.yaml`

If something's wrong, nothing is built, and you get the line to fix:

```
✗ modules/F3/module.yaml, line 32 (screen 1, scenario-hook › image): alt text is missing. Add "alt:" …
✗ modules/F3/module.yaml, line 164 (screen 7, knowledge-check › question 2 › answer): the answer "d" isn't one of the options (a, b, c).
```

## Writing a module

Make a folder in `modules/` with a `module.yaml` and an `assets/` folder for images and PDFs.
Copying F3 is the easiest start. Text can use **\*\*bold\*\***, *\*italic\**, and `==highlight==`.
Leave a blank line between paragraphs; lines starting `1.` or `-` become lists.

At the top: `id`, `title`, `level`, `version`, `minutes`, `pass_mark`, and the `parts` the module
teaches (up to four; each gets its own colour and number tag). Then a list of `screens`, each using
one template:

| Template | What it's for |
|---|---|
| `scenario-hook` | Opens with a character, their situation, what went wrong, and a reflection with a reveal |
| `flip-cards` | Two to four key ideas on cards the learner turns over |
| `step-builder` | Builds something up one step per screen, with the prompt so far and Claude's reply |
| `try-it` | Guided practice: write a prompt in parts, copy it, open Claude, self-check |
| `knowledge-check` | Scored multiple-choice and matching questions with feedback and retries |
| `take-away` | Job aid table, PDF downloads, the completion message and what's next |

Run `node bin/groundwork.js templates` for the list with every field.

The generator refuses a module with missing alt text, a question without feedback or a correct
answer, an unknown template, a misspelt field name, or a part that doesn't exist.

## What every module gets automatically

- **Tracking (SCORM 2004 4th Edition):** bookmark (`cmi.location`), score out of the number of
  questions, pass or fail at the pass mark, completion, resume, and the pass is kept on return.
- **Works without an LMS**, for the hosted web version and demos.
- **No outside calls:** fonts, images and PDFs are bundled in the package.
- **Accessibility:** keyboard access for everything (drag and drop has a click alternative),
  focus moves to the new heading on Next and Back, results are announced to screen readers,
  light and dark mode, and phone width with no sideways scrolling.

## Themes

The house look (design direction B) lives in [`themes/groundwork/theme.yaml`](themes/groundwork/theme.yaml):
colours for light and dark mode, fonts and corner shapes. Every build checks each text colour
against its background (WCAG AA). For an enterprise customer, copy the folder, change the colours,
add `logo:`, and build with `--theme themes/their-name`. The module files don't change.

## Tests

```
npx playwright install chromium   # once
npm test
```

The tests rebuild F3 and click through it in a real browser with a pretend LMS: fail, retry, pass,
resume, no-LMS mode, keyboard, focus, automatic WCAG 2.2 AA checks on every screen in light and
dark mode, phone width, and no outside calls. They also feed in broken module files to check the
error messages.

## For the Mac app (phase 2)

The Mac app will call the same generator. Add `--json` to any command to get a machine-readable
report (problems with line numbers, the files built, contrast results), for example:

```
node bin/groundwork.js build modules/F3/module.yaml --json
```

## Folder map

```
bin/groundwork.js      the command line
src/                   the generator (checking, templates, manifest, zip)
src/templates/         one file per screen template
runtime/               the shared player every module uses (navigation, tracking, styles)
themes/groundwork/     house theme and bundled fonts (SIL Open Font Licence)
modules/F3/            the F3 pilot as a module file, plus its assets
tests/                 automatic tests
```
