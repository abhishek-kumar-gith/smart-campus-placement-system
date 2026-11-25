const { Schema, model } = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const approvalHistorySchema = new Schema({
  previousStatus: { type: String, enum: ['active', 'inactive', 'pending'], required: true },
  newStatus: { type: String, enum: ['active', 'inactive', 'pending'], required: true },
  action: { type: String, enum: ['approved', 'rejected', 'pending', 'other'], required: true },
  changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  changedByRole: { type: String, enum: ['admin', 'recruiter', 'student'], required: true },
  remarks: { type: String, trim: true, maxlength: 1000, default: '' },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const companySchema = new Schema({
  name: { type: String, required: [true, 'Company name is required'], unique: true, trim: true },
  logo: { type: String, default: null },
  website: { type: String, default: '' },
  industry: { type: String, required: [true, 'Industry is required'] },
  location: { type: String, required: [true, 'Location is required'] },
  description: { type: String, default: '' },
  hrName: { type: String, required: [true, 'HR name is required'] },
  hrEmail: { type: String, required: [true, 'HR email is required'], lowercase: true },
  contactNumber: { type: String, required: [true, 'Contact number is required'] },
  status: { type: String, enum: ['active', 'inactive', 'pending'], default: 'pending' },
  addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  approvalHistory: { type: [approvalHistorySchema], default: [] },
}, { timestamps: true });

companySchema.index({ status: 1 });
companySchema.index({ industry: 1 });

companySchema.plugin(mongoosePaginate);

module.exports = model('Company', companySchema);
