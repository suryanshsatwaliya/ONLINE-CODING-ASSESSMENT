import { Student, AssessmentStudent, Attempt } from "../models/index.js";
import ApiError from "../utils/ApiError.js";
export async function list(req, res) {
  res.json(
    await Student.find({ createdBy: req.user.id })
      .sort({ createdAt: -1 })
      .limit(5000),
  );
}
export async function create(req, res) {
  res.status(201).json(
    await Student.create({
      ...req.body,
      uid: req.body.uid.toUpperCase(),
      createdBy: req.user.id,
    }),
  );
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
  res.status(201).json(await Student.insertMany(students, { ordered: true }));
}
export async function update(req, res) {
  const s = await Student.findOneAndUpdate(
    { _id: req.params.id, createdBy: req.user.id },
    { $set: { ...req.body, uid: req.body.uid.toUpperCase() } },
    { new: true, runValidators: true },
  );
  if (!s) throw new ApiError(404, "Student not found");
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
  await s.deleteOne();
  res.json({ success: true });
}
