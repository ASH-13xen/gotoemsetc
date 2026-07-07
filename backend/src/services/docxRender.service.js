const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const ApiError = require('../utils/ApiError');

function formatDocxtemplaterError(err) {
  const details = (err.properties?.errors || []).map((e) => ({
    tag: e.properties?.id ?? e.properties?.tag,
    explanation: e.properties?.explanation || e.message,
  }));
  return ApiError.badRequest('Failed to render document template', details);
}

// Fills a .docx template buffer with `data`, using single-brace {tag} syntax.
// Any tag that resolves to undefined/null is collected (not silently blanked)
// so callers get a precise "these fields are missing" error instead of a
// document with empty gaps.
function renderDocx(templateBuffer, data) {
  const missingTags = new Set();

  let zip;
  let doc;
  try {
    zip = new PizZip(templateBuffer);
    doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: (part) => {
        missingTags.add(part.value);
        return '';
      },
    });
  } catch (err) {
    throw formatDocxtemplaterError(err);
  }

  try {
    doc.render(data);
  } catch (err) {
    throw formatDocxtemplaterError(err);
  }

  if (missingTags.size > 0) {
    throw ApiError.badRequest('Missing values for required fields', {
      missingTags: [...missingTags],
    });
  }

  return doc.getZip().generate({ type: 'nodebuffer' });
}

module.exports = { renderDocx };
