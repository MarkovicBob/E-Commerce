import { TestBed } from '@angular/core/testing';
import { SessionService } from './session.service';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('SessionService', () => {
  const realCrypto = globalThis.crypto;

  function makeService(): SessionService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(SessionService);
  }

  function stubCrypto(value: unknown) {
    Object.defineProperty(globalThis, 'crypto', { value, configurable: true, writable: true });
  }

  beforeEach(() => localStorage.clear());

  afterEach(() => {
    stubCrypto(realCrypto);
    localStorage.clear();
  });

  it('creates and persists an id', () => {
    const id = makeService().sessionId;
    expect(id.length).toBeGreaterThan(8);
    expect(localStorage.getItem('session_id')).toBe(id);
  });

  it('reuses the stored id on the next visit', () => {
    const first = makeService().sessionId;
    expect(makeService().sessionId).toBe(first);
  });

  it('still produces an id when randomUUID is unavailable', () => {
    // What a plain-http LAN origin looks like: getRandomValues only, no randomUUID.
    stubCrypto({ getRandomValues: realCrypto.getRandomValues.bind(realCrypto) });
    const id = makeService().sessionId;
    expect(id).toMatch(UUID_SHAPE);
  });

  it('still produces an id when the Web Crypto API is missing entirely', () => {
    stubCrypto(undefined);
    expect(makeService().sessionId.length).toBeGreaterThan(8);
  });
});
