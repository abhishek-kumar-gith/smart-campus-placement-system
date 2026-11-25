const { Schema, model } = require('mongoose');

const revisionHistorySchema = new Schema({
  revisionNumber: { type: Number, required: true, min: 1 },
  changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  changedAt: { type: Date, default: Date.now },
  remarks: { type: String, trim: true, maxlength: 1000, default: '' },
}, { _id: false });

const statusHistorySchema = new Schema({
  status: {
    type: String,
    enum: ['generated', 'issued', 'accepted', 'rejected', 'expired', 'revoked'],
    required: true,
  },
  changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  changedByRole: { type: String, enum: ['student', 'recruiter', 'admin'], required: true },
  changedAt: { type: Date, default: Date.now },
  remarks: { type: String, trim: true, maxlength: 1000, default: '' },
}, { _id: false });

const offerLetterSchema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, immutable: true },
  applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true, immutable: true },
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, immutable: true },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, immutable: true },
  recruiterId: { type: Schema.Types.ObjectId, ref: 'Recruiter', required: true, immutable: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  offerLetterNumber: { type: String, required: true, trim: true, immutable: true },
  designation: { type: String, required: true, trim: true },
  annualCtc: { type: Number, min: 0, required: true },
  monthlyStipend: { type: Number, min: 0, default: 0 },
  jobLocation: { type: String, trim: true, default: '' },
  reportingDetails: { type: String, trim: true, maxlength: 2000, default: '' },
  termsAndConditions: { type: String, trim: true, maxlength: 10000, default: '' },
  authorizedSignatory: { type: String, trim: true, maxlength: 200, default: '' },
  offerDate: { type: Date, required: true },
  joiningDate: { type: Date, default: null },
  employmentType: {
    type: String,
    enum: ['Full-time', 'Internship', 'Contract'],
    default: 'Full-time',
  },
  privatePdf: {
    storedFileName: { type: String, required: true, trim: true },
    originalFileName: { type: String, required: true, trim: true },
    fileSize: { type: Number, min: 0, required: true },
  },
  status: {
    type: String,
    enum: ['generated', 'issued', 'accepted', 'rejected', 'expired', 'revoked'],
    default: 'generated',
  },
  statusHistory: { type: [statusHistorySchema], default: [] },
  revisionHistory: { type: [revisionHistorySchema], default: [] },
}, { timestamps: true });

offerLetterSchema.index(
  { applicationId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['generated', 'issued', 'accepted'] },
    },
  },
);
offerLetterSchema.index({ studentId: 1, status: 1, createdAt: -1 });
offerLetterSchema.index({ companyId: 1, status: 1, createdAt: -1 });
offerLetterSchema.index({ offerLetterNumber: 1 }, { unique: true });

module.exports = model('OfferLetter', offerLetterSchema);
