'use strict';
// Public API, for the command line and (later) the Mac app.
const { build } = require('./build');
const { validateModule } = require('./validate');
const { loadTheme } = require('./theme');
const templates = require('./templates');
const { formatProblem } = require('./load');
module.exports = { build, validateModule, loadTheme, templates: templates.list, formatProblem };
