import test from "node:test";
import assert from "node:assert/strict";
import { examSections } from "../../client/src/utils/examSections.js";

test("mixed sections preserve original indexes and randomized order within each type", () => {
  const questions = [{ type: "CODING" }, { type: "SHORT" }, { type: "CODING" }, { type: "SINGLE" }, { type: "MULTIPLE" }];
  const sections = examSections(questions);
  assert.deepEqual(sections.map((s) => [s.label, s.indexes]), [["Quiz", [1, 3, 4]], ["Coding", [0, 2]]]);
  const navigation = sections.flatMap((s) => s.indexes);
  assert.equal(new Set(navigation).size, questions.length);
  assert.equal(navigation[navigation.indexOf(4) + 1], 0);
  assert.deepEqual(examSections([{ type: "CODING" }]).map((s) => s.id), ["coding"]);
  assert.deepEqual(examSections([]), []);
});
