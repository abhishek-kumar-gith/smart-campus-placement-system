const { Schema, model } = require('mongoose');

const interviewSchema = new Schema({
  applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true, unique: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  mode: { type: String, enum: ['Online', 'On-campus', 'Offline'], default: 'Online' },
  round: { type: String, required: true, trim: true },
  scheduledAt: { type: Date, required: true },
  venue: { type: String, default: '' },
  meetingLink: { type: String, default: '' },
  instructions: { type: String, default: '' },
  rescheduleHistory: [{
    previousScheduledAt: Date,
    newScheduledAt: Date,
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
  }],
  status: { type: String, enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'], default: 'scheduled' },
  feedback: { type: String, default: '' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

interviewSchema.index({ studentId: 1 });
interviewSchema.index({ companyId: 1 });
interviewSchema.index({ scheduledAt: 1 });

module.exports = model('Interview', interviewSchema);
