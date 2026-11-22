const { Schema, model } = require('mongoose');

const placementSchema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  applicationId: { type: Schema.Types.ObjectId, ref: 'Application', default: null },
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', default: null },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  package: { type: Number, default: 0, min: 0 },
  monthlyStipend: { type: Number, default: 0, min: 0 },
  jobLocation: { type: String, default: '' },
  jobRole: { type: String, default: '' },
  offerDate: { type: Date, default: null },
  joiningDate: { type: Date, default: null },
  confirmedAt: { type: Date, required: true, default: Date.now },
  confirmedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['placed', 'revoked'], default: 'placed' },
  placementDetails: { type: String, default: '' },
  revocationReason: { type: String, default: '' },
  revokedAt: { type: Date, default: null },
  revokedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

placementSchema.index({ studentId: 1 });
placementSchema.index({ companyId: 1 });
placementSchema.index({ applicationId: 1 }, { unique: true, partialFilterExpression: { applicationId: { $type: 'objectId' } } });
placementSchema.index({ status: 1, confirmedAt: -1 });

module.exports = model('Placement', placementSchema);
