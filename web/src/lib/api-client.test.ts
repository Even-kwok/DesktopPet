import test from "node:test";
import assert from "node:assert/strict";
import { deletePet } from "./api-client.ts";

const originalFetch = globalThis.fetch;

test("deletePet posts to the stable delete action endpoint", async (t) => {
  const calls: Array<{ input: string | URL | Request; init?: RequestInit }> = [];

  globalThis.fetch = (async (input, init) => {
    calls.push({ input, init });

    return new Response(
      JSON.stringify({
        deletedPetId: "pet with space",
        deletedAssets: 0
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      }
    );
  }) as typeof fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await deletePet({
    petId: "pet with space",
    confirmation: "永久删除"
  });

  assert.deepEqual(result, {
    deletedPetId: "pet with space",
    deletedAssets: 0
  });
  assert.equal(calls[0]?.input, "/api/pets/pet%20with%20space/delete");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[0]?.init?.body, JSON.stringify({ confirmation: "永久删除" }));
});

test("deletePet converts fetch failures into a readable network message", async (t) => {
  globalThis.fetch = (async () => {
    throw new TypeError("Failed to fetch");
  }) as typeof fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  let caught: unknown;

  try {
    await deletePet({
      petId: "pet_orange",
      confirmation: "永久删除"
    });
  } catch (error) {
    caught = error;
  }

  assert.ok(caught instanceof Error);
  assert.match(caught.message, /网络请求失败/);
  assert.doesNotMatch(caught.message, /Failed to fetch/);
});
