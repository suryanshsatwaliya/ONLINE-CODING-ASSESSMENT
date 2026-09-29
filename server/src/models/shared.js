import mongoose from "mongoose";
export const { Schema } = mongoose;
export const ref = (name) => ({
  type: Schema.Types.ObjectId,
  ref: name,
  required: true,
});
export const model = (name, fields, indexes = []) => {
  const s = new Schema(fields, { timestamps: true });
  for (const [keys, options] of indexes) s.index(keys, options);
  return mongoose.models[name] || mongoose.model(name, s);
};
