'use strict';
// Writes imsmanifest.xml for SCORM 2004 4th Edition: one SCO, every file listed,
// and the pass mark as a scaled score (for example 4 of 5 = 0.8).
const { esc } = require('./text');

function packageId(m) {
  const words = String(m.title).replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  return m.id + '_' + words.map(function (w) { return w[0].toUpperCase() + w.slice(1); }).join('') + '_v' + (m.version || 1);
}

function manifest(m, files, scaledPass) {
  const key = String(m.id).toLowerCase().replace(/[^a-z0-9]/g, '');
  const title = esc(m.id + ' ' + m.title);
  const seq = scaledPass == null ? '' :
    '\n        <imsss:sequencing>\n          <imsss:objectives>\n            <imsss:primaryObjective objectiveID="' + key + '_primary" satisfiedByMeasure="true">\n' +
    '              <imsss:minNormalizedMeasure>' + scaledPass + '</imsss:minNormalizedMeasure>\n            </imsss:primaryObjective>\n          </imsss:objectives>\n        </imsss:sequencing>';
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<manifest identifier="' + esc(packageId(m)) + '" version="' + (m.version || 1) + '.0"\n' +
    '  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"\n  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"\n' +
    '  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"\n  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"\n' +
    '  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"\n  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n' +
    '  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd\n' +
    '                      http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd\n' +
    '                      http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd\n' +
    '                      http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd\n' +
    '                      http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">\n' +
    '  <metadata>\n    <schema>ADL SCORM</schema>\n    <schemaversion>2004 4th Edition</schemaversion>\n  </metadata>\n' +
    '  <organizations default="org_' + key + '">\n    <organization identifier="org_' + key + '">\n      <title>' + title + '</title>\n' +
    '      <item identifier="item_' + key + '" identifierref="res_' + key + '">\n        <title>' + title + '</title>' + seq + '\n      </item>\n' +
    '    </organization>\n  </organizations>\n  <resources>\n' +
    '    <resource identifier="res_' + key + '" type="webcontent" adlcp:scormType="sco" href="index.html">\n' +
    files.map(function (f) { return '      <file href="' + esc(f) + '"/>'; }).join('\n') + '\n' +
    '    </resource>\n  </resources>\n</manifest>\n';
}

module.exports = { manifest, packageId };
