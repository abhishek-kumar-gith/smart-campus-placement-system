const { Schema, model } = require('mongoose');

const resumeSchema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  fileUrl: { type: String, required: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number },
  mimeType: { type: String, default: 'application/pdf' },
  parsedText: { type: String, select: false },
  extractedSkills: [{ type: String, lowercase: true, trim: true }],
  extractedEducation: [{
    institution: String,
    degree: String,
    year: String,
    cgpa: String,
  }],
  extractedProjects: [{
    title: String,
    technologies: [String],
    description: String,
  }],
  parsingStatus: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  parsingError: { type: String, default: '' },
  atsScore: { type: Number, default: 0 },
  lastParsedAt: { type: Date, default: null },
  isVerifiedByStudent: { type: Boolean, default: false },
  verifiedAt: { type: Date, default: null },
}, { timestamps: true });

resumeSchema.index({ userId: 1 });
resumeSchema.index({ parsingStatus: 1 });

module.exports = model('Resume', resumeSchema);
