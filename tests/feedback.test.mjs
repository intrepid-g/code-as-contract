// Run: node tests/feedback.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const { issueUrl } = createRequire(import.meta.url)("../assets/feedback.js");

const bug = new URL(issueUrl("Bug", "  Broken link ", "Steps & more", "https://x.test/a.html#sec"));
assert.equal(bug.searchParams.get("template"), "feedback-bug.yml");
assert.equal(bug.searchParams.get("title"), "Broken link");
assert.equal(bug.searchParams.get("description"), "Steps & more");
assert.equal(bug.searchParams.get("page"), "https://x.test/a.html", "fragment dropped");
assert.equal(new URL(issueUrl("Improvement", "a", "", "")).searchParams.get("template"), "feedback-improvement.yml");

for (const [f, type] of [["feedback-bug.yml", "bug"], ["feedback-improvement.yml", "enhancement"]]) {
  const y = readFileSync(new URL(`../.github/ISSUE_TEMPLATE/${f}`, import.meta.url), "utf8");
  assert.match(y, new RegExp(`labels: \\[feedback, triage, ${type}\\]`), `${f} labels`);
  assert.match(y, /id: description/); assert.match(y, /id: page/);
}
console.log("feedback ok");
