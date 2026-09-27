import assert from "node:assert/strict";
import { test } from "node:test";

import type { DecisionResult } from "@/lib/types";

import { ALL_ROLE_KEYS, decideRole, distributionLine, roleName, welcomeMessage } from "./decide";

function result(probabilities: Record<string, number>, extra: Partial<DecisionResult> = {}): DecisionResult {
  const choice = Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0][0];
  return {
    choice,
    probabilities,
    confidence: 0.5,
    latencyMs: 120,
    serverLatencyMs: null,
    attempts: 1,
    model: "lora:circuit-vl-4b@test",
    requestedModel: "circuit-vl-4b",
    endpoint: "test",
    requestId: null,
    inputTokens: 600,
    outputTokens: 0,
    optionOrder: Object.keys(probabilities),
    request: {},
    raw: {},
    headers: {},
    mock: false,
    ...extra,
  };
}

const furry = result({ neckbeard: 0.04, stressed_dev: 0.06, femboy: 0.08, furry: 0.82 });
const flat = result({ neckbeard: 0.3, stressed_dev: 0.25, femboy: 0.25, furry: 0.2 });

test("the top option becomes the role when it clears the threshold", () => {
  const d = decideRole(furry, { defaultAvatar: false });
  assert.equal(d.key, "furry");
  assert.equal(d.reason, "decided");
});

test("below the threshold the member is Unclassifiable", () => {
  const d = decideRole(flat, { defaultAvatar: false });
  assert.equal(d.key, "unclassifiable");
  assert.equal(d.reason, "unsure");
});

test("a default Discord avatar is Unclassifiable without asking the model", () => {
  const d = decideRole(null, { defaultAvatar: true });
  assert.equal(d.key, "unclassifiable");
  assert.equal(d.reason, "default_avatar");
});

test("the threshold is configurable", () => {
  assert.equal(decideRole(flat, { defaultAvatar: false, minProbability: 0.25 }).key, "neckbeard");
});

test("five roles with names", () => {
  assert.deepEqual(ALL_ROLE_KEYS.map(roleName), ["Neckbeard", "Stressed Dev", "Femboy", "Furry", "Unclassifiable"]);
});

test("the welcome message carries the model's numbers unchanged", () => {
  const msg = welcomeMessage("123", decideRole(furry, { defaultAvatar: false }));
  assert.match(msg, /<@123>/);
  assert.match(msg, /\*\*FURRY\*\* \(82%\)/);
  assert.match(msg, /furry 82% · femboy 8% · stressed_dev 6% · neckbeard 4%/);
  assert.match(msg, /0 tokens generated/);
  assert.doesNotMatch(msg, /MOCK/);
});

test("mock results are labelled in the welcome message", () => {
  const msg = welcomeMessage("123", decideRole(result(furry.probabilities, { mock: true }), { defaultAvatar: false }));
  assert.match(msg, /MOCK MODE/);
});

test("unsure results name the best guess", () => {
  const msg = welcomeMessage("1", decideRole(flat, { defaultAvatar: false }));
  assert.match(msg, /UNCLASSIFIABLE/);
  assert.match(msg, /best guess neckbeard at only 30%/);
});

test("tiny probabilities are shown as <1%", () => {
  assert.match(distributionLine(result({ neckbeard: 0.995, stressed_dev: 0.003, femboy: 0.001, furry: 0.001 })), /stressed_dev <1%/);
});
