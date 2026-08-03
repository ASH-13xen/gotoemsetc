const { encrypt, decrypt, isEncrypted } = require('./secretCrypto');

// Extra Details is a freeform key/value list (HR types whatever key name
// they want), so there's no schema-level way to mark a value sensitive —
// this matches on the key itself. Anything named like a password (COMPANY
// MAIL PASSWORD, etc.) gets encrypted at rest; every other key stays plain
// text exactly as before.
function isPasswordKey(key) {
  return typeof key === 'string' && /password/i.test(key);
}

function encryptList(list) {
  if (!Array.isArray(list)) return list;
  for (const detail of list) {
    if (detail && isPasswordKey(detail.key) && detail.value && !isEncrypted(detail.value)) {
      detail.value = encrypt(detail.value);
    }
  }
  return list;
}

function decryptDoc(doc) {
  if (!doc || !Array.isArray(doc.extraDetails)) return;
  for (const detail of doc.extraDetails) {
    if (detail && isEncrypted(detail.value)) {
      detail.value = decrypt(detail.value);
    }
  }
}

// Wires encrypt-on-write / decrypt-on-read hooks for a schema's
// `extraDetails` array onto the schema in one call — used by both Employee
// and Client, whose extraDetails follow the identical freeform shape.
function attachExtraDetailsEncryption(schema) {
  schema.pre('save', async function encryptExtraDetailsOnSave() {
    if (this.isModified('extraDetails')) encryptList(this.extraDetails);
  });

  // create()/save() cover normal writes, but repositories in this codebase
  // update via findOneAndUpdate — Mongoose auto-wraps a plain (non-operator)
  // update object into $set, but the wrapping may or may not have happened
  // yet by the time this hook runs depending on Mongoose version, so both
  // shapes are checked.
  schema.pre('findOneAndUpdate', async function encryptExtraDetailsOnUpdate() {
    const update = this.getUpdate() || {};
    if (update.extraDetails) encryptList(update.extraDetails);
    if (update.$set && update.$set.extraDetails) encryptList(update.$set.extraDetails);
  });

  schema.post(['find'], function decryptExtraDetailsOnFind(docs) {
    for (const doc of docs) decryptDoc(doc);
  });

  schema.post(['findOne', 'findOneAndUpdate'], function decryptExtraDetailsOnFindOne(doc) {
    decryptDoc(doc);
  });
}

module.exports = { attachExtraDetailsEncryption, isPasswordKey };
