import { recordEvent } from "../services/proctor.service.js";
export async function create(req, res) {
  res.json(await recordEvent(req.user, req.body));
}
