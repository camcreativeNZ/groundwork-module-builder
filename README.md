# Groundwork module builder

Turns one **module file** (plain text, YAML) into a finished learning module:

- a **web version** (a folder you can host anywhere, or open on your Mac), and
- a **SCORM 2004 zip** you can upload to any LMS.

Modules built so far: F1 Meet Claude, F2 Getting set up, F3 Your first prompts, F4 Having a conversation.

## Set up on your Mac (once)

1. Install Node.js (the LTS version) from [nodejs.org](https://nodejs.org).
2. Open Terminal, go to this folder, and run:
   ```
   npm install
   npx playwright install chromium
   ```
   The second line downloads the browser the builder uses to make PDFs and run QA.

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

## QA run (for the QA reviewer)

```
npm run qa -- modules/F1/module.yaml
```

This builds the module, then clicks through every screen in a real browser with a pretend LMS.
It opens every reveal and card, fills in the Try it boxes, answers the questions wrongly and then
correctly, checks what's sent to the LMS (bookmark, score, pass, completion, resume), runs automatic
WCAG 2.2 AA checks in light and dark mode, checks phone layout, and takes screenshots. Open
`modules/F1/build/qa/report.html` to see the results and every screenshot.

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
| `before-and-after` | A weak and a strong result side by side, with a "What changed" list to reveal |
| `try-it` | Guided practice: write a prompt in parts, copy it, open Claude, self-check |
| `knowledge-check` | Scored multiple-choice and matching questions with feedback and retries |
| `take-away` | Job aid table, PDF downloads, the completion message and what's next |

Run `node bin/groundwork.js templates` for the list with every field.

**Job aid PDFs:** add `job_aid:` to the take-away screen (a title, and optional `intro`,
`all_together` and `footer`) and the generator makes one-page A4 and US Letter PDFs from the
table, in the house style, with download buttons. No hand-made PDFs needed.

**Try it fields:** add `in_prompt: false` to a field that shouldn't be part of the copied prompt
(for example, "what will you call this chat?").

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
npm test
```

The tests build every module in `modules/` and run the full QA on each. They also test F3 in
detail (fail, retry, pass, resume, no-LMS mode, keyboard, focus) and feed in broken module files
to check the error messages.

## For the Mac app (phase 2)

The Mac app will call the same generator. Add `--json` to any command to get a machine-readable
report (problems with line numbers, the files built, contrast results), for example:

```
node bin/groundwork.js build modules/F3/module.yaml --json
```

## Folder map

```
bin/groundwork.js      the command line
src/                   the generator (checking, templates, manifest, zip, job aids, QA)
src/templates/         one file per screen template
runtime/               the shared player every module uses (navigation, tracking, styles)
themes/groundwork/     house theme and bundled fonts (SIL Open Font Licence)
modules/               one folder per module: module.yaml plus its assets
tests/                 automatic tests
```
