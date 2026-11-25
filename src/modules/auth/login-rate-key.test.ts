import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  loginRateLimitKeys,
  normalizeUsername,
  resolveClientIp,
} from "./login-rate-key";

describe("resolveClientIp", () => {
  it("ignores X-Forwarded-For when the proxy is not trusted", () => {
    assert.equal(resolveClientIp("203.0.113.9", false), null);
  });

  it("uses the first hop when the proxy is trusted", () => {
    assert.equal(resolveClientIp("203.0.113.9, 10.0.0.1", true), "203.0.113.9");
  });

  it("returns null for missing or blank headers", () => {
    assert.equal(resolveClientIp(null, true), null);
    assert.equal(resolveClientIp(" , ", true), null);
  });
});

describe("normalizeUsername", () => {
  it("trims and lowercases", () => {
    assert.equal(normalizeUsername("  Ali.Khan "), "ali.khan");
  });
});

describe("loginRateLimitKeys", () => {
  it("always keys by normalized username, without an IP key when untrusted", () => {
    assert.deepEqual(loginRateLimitKeys({ username: " Ali ", ip: null }), ["login:user:ali"]);
  });

  it("adds an IP key only when an IP is available", () => {
    assert.deepEqual(loginRateLimitKeys({ username: "ali", ip: "10.0.0.5" }), [
      "login:user:ali",
      "login:ip:10.0.0.5",
    ]);
  });

  it("rotating X-Forwarded-For does not change the username key", () => {
    const a = loginRateLimitKeys({ username: "ali", ip: resolveClientIp("1.1.1.1", false) });
    const b = loginRateLimitKeys({ username: "ali", ip: resolveClientIp("2.2.2.2", false) });
    assert.deepEqual(a, b);
  });
});
