import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  __resetSessionStoreForTests,
  createBrowserSession,
  readSessionIdFromRequest,
  getSessionBackend,
  getSessionRecord,
  rotateCsrfToken,
  deleteSession,
  setSessionBackend,
  SESSION_COOKIE_NAME,
  MemorySessionBackend,
  type SessionBackend,
} from './session';

describe('session store — default in-memory backend', () => {
  beforeEach(() => {
    __resetSessionStoreForTests();
  });

  // Issue #1288 acceptance: pin the documented default down explicitly so
  // anyone changing buildDefaultBackend() without updating tests will trip.
  it('the active backend is the in-memory backend', () => {
    expect(getSessionBackend()).toBeInstanceOf(MemorySessionBackend);
  });

  it('createBrowserSession stores CSRF token retrievable by session id', () => {
    const { sessionId, csrfToken } = createBrowserSession('GADDR123');
    const rec = getSessionRecord(sessionId);
    expect(rec?.csrfToken).toBe(csrfToken);
    expect(rec?.walletAddress).toBe('GADDR123');
  });

  it('readSessionIdFromRequest reads cl_session from cookies', () => {
    const { sessionId } = createBrowserSession();
    const request = new NextRequest('http://localhost:3000/', {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${sessionId}` },
    });
    expect(readSessionIdFromRequest(request.cookies)).toBe(sessionId);
  });

  it('rotateCsrfToken returns undefined for unknown session', () => {
    expect(rotateCsrfToken('unknown')).toBeUndefined();
  });

  it('rotateCsrfToken replaces CSRF token', () => {
    const { sessionId, csrfToken } = createBrowserSession();
    const next = rotateCsrfToken(sessionId);
    expect(next).toBeTruthy();
    expect(next).not.toBe(csrfToken);
    expect(getSessionRecord(sessionId)?.csrfToken).toBe(next);
  });

  it('deleteSession removes the record', () => {
    const { sessionId } = createBrowserSession();
    deleteSession(sessionId);
    expect(getSessionRecord(sessionId)).toBeUndefined();
  });

  it('readSessionIdFromRequest returns undefined when cookie absent', () => {
    const cookies = { get: () => undefined as { value: string } | undefined };
    expect(readSessionIdFromRequest(cookies)).toBeUndefined();
  });
});

describe('session store — pluggable backend injection (issue #1288 acceptance)', () => {
  // Snapshot the production-default backend so each test can restore it
  // after mutating the active backend.
  let originalBackend: SessionBackend;

  beforeEach(() => {
    __resetSessionStoreForTests();
    originalBackend = getSessionBackend();
  });

  afterEach(() => {
    setSessionBackend(originalBackend);
    __resetSessionStoreForTests();
  });

  it('setSessionBackend routes reads/writes through the injected backend', () => {
    const isolated = new MemorySessionBackend();
    setSessionBackend(isolated);

    const { sessionId, csrfToken } = createBrowserSession('GADDR123');
    expect(getSessionRecord(sessionId)?.csrfToken).toBe(csrfToken);

    // The injected backend holds the record, but the original backend does not.
    expect(isolated.get(sessionId)?.csrfToken).toBe(csrfToken);
    expect(originalBackend.get(sessionId)).toBeUndefined();
  });

  it('setSessionBackend supports a custom SessionBackend implementation', () => {
    const calls: string[] = [];
    const custom: SessionBackend = {
      get: () => undefined,
      set: (id) => calls.push(`set:${id}`),
      delete: (id) => calls.push(`delete:${id}`),
      clear: () => calls.push('clear'),
    };
    setSessionBackend(custom);

    const { sessionId } = createBrowserSession();
    deleteSession(sessionId);
    expect(calls).toEqual([`set:${sessionId}`, `delete:${sessionId}`]);
  });

  it('setSessionBackend rejects nullish inputs to prevent accidental no-op DI', () => {
    expect(() => setSessionBackend(null as unknown as SessionBackend)).toThrow(
      /SessionBackend/,
    );
    expect(() =>
      setSessionBackend(undefined as unknown as SessionBackend),
    ).toThrow(/SessionBackend/);
  });
});
