const { Schema, model } = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const statusHistorySchema = new Schema({
  status: { type: String, required: true },
  changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  changedByRole: String,
  reason: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const applicationSchema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  status: {
    type: String,
    enum: ['applied', 'shortlisted', 'interview', 'selected', 'placed', 'rejected', 'withdrawn'],
    default: 'applied',
  },
  statusHistory: [statusHistorySchema],
  skillMatchScore: { type: Number, default: 0, min: 0, max: 100 },
  matchedSkills: [{ type: String }],
  missingSkills: [{ type: String }],
  isEligible: { type: Boolean, default: true },
  eligibilityDetails: {
    passed: { type: Boolean, default: true },
    reasons: [String],
  },
  coverLetter: { type: String, default: '' },
  appliedAt: { type: Date, default: Date.now },
}, { timestamps: true });

applicationSchema.index({ studentId: 1, jobId: 1 }, { unique: true });
applicationSchema.index({ status: 1 });
applicationSchema.index({ companyId: 1 });
applicationSchema.index({ jobId: 1 });
applicationSchema.index({ studentId: 1 });

applicationSchema.plugin(mongoosePaginate);

module.exports = model('Application', applicationSchema);
