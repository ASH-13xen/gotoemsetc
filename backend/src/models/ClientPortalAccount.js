const { Schema, model } = require('mongoose');

// The login+theme layer for the separate client-facing dashboard
// (clientdashboard/, its own Next.js app, its own hosting). Deliberately
// NOT folded into TaskClient itself — TaskClient is the shared client
// registry Task Management and the CMS both read/write, and stays that way
// (see TaskClient.js's own comment on why a second parallel "client"
// concept was removed rather than kept); this is purely the portal's own
// auth + branding, one row per client that's actually allowed to log in.
const clientPortalAccountSchema = new Schema(
  {
    taskClient: { type: Schema.Types.ObjectId, ref: 'TaskClient', required: true, unique: true },
    username: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    // Two-color theme the dashboard repaints itself in on login — plain hex,
    // no palette generation. logoUrl is intentionally NOT duplicated here;
    // the dashboard reads TaskClient.logoUrl directly and falls back to a
    // generated initials badge in these colors when it's unset.
    theme: {
      primaryColor: { type: String, required: true },
      secondaryColor: { type: String, required: true },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = model('ClientPortalAccount', clientPortalAccountSchema);
