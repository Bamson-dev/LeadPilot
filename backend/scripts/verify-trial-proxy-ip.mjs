#!/usr/bin/env node
/**
 * Verifies origin/proxy IPs are treated as infrastructure so the
 * www → /backend rewrite cannot exhaust the shared trial IP cap.
 */
process.env.RATE_LIMIT_WINDOW_MS = "60000";
process.env.RATE_LIMIT_MAX = "30";

const { clientIp, isInfrastructureIp } = await import("../src/middleware/rate-limit.ts");

function mockReq(headers = {}, extras = {}) {
  return {
    ip: extras.ip ?? "10.0.1.2",
    headers,
    socket: { remoteAddress: extras.socket ?? "10.0.1.2" },
    body: extras.body ?? {},
  };
}

const proxyReq = mockReq({
  "cf-connecting-ip": "167.86.106.198",
  "x-real-ip": "172.68.110.41",
  "x-forwarded-for": "172.68.110.41",
});
const proxyWithVisitor = mockReq({
  "cf-connecting-ip": "167.86.106.198",
  "x-leadthur-client-ip": "102.219.155.27",
  "x-real-ip": "172.68.110.41",
  "x-forwarded-for": "172.68.110.41",
});
const directReq = mockReq({
  "cf-connecting-ip": "102.219.155.27",
  "x-real-ip": "141.101.98.25",
  "x-forwarded-for": "141.101.98.25",
});
const spoofedDirect = mockReq({
  "cf-connecting-ip": "102.219.155.27",
  "x-leadthur-client-ip": "1.2.3.4",
});

const report = {
  originIsInfrastructure: isInfrastructureIp("167.86.106.198"),
  privateIsInfrastructure: isInfrastructureIp("10.0.1.2"),
  publicIsNotInfrastructure: !isInfrastructureIp("102.219.155.27"),
  proxyResolvesToOrigin: clientIp(proxyReq) === "167.86.106.198",
  proxySkipsSharedCap: isInfrastructureIp(clientIp(proxyReq)),
  proxyUsesVisitorHeader: clientIp(proxyWithVisitor) === "102.219.155.27",
  directUsesRealIp: clientIp(directReq) === "102.219.155.27",
  spoofedHeaderIgnoredOnDirect: clientIp(spoofedDirect) === "102.219.155.27",
};

console.log(JSON.stringify(report, null, 2));
const pass = Object.values(report).every(Boolean);
process.exit(pass ? 0 : 1);
