const { Schema, model } = require('mongoose');
const { TASK_STAGE } = require('../config/constants');

// An append-only log for the Pipeline tab. Each row is either an auto-copy
// of a task labeled with a pipeline stage (sourceTask set, note snapshots the
// task's title) or a freeform "what I did" entry typed directly against a
// stage (sourceTask absent). Never updated in place except by the one-copy-
// per-task upsert in task.service.js.
const pipelineLogEntrySchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    stage: { type: String, enum: Object.values(TASK_STAGE), required: true },
    // Only set when stage === 'custom' — groups this entry under an "Others"
    // sub-section named after the label instead of one of the 7 fixed rows.
    customLabel: { type: String, trim: true },
    note: { type: String, required: true, trim: true },
    sourceTask: { type: Schema.Types.ObjectId, ref: 'Task' },
    taskDate: Date,
    loggedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

pipelineLogEntrySchema.index({ client: 1, stage: 1 });

module.exports = model('PipelineLogEntry', pipelineLogEntrySchema);
