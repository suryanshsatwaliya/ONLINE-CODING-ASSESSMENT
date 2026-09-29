import { model, Schema, ref } from "./shared.js";
export default model(
  "Course",
  { name: String, sections: [String], createdBy: ref("Teacher") },
  [],
);
