import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import {
  DesktopPetSyncClient,
  DesktopPetSyncError,
  displayablePets,
  localMaterialReplacementDescriptions,
  safeRemoteMaterialPathComponent,
  syncedPetCardsFromBundle
} from "../src/shared/desktop-sync-client.ts";

async function withServer(
  handler: (request: IncomingMessage, body: string) => { status: number; body: unknown }
) {
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += String(chunk);
    });
    request.on("end", () => {
      const result = handler(request, body);
      response.writeHead(result.status, { "content-type": "application/json" });
      response.end(JSON.stringify(result.body));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.equal(typeof address, "object");
  assert.ok(address);
  const port = (address as AddressInfo).port;

  return {
    baseURL: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      })
  };
}

test("logs in and stores bearer-capable account response", async () => {
  const server = await withServer((request, body) => {
    assert.equal(request.url, "/api/desktop/auth/login");
    assert.equal(request.method, "POST");
    assert.deepEqual(JSON.parse(body), { email: "demo@desktop.pet", password: "123456" });
    return {
      status: 200,
      body: {
        mode: "mock",
        tokenType: "bearer",
        accessToken: "desktop-token",
        expiresIn: 3600,
        account: { id: "user_demo", name: "栗子主人", email: "demo@desktop.pet", credits: 120 }
      }
    };
  });

  try {
    const client = new DesktopPetSyncClient(server.baseURL);
    const login = await client.login("demo@desktop.pet", "123456");
    assert.equal(login.accessToken, "desktop-token");
    assert.equal(login.account.email, "demo@desktop.pet");
  } finally {
    await server.close();
  }
});

test("maps malformed login responses to invalid response", async () => {
  const server = await withServer(() => ({
    status: 200,
    body: {
      mode: "mock",
      tokenType: "bearer",
      expiresIn: 3600,
      account: { id: "user_demo", name: "栗子主人", email: "demo@desktop.pet", credits: "120" }
    }
  }));

  try {
    const client = new DesktopPetSyncClient(server.baseURL);

    await assert.rejects(
      client.login("demo@desktop.pet", "123456"),
      (error) =>
        error instanceof DesktopPetSyncError &&
        error.code === "invalidResponse" &&
        error.message === "桌面同步返回异常。"
    );
  } finally {
    await server.close();
  }
});

test("maps login responses with negative account credits to invalid response", async () => {
  const server = await withServer(() => ({
    status: 200,
    body: {
      mode: "mock",
      tokenType: "bearer",
      accessToken: "desktop-token",
      expiresIn: 3600,
      account: { id: "user_demo", name: "栗子主人", email: "demo@desktop.pet", credits: -1 }
    }
  }));

  try {
    const client = new DesktopPetSyncClient(server.baseURL);

    await assert.rejects(
      client.login("demo@desktop.pet", "123456"),
      (error) =>
        error instanceof DesktopPetSyncError &&
        error.code === "invalidResponse" &&
        error.message === "桌面同步返回异常。"
    );
  } finally {
    await server.close();
  }
});

test("maps login responses with empty account identity fields to invalid response", async () => {
  const malformedAccounts = [
    { id: " ", name: "栗子主人", email: "demo@desktop.pet" },
    { id: "user_demo", name: " ", email: "demo@desktop.pet" },
    { id: "user_demo", name: "栗子主人", email: " " }
  ];

  for (const account of malformedAccounts) {
    const server = await withServer(() => ({
      status: 200,
      body: {
        mode: "mock",
        tokenType: "bearer",
        accessToken: "desktop-token",
        expiresIn: 3600,
        account: { ...account, credits: 120 }
      }
    }));

    try {
      const client = new DesktopPetSyncClient(server.baseURL);

      await assert.rejects(
        client.login("demo@desktop.pet", "123456"),
        (error) =>
          error instanceof DesktopPetSyncError &&
          error.code === "invalidResponse" &&
          error.message === "桌面同步返回异常。"
      );
    } finally {
      await server.close();
    }
  }
});

test("maps login responses with negative token expiry to invalid response", async () => {
  const server = await withServer(() => ({
    status: 200,
    body: {
      mode: "mock",
      tokenType: "bearer",
      accessToken: "desktop-token",
      expiresIn: -1,
      account: { id: "user_demo", name: "栗子主人", email: "demo@desktop.pet", credits: 120 }
    }
  }));

  try {
    const client = new DesktopPetSyncClient(server.baseURL);

    await assert.rejects(
      client.login("demo@desktop.pet", "123456"),
      (error) =>
        error instanceof DesktopPetSyncError &&
        error.code === "invalidResponse" &&
        error.message === "桌面同步返回异常。"
    );
  } finally {
    await server.close();
  }
});

test("maps login responses with empty access tokens to invalid response", async () => {
  const server = await withServer(() => ({
    status: 200,
    body: {
      mode: "mock",
      tokenType: "bearer",
      accessToken: "",
      expiresIn: 3600,
      account: { id: "user_demo", name: "栗子主人", email: "demo@desktop.pet", credits: 120 }
    }
  }));

  try {
    const client = new DesktopPetSyncClient(server.baseURL);

    await assert.rejects(
      client.login("demo@desktop.pet", "123456"),
      (error) =>
        error instanceof DesktopPetSyncError &&
        error.code === "invalidResponse" &&
        error.message === "桌面同步返回异常。"
    );
  } finally {
    await server.close();
  }
});

test("maps login responses with unsupported token types to invalid response", async () => {
  const server = await withServer(() => ({
    status: 200,
    body: {
      mode: "mock",
      tokenType: "basic",
      accessToken: "desktop-token",
      expiresIn: 3600,
      account: { id: "user_demo", name: "栗子主人", email: "demo@desktop.pet", credits: 120 }
    }
  }));

  try {
    const client = new DesktopPetSyncClient(server.baseURL);

    await assert.rejects(
      client.login("demo@desktop.pet", "123456"),
      (error) =>
        error instanceof DesktopPetSyncError &&
        error.code === "invalidResponse" &&
        error.message === "桌面同步返回异常。"
    );
  } finally {
    await server.close();
  }
});

test("maps invalid login requests to Mac-parity invalid response copy", async () => {
  const server = await withServer(() => ({
    status: 400,
    body: { error: "INVALID_LOGIN_REQUEST" }
  }));

  try {
    const client = new DesktopPetSyncClient(server.baseURL);

    await assert.rejects(
      client.login("not-an-email", "123456"),
      (error) =>
        error instanceof DesktopPetSyncError &&
        error.code === "invalidResponse" &&
        error.message === "桌面同步返回异常。"
    );
  } finally {
    await server.close();
  }
});

test("fetches desktop bundle with bearer token and filters displayable pets", async () => {
  const server = await withServer((request) => {
    assert.equal(request.url, "/api/desktop/pets");
    assert.equal(request.headers.authorization, "Bearer desktop-token");
    return {
      status: 200,
      body: {
        version: 1,
        generatedAt: "2026-06-24T00:00:00.000Z",
        pets: [
          {
            id: "pet_local",
            name: "栗子",
            type: "cat",
            displayState: "active",
            materials: [
              {
                slot: "idle_loop",
                name: "待机循环",
                videoUrl: "https://example.com/idle.mp4",
                status: "ready"
              }
            ]
          },
          {
            id: "pet_away",
            name: "雪球",
            type: "cat",
            displayState: "unavailable",
            materials: [
              {
                slot: "idle_loop",
                name: "待机循环",
                videoUrl: "https://example.com/idle.mp4",
                status: "ready"
              }
            ]
          }
        ]
      }
    };
  });

  try {
    const client = new DesktopPetSyncClient(server.baseURL);
    const bundle = await client.fetchBundle("desktop-token");
    assert.equal(
      displayablePets(bundle)
        .map((pet) => pet.id)
        .join(","),
      "pet_local"
    );
  } finally {
    await server.close();
  }
});

test("maps malformed desktop bundle responses to invalid response", async () => {
  const server = await withServer(() => ({
    status: 200,
    body: {
      version: 1,
      generatedAt: "2026-06-24T00:00:00.000Z",
      pets: "not-a-list"
    }
  }));

  try {
    const client = new DesktopPetSyncClient(server.baseURL);

    await assert.rejects(
      client.fetchBundle("desktop-token"),
      (error) =>
        error instanceof DesktopPetSyncError &&
        error.code === "invalidResponse" &&
        error.message === "桌面同步返回异常。"
    );
  } finally {
    await server.close();
  }
});

test("maps desktop bundles with negative versions to invalid response", async () => {
  const server = await withServer(() => ({
    status: 200,
    body: {
      version: -1,
      generatedAt: "2026-06-24T00:00:00.000Z",
      pets: []
    }
  }));

  try {
    const client = new DesktopPetSyncClient(server.baseURL);

    await assert.rejects(
      client.fetchBundle("desktop-token"),
      (error) =>
        error instanceof DesktopPetSyncError &&
        error.code === "invalidResponse" &&
        error.message === "桌面同步返回异常。"
    );
  } finally {
    await server.close();
  }
});

test("maps desktop bundles with negative recommended polling intervals to invalid response", async () => {
  const server = await withServer(() => ({
    status: 200,
    body: {
      version: 1,
      generatedAt: "2026-06-24T00:00:00.000Z",
      sync: {
        mode: "desktop",
        source: "web",
        recommendedPollSeconds: -1
      },
      pets: []
    }
  }));

  try {
    const client = new DesktopPetSyncClient(server.baseURL);

    await assert.rejects(
      client.fetchBundle("desktop-token"),
      (error) =>
        error instanceof DesktopPetSyncError &&
        error.code === "invalidResponse" &&
        error.message === "桌面同步返回异常。"
    );
  } finally {
    await server.close();
  }
});

test("maps desktop bundles with empty account identity fields to invalid response", async () => {
  const malformedAccounts = [
    { id: " ", name: "栗子主人", email: "demo@desktop.pet" },
    { id: "user_demo", name: " ", email: "demo@desktop.pet" },
    { id: "user_demo", name: "栗子主人", email: " " }
  ];

  for (const account of malformedAccounts) {
    const server = await withServer(() => ({
      status: 200,
      body: {
        version: 1,
        generatedAt: "2026-06-24T00:00:00.000Z",
        account: { ...account, credits: 120 },
        pets: []
      }
    }));

    try {
      const client = new DesktopPetSyncClient(server.baseURL);

      await assert.rejects(
        client.fetchBundle("desktop-token"),
        (error) =>
          error instanceof DesktopPetSyncError &&
          error.code === "invalidResponse" &&
          error.message === "桌面同步返回异常。"
      );
    } finally {
      await server.close();
    }
  }
});

test("maps desktop bundles with empty pet identity fields to invalid response", async () => {
  const malformedPets = [
    { id: " ", name: "栗子" },
    { id: "pet_local", name: " " }
  ];

  for (const pet of malformedPets) {
    const server = await withServer(() => ({
      status: 200,
      body: {
        version: 1,
        generatedAt: "2026-06-24T00:00:00.000Z",
        pets: [
          {
            ...pet,
            type: "cat",
            materials: [
              {
                slot: "idle_loop",
                name: "待机循环",
                videoUrl: "https://example.com/idle.mp4",
                status: "ready"
              }
            ]
          }
        ]
      }
    }));

    try {
      const client = new DesktopPetSyncClient(server.baseURL);

      await assert.rejects(
        client.fetchBundle("desktop-token"),
        (error) =>
          error instanceof DesktopPetSyncError &&
          error.code === "invalidResponse" &&
          error.message === "桌面同步返回异常。"
      );
    } finally {
      await server.close();
    }
  }
});

test("maps desktop bundles with malformed material URLs to invalid response", async () => {
  const server = await withServer(() => ({
    status: 200,
    body: {
      version: 1,
      generatedAt: "2026-06-24T00:00:00.000Z",
      pets: [
        {
          id: "pet_local",
          name: "栗子",
          type: "cat",
          materials: [
            {
              slot: "idle_loop",
              name: "待机循环",
              videoUrl: "not a remote url",
              status: "ready"
            }
          ]
        }
      ]
    }
  }));

  try {
    const client = new DesktopPetSyncClient(server.baseURL);

    await assert.rejects(
      client.fetchBundle("desktop-token"),
      (error) =>
        error instanceof DesktopPetSyncError &&
        error.code === "invalidResponse" &&
        error.message === "桌面同步返回异常。"
    );
  } finally {
    await server.close();
  }
});

test("maps unauthorized bundle fetches to session expired", async () => {
  const server = await withServer(() => ({ status: 401, body: { error: "DESKTOP_AUTH_REQUIRED" } }));

  try {
    const client = new DesktopPetSyncClient(server.baseURL);

    await assert.rejects(
      client.fetchBundle("expired-token"),
      (error) =>
        error instanceof DesktopPetSyncError &&
        error.code === "sessionExpired" &&
        error.message === "登录已过期，请重新登录。"
    );
  } finally {
    await server.close();
  }
});

test("maps malformed friend list responses to invalid response", async () => {
  const server = await withServer(() => ({
    status: 200,
    body: {
      friends: [{ id: "friend_1", name: "阿雯", status: "在线", hostedPets: "one" }]
    }
  }));

  try {
    const client = new DesktopPetSyncClient(server.baseURL);

    await assert.rejects(
      client.fetchFriends("desktop-token"),
      (error) =>
        error instanceof DesktopPetSyncError &&
        error.code === "invalidResponse" &&
        error.message === "桌面同步返回异常。"
    );
  } finally {
    await server.close();
  }
});

test("maps friend list responses with empty friend identity fields to invalid response", async () => {
  const malformedFriends = [
    { id: " ", name: "阿雯" },
    { id: "friend_1", name: " " }
  ];

  for (const friend of malformedFriends) {
    const server = await withServer(() => ({
      status: 200,
      body: {
        friends: [{ ...friend, status: "在线", hostedPets: 1 }]
      }
    }));

    try {
      const client = new DesktopPetSyncClient(server.baseURL);

      await assert.rejects(
        client.fetchFriends("desktop-token"),
        (error) =>
          error instanceof DesktopPetSyncError &&
          error.code === "invalidResponse" &&
          error.message === "桌面同步返回异常。"
      );
    } finally {
      await server.close();
    }
  }
});

test("maps friend list responses with negative hosted-pet counts to invalid response", async () => {
  const server = await withServer(() => ({
    status: 200,
    body: {
      friends: [{ id: "friend_1", name: "阿雯", status: "在线", hostedPets: -1 }]
    }
  }));

  try {
    const client = new DesktopPetSyncClient(server.baseURL);

    await assert.rejects(
      client.fetchFriends("desktop-token"),
      (error) =>
        error instanceof DesktopPetSyncError &&
        error.code === "invalidResponse" &&
        error.message === "桌面同步返回异常。"
    );
  } finally {
    await server.close();
  }
});

test("maps malformed add-friend responses to invalid response", async () => {
  const server = await withServer(() => ({
    status: 200,
    body: {
      friend: { id: "friend_1", name: "阿雯", status: "在线", hostedPets: "one" }
    }
  }));

  try {
    const client = new DesktopPetSyncClient(server.baseURL);

    await assert.rejects(
      client.addFriend("friend@example.com", "desktop-token"),
      (error) =>
        error instanceof DesktopPetSyncError &&
        error.code === "invalidResponse" &&
        error.message === "桌面同步返回异常。"
    );
  } finally {
    await server.close();
  }
});

test("maps malformed remove-friend responses to invalid response", async () => {
  const server = await withServer(() => ({
    status: 200,
    body: { deletedFriendId: 123 }
  }));

  try {
    const client = new DesktopPetSyncClient(server.baseURL);

    await assert.rejects(
      client.removeFriend("friend_1", "desktop-token"),
      (error) =>
        error instanceof DesktopPetSyncError &&
        error.code === "invalidResponse" &&
        error.message === "桌面同步返回异常。"
    );
  } finally {
    await server.close();
  }
});

test("maps remove-friend responses with empty deleted friend IDs to invalid response", async () => {
  const server = await withServer(() => ({
    status: 200,
    body: { deletedFriendId: " " }
  }));

  try {
    const client = new DesktopPetSyncClient(server.baseURL);

    await assert.rejects(
      client.removeFriend("friend_1", "desktop-token"),
      (error) =>
        error instanceof DesktopPetSyncError &&
        error.code === "invalidResponse" &&
        error.message === "桌面同步返回异常。"
    );
  } finally {
    await server.close();
  }
});

test("maps malformed hosting request responses to invalid response", async () => {
  const server = await withServer(() => ({
    status: 200,
    body: {
      requestId: "request_1",
      status: "pending",
      petId: "pet_1",
      toUserId: 123
    }
  }));

  try {
    const client = new DesktopPetSyncClient(server.baseURL);

    await assert.rejects(
      client.requestHosting("pet_1", "user_friend", "desktop-token"),
      (error) =>
        error instanceof DesktopPetSyncError &&
        error.code === "invalidResponse" &&
        error.message === "桌面同步返回异常。"
    );
  } finally {
    await server.close();
  }
});

test("maps hosting request responses with empty action fields to invalid response", async () => {
  const malformedResponses = [
    { requestId: " ", status: "pending", petId: "pet_1", toUserId: "user_friend" },
    { requestId: "request_1", status: " ", petId: "pet_1", toUserId: "user_friend" },
    { requestId: "request_1", status: "pending", petId: " ", toUserId: "user_friend" },
    { requestId: "request_1", status: "pending", petId: "pet_1", toUserId: " " }
  ];

  for (const body of malformedResponses) {
    const server = await withServer(() => ({
      status: 200,
      body
    }));

    try {
      const client = new DesktopPetSyncClient(server.baseURL);

      await assert.rejects(
        client.requestHosting("pet_1", "user_friend", "desktop-token"),
        (error) =>
          error instanceof DesktopPetSyncError &&
          error.code === "invalidResponse" &&
          error.message === "桌面同步返回异常。"
      );
    } finally {
      await server.close();
    }
  }
});

test("maps malformed recall responses to invalid response", async () => {
  const server = await withServer(() => ({
    status: 200,
    body: {
      petId: "pet_1",
      status: 200
    }
  }));

  try {
    const client = new DesktopPetSyncClient(server.baseURL);

    await assert.rejects(
      client.recallPet("pet_1", "desktop-token"),
      (error) =>
        error instanceof DesktopPetSyncError &&
        error.code === "invalidResponse" &&
        error.message === "桌面同步返回异常。"
    );
  } finally {
    await server.close();
  }
});

test("maps recall responses with empty action fields to invalid response", async () => {
  const malformedResponses = [
    { petId: " ", status: "recalled" },
    { petId: "pet_1", status: " " }
  ];

  for (const body of malformedResponses) {
    const server = await withServer(() => ({
      status: 200,
      body
    }));

    try {
      const client = new DesktopPetSyncClient(server.baseURL);

      await assert.rejects(
        client.recallPet("pet_1", "desktop-token"),
        (error) =>
          error instanceof DesktopPetSyncError &&
          error.code === "invalidResponse" &&
          error.message === "桌面同步返回异常。"
      );
    } finally {
      await server.close();
    }
  }
});

test("describes local videos replaced by cloud sync", () => {
  const bundle = {
    version: 1,
    generatedAt: "2026-06-24T00:00:00.000Z",
    pets: [
      {
        id: "pet_orange",
        name: "栗子",
        type: "cat",
        displayState: "active",
        materials: [
          {
            slot: "idle_loop",
            name: "待机循环",
            videoUrl: "https://example.com/idle.mp4",
            status: "ready"
          }
        ]
      }
    ]
  } as const;

  const replacements = localMaterialReplacementDescriptions(bundle, (slot, petIndex) => {
    assert.equal(slot, "idle_loop");
    assert.equal(petIndex, 0);
    return "C:/local/idle.mp4";
  });

  assert.deepEqual(replacements, ["栗子 · 待机循环"]);
});

test("maps bundle pets to cached studio cards", () => {
  const cards = syncedPetCardsFromBundle({
    version: 1,
    generatedAt: "2026-06-24T00:00:00.000Z",
    pets: [
      {
        id: "pet_orange",
        petNumber: "CAT-001",
        name: "栗子",
        type: "cat",
        ownership: "owned",
        displayState: "active",
        materials: [
          {
            slot: "idle_loop",
            name: "待机循环",
            videoUrl: "https://example.com/idle.mp4",
            status: "ready"
          },
          {
            slot: "click_react",
            name: "点击反应",
            videoUrl: "https://example.com/click.mp4",
            status: "queued"
          },
          {
            slot: "drag_loop",
            name: "拖拽循环（备用）",
            videoUrl: "https://example.com/drag.mp4",
            status: "ready"
          },
          {
            slot: "look_at_camera",
            name: "看镜头",
            videoUrl: "https://example.com/look.mp4",
            status: "failed"
          }
        ]
      },
      {
        id: "pet_missing_number",
        name: "团子",
        type: "cat",
        materials: [
          {
            slot: "idle_loop",
            name: "待机循环",
            videoUrl: "https://example.com/second-idle.mp4",
            status: "ready"
          }
        ]
      }
    ]
  });

  assert.deepEqual(cards, [
    {
      id: "pet_orange",
      petNumber: "CAT-001",
      name: "栗子",
      ownership: "owned",
      displayState: "active",
      avatarUrl: undefined,
      materialCount: 3
    },
    {
      id: "pet_missing_number",
      petNumber: "pet_missing_number",
      name: "团子",
      ownership: "owned",
      displayState: "active",
      avatarUrl: undefined,
      materialCount: 1
    }
  ]);
  assert.equal(safeRemoteMaterialPathComponent("pet/demo:1"), "pet-demo-1");
});

test("keeps Unicode alphanumerics and one replacement per unsafe cache path character", () => {
  assert.equal(safeRemoteMaterialPathComponent("猫//栗子:1"), "猫--栗子-1");
  assert.equal(safeRemoteMaterialPathComponent("///"), "pet");
});
