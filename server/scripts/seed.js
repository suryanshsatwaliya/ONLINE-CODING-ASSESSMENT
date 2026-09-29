import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { connectDB } from "../src/config/db.js";
import { Teacher, Student, Question } from "../src/models/index.js";
import { questionSchema } from "../src/validators/assessment.validator.js";
if (!env.SEED_TEACHER_PASSWORD || env.SEED_TEACHER_PASSWORD.length < 12)
  throw new Error("Set SEED_TEACHER_PASSWORD to at least 12 characters");
await connectDB();
const email = (env.SEED_TEACHER_EMAIL || "teacher@example.com").toLowerCase();
let t = await Teacher.findOne({ email });
if (!t)
  t = await Teacher.create({
    name: env.SEED_TEACHER_NAME || "Assessment Admin",
    email,
    passwordHash: await bcrypt.hash(env.SEED_TEACHER_PASSWORD, 12),
  });
await Student.updateOne(
  { uid: "24BCS12345" },
  {
    $setOnInsert: {
      name: "Rahul Sharma",
      course: "BE CSE",
      section: "24BCS-802",
      status: "ACTIVE",
      createdBy: t._id,
    },
  },
  { upsert: true },
);
if (!(await Question.exists({ createdBy: t._id }))) {
  await Question.create({
    createdBy: t._id,
    ...questionSchema.parse({
      title: "Binary search",
      question:
        "What is the worst-case time complexity of binary search on a sorted array?",
      type: "SINGLE",
      marks: 10,
      options: ["O(n)", "O(log n)", "O(n²)", "O(1)"],
      correctAnswer: [1],
      explanation: "Each step halves the search space.",
    }),
  });
  await Question.create({
    createdBy: t._id,
    ...questionSchema.parse({
      title: "Sum two integers",
      type: "CODING",
      marks: 40,
      description: "Read two integers and print their sum.",
      constraints: "-1000000 ≤ a, b ≤ 1000000",
      inputFormat: "Two space-separated integers.",
      outputFormat: "One integer: their sum.",
      examples: [{ input: "2 3", output: "5" }],
      starterCode: {
        python: "a, b = map(int, input().split())\n# Print their sum\n",
        javascript:
          "const fs = require('fs');\nconst [a,b] = fs.readFileSync(0,'utf8').trim().split(/\\s+/).map(Number);\n",
        cpp: "#include <iostream>\nint main(){ long a,b; std::cin>>a>>b; }",
        c: '#include <stdio.h>\nint main(){ long a,b; scanf("%ld %ld", &a, &b); return 0; }',
        java: "import java.util.*;\npublic class Main { public static void main(String[] args){ Scanner s=new Scanner(System.in); long a=s.nextLong(),b=s.nextLong(); } }",
      },
      testCases: [
        { input: "2 3", expectedOutput: "5", hidden: false, weight: 1 },
        { input: "-4 9", expectedOutput: "5", hidden: true, weight: 1 },
        { input: "0 0", expectedOutput: "0", hidden: true, weight: 1 },
        {
          input: "1000000 1000000",
          expectedOutput: "2000000",
          hidden: true,
          weight: 2,
        },
      ],
    }),
  });
}
console.log(
  "Seed complete. Teacher: " +
    email +
    "; sample student UID: 24BCS12345. Existing password unchanged.",
);
await mongoose.disconnect();
