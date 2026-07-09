const { APPLICANT_SOURCE } = require('../config/constants');

// The Google Apps Script (see docs handed to the user) already re-keys each
// form question onto these fixed field names, but the *values* are still
// exactly what the candidate picked/typed on the form — this normalizes
// those raw strings into what the Applicant schema expects. Normalization is
// tolerant on purpose: an unrecognized value is kept as-is rather than
// rejected, so a form wording change never silently drops an applicant.
const EXPERIENCE_MAP = {
  fresher: 'fresher',
  '0-1 year': '0-1',
  '1-2 year': '1-2',
  '2-3 year': '2-3',
  '3-4 year': '3-4',
  '4+ years': '4+',
};

const AVAILABILITY_MAP = {
  immediately: 'immediately',
  '15 days notice period': '15_days',
  '30 days notice period': '30_days',
  '60 days notice period': '60_days',
};

// A checkbox-type form question (multi-select) comes back from Apps Script
// as an array rather than a single string — every schema field here is a
// plain string, so any array-valued answer is joined rather than left to
// crash Mongoose's cast on write. Applies regardless of whether the live
// form's question type matches what it was originally described as, since
// that's exactly the kind of drift this mapper is meant to absorb.
function toText(raw) {
  if (Array.isArray(raw)) return raw.join(', ');
  return raw;
}

function normalizeLookup(map, raw) {
  const text = toText(raw);
  if (!text) return undefined;
  const key = String(text).trim().toLowerCase();
  return map[key] || text;
}

function toBoolean(raw) {
  const text = toText(raw);
  if (text === undefined || text === null || text === '') return undefined;
  return String(text).trim().toLowerCase() === 'yes';
}

function splitName(fullName) {
  const trimmed = String(toText(fullName) || '').trim();
  const [firstName, ...rest] = trimmed.split(/\s+/);
  return { firstName: firstName || trimmed, lastName: rest.join(' ') };
}

// payload.resumes is [{ filename, mimeType, base64 }] from the Apps Script —
// decoded here into the { buffer, originalname, mimetype } shape
// applicantService.createApplicant already expects from multer.
function mapResumeFiles(resumes = []) {
  return resumes
    .filter((r) => r && r.base64)
    .map((r) => ({
      buffer: Buffer.from(r.base64, 'base64'),
      originalname: r.filename || 'resume',
      mimetype: r.mimeType || 'application/octet-stream',
    }));
}

function mapGoogleFormPayload(payload) {
  const { firstName, lastName } = splitName(payload.fullName);

  const applicantData = {
    firstName,
    lastName,
    email: toText(payload.email),
    phone: toText(payload.whatsappNumber),
    instagramId: toText(payload.instagramId) && toText(payload.instagramId).trim() ? toText(payload.instagramId).trim() : 'NA',
    experienceLevel: normalizeLookup(EXPERIENCE_MAP, payload.experienceLevel),
    hasLaptop: toBoolean(payload.hasLaptop),
    willingToRelocate: toBoolean(payload.willingToRelocate),
    positionAppliedFor: toText(payload.positionAppliedFor),
    availability: normalizeLookup(AVAILABILITY_MAP, payload.availability),
    howDidYouFindUs: toText(payload.howDidYouFindUs),
    whyJoinCompany: toText(payload.whyJoinCompany),
    workStylePreference: toText(payload.workStylePreference)
      ? String(toText(payload.workStylePreference)).trim().toLowerCase()
      : undefined,
    whyHireYou: toText(payload.whyHireYou),
    currentSalary: toText(payload.currentSalary),
    expectedSalary: toText(payload.expectedSalary),
    dateApplied: new Date(),
    source: APPLICANT_SOURCE.GOOGLE_FORM,
    googleFormResponseId: payload.googleFormResponseId,
  };

  return { applicantData, resumeFiles: mapResumeFiles(payload.resumes) };
}

module.exports = { mapGoogleFormPayload };
