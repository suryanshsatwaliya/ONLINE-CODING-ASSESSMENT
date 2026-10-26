import { useState } from "react";
import { Link } from "react-router-dom";
import ExamWorkspace from "../../components/assessment/ExamWorkspace";
import Modal from "../../components/common/Modal";
import Button from "../../components/common/Button";

const assessment = {
  title: "Data Structures & Algorithms", type: "MIXED", duration: 30,
  securitySettings: { requireFullscreen: false, maxWarnings: 3 },
  questions: [
    { _id: "preview-1", title: "Which data structure follows the Last In, First Out (LIFO) principle?", type: "SINGLE", marks: 2, options: ["Queue", "Stack", "Linked list", "Binary tree"] },
    { _id: "preview-2", title: "What is the time complexity of merge sort in the worst case?", type: "SINGLE", marks: 2, options: ["O(n²)", "O(n log n)", "O(log n)", "O(n)"] },
    { _id: "preview-3", title: "Which of these algorithms use a divide-and-conquer approach?", type: "MULTIPLE", marks: 4, options: ["Merge sort", "Linear search", "Quick sort", "Binary search"] },
    { _id: "preview-4", title: "Explain when you would choose a linked list over an array.", type: "SHORT", marks: 5, options: [] },
    { _id: "preview-5", title: "Which traversal visits a binary search tree in sorted order?", type: "SINGLE", marks: 2, options: ["Preorder", "Inorder", "Postorder", "Level order"] },
    { _id: "preview-6", title: "Sum of two numbers", description: "Read two integers from standard input and print their sum.", type: "CODING", marks: 10, options: [], supportedLanguages: ["python", "javascript"], starterCode: { python: "a, b = map(int, input().split())\n# Print the sum below\n", javascript: "const fs = require('fs');\nconst [a, b] = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\n// Print the sum below\n" }, inputFormat: "Two space-separated integers.", outputFormat: "Their sum as an integer.", examples: [{ input: "2 3", output: "5" }], testCases: [{ input: "2 3", expectedOutput: "5", hidden: false }], constraints: "-1000 <= a, b <= 1000", timeLimit: 2, memoryLimit: 128000 },
  ],
};
export default function ExamPreview() {
  const [answers, setAnswers] = useState({ "preview-1": { value: [1], marked: false } });
  const [current, setCurrent] = useState(1), [review, setReview] = useState(false);
  function change(value, marked) {
    const id = assessment.questions[current]._id;
    setAnswers((old) => ({ ...old, [id]: { value, marked: marked ?? old[id]?.marked ?? false } }));
  }
  return <div className="exam-preview-page">
    <div className="exam-preview-banner"><span><strong>INTERFACE PREVIEW</strong> · Try answers and question navigation. No real attempt is created.</span><Link to="/teacher/dashboard">Back to dashboard →</Link></div>
    <ExamWorkspace assessment={assessment} attempt={{ warningCount: 0, optionOrders: {} }} name="Alex Morgan" seconds={1425} connected answers={answers} current={current} onNavigate={setCurrent} change={change} status="Saved" flush={async () => {}} onSubmit={() => setReview(true)} preview>
      {review && <Modal title="Preview complete" onClose={() => setReview(false)}><p>In a real assessment, students confirm submission here before their saved answers are sent for grading. This preview does not submit anything.</p><Button onClick={() => setReview(false)}>Continue exploring</Button></Modal>}
    </ExamWorkspace>
  </div>;
}
