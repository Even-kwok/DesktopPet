import test from "node:test";
import assert from "node:assert/strict";
import { initialCreditBalanceFromEnv } from "../account-credit-config.ts";

test("new Supabase accounts default to zero credits", () => {
  assert.equal(initialCreditBalanceFromEnv(undefined), 0);
  assert.equal(initialCreditBalanceFromEnv(""), 0);
});

test("initial account credits can be configured with a nonnegative integer", () => {
  assert.equal(initialCreditBalanceFromEnv("20"), 20);
  assert.equal(initialCreditBalanceFromEnv("001"), 1);
});

test("invalid initial account credit values fall back to zero", () => {
  assert.equal(initialCreditBalanceFromEnv("-1"), 0);
  assert.equal(initialCreditBalanceFromEnv("1.5"), 0);
  assert.equal(initialCreditBalanceFromEnv("abc"), 0);
});
