'use strict';
// Starts the bundled Chromium (via Playwright) for job aid PDFs and QA runs.
let playwright = null;
function chromium() {
  if (!playwright) {
    try { playwright = require('playwright'); } catch (e) {
      throw new Error('This step needs Playwright. In Terminal, run: npm install, then: npx playwright install chromium');
    }
  }
  return playwright.chromium;
}
async function launch() {
  const opts = {};
  if (process.env.GROUNDWORK_CHROMIUM) opts.executablePath = process.env.GROUNDWORK_CHROMIUM;
  return chromium().launch(opts);
}
module.exports = { launch };
