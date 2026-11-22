const { Schema, model } = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const recruiterSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  fullName: { type: String, required: [true, 'Full name is required'], trim: true },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null },
  designation: { type: String, required: [true, 'Designation is required'] },
  phone: { type: String, required: [true, 'Phone is required'] },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: '' },
}, { timestamps: true });

recruiterSchema.index({ companyId: 1 });
recruiterSchema.index({ approvalStatus: 1 });

recruiterSchema.plugin(mongoosePaginate);

module.exports = model('Recruiter', recruiterSchema);
