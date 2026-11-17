import { Student, AssessmentStudent, Attempt, UserSession } from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import { audit } from "../services/audit.service.js";
export async function list(req, res) {
  res.json(
    await Student.find({ createdBy: req.user.id })
      .sort({ createdAt: -1 })
      .limit(5000),
  );
}
export async function create(req, res) {
  const student = await Student.create({
      ...req.body,
      uid: req.body.uid.toUpperCase(),
      createdBy: req.user.id,
    });
  await audit(req, "STUDENT_REGISTERED", "Student registered", { targetType: "Student", targetId: String(student._id), metadata: { uid: student.uid, section: student.section } });
  res.status(201).json(student);
}
export async function createMany(req, res) {
  const students = req.body.students.map((student) => ({
    ...student,
    uid: student.uid.toUpperCase(),
    createdBy: req.user.id,
  }));
  const normalizedUids = students.map((student) => student.uid);
  const duplicatesInUpload = [...new Set(normalizedUids.filter((uid, index) => normalizedUids.indexOf(uid) !== index))];
  const existing = await Student.find({ uid: { $in: normalizedUids } }).select("uid").lean();
  const duplicatesInDatabase = existing.map((student) => student.uid);
  const duplicates = [...new Set([...duplicatesInUpload, ...duplicatesInDatabase])];
  if (duplicates.length)
    throw new ApiError(409, `These UIDs already exist or repeat in the upload: ${duplicates.join(", ")}`);
  const inserted = await Student.insertMany(students, { ordered: true });
  await audit(req, "STUDENTS_REGISTERED_BULK", "Students registered in bulk", { metadata: { count: inserted.length } });
  res.status(201).json(inserted);
}
export async function update(req, res) {
  const s = await Student.findOneAndUpdate(
    { _id: req.params.id, createdBy: req.user.id },
    { $set: { ...req.body, uid: req.body.uid.toUpperCase() } },
    { new: true, runValidators: true },
  );
  if (!s) throw new ApiError(404, "Student not found");
  if (req.body.status === "INACTIVE") await UserSession.deleteMany({ userType: "STUDENT", userId: String(s._id) });
  await audit(req, "STUDENT_UPDATED", "Student record updated", { targetType: "Student", targetId: String(s._id), metadata: { fields: Object.keys(req.body) } });
  res.json(s);
}
export async function remove(req, res) {
  const s = await Student.findOne({
    _id: req.params.id,
    createdBy: req.user.id,
  });
  if (!s) throw new ApiError(404, "Student not found");
  if (await Attempt.exists({ student: s._id }))
    throw new ApiError(
      409,
      "Student has assessment history; deactivate instead",
    );
  await AssessmentStudent.deleteMany({ student: s._id });
  await UserSession.deleteMany({ userType: "STUDENT", userId: String(s._id) });
  await s.deleteOne();
  await audit(req, "STUDENT_DELETED", "Student record deleted", { targetType: "Student", targetId: String(s._id) });
  res.json({ success: true });
}
