import { NextResponse } from "next/server";
import { z } from "zod";
import {
  addAccountFriend,
  listAccountFriends,
  removeAccountFriend
} from "@/lib/server/account-data-store";
import { getRequestAccount } from "@/lib/server/request-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const addFriendSchema = z.object({
  email: z.string().email()
});

const removeFriendSchema = z.object({
  friendId: z.string().min(1)
});

export async function GET(request: Request) {
  const account = await getRequestAccount(request);

  if (!account) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  return NextResponse.json({
    friends: await listAccountFriends(account)
  });
}

export async function POST(request: Request) {
  const account = await getRequestAccount(request);

  if (!account) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = addFriendSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_FRIEND_EMAIL",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json({
      friend: await addAccountFriend({
        account,
        email: parsed.data.email
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "FRIEND_ADD_FAILED";

    return NextResponse.json(
      {
        error: message === "FRIEND_NOT_FOUND" ? "FRIEND_NOT_FOUND" : "FRIEND_ADD_FAILED",
        details: message === "FRIEND_NOT_FOUND" ? "没有找到这个账号，或不能添加自己。" : message
      },
      { status: message === "FRIEND_NOT_FOUND" ? 404 : 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const account = await getRequestAccount(request);

  if (!account) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = removeFriendSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_FRIEND_ID",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await removeAccountFriend({
      account,
      friendId: parsed.data.friendId
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "FRIEND_DELETE_FAILED";

    return NextResponse.json(
      {
        error: message === "FRIEND_NOT_FOUND" ? "FRIEND_NOT_FOUND" : "FRIEND_DELETE_FAILED",
        details: message === "FRIEND_NOT_FOUND" ? "没有找到这个好友关系。" : message
      },
      { status: message === "FRIEND_NOT_FOUND" ? 404 : 500 }
    );
  }
}
