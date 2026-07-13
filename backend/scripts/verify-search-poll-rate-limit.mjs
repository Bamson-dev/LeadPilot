#!/usr/bin/env node
/**
 * Verifies search-poll rate limit scope allows dashboard-style polling.
 */
process.env.RATE_LIMIT_WINDOW_MS = "60000";
process.env.RATE_LIMIT_MAX = "30";
process.env.RATE_LIMIT_SEARCH_POLL_MAX = "180";
process.env.RATE_LIMIT_IP_ALLOWLIST = "";

const { rateLimit } = await import("../dist/middleware/rate-limit.js");

function mockReq(path, method = "GET") {
  return {
    ip: "198.51.100.50",
    method,
    originalUrl: path,
    path,
    headers: { "cf-connecting-ip": "198.51.100.50" },
  };
}

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

function hit(path, method = "GET") {
  const req = mockReq(path, method);
  const res = mockRes();
  let nextCalled = false;
  rateLimit(req, res, () => {
    nextCalled = true;
  });
  return { status: res.statusCode, nextCalled, body: res.body };
}

const searchId = "7793926b-2087-46b9-8e2f-bc2242b13081";
let pollOk = 0;
let pollBlocked = 0;
for (let i = 0; i < 60; i++) {
  const r = hit(`/search/results/${searchId}`);
  if (r.nextCalled) pollOk++;
  if (r.status === 429) pollBlocked++;
}

let postBlockedAt = null;
for (let i = 1; i <= 40; i++) {
  const r = hit("/search", "POST");
  if (r.status === 429) {
    postBlockedAt = i;
    break;
  }
}

const statusPoll = hit(`/search/${searchId}`);
const streamPoll = hit(`/search/${searchId}/stream`);

const report = {
  sixtyResultPollsAllowed: pollOk,
  sixtyResultPollsBlocked: pollBlocked,
  postSearchBlockedAtRequest: postBlockedAt,
  statusPollAllowed: statusPoll.nextCalled,
  streamPollAllowed: streamPoll.nextCalled,
};

console.log(JSON.stringify(report, null, 2));
const pass =
  pollOk === 60 &&
  pollBlocked === 0 &&
  postBlockedAt !== null &&
  postBlockedAt <= 31 &&
  statusPoll.nextCalled &&
  streamPoll.nextCalled;
process.exit(pass ? 0 : 1);
