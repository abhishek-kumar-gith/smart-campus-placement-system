const { Schema, model } = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const projectSchema = new Schema({
  title: { type: String, required: true },
  description: String,
  technologies: [String],
  link: String,
  startDate: Date,
  endDate: Date,
}, { _id: true });

const internshipSchema = new Schema({
  company: { type: String, required: true },
  role: { type: String, required: true },
  duration: String,
  description: String,
  startDate: Date,
  endDate: Date,
}, { _id: true });

const certificationSchema = new Schema({
  name: { type: String, required: true },
  issuer: String,
  issueDate: Date,
  credentialId: String,
  credentialUrl: String,
}, { _id: true });

const placementStatusHistorySchema = new Schema({
  previousStatus: { type: String, required: true },
  newStatus: { type: String, required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedAt: { type: Date, default: Date.now },
  reason: { type: String, default: '' },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null },
  placementDetails: { type: String, default: '' },
  package: { type: Number, default: 0 },
}, { _id: true });

const studentSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  fullName: { type: String, required: [true, 'Full name is required'], trim: true },
  rollNumber: { type: String, required: [true, 'Roll number is required'], unique: true, uppercase: true, trim: true },
  phone: { type: String, required: [true, 'Phone number is required'] },
  profilePhotoUrl: { type: String, default: '' },
  branch: {
    type: String,
    enum: [
      'CSE', 'IT', 'ECE', 'EEE', 'ME', 'CE', 'Other',
      'Agriculture', 'Biotechnology', 'Chemical Engineering', 'Textile Engineering',
      'Aerospace Engineering', 'Biomedical Engineering', 'Food Technology',
      'Environmental Engineering', 'Petroleum Engineering',
      'Civil Engineering', 'Electrical Engineering', 'Mechanical Engineering',
      'Metallurgical Engineering', 'Instrumentation Engineering', 'Manufacturing Engineering',
    ],
    required: true,
  },
  degree: { type: String, enum: ['B.Tech', 'B.E.', 'M.Tech', 'MCA', 'BCA', 'Other'], required: true },
  currentSemester: { type: Number, min: 1, max: 8, required: true },
  cgpa: { type: Number, min: 0, max: 10, required: [true, 'CGPA is required'] },
  graduationYear: { type: Number, required: true },
  backlogs: {
    count: { type: Number, default: 0, min: 0 },
    details: { type: String, default: '' },
  },
  skills: [{ type: String, lowercase: true, trim: true }],
  projects: [projectSchema],
  internships: [internshipSchema],
  certifications: [certificationSchema],
  profileCompletion: { type: Number, default: 0, min: 0, max: 100 },
  placementStatus: { type: String, enum: ['unplaced', 'placed', 'opted-out', 'higher-studies', 'internship', 'not-interested', 'in-progress'], default: 'unplaced' },
  placementStatusHistory: [placementStatusHistorySchema],
  isProfileLocked: { type: Boolean, default: false },
}, { timestamps: true });

studentSchema.index({ branch: 1 });
studentSchema.index({ cgpa: 1 });
studentSchema.index({ graduationYear: 1 });
studentSchema.index({ placementStatus: 1 });

studentSchema.plugin(mongoosePaginate);

module.exports = model('Student', studentSchema);
