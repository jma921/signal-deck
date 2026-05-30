import { expect, test } from "bun:test";
import { isLoopbackRequest } from "./localOnly";

test("local-only guard allows loopback hosts and request IPs", () => {
  expect(isLoopbackRequest(new Request("http://127.0.0.1:3000/api/settings"))).toBe(true);
  expect(isLoopbackRequest(new Request("http://example.test/api/settings", {
    headers: { host: "localhost:3000" },
  }))).toBe(true);
  expect(isLoopbackRequest(new Request("http://example.test/api/settings"), "::ffff:127.0.0.1")).toBe(true);
});

test("local-only guard rejects non-loopback requests", () => {
  expect(isLoopbackRequest(new Request("http://192.168.1.20:3000/api/settings"), "192.168.1.20")).toBe(false);
});
