const { Router } = require('express');
const { z } = require('zod');
const validate = require('../middlewares/validate.middleware');
const asyncHandler = require('../utils/asyncHandler');
const ActionAck = require('../models/ActionAck');
const AttendanceMismatch = require('../models/AttendanceMismatch');
const { requireAccess } = require('../middlewares/auth.middleware');
const { ACCESS } = require('../config/access');

// The Action centre's "Acknowledge" — per person, for anyone signed in. What
// a key names is up to the screen; nothing here acts on the item itself.
const router = Router();

const keys = { body: z.object({ keys: z.array(z.string().trim().min(1).max(120)).min(1).max(200) }) };

router.get(
  '/acks',
  asyncHandler(async (req, res) => {
    const acks = await ActionAck.find({ user: req.user.id }).select('key').lean();
    res.json({ keys: acks.map((a) => a.key) });
  })
);

router.post(
  '/acks',
  validate(keys),
  asyncHandler(async (req, res) => {
    await ActionAck.bulkWrite(
      req.body.keys.map((key) => ({
        updateOne: { filter: { user: req.user.id, key }, update: { $setOnInsert: { user: req.user.id, key, at: new Date() } }, upsert: true },
      }))
    );
    res.json({ acknowledged: req.body.keys });
  })
);

// "Bring back" — undoes an acknowledgement.
router.delete(
  '/acks',
  validate(keys),
  asyncHandler(async (req, res) => {
    await ActionAck.deleteMany({ user: req.user.id, key: { $in: req.body.keys } });
    res.json({ restored: req.body.keys });
  })
);

// Days whose scans told a different story from the approved request
// (attendanceClassifier.service.js#checkRequestDay) — for HR and the CEO,
// the last 30 days, newest first.
router.get(
  '/attendance-mismatches',
  requireAccess(ACCESS.HRMS, ACCESS.PAYOUT_APPROVAL),
  asyncHandler(async (req, res) => {
    const mismatches = await AttendanceMismatch.find({ updatedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })
      .sort({ date: -1 })
      .populate('employee', 'firstName lastName')
      .lean();
    res.json({ mismatches });
  })
);

module.exports = router;
