import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  Assessment,
  Question,
  Student,
  AssessmentStudent,
  Attempt,
  ProctorEvent,
} from "../models/index.js";
import { ownAssessment } from "../services/assessment.service.js";
import { emitAssessment } from "../services/realtime.service.js";
import { closeAttempt } from "../services/attemptLifecycle.service.js";
import { gradeAttempt } from "../services/grading.service.js";
import ApiError from "../utils/ApiError.js";
async function payload(body, user) {
  const qs = await Question.find({
    _id: { $in: body.questionIds },
    createdBy: user.id,
  }).lean();
  if (qs.length !== new Set(body.questionIds).size)
    throw new ApiError(422, "Question unavailable");
  const questions = body.questionIds.map((id) =>
    qs.find((q) => String(q._id) === id),
  );
  if (new Set(body.questionIds).size !== body.questionIds.length)
    throw new ApiError(422, "Duplicate questions");
  if (
    questions.some((q) =>
      body.type === "QUIZ"
        ? q.type === "CODING"
        : body.type === "CODING"
          ? q.type !== "CODING"
          : false,
    )
  )
    throw new ApiError(422, "Question types do not match assessment type");
  const { questionIds, ...rest } = body;
  return {
    ...rest,
    questions,
    totalMarks: questions.reduce(
      (s, q) =>
        s +
        q.marks +
        (body.aiEnabled && q.type === "CODING"
          ? q.qualityMarks + q.efficiencyMarks
          : 0),
      0,
    ),
  };
}
export async function list(req, res) {
  if (req.user.role === "TEACHER")
    return res.json(
      await Assessment.find({ createdBy: req.user.id })
        .select("-questions")
        .sort({ createdAt: -1 }),
    );
  const a = await Assessment.findById(req.user.assessmentId).select(
    "-questions",
  );
  res.json(a ? [a] : []);
}
export async function get(req, res) {
  if (req.user.role === "TEACHER")
    return res.json(await ownAssessment(req.params.id, req.user));
  if (req.params.id !== req.user.assessmentId)
    throw new ApiError(403, "Access denied");
  res.json(await Assessment.findById(req.params.id).select("-questions"));
}
export async function create(req, res) {
  res.status(201).json(
    await Assessment.create({
      ...(await payload(req.body, req.user)),
      createdBy: req.user.id,
    }),
  );
}
export async function update(req, res) {
  const p = await payload(req.body, req.user);
  const a = await Assessment.findOneAndUpdate(
    {
      _id: req.params.id,
      createdBy: req.user.id,
      status: { $in: ["DRAFT", "SCHEDULED"] },
    },
    { $set: p, $inc: { revision: 1 } },
    { new: true },
  );
  if (!a)
    throw new ApiError(
      409,
      "Only drafts and scheduled assessments can be edited",
    );
  res.json(a);
}
export async function assign(req, res) {
  const body = z
    .object({
      studentIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).default([]),
      course: z.string().optional(),
      section: z.string().optional(),
    })
    .parse(req.body);
  let count = 0;
  await mongoose.connection.transaction(async (session) => {
    const a = await Assessment.findOneAndUpdate(
      {
        _id: req.params.id,
        createdBy: req.user.id,
        status: { $in: ["DRAFT", "SCHEDULED"] },
      },
      { $inc: { revision: 1 } },
      { session, new: true },
    );
    if (!a)
      throw new ApiError(
        409,
        "Assignment requires a draft or scheduled assessment",
      );
    const filters = [
      ...(body.studentIds.length ? [{ _id: { $in: body.studentIds } }] : []),
      ...(body.course || body.section
        ? [
            {
              ...(body.course ? { course: body.course } : {}),
              ...(body.section ? { section: body.section } : {}),
            },
          ]
        : []),
    ];
    const students = filters.length
      ? await Student.find({ createdBy: req.user.id, $or: filters }).session(
          session,
        )
      : [];
    await AssessmentStudent.deleteMany({ assessment: a._id }).session(session);
    if (students.length)
      await AssessmentStudent.insertMany(
        students.map((s) => ({ assessment: a._id, student: s._id })),
        { session },
      );
    count = students.length;
  });
  res.json({ assigned: count });
}
export async function assignments(req, res) {
  await ownAssessment(req.params.id, req.user);
  res.json(
    await AssessmentStudent.find({ assessment: req.params.id }).populate(
      "student",
    ),
  );
}
export async function accessCode(req, res) {
  const code = randomBytes(9).toString("base64url");
  const hash = await bcrypt.hash(code, 12);
  const a = await Assessment.findOneAndUpdate(
    {
      _id: req.params.id,
      createdBy: req.user.id,
      status: { $in: ["DRAFT", "SCHEDULED"] },
    },
    { $set: { accessCodeHash: hash } },
  );
  if (!a) throw new ApiError(409, "Generate access code before starting");
  res.json({ accessCode: code, assessmentId: a._id });
}
export async function start(req, res) {
  let a;
  await mongoose.connection.transaction(async (session) => {
    a = await ownAssessment(req.params.id, req.user, session);
    if (
      !["DRAFT", "SCHEDULED"].includes(a.status) ||
      !a.questions.length ||
      !(await Assessment.findById(a._id)
        .select("+accessCodeHash")
        .session(session)
        .then((x) => x.accessCodeHash)) ||
      !(await AssessmentStudent.exists({ assessment: a._id }).session(session))
    )
      throw new ApiError(
        409,
        "Add questions, assign students and generate an access code first",
      );
    if (a.startTime && a.startTime > new Date())
      throw new ApiError(409, "Scheduled start time has not arrived");
    if (a.endTime && a.endTime <= new Date())
      throw new ApiError(409, "End time has passed");
    a.status = "LIVE";
    a.revision++;
    await a.save({ session });
  });
  emitAssessment(a, "ASSESSMENT_STARTED", { assessmentId: a._id });
  res.json(a);
}
export async function end(req, res) {
  let a,
    ids = [];
  await mongoose.connection.transaction(async (session) => {
    a = await ownAssessment(req.params.id, req.user, session);
    if (a.status !== "LIVE") throw new ApiError(409, "Assessment is not live");
    a.status = "ENDED";
    a.revision++;
    await a.save({ session });
    const ts = await Attempt.find({
      assessment: a._id,
      status: "ACTIVE",
    }).session(session);
    ids = [];
    for (const t of ts) {
      await closeAttempt(t, a, "SUBMITTED", session);
      await t.save({ session });
      ids.push(t._id);
    }
  });
  for (const id of ids) await gradeAttempt(id);
  emitAssessment(a, "ASSESSMENT_ENDED", { assessmentId: a._id });
  res.json(a);
}
export async function publish(req, res) {
  const { publishResults } = z
    .object({ publishResults: z.boolean() })
    .parse(req.body);
  const a = await ownAssessment(req.params.id, req.user);
  a.publishResults = publishResults;
  await a.save();
  res.json(a);
}
export async function monitor(req, res) {
  const assessment = await ownAssessment(req.params.id, req.user);
  const assignments = await AssessmentStudent.find({
    assessment: req.params.id,
  }).populate("student");
  const attempts = await Attempt.find({ assessment: req.params.id }).select(
    "-answers",
  );
  const latestEvents = await ProctorEvent.aggregate([
    { $match: { assessmentId: assessment._id } },
    { $sort: { timestamp: -1 } },
    {
      $group: {
        _id: "$attemptId",
        eventType: { $first: "$eventType" },
        timestamp: { $first: "$timestamp" },
      },
    },
  ]);
  res.json(
    assignments
      .filter((x) => x.student)
      .map((x) => ({
        student: x.student,
        maxWarnings: assessment.securitySettings.maxWarnings,
        lastEvent:
          latestEvents.find(
            (e) =>
              String(e._id) ===
              String(
                attempts.find(
                  (t) => String(t.student) === String(x.student._id),
                )?._id,
              ),
          ) || null,
        attempt:
          attempts.find((t) => String(t.student) === String(x.student._id)) ||
          null,
      })),
  );
}
export async function eventLog(req, res) {
  const t = await Attempt.findById(req.params.id);
  if (!t) throw new ApiError(404, "Attempt unavailable");
  await ownAssessment(t.assessment, req.user);
  res.json(
    await ProctorEvent.find({ attemptId: t._id })
      .sort({ timestamp: 1 })
      .limit(5000),
  );
}
