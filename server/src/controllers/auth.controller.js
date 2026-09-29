import bcrypt from "bcrypt";
import {
  Teacher,
  Student,
  Assessment,
  AssessmentStudent,
} from "../models/index.js";
import { issueToken } from "../services/auth.service.js";
import ApiError from "../utils/ApiError.js";
export async function teacherLogin(req, res) {
  const t = await Teacher.findOne({
    email: req.body.email.toLowerCase(),
  }).select("+passwordHash");
  if (!t || !(await bcrypt.compare(req.body.password, t.passwordHash)))
    throw new ApiError(401, "Invalid email or password");
  res.json({
    token: issueToken({ id: String(t._id), role: "TEACHER" }),
    user: { id: t._id, name: t.name, email: t.email, role: "TEACHER" },
  });
}
export async function verifyStudent(req, res) {
  const s = await Student.findOne({
    uid: req.body.uid.trim().toUpperCase(),
    status: "ACTIVE",
  });
  if (!s) throw new ApiError(401, "Student unavailable. Contact your teacher.");
  res.json({ name: s.name, course: s.course, section: s.section });
}
export async function studentLogin(req, res) {
  const s = await Student.findOne({
    uid: req.body.uid.trim().toUpperCase(),
    status: "ACTIVE",
  });
  const a = await Assessment.findById(req.body.assessmentId).select(
    "+accessCodeHash",
  );
  if (
    !s ||
    !a ||
    !a.accessCodeHash ||
    !["SCHEDULED", "LIVE"].includes(a.status) ||
    !(await AssessmentStudent.exists({ student: s._id, assessment: a._id })) ||
    !(await bcrypt.compare(req.body.accessCode, a.accessCodeHash))
  )
    throw new ApiError(401, "Invalid assessment access details");
  res.json({
    token: issueToken({
      id: String(s._id),
      role: "STUDENT",
      assessmentId: String(a._id),
    }),
    user: {
      id: s._id,
      name: s.name,
      uid: s.uid,
      role: "STUDENT",
      assessmentId: a._id,
    },
  });
}
export const me = (req, res) => res.json(req.user);
