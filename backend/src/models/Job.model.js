const { Schema, model } = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const BRANCHES = [
  'CSE', 'IT', 'ECE', 'EEE', 'ME', 'CE', 'Other',
  'Agriculture', 'Biotechnology', 'Chemical Engineering', 'Textile Engineering',
  'Aerospace Engineering', 'Biomedical Engineering', 'Food Technology',
  'Environmental Engineering', 'Petroleum Engineering',
  'Civil Engineering', 'Electrical Engineering', 'Mechanical Engineering',
  'Metallurgical Engineering', 'Instrumentation Engineering', 'Manufacturing Engineering',
];

const jobSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdByRole: { type: String, enum: ['admin', 'recruiter'], required: true },
  title: { type: String, required: [true, 'Job title is required'], trim: true },
  description: { type: String, required: [true, 'Job description is required'] },
  location: { type: String, required: [true, 'Location is required'] },
  package: {
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
  },
  jobType: { type: String, enum: ['Full-time', 'Internship', 'Contract'], default: 'Full-time' },
  requiredExperience: { type: String, default: '' },
  requiredSkills: [{ type: String, lowercase: true, trim: true }],
  minCgpa: { type: Number, min: 0, max: 10, default: 0 },
  allowedBranches: [{ type: String, enum: BRANCHES }],
  targetGraduationYear: { type: Number, required: true },
  maxBacklogs: { type: Number, default: 0, min: 0 },
  targetSemester: { type: Number, min: 1, max: 8, default: null },
  allowedSemesters: [{ type: Number, min: 1, max: 8 }],
  vacancies: { type: Number, required: true, min: 1 },
  publishDate: { type: Date, default: null },
  applicationDeadline: { type: Date, required: true },
  approvalStatus: { type: String, enum: ['draft', 'pending', 'approved', 'rejected'], default: 'draft' },
  approvalNotes: { type: String, default: '' },
  isPublished: { type: Boolean, default: false },
  status: { type: String, enum: ['draft', 'pending', 'active', 'inactive', 'closed', 'cancelled'], default: 'draft' },
  publishedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  publishedAt: { type: Date, default: null },
  closedAt: { type: Date, default: null },
}, { timestamps: true });

jobSchema.index({ status: 1, isPublished: 1 });
jobSchema.index({ companyId: 1 });
jobSchema.index({ applicationDeadline: 1 });
jobSchema.index({ targetGraduationYear: 1 });
jobSchema.index({ approvalStatus: 1 });

jobSchema.plugin(mongoosePaginate);

module.exports = model('Job', jobSchema);
