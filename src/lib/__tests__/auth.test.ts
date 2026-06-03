// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import {
  createSession,
  getSession,
  deleteSession,
  verifySession,
} from "@/lib/auth";

const SECRET = new TextEncoder().encode("development-secret-key");
const COOKIE_NAME = "auth-token";

async function makeToken(
  payload: object,
  expiresAt: number | string = "7d"
): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresAt)
    .setIssuedAt()
    .sign(SECRET);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);
});

// --- createSession ---

test("createSession sets a cookie named auth-token", async () => {
  await createSession("user1", "user@example.com");

  expect(mockCookieStore.set).toHaveBeenCalledOnce();
  expect(mockCookieStore.set.mock.calls[0][0]).toBe(COOKIE_NAME);
});

test("createSession JWT payload contains userId and email", async () => {
  await createSession("user1", "user@example.com");

  const token = mockCookieStore.set.mock.calls[0][1] as string;
  const { jwtVerify } = await import("jose");
  const { payload } = await jwtVerify(token, SECRET);

  expect(payload.userId).toBe("user1");
  expect(payload.email).toBe("user@example.com");
});

test("createSession sets httpOnly cookie", async () => {
  await createSession("user1", "user@example.com");

  const options = mockCookieStore.set.mock.calls[0][2];
  expect(options.httpOnly).toBe(true);
});

test("createSession sets sameSite lax", async () => {
  await createSession("user1", "user@example.com");

  const options = mockCookieStore.set.mock.calls[0][2];
  expect(options.sameSite).toBe("lax");
});

test("createSession sets path /", async () => {
  await createSession("user1", "user@example.com");

  const options = mockCookieStore.set.mock.calls[0][2];
  expect(options.path).toBe("/");
});

test("createSession cookie is not secure outside production", async () => {
  await createSession("user1", "user@example.com");

  const options = mockCookieStore.set.mock.calls[0][2];
  expect(options.secure).toBe(false);
});

test("createSession cookie expires approximately 7 days from now", async () => {
  const before = Date.now();
  await createSession("user1", "user@example.com");
  const after = Date.now();

  const expires: Date = mockCookieStore.set.mock.calls[0][2].expires;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  expect(expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
  expect(expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
});

// --- getSession ---

test("getSession returns null when no cookie", async () => {
  mockCookieStore.get.mockReturnValue(undefined);

  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns session payload for valid token", async () => {
  const token = await makeToken({
    userId: "user1",
    email: "user@example.com",
    expiresAt: new Date().toISOString(),
  });
  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();

  expect(session).not.toBeNull();
  expect(session?.userId).toBe("user1");
  expect(session?.email).toBe("user@example.com");
});

test("getSession returns null for a malformed token", async () => {
  mockCookieStore.get.mockReturnValue({ value: "not.a.valid.jwt" });

  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns null for an expired token", async () => {
  const expiredToken = await makeToken(
    { userId: "user1", email: "user@example.com" },
    Math.floor(Date.now() / 1000) - 60
  );
  mockCookieStore.get.mockReturnValue({ value: expiredToken });

  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns null for empty string token", async () => {
  mockCookieStore.get.mockReturnValue({ value: "" });

  const session = await getSession();
  expect(session).toBeNull();
});

// --- deleteSession ---

test("deleteSession deletes the auth-token cookie", async () => {
  await deleteSession();

  expect(mockCookieStore.delete).toHaveBeenCalledOnce();
  expect(mockCookieStore.delete).toHaveBeenCalledWith(COOKIE_NAME);
});

// --- verifySession ---

test("verifySession returns null when request has no cookie", async () => {
  const request = new NextRequest("http://localhost:3000");

  const session = await verifySession(request);
  expect(session).toBeNull();
});

test("verifySession returns session payload for valid token in request", async () => {
  const token = await makeToken({
    userId: "user1",
    email: "user@example.com",
    expiresAt: new Date().toISOString(),
  });
  const request = new NextRequest("http://localhost:3000", {
    headers: { cookie: `${COOKIE_NAME}=${token}` },
  });

  const session = await verifySession(request);

  expect(session).not.toBeNull();
  expect(session?.userId).toBe("user1");
  expect(session?.email).toBe("user@example.com");
});

test("verifySession returns null for malformed token in request", async () => {
  const request = new NextRequest("http://localhost:3000", {
    headers: { cookie: `${COOKIE_NAME}=bad.token.value` },
  });

  const session = await verifySession(request);
  expect(session).toBeNull();
});

test("verifySession returns null for expired token in request", async () => {
  const expiredToken = await makeToken(
    { userId: "user1", email: "user@example.com" },
    Math.floor(Date.now() / 1000) - 60
  );
  const request = new NextRequest("http://localhost:3000", {
    headers: { cookie: `${COOKIE_NAME}=${expiredToken}` },
  });

  const session = await verifySession(request);
  expect(session).toBeNull();
});
