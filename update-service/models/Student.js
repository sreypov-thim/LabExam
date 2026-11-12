const mongoose = require('mongoose');

// Same schema / same "students" collection as the Registration service
const studentSchema = new mongoose.Schema(
  {
    Student_id: { type: Number, required: true, unique: true },
    Student_name: { type: String, required: true, trim: true },
    student_mobile: { type: String, required: true, trim: true },
    student_email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    student_password: { type: String, required: true } // bcrypt hash
  },
  { collection: 'LabExam', versionKey: false }
);

module.exports = mongoose.model('Student', studentSchema);
