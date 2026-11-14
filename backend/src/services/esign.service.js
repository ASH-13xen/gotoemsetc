const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const QRCode = require('qrcode');
const { PDFDocument } = require('pdf-lib');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { NOTIFICATION_TYPES, PERMISSIONS } = require('../config/constants');
const { ACCESS } = require('../config/access');
const { can } = require('../utils/roles');
const ESignSettings = require('../models/ESignSettings');
const DocumentSignature = require('../models/DocumentSignature');
const GeneratedDocument = require('../models/GeneratedDocument');
const Employee = require('../models/Employee');
const { fillTemplate, renderPdfFromHtml } = require('./htmlRender.service');
const { sendEmail } = require('./email.service');

// E-signing generated documents.
//
// - The company's signature (the CEO's, or HR's — whichever the template
//   names) is placed on a document when it is generated.
// - HR sends it to the employee's company (default) or personal mail. With
//   a place for the employee to sign, they get a link: they confirm a code
//   emailed to that address, read it, sign (drawn or typed), and the signed
//   PDF — the document with their signature, plus a certificate page with
//   the record and a QR code — is kept. A letter with nothing for them to
//   sign (experience, relieving) is issued the same way, certificate and all.
// - Every copy can be checked on the public verification page: its
//   fingerprint (SHA-256) either matches what was signed/sent, or it doesn't.

const CONSENT =
  'I have read this document, and I agree that my electronic signature on it is the legal equivalent of my handwritten signature.';
const LINK_DAYS = 14;
const CODE_MINUTES = 10;
const CODE_RESEND_SECONDS = 45;
const CODE_TRIES = 5;
const SESSION_MINUTES = 45;
const COMPANY = 'GO-TO Friend Pvt. Ltd.';
const OPEN = ['sent', 'viewed'];
const FINAL = ['signed', 'issued'];

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const newToken = () => crypto.randomBytes(24).toString('base64url');
const hmac = (value) => crypto.createHmac('sha256', env.jwtSecret).update(String(value)).digest('hex');
const idOf = (v) => (v && v._id ? String(v._id) : v ? String(v) : null);
const nameOf = (e) => (e ? `${e.firstName || ''} ${e.lastName || ''}`.trim() : '');
const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
const fmtDay = (d) => new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' });
const fmtStamp = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }) + ' IST' : '—';
const maskEmail = (e) => String(e || '').replace(/^(.)(.*)(.@.*)$/, (_m, a, mid, b) => `${a}${'•'.repeat(Math.min(6, mid.length))}${b}`);

// A verification code people can type: GTF-XXXX-XXXX (no look-alike letters).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function verificationCode() {
  const bytes = crypto.randomBytes(8);
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `GTF-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

// ---------------------------------------------------------------- signatories

async function settingsDoc() {
  return (await ESignSettings.findOne({ key: 'settings' })) || new ESignSettings({ key: 'settings', signatories: [] });
}

// For the screens: who signs for the company, and whether their signature is on file.
async function getSettings() {
  const s = await settingsDoc();
  const defaults = { ceo: { name: 'Prakhar Agrawal', title: 'CEO (Chief Executive Officer)' }, hr: { name: 'Juhika Paradkar', title: 'HR Executive' } };
  return {
    signatories: ['ceo', 'hr'].map((key) => {
      const x = s.signatories.find((y) => y.key === key);
      return {
        key,
        name: x?.name || defaults[key].name,
        title: x?.title || defaults[key].title,
        hasSignature: Boolean(x?.image?.data?.length),
        image: x?.image?.data?.length ? `data:${x.image.contentType};base64,${x.image.data.toString('base64')}` : null,
        updatedAt: x?.updatedAt || null,
      };
    }),
  };
}

async function setSignatory(user, key, { name, title }, file) {
  if (!['ceo', 'hr'].includes(key)) throw ApiError.badRequest('Choose the CEO or HR');
  if (!String(name || '').trim()) throw ApiError.badRequest('Their name, as the letters print it');
  if (file && !['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) throw ApiError.badRequest('The signature has to be a PNG, JPG or WebP image');
  if (file && file.size > 600 * 1024) throw ApiError.badRequest('The signature image is too large (600 KB at most)');
  const s = await settingsDoc();
  const existing = s.signatories.find((x) => x.key === key);
  const next = {
    key,
    name: String(name).trim(),
    title: String(title || '').trim(),
    image: file ? { data: file.buffer, contentType: file.mimetype } : existing?.image,
    updatedBy: user.id,
    updatedAt: new Date(),
  };
  s.signatories = [...s.signatories.filter((x) => x.key !== key), next];
  await s.save();
  return getSettings();
}

async function signatoryMap() {
  const s = await settingsDoc();
  const out = {};
  for (const x of s.signatories) {
    if (x.image?.data?.length) out[x.key] = { name: x.name, title: x.title, dataUrl: `data:${x.image.contentType};base64,${x.image.data.toString('base64')}` };
  }
  return out;
}

// ---------------------------------------------------------------- placing signatures

const STYLE = `<style id="esign-style">
  .esign-block { min-height: 56pt; }
  .esign-block.sm { min-height: 30pt; }
  [data-esign] img.esign-sig { display: block; height: 52px; max-width: 220px; object-fit: contain; margin: 2pt 0; }
  [data-esign] img.esign-sig-inline { height: 34px; max-width: 200px; object-fit: contain; vertical-align: -12px; }
  .esign-by { display: block; font-size: 7.5pt; color: #555; }
</style>`;
const MARK = /<(span|div)\b([^>]*?)\bdata-esign="([a-z-]+)"([^>]*)>([\s\S]*?)<\/\1>/g;
const attr = (attrs, name) => {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(attrs);
  return m ? m[1] : '';
};

function withStyle(html) {
  if (html.includes('id="esign-style"')) return html;
  return html.includes('</head>') ? html.replace('</head>', `${STYLE}</head>`) : STYLE + html;
}

// Fills the marked places: the company's signature (when that signatory's
// is on file — and, where the template names the person, only if it's them)
// and, once they sign, the employee's. Returns the HTML and which company
// signatories were placed.
function applySignatures(html, { signatories = {}, companyDate = null, employee = null } = {}) {
  const placed = new Set();
  const out = withStyle(html).replace(MARK, (whole, tag, a1, kind, a2, inner) => {
    const attrs = `${a1} ${a2}`;
    const open = `<${tag}${a1}data-esign="${kind}"${a2}>`;
    if (kind.startsWith('company')) {
      const key = attr(attrs, 'data-signatory');
      const s = signatories[key];
      const named = attr(attrs, 'data-name');
      if (!s || (named && norm(named) !== norm(s.name))) return whole;
      placed.add(key);
      if (kind === 'company') {
        const cls = tag === 'div' ? 'esign-sig' : 'esign-sig-inline';
        return `${open}<img class="${cls}" src="${s.dataUrl}" alt="Signature of ${esc(s.name)}" /></${tag}>`;
      }
      if (kind === 'company-name') return `${open}${esc(s.name)}${s.title ? `, ${esc(s.title)}` : ''}</${tag}>`;
      if (kind === 'company-date') return `${open}${esc(fmtDay(companyDate || new Date()))}</${tag}>`;
      return whole;
    }
    if (!employee) return whole;
    if (kind === 'employee') {
      return `${open}<img class="esign-sig-inline" src="${employee.dataUrl}" alt="Signature of ${esc(employee.name)}" /><span class="esign-by">Signed electronically by ${esc(employee.name)}</span></${tag}>`;
    }
    if (kind === 'employee-date') return `${open}${esc(fmtDay(employee.at))}</${tag}>`;
    return whole || inner;
  });
  return { html: out, placed: [...placed] };
}

// At generation: the document's HTML with the company's signature placed.
async function withCompanySignatures(html, when = new Date()) {
  const signatories = await signatoryMap();
  return applySignatures(html, { signatories, companyDate: when });
}

const hasEmployeeSpot = (html) => /data-esign="employee"/.test(html || '');

// ---------------------------------------------------------------- the certificate page

async function certificatePdf(rec, { employeeName, signatureDataUrl = null, signatories = [] }) {
  const verifyUrl = `${env.publicAppUrl}/verify/${rec.code}`;
  const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 220 });
  const row = (k, v) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`;
  const issued = rec.kind === 'issue';
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: Arial, Helvetica, sans-serif; color: #111827; font-size: 10pt; }
    .head { display: flex; align-items: center; gap: 14pt; border-bottom: 2pt solid #111827; padding-bottom: 10pt; }
    .head img { height: 34pt; }
    h1 { font-size: 17pt; margin: 0; }
    .sub { color: #4b5563; margin: 2pt 0 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 12pt; }
    th { text-align: left; width: 34%; color: #4b5563; font-weight: 600; vertical-align: top; padding: 5pt 8pt 5pt 0; border-bottom: 0.6pt solid #e5e7eb; }
    td { padding: 5pt 0; border-bottom: 0.6pt solid #e5e7eb; overflow-wrap: break-word; }
    .mono { font-family: Consolas, 'Courier New', monospace; font-size: 8.5pt; word-break: break-all; }
    .sig { height: 54px; max-width: 240px; object-fit: contain; }
    .verify { display: flex; gap: 14pt; align-items: center; margin-top: 16pt; padding: 10pt; border: 1pt solid #d1d5db; border-radius: 6pt; }
    .verify img { width: 104pt; height: 104pt; }
    .small { color: #6b7280; font-size: 8pt; margin-top: 12pt; line-height: 1.4; }
  </style></head><body>
    <div class="head"><img src="assets/logo.png" alt="" /><div><h1>${issued ? 'Certificate of issue' : 'Signing certificate'}</h1><p class="sub">${esc(rec.title)} · Document ${esc(rec.code)}</p></div></div>
    <table>
      ${row('Document', esc(rec.title))}
      ${row('Issued by', COMPANY)}
      ${row(issued ? 'Issued to' : 'Employee', esc(employeeName))}
      ${signatories.length ? row('Company signature', signatories.map((s) => `${esc(s.name)}${s.title ? `, ${esc(s.title)}` : ''}`).join('; ')) : ''}
      ${row(issued ? 'Issued and sent' : 'Sent for signing', `${fmtStamp(rec.sentAt)} to ${esc(rec.email)} (${rec.channel === 'company' ? 'company mail' : 'personal mail'})`)}
      ${issued ? '' : row('Opened', fmtStamp(rec.viewedAt))}
      ${issued ? '' : row('Email code confirmed', `${fmtStamp(rec.codeVerifiedAt)} — a one-time code sent to ${esc(rec.email)}`)}
      ${issued ? '' : row('Signed', `${fmtStamp(rec.signedAt)} — signed as “${esc(rec.signerName)}”`)}
      ${issued || !signatureDataUrl ? '' : row('Signature', `<img class="sig" src="${signatureDataUrl}" alt="" />`)}
      ${issued ? '' : row('Signed from', `<span class="mono">IP ${esc(rec.signerIp || '—')}</span><br /><span class="mono">${esc((rec.signerAgent || '').slice(0, 180))}</span>`)}
      ${issued ? '' : row('Agreed to', esc(rec.consentText || CONSENT))}
      ${row('Fingerprint of the document as sent (SHA-256)', `<span class="mono">${esc(rec.originalHash)}</span>`)}
    </table>
    <div class="verify"><img src="${qr}" alt="" /><div>
      <p><strong>Check this document</strong></p>
      <p>Scan the code, or open <span class="mono">${esc(verifyUrl)}</span>.</p>
      <p>To confirm a copy hasn't been changed, upload it there — its fingerprint has to match the one recorded when it was ${issued ? 'issued' : 'signed'}.</p>
    </div></div>
    <p class="small">This page is part of the ${issued ? 'issued' : 'signed'} document. The fingerprint (SHA-256) of the whole file was recorded at ${issued ? 'issue' : 'signing'}; any change to the file — even a single character — changes it. ${COMPANY} keeps the record of this document; it can't be edited or deleted.</p>
  </body></html>`;
  return renderPdfFromHtml(html, env.templatesHtmlDir);
}

// The document, then its certificate page, as one PDF.
async function withCertificate(docPdf, certPdf) {
  const out = await PDFDocument.create();
  for (const src of [docPdf, certPdf]) {
    // eslint-disable-next-line no-await-in-loop
    const pdf = await PDFDocument.load(src);
    // eslint-disable-next-line no-await-in-loop
    const pages = await out.copyPages(pdf, pdf.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  out.setTitle('Signed document');
  out.setProducer(`${COMPANY} — EMS`);
  // The fingerprint is taken of exactly these bytes, once, after saving.
  return Buffer.from(await out.save());
}

// ---------------------------------------------------------------- emails

const button = (href, label) =>
  `<p style="margin:22px 0"><a href="${href}" style="background:#111827;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">${esc(label)}</a></p>`;
const wrap = (body) => `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111827;line-height:1.55;max-width:560px">${body}<p style="color:#6b7280;font-size:12px;margin-top:28px">${COMPANY} · sent from EMS</p></div>`;

async function mailSignRequest(rec, employee, token) {
  const link = `${env.publicAppUrl}/sign/${token}`;
  await sendEmail({
    to: rec.email,
    subject: `Please sign: ${rec.title} — ${COMPANY}`,
    html: wrap(
      `<p>Hi ${esc(employee.firstName)},</p><p>${COMPANY} has sent you <strong>${esc(rec.title)}</strong> to read and sign online — no printing needed.</p>${button(link, 'Review and sign')}<p>You'll be asked for a one-time code, which we email to this address. The link works until ${fmtDay(rec.tokenExpiresAt)}.</p><p style="color:#6b7280">If you weren't expecting this, you can ignore this email.</p>`
    ),
  });
}

async function mailFinal(rec, employee, pdf) {
  const verify = `${env.publicAppUrl}/verify/${rec.code}`;
  await sendEmail({
    to: rec.email,
    subject: rec.kind === 'issue' ? `${rec.title} — ${COMPANY}` : `Signed: ${rec.title}`,
    html: wrap(
      rec.kind === 'issue'
        ? `<p>Hi ${esc(employee.firstName)},</p><p>Your <strong>${esc(rec.title)}</strong> from ${COMPANY} is attached. Its last page is a certificate: anyone can check the document is genuine at <a href="${verify}">${verify}</a>.</p>`
        : `<p>Hi ${esc(employee.firstName)},</p><p>Thank you — your signed copy of <strong>${esc(rec.title)}</strong> is attached. Its last page is the signing certificate; the document can be checked at <a href="${verify}">${verify}</a>.</p>`
    ),
    attachments: [{ filename: `${rec.templateKey || 'document'}-${rec.code}.pdf`, content: pdf.toString('base64') }],
  });
}

// ---------------------------------------------------------------- HR: sending

function companyMailOf(employee) {
  if (employee.companyEmail) return employee.companyEmail;
  const hit = (employee.extraDetails || []).find((d) => /^\s*company\s*mail\s*id\s*$/i.test(d.key) && /@/.test(d.value || ''));
  return hit ? hit.value.trim() : '';
}

async function loadDocument(employeeId, docId) {
  const doc = await GeneratedDocument.findOne({ _id: docId, employee: employeeId }).select('+html -docx.data').populate('template', 'key title htmlFilePath');
  if (!doc) throw ApiError.notFound('Document not found');
  if (doc.status !== 'completed') throw ApiError.badRequest("This document wasn't generated — make it again first");
  return doc;
}

// The document exactly as it will be signed: as generated when its HTML was
// kept; otherwise (made before e-signing, or as a Word file) rebuilt from
// what it was made with, with the company's signature placed.
async function documentAsSent(doc) {
  if (doc.html && doc.pdf?.data?.length) {
    return { html: doc.html, pdf: doc.pdf.data, placed: [...new Set([...doc.html.matchAll(/data-esign="company" data-signatory="(\w+)"[^>]*><img/g)].map((m) => m[1]))] };
  }
  if (!doc.template?.htmlFilePath) throw ApiError.badRequest('This document has no PDF version, so it can’t be signed online');
  const raw = await fs.readFile(path.join(env.templatesHtmlDir, doc.template.htmlFilePath), 'utf8');
  const filled = fillTemplate(raw, doc.mergeDataSnapshot || {});
  const { html, placed } = await withCompanySignatures(filled, doc.createdAt);
  const pdf = await renderPdfFromHtml(html, env.templatesHtmlDir);
  return { html, pdf, placed };
}

async function send(actor, employeeId, docId, { channel = 'company' } = {}, meta = {}) {
  if (!['company', 'personal'].includes(channel)) throw ApiError.badRequest('Send it to their company or personal mail');
  const doc = await loadDocument(employeeId, docId);
  if (doc.signedFile?.contentType) throw ApiError.conflict('This document already has a signed copy on file');
  const done = await DocumentSignature.findOne({ document: doc._id, status: { $in: FINAL } }).select('status');
  if (done) throw ApiError.conflict(done.status === 'signed' ? 'This document is already signed' : 'This document was already issued');
  const employee = await Employee.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');
  const email = channel === 'personal' ? (employee.personalEmail || '').trim() : companyMailOf(employee);
  if (!email) throw ApiError.badRequest(channel === 'personal' ? 'They have no personal email on their profile' : 'They have no company mail ID on their profile');

  const { html, pdf, placed } = await documentAsSent(doc);
  const settings = await getSettings();
  const kind = hasEmployeeSpot(html) ? 'sign' : 'issue';

  // A new send replaces any link still open for this document.
  const openOnes = await DocumentSignature.find({ document: doc._id, status: { $in: OPEN } });
  for (const o of openOnes) {
    o.status = 'cancelled';
    o.cancelledAt = new Date();
    o.cancelledBy = actor.id;
    o.cancelReason = 'Sent again';
    o.tokenHash = undefined;
    o.appTokenHash = undefined;
    o.sessionHash = undefined;
    o.events.push({ type: 'cancelled', by: actor.id, note: 'Sent again' });
    // eslint-disable-next-line no-await-in-loop
    await o.save();
  }

  let code = verificationCode();
  // eslint-disable-next-line no-await-in-loop
  while (await DocumentSignature.exists({ code })) code = verificationCode();
  const token = newToken();
  const now = new Date();
  const rec = new DocumentSignature({
    document: doc._id,
    employee: employee._id,
    templateKey: doc.template?.key,
    title: doc.template?.title || 'Document',
    kind,
    status: 'sent',
    code,
    channel,
    email,
    sentAt: now,
    sentBy: actor.id,
    tokenHash: kind === 'sign' ? sha256(token) : undefined,
    tokenExpiresAt: kind === 'sign' ? new Date(now.getTime() + LINK_DAYS * 86400000) : undefined,
    html,
    sentPdf: pdf,
    originalHash: sha256(pdf),
    companySignatories: placed.map((k) => settings.signatories.find((s) => s.key === k)).filter(Boolean).map((s) => ({ key: s.key, name: s.name, title: s.title })),
    events: [{ type: 'sent', by: actor.id, ip: meta.ip, agent: meta.agent, note: `${channel} mail` }],
  });

  if (kind === 'issue') {
    // Nothing for them to sign: issued now — certificate page, fingerprint, emailed.
    rec.status = 'issued';
    rec.issuedAt = now;
    const cert = await certificatePdf(rec, { employeeName: nameOf(employee), signatories: rec.companySignatories });
    const final = await withCertificate(pdf, cert);
    rec.signedPdf = final;
    rec.signedHash = sha256(final);
    rec.events.push({ type: 'issued', by: actor.id });
    await rec.save();
    await keepSignedCopy(doc._id, final, `${rec.templateKey || 'document'}-issued.pdf`);
    await mailFinal(rec, employee, final);
  } else {
    await rec.save();
    await mailSignRequest(rec, employee, token);
  }
  return shape(rec);
}

// The signed (or issued) PDF becomes the document's signed copy — only when
// it has none (a paper copy uploaded earlier is never replaced).
async function keepSignedCopy(docId, pdf, filename) {
  await GeneratedDocument.updateOne(
    { _id: docId, $or: [{ signedFile: null }, { 'signedFile.contentType': { $exists: false } }] },
    { $set: { signedFile: { data: pdf, contentType: 'application/pdf', filename } } }
  );
}

async function loadRecord(id) {
  const rec = await DocumentSignature.findById(id);
  if (!rec) throw ApiError.notFound('Not found');
  return rec;
}

async function remind(actor, id) {
  const rec = await loadRecord(id);
  if (!OPEN.includes(rec.status)) throw ApiError.conflict('Only a document waiting to be signed can be sent again');
  const employee = await Employee.findById(rec.employee);
  const token = newToken();
  rec.tokenHash = sha256(token);
  rec.tokenExpiresAt = new Date(Date.now() + LINK_DAYS * 86400000);
  rec.events.push({ type: 'reminded', by: actor.id });
  await rec.save();
  await mailSignRequest(rec, employee, token);
  return shape(rec);
}

async function cancel(actor, id, { reason } = {}) {
  const rec = await loadRecord(id);
  if (!OPEN.includes(rec.status)) throw ApiError.conflict('Only a document waiting to be signed can be withdrawn');
  rec.status = 'cancelled';
  rec.cancelledAt = new Date();
  rec.cancelledBy = actor.id;
  rec.cancelReason = String(reason || '').trim() || 'Withdrawn';
  rec.tokenHash = undefined;
  rec.appTokenHash = undefined;
  rec.sessionHash = undefined;
  rec.events.push({ type: 'cancelled', by: actor.id, note: rec.cancelReason });
  await rec.save();
  return shape(rec);
}

// ---------------------------------------------------------------- reading

function shape(rec) {
  return {
    _id: idOf(rec._id),
    document: idOf(rec.document),
    employee: idOf(rec.employee),
    title: rec.title,
    templateKey: rec.templateKey,
    kind: rec.kind,
    status: rec.status,
    code: rec.code,
    channel: rec.channel,
    email: rec.email,
    sentAt: rec.sentAt,
    viewedAt: rec.viewedAt || null,
    codeVerifiedAt: rec.codeVerifiedAt || null,
    signedAt: rec.signedAt || null,
    issuedAt: rec.issuedAt || null,
    signerName: rec.signerName || null,
    declinedAt: rec.declinedAt || null,
    declineReason: rec.declineReason || null,
    cancelledAt: rec.cancelledAt || null,
    cancelReason: rec.cancelReason || null,
    tokenExpiresAt: rec.tokenExpiresAt || null,
    originalHash: rec.originalHash,
    signedHash: rec.signedHash || null,
    verifyUrl: `${env.publicAppUrl}/verify/${rec.code}`,
  };
}

const canHandleDocs = (user) => can(user, ACCESS.EMS_ALL) || (user.permissions || []).includes(PERMISSIONS.GENERATE_DOCUMENTS);
const isOwn = (user, rec) => Boolean(user.employeeLink) && idOf(user.employeeLink) === idOf(rec.employee);

async function listForEmployee(user, employeeId) {
  if (!canHandleDocs(user) && idOf(user.employeeLink) !== String(employeeId)) throw ApiError.forbidden();
  const list = await DocumentSignature.find({ employee: employeeId }).sort({ createdAt: -1 });
  return list.map(shape);
}

async function fileFor(user, id) {
  const rec = await DocumentSignature.findById(id).select('+signedPdf +sentPdf');
  if (!rec) throw ApiError.notFound('Not found');
  if (!canHandleDocs(user) && !isOwn(user, rec)) throw ApiError.forbidden();
  const final = FINAL.includes(rec.status);
  if (!final && !canHandleDocs(user)) throw ApiError.forbidden('Sign it first — the signed copy is yours once it is signed');
  return { pdf: final ? rec.signedPdf : rec.sentPdf, filename: `${rec.templateKey || 'document'}-${rec.code}${final ? '' : '-unsigned'}.pdf` };
}

// The employee opening it from EMS: a short-lived link of its own.
async function openMine(user, id) {
  const rec = await loadRecord(id);
  if (!isOwn(user, rec)) throw ApiError.forbidden();
  if (!OPEN.includes(rec.status)) throw ApiError.conflict('This document is no longer waiting for your signature');
  const token = newToken();
  rec.appTokenHash = sha256(token);
  rec.appTokenExpiresAt = new Date(Date.now() + 60 * 60000);
  await rec.save();
  return { token };
}

// ---------------------------------------------------------------- the employee: signing (public, by link)

async function byToken(token) {
  const h = sha256(String(token || ''));
  const rec = await DocumentSignature.findOne({ $or: [{ tokenHash: h }, { appTokenHash: h, appTokenExpiresAt: { $gt: new Date() } }] });
  if (!rec) throw ApiError.notFound('This link is not valid — it may have been replaced by a newer one. Ask HR to send it again.');
  if (rec.status === 'sent' || rec.status === 'viewed') {
    const viaApp = rec.appTokenHash === h;
    if (!viaApp && rec.tokenExpiresAt && rec.tokenExpiresAt < new Date()) throw ApiError.badRequest('This link has expired. Ask HR to send it again.');
  }
  return rec;
}

function assertSession(rec, session) {
  if (!session || !rec.sessionHash || rec.sessionHash !== sha256(session) || !rec.sessionExpiresAt || rec.sessionExpiresAt < new Date()) {
    throw ApiError.forbidden('Confirm the code we emailed you first');
  }
}

async function view(token, meta = {}) {
  const rec = await byToken(token);
  const employee = await Employee.findById(rec.employee).select('firstName lastName');
  if (OPEN.includes(rec.status) && !rec.viewedAt) {
    rec.viewedAt = new Date();
    rec.status = 'viewed';
    rec.events.push({ type: 'viewed', ip: meta.ip, agent: meta.agent });
    await rec.save();
  }
  return {
    title: rec.title,
    company: COMPANY,
    firstName: employee?.firstName || '',
    status: rec.status,
    email: maskEmail(rec.email),
    code: FINAL.includes(rec.status) ? rec.code : null,
    signedAt: rec.signedAt || null,
    expiresAt: rec.tokenExpiresAt || null,
    consent: CONSENT,
  };
}

async function sendCode(token, meta = {}) {
  const rec = await byToken(token);
  if (!OPEN.includes(rec.status) && rec.status !== 'signed') throw ApiError.conflict('This document is not waiting for a signature');
  if (rec.otp?.sentAt && Date.now() - new Date(rec.otp.sentAt).getTime() < CODE_RESEND_SECONDS * 1000) {
    throw ApiError.badRequest('A code was just sent — wait a few seconds before asking again');
  }
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  rec.otp = { hash: hmac(`${rec._id}:${code}`), expiresAt: new Date(Date.now() + CODE_MINUTES * 60000), attempts: 0, sentAt: new Date() };
  rec.events.push({ type: 'code_sent', ip: meta.ip, agent: meta.agent });
  await rec.save();
  await sendEmail({
    to: rec.email,
    subject: `Your signing code: ${code}`,
    html: wrap(`<p>Your one-time code to open <strong>${esc(rec.title)}</strong> is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It works for ${CODE_MINUTES} minutes. Don't share it with anyone.</p>`),
  });
  return { sentTo: maskEmail(rec.email), expiresInMinutes: CODE_MINUTES };
}

async function verifyCode(token, code, meta = {}) {
  const rec = await byToken(token);
  if (!OPEN.includes(rec.status) && rec.status !== 'signed') throw ApiError.conflict('This document is not waiting for a signature');
  const otp = rec.otp || {};
  if (!otp.hash || !otp.expiresAt || otp.expiresAt < new Date()) throw ApiError.badRequest('The code has expired — ask for a new one');
  if ((otp.attempts || 0) >= CODE_TRIES) throw ApiError.badRequest('Too many wrong codes — ask for a new one');
  if (hmac(`${rec._id}:${String(code || '').trim()}`) !== otp.hash) {
    rec.otp.attempts = (otp.attempts || 0) + 1;
    rec.events.push({ type: 'code_failed', ip: meta.ip, agent: meta.agent });
    await rec.save();
    throw ApiError.badRequest(`That code isn't right — ${CODE_TRIES - rec.otp.attempts} tries left`);
  }
  const session = newToken();
  rec.otp = { attempts: 0 };
  rec.sessionHash = sha256(session);
  rec.sessionExpiresAt = new Date(Date.now() + SESSION_MINUTES * 60000);
  rec.codeVerifiedAt = new Date();
  rec.events.push({ type: 'code_verified', ip: meta.ip, agent: meta.agent });
  await rec.save();
  return { session, expiresInMinutes: SESSION_MINUTES };
}

async function publicFile(token, session) {
  const rec = await byToken(token);
  assertSession(rec, session);
  const full = await DocumentSignature.findById(rec._id).select('+sentPdf +signedPdf');
  const final = FINAL.includes(full.status);
  return { pdf: final ? full.signedPdf : full.sentPdf, filename: `${full.templateKey || 'document'}${final ? '-signed' : ''}.pdf` };
}

function signatureImage(dataUrl) {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw ApiError.badRequest('Draw or type your signature');
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length < 200) throw ApiError.badRequest('Draw or type your signature');
  if (buf.length > 400 * 1024) throw ApiError.badRequest('The signature image is too large');
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw ApiError.badRequest('The signature has to be an image');
  return buf;
}

async function sign(token, { session, name, signature, consent } = {}, meta = {}) {
  const rec0 = await byToken(token);
  assertSession(rec0, session);
  if (!OPEN.includes(rec0.status)) throw ApiError.conflict('This document is not waiting for a signature');
  if (consent !== true) throw ApiError.badRequest('Tick the box to agree to sign electronically');
  const signerName = String(name || '').trim().replace(/\s+/g, ' ');
  if (signerName.length < 3) throw ApiError.badRequest('Type your full name');
  const image = signatureImage(signature);

  const rec = await DocumentSignature.findById(rec0._id).select('+html');
  const employee = await Employee.findById(rec.employee).select('firstName lastName');
  const at = new Date();
  const dataUrl = `data:image/png;base64,${image.toString('base64')}`;
  const { html } = applySignatures(rec.html, { employee: { dataUrl, name: signerName, at } });
  const signedBody = await renderPdfFromHtml(html, env.templatesHtmlDir);

  rec.status = 'signed';
  rec.signedAt = at;
  rec.signerName = signerName;
  rec.signatureImage = image;
  rec.signerIp = meta.ip || '';
  rec.signerAgent = meta.agent || '';
  rec.consentText = CONSENT;
  const cert = await certificatePdf(rec, { employeeName: nameOf(employee), signatureDataUrl: dataUrl, signatories: rec.companySignatories });
  const final = await withCertificate(signedBody, cert);
  rec.signedPdf = final;
  rec.signedHash = sha256(final);
  rec.appTokenHash = undefined;
  rec.events.push({ type: 'signed', ip: meta.ip, agent: meta.agent });
  await rec.save();

  await keepSignedCopy(rec.document, final, `${rec.templateKey || 'document'}-signed.pdf`);
  try {
    await mailFinal(rec, employee, final);
  } catch (err) {
    logger.warn({ err: err.message }, 'Mailing the signed copy failed');
  }
  await notifySender(rec, NOTIFICATION_TYPES.DOCUMENT_SIGNED, `${nameOf(employee)} signed ${rec.title}`, `Signed electronically on ${fmtStamp(at)}. The signed copy is in their documents.`);
  return { status: 'signed', code: rec.code, verifyUrl: `${env.publicAppUrl}/verify/${rec.code}` };
}

async function decline(token, { session, reason } = {}, meta = {}) {
  const rec = await byToken(token);
  assertSession(rec, session);
  if (!OPEN.includes(rec.status)) throw ApiError.conflict('This document is not waiting for a signature');
  const why = String(reason || '').trim();
  if (!why) throw ApiError.badRequest('Tell HR why you are not signing it');
  rec.status = 'declined';
  rec.declinedAt = new Date();
  rec.declineReason = why.slice(0, 1000);
  rec.appTokenHash = undefined;
  rec.sessionHash = undefined;
  rec.events.push({ type: 'declined', ip: meta.ip, agent: meta.agent, note: rec.declineReason });
  await rec.save();
  const employee = await Employee.findById(rec.employee).select('firstName lastName');
  await notifySender(rec, NOTIFICATION_TYPES.DOCUMENT_DECLINED, `${nameOf(employee)} didn't sign ${rec.title}`, rec.declineReason);
  return { status: 'declined' };
}

async function notifySender(rec, type, title, message) {
  if (!rec.sentBy) return;
  try {
    await require('./notification.service').createForUsers([rec.sentBy], { type, title, message, employee: rec.employee });
  } catch (err) {
    logger.warn({ err: err.message }, 'E-sign notification failed');
  }
}

// ---------------------------------------------------------------- verification (public)

async function verifyByCode(code) {
  const rec = await DocumentSignature.findOne({ code: String(code || '').trim().toUpperCase() });
  if (!rec) return { found: false };
  const employee = await Employee.findById(rec.employee).select('firstName lastName');
  return {
    found: true,
    code: rec.code,
    title: rec.title,
    company: COMPANY,
    issuedTo: nameOf(employee),
    kind: rec.kind,
    status: rec.status,
    signedAt: rec.signedAt || null,
    issuedAt: rec.issuedAt || null,
    signerName: rec.signerName || null,
    sentAt: rec.sentAt,
    companySignatories: rec.companySignatories || [],
    originalHash: rec.originalHash,
    signedHash: rec.signedHash || null,
  };
}

async function verifyUpload(buffer) {
  if (!buffer?.length) throw ApiError.badRequest('Choose the PDF to check');
  const hash = sha256(buffer);
  const signed = await DocumentSignature.findOne({ signedHash: hash });
  if (signed) return { hash, match: signed.kind === 'issue' ? 'issued' : 'signed', record: await verifyByCode(signed.code) };
  const sent = await DocumentSignature.findOne({ originalHash: hash });
  if (sent) return { hash, match: 'as_sent', record: await verifyByCode(sent.code) };
  return { hash, match: 'none' };
}

// Is this document tied to an e-signing that must be kept?
async function blocksDelete(docId) {
  return Boolean(await DocumentSignature.exists({ document: docId, status: { $in: ['sent', 'viewed', 'signed', 'issued'] } }));
}

module.exports = {
  getSettings,
  setSignatory,
  withCompanySignatures,
  applySignatures,
  hasEmployeeSpot,
  send,
  remind,
  cancel,
  listForEmployee,
  fileFor,
  openMine,
  view,
  sendCode,
  verifyCode,
  publicFile,
  sign,
  decline,
  verifyByCode,
  verifyUpload,
  blocksDelete,
  CONSENT,
};
