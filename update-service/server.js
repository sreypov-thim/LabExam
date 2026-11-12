require("dotenv").config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Student = require('./models/Student');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/LabExam';

const MOBILE_RE = /^\+?[0-9]{8,15}$/;

const publicStudent = (s) => ({
  Student_id: s.Student_id,
  Student_name: s.Student_name,
  student_mobile: s.student_mobile,
  student_email: s.student_email
});

// Helpers ------------------------------------------------------------------
function parseId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: 'Student id must be a number' });
    return null;
  }
  return id;
}

async function changeMobile(student, student_mobile) {
  if (!student_mobile || !MOBILE_RE.test(String(student_mobile))) {
    return { status: 400, message: 'student_mobile must be 8-15 digits (optional leading +)' };
  }
  student.student_mobile = String(student_mobile);
  return null;
}

async function changePassword(student, old_password, new_password) {
  if (!old_password || !new_password) {
    return { status: 400, message: 'old_password and new_password are required' };
  }
  if (String(new_password).length < 6) {
    return { status: 400, message: 'New password must be at least 6 characters' };
  }
  const ok = await bcrypt.compare(String(old_password), student.student_password);
  if (!ok) {
    return { status: 401, message: 'Old password is incorrect' };
  }
  student.student_password = await bcrypt.hash(String(new_password), 10);
  return null;
}

// Routes -------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({ service: 'update-service', status: 'UP' });
});

// PUT /students/:id/mobile   body: { student_mobile }
app.put('/students/:id/mobile', async (req, res) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;
    const student = await Student.findOne({ Student_id: id });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const err = await changeMobile(student, (req.body || {}).student_mobile);
    if (err) return res.status(err.status).json({ message: err.message });

    await student.save();
    res.json({ message: 'Mobile number updated successfully', student: publicStudent(student) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /students/:id/password   body: { old_password, new_password }
app.put('/students/:id/password', async (req, res) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;
    const student = await Student.findOne({ Student_id: id });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const { old_password, new_password } = req.body || {};
    const err = await changePassword(student, old_password, new_password);
    if (err) return res.status(err.status).json({ message: err.message });

    await student.save();
    res.json({ message: 'Password updated successfully', student: publicStudent(student) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /students/:id   body: { student_mobile?, old_password?, new_password? }
// Lets a client update the mobile number and/or the password in one call.
app.patch('/students/:id', async (req, res) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;
    const body = req.body || {};
    const wantsMobile = body.student_mobile !== undefined;
    const wantsPassword = body.old_password !== undefined || body.new_password !== undefined;

    if (!wantsMobile && !wantsPassword) {
      return res.status(400).json({
        message: 'Provide student_mobile and/or old_password + new_password'
      });
    }

    const student = await Student.findOne({ Student_id: id });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Validate everything first so a failure never leaves a half-applied update
    if (wantsMobile) {
      const err = await changeMobile(student, body.student_mobile);
      if (err) return res.status(err.status).json({ message: err.message });
    }
    if (wantsPassword) {
      const err = await changePassword(student, body.old_password, body.new_password);
      if (err) return res.status(err.status).json({ message: err.message });
    }

    await student.save();
    res.json({ message: 'Student updated successfully', student: publicStudent(student) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

async function connectWithRetry() {
  for (;;) {
    try {
      await mongoose.connect(MONGO_URI);
      console.log('Update service connected to MongoDB');
      return;
    } catch (err) {
      console.error('MongoDB not ready, retrying in 3s:', err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

app.listen(PORT, () => console.log(`Update service listening on port ${PORT}`));
connectWithRetry();
