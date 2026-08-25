const { Schema, model } = require('mongoose');
const { CMS_PLAN } = require('../config/constants');

// The single client registry, shared by Task Management and the Client
// Management System. Started as Task Management's own lightweight list
// (name + logo) alongside a separate CRM Client model; that model was removed
// in the CMS rebuild and its useful fields — brand, contacts, location — were
// folded in here rather than duplicated, so a client's phone number lives in
// exactly one place.
const contactSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    // Exactly one contact should carry this; not enforced in the schema
    // because a client with no contacts yet is a legitimate mid-onboarding
    // state — taskClient.service.js normalises it instead.
    isPrimary: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const locationSchema = new Schema(
  {
    addressLine: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    pincode: { type: String, trim: true },
  },
  { _id: false }
);

// One open-ended entry per stretch of time a WorkTeam owned this client —
// `endedAt: null` marks whichever entry is current. Written by
// taskClient.service.js#updateTaskClient whenever `defaultTeam` actually
// changes, never by hand — this is what lets the client manual (see
// clientManual.service.js) say "switched teams on August 15" at exact-date
// granularity, independent of ClientCalendar's per-month team snapshot.
const teamHistoryEntrySchema = new Schema(
  {
    team: { type: Schema.Types.ObjectId, ref: 'WorkTeam', required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const taskClientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    brandName: { type: String, trim: true },
    logoUrl: { type: String },

    contacts: [contactSchema],
    location: locationSchema,
    instagramHandle: { type: String, trim: true },
    website: { type: String, trim: true },

    // The client manual's page 2 — as long as needed, no length cap.
    aboutBrand: { type: String, trim: true },
    aboutClient: { type: String, trim: true },
    // The client manual's page 1 — what this client expects from the team.
    expectations: { type: String, trim: true },

    // The team that handles this client's work — auto-selected (editable)
    // when a Client task is created for this client, and snapshotted onto
    // each ClientCalendar at creation so a later team change doesn't rewrite
    // a month already in progress.
    defaultTeam: { type: Schema.Types.ObjectId, ref: 'WorkTeam', default: null },
    teamHistory: [teamHistoryEntrySchema],

    // The plan currently sold to this client. Also snapshotted onto each
    // ClientCalendar — this field is "what they're on now", the snapshot is
    // "what this month was committed at".
    currentPlan: { type: String, enum: [...Object.values(CMS_PLAN), null], default: null },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = model('TaskClient', taskClientSchema);
