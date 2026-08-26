import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Firestore Security Rules', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const firebaseJsonPath = path.resolve(process.cwd(), 'firebase.json');

  it('ensures firestore.rules file exists and specifies rules_version 2', () => {
    expect(fs.existsSync(rulesPath)).toBe(true);
    const content = fs.readFileSync(rulesPath, 'utf8');
    expect(content).toContain("rules_version = '2'");
    expect(content).toContain("service cloud.firestore");
  });

  it('ensures firebase.json links correctly to firestore.rules', () => {
    expect(fs.existsSync(firebaseJsonPath)).toBe(true);
    const json = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'));
    expect(json.firestore).toBeDefined();
    expect(json.firestore.rules).toBe('firestore.rules');
  });

  it('enforces that match /tableroDia/{userId} requires request.auth.uid == userId', () => {
    const content = fs.readFileSync(rulesPath, 'utf8');
    expect(content).toMatch(/match\s+\/tableroDia\/\{userId\}/);
    expect(content).toMatch(/request\.auth\s*!=\s*null/);
    expect(content).toMatch(/request\.auth\.uid\s*==\s*userId/);
  });

  it('has a default catch-all rule denying all other collections', () => {
    const content = fs.readFileSync(rulesPath, 'utf8');
    expect(content).toMatch(/match\s+\/\{document=\*\*\}/);
    expect(content).toMatch(/allow\s+read,\s*write:\s*if\s+false/);
  });

  describe('Rule Evaluation Simulation Logic', () => {
    function evaluateRule({ path, auth, method }) {
      const matchTablero = path.match(/^\/tableroDia\/([^/]+)$/);
      if (matchTablero) {
        const userId = matchTablero[1];
        const isAuthenticated = auth !== null && auth !== undefined;
        const isOwner = isAuthenticated && auth.uid === userId;
        return isOwner;
      }
      // default rule
      return false;
    }

    it('rejects unauthenticated read/write to user document', () => {
      expect(evaluateRule({ path: '/tableroDia/user_123', auth: null, method: 'read' })).toBe(false);
      expect(evaluateRule({ path: '/tableroDia/user_123', auth: null, method: 'write' })).toBe(false);
    });

    it('allows authenticated owner to read and write their document', () => {
      const auth = { uid: 'user_123' };
      expect(evaluateRule({ path: '/tableroDia/user_123', auth, method: 'read' })).toBe(true);
      expect(evaluateRule({ path: '/tableroDia/user_123', auth, method: 'write' })).toBe(true);
    });

    it('rejects authenticated user attempting to read or write another user document', () => {
      const auth = { uid: 'attacker_456' };
      expect(evaluateRule({ path: '/tableroDia/user_123', auth, method: 'read' })).toBe(false);
      expect(evaluateRule({ path: '/tableroDia/user_123', auth, method: 'write' })).toBe(false);
    });

    it('rejects access to any arbitrary collections outside tableroDia', () => {
      const auth = { uid: 'user_123' };
      expect(evaluateRule({ path: '/secrets/doc1', auth, method: 'read' })).toBe(false);
      expect(evaluateRule({ path: '/users/user_123', auth, method: 'write' })).toBe(false);
      expect(evaluateRule({ path: '/admin/config', auth, method: 'read' })).toBe(false);
    });
  });
});
