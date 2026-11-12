const mongoose = require('mongoose');

// Simple auto-increment counter used to generate Student_id
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 }
  },
  { collection: 'counters', versionKey: false }
);

module.exports = mongoose.model('Counter', counterSchema);
