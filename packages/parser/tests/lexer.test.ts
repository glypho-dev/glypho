import { describe, it, expect } from 'vitest';
import { Lexer, TokenType } from '../src/lexer.js';

function tokenTypes(input: string): TokenType[] {
  return new Lexer(input).tokenize().map(t => t.type);
}

function tokenValues(input: string): string[] {
  return new Lexer(input).tokenize().map(t => t.value);
}

describe('Lexer', () => {
  describe('operators and structural characters', () => {
    it('tokenizes single-char operators', () => {
      const tokens = new Lexer('>~=:@^{},$.').tokenize();
      const types = tokens.map(t => t.type);
      expect(types).toEqual([
        TokenType.GT, TokenType.TILDE, TokenType.EQUALS,
        TokenType.COLON, TokenType.AT, TokenType.CARET,
        TokenType.LBRACE, TokenType.RBRACE, TokenType.COMMA,
        TokenType.DOLLAR, TokenType.DOT, TokenType.EOF,
      ]);
    });

    it('tokenizes -- as DASH_DASH', () => {
      expect(tokenTypes('--')).toEqual([TokenType.DASH_DASH, TokenType.EOF]);
    });

    it('tokenizes <> as DIAMOND', () => {
      expect(tokenTypes('<>')).toEqual([TokenType.DIAMOND, TokenType.EOF]);
    });

    it('tokenizes // as SLASH_SLASH', () => {
      expect(tokenTypes('// comment')).toEqual([TokenType.SLASH_SLASH, TokenType.EOF]);
    });
  });

  describe('IDs', () => {
    it('scans simple ID', () => {
      expect(tokenValues('login')).toEqual(['login', '']);
    });

    it('scans hyphenated ID', () => {
      expect(tokenValues('my-node')).toEqual(['my-node', '']);
    });

    it('scans ID with underscore', () => {
      expect(tokenValues('step_1')).toEqual(['step_1', '']);
    });

    it('scans mixed ID', () => {
      expect(tokenValues('a-b')).toEqual(['a-b', '']);
    });
  });

  describe('-- disambiguation', () => {
    it('splits a--b into ID DASH_DASH ID', () => {
      const tokens = new Lexer('a--b').tokenize();
      expect(tokens.map(t => [t.type, t.value])).toEqual([
        [TokenType.ID, 'a'],
        [TokenType.DASH_DASH, '--'],
        [TokenType.ID, 'b'],
        [TokenType.EOF, ''],
      ]);
    });

    it('splits my-node--other correctly', () => {
      const tokens = new Lexer('my-node--other').tokenize();
      expect(tokens.map(t => [t.type, t.value])).toEqual([
        [TokenType.ID, 'my-node'],
        [TokenType.DASH_DASH, '--'],
        [TokenType.ID, 'other'],
        [TokenType.EOF, ''],
      ]);
    });
  });

  describe('strings', () => {
    it('reads quoted string', () => {
      const tokens = new Lexer('"Hello World"').tokenize();
      expect(tokens[0].type).toBe(TokenType.QUOTED_STRING);
      expect(tokens[0].value).toBe('Hello World');
    });

    it('handles escape sequences', () => {
      const tokens = new Lexer('"line1\\nline2\\t\\\\"').tokenize();
      expect(tokens[0].value).toBe('line1\nline2\t\\');
    });

    it('handles escaped quotes', () => {
      const tokens = new Lexer('"say \\"hi\\""').tokenize();
      expect(tokens[0].value).toBe('say "hi"');
    });

    it('reads multiline string', () => {
      const tokens = new Lexer('"""first\nsecond\nthird"""').tokenize();
      expect(tokens[0].type).toBe(TokenType.MULTILINE_STRING);
      expect(tokens[0].value).toBe('first\nsecond\nthird');
    });
  });

  describe('hex colors', () => {
    it('reads 3-digit hex color', () => {
      const tokens = new Lexer('#f00').tokenize();
      expect(tokens[0].type).toBe(TokenType.HASH);
      expect(tokens[1].type).toBe(TokenType.HEX_COLOR);
      expect(tokens[1].value).toBe('f00');
    });

    it('reads 6-digit hex color', () => {
      const tokens = new Lexer('#ff0000').tokenize();
      expect(tokens[1].type).toBe(TokenType.HEX_COLOR);
      expect(tokens[1].value).toBe('ff0000');
    });

    it('emits plain HASH when not followed by valid hex color', () => {
      const tokens = new Lexer('#login').tokenize();
      expect(tokens[0].type).toBe(TokenType.HASH);
      expect(tokens[1].type).toBe(TokenType.ID);
      expect(tokens[1].value).toBe('login');
    });
  });

  describe('integers', () => {
    it('reads integer', () => {
      const tokens = new Lexer('42').tokenize();
      expect(tokens[0].type).toBe(TokenType.INTEGER);
      expect(tokens[0].value).toBe('42');
    });
  });

  describe('newlines', () => {
    it('emits NEWLINE tokens', () => {
      const types = tokenTypes('a\nb');
      expect(types).toEqual([
        TokenType.ID, TokenType.NEWLINE, TokenType.ID, TokenType.EOF,
      ]);
    });
  });

  describe('line/column tracking', () => {
    it('tracks line and column', () => {
      const tokens = new Lexer('a>b\nc>d').tokenize();
      const a = tokens[0];
      expect(a.line).toBe(1);
      expect(a.column).toBe(1);
      const c = tokens[4]; // a > b NEWLINE c
      expect(c.line).toBe(2);
      expect(c.column).toBe(1);
    });
  });

  describe('full lines', () => {
    it('tokenizes a node definition', () => {
      const types = tokenTypes('login:r Login #0f0');
      expect(types).toEqual([
        TokenType.ID, TokenType.COLON, TokenType.ID,
        TokenType.ID, TokenType.HASH, TokenType.HEX_COLOR,
        TokenType.EOF,
      ]);
    });

    it('tokenizes an edge', () => {
      const types = tokenTypes('a>b success');
      expect(types).toEqual([
        TokenType.ID, TokenType.GT, TokenType.ID,
        TokenType.ID, TokenType.EOF,
      ]);
    });

    it('tokenizes a group', () => {
      const types = tokenTypes('@auth{login mfa}');
      expect(types).toEqual([
        TokenType.AT, TokenType.ID, TokenType.LBRACE,
        TokenType.ID, TokenType.ID, TokenType.RBRACE,
        TokenType.EOF,
      ]);
    });

    it('tokenizes a style block', () => {
      const types = tokenTypes('$:r{fill:#fff stroke:#333}');
      expect(types).toEqual([
        TokenType.DOLLAR, TokenType.COLON, TokenType.ID,
        TokenType.LBRACE, TokenType.ID, TokenType.COLON,
        TokenType.HASH, TokenType.HEX_COLOR, TokenType.ID,
        TokenType.COLON, TokenType.HASH, TokenType.HEX_COLOR,
        TokenType.RBRACE, TokenType.EOF,
      ]);
    });

    it('tokenizes a position with size', () => {
      // 120x40 → INTEGER(120), ID(x40) — parser splits the "x" separator
      const types = tokenTypes('login@100,200^120x40');
      expect(types).toEqual([
        TokenType.ID, TokenType.AT, TokenType.INTEGER,
        TokenType.COMMA, TokenType.INTEGER, TokenType.CARET,
        TokenType.INTEGER, TokenType.ID,
        TokenType.EOF,
      ]);
    });
  });
});
