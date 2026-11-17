import { test } from "node:test";
import assert from "node:assert/strict";
import { readCookie } from "../src/utils/adminCookies.js";

test("Master Admin cookie parsing handles encoded, quoted, and neighboring cookies", () => {
  assert.equal(
    readCookie("other=value; master_session=abc%2D123; master_csrf=csrf%3Dvalue", "master_session"),
    "abc-123",
  );
  assert.equal(readCookie('master_session="token-value"; another=x', "master_session"), "token-value");
  assert.equal(readCookie("other=value", "master_session"), undefined);
  assert.equal(readCookie(undefined, "master_session"), undefined);
});
