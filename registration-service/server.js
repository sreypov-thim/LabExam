require("dotenv").config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Student = require('./models/Student');
const Counter = require('./models/Counter');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/LabExam';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^\+?[0-9]{8,15}$/;

// Never send the password hash back to the client
const publicStudent = (s) => ({
  Student_id: s.Student_id,
  Student_name: s.Student_name,
  student_mobile: s.student_mobile,
  student_email: s.student_email
});

async function nextStudentId() {
  const counter = await Counter.findByIdAndUpdate(
    'Student_id',
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

app.get('/health', (req, res) => {
  res.json({ service: 'registration-service', status: 'UP' });
});

// POST /register  -> create a new student
app.post('/register', async (req, res) => {
  try {
    const { Student_name, student_mobile, student_email, student_password } = req.body || {};

    if (!Student_name || !student_mobile || !student_email || !student_password) {
      return res.status(400).json({
        message: 'Student_name, student_mobile, student_email and student_password are required'
      });
    }
    if (!EMAIL_RE.test(student_email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    if (!MOBILE_RE.test(String(student_mobile))) {
      return res.status(400).json({ message: 'Mobile number must be 8-15 digits (optional leading +)' });
    }
    if (String(student_password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const exists = await Student.findOne({ student_email: student_email.toLowerCase().trim() });
    if (exists) {
      return res.status(409).json({ message: 'A student with this email is already registered' });
    }

    const hashed = await bcrypt.hash(String(student_password), 10);
    const student = await Student.create({
      Student_id: await nextStudentId(),
      Student_name,
      student_mobile: String(student_mobile),
      student_email,
      student_password: hashed
    });

    res.status(201).json({
      message: 'Student registered successfully',
      student: publicStudent(student)
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ message: 'Duplicate student (id or email already exists)' });
    }
    console.error('Register error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /students  -> list all students (helps verify results; no passwords)
app.get('/students', async (req, res) => {
  try {
    const students = await Student.find().sort({ Student_id: 1 });
    res.json(students.map(publicStudent));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /students/:id  -> one student by Student_id
app.get('/students/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Student id must be a number' });
    const student = await Student.findOne({ Student_id: id });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json(publicStudent(student));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Connect to MongoDB (retry until it is reachable - useful inside Kubernetes)
async function connectWithRetry() {
  for (;;) {
    try {
      await mongoose.connect(MONGO_URI);
      console.log('Registration service connected to MongoDB');
      return;
    } catch (err) {
      console.error('MongoDB not ready, retrying in 3s:', err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

app.listen(PORT, () => console.log(`Registration service listening on port ${PORT}`));
connectWithRetry();
