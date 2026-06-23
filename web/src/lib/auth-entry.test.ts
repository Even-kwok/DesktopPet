import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSignedOutAuthModeHref,
  resolveSignedOutAuthMode
} from "./auth-entry.ts";

test("signed-out auth entry defaults to login mode", () => {
  assert.equal(resolveSignedOutAuthMode(undefined), "login");
  assert.equal(resolveSignedOutAuthMode("register"), "register");
  assert.equal(resolveSignedOutAuthMode("login"), "login");
  assert.equal(resolveSignedOutAuthMode("anything-else"), "login");
});

test("signed-out auth entry keeps next when switching modes", () => {
  assert.equal(buildSignedOutAuthModeHref("register", "/"), "/?auth=register");
  assert.equal(
    buildSignedOutAuthModeHref("register", "/pets?tab=billing"),
    "/?auth=register&next=%2Fpets%3Ftab%3Dbilling"
  );
  assert.equal(buildSignedOutAuthModeHref("login", "/admin"), "/?auth=login&next=%2Fadmin");
});
