import type { ParseError } from './types.js';

export enum TokenType {
  // Operators / structural
  GT = 'GT',               // >
  TILDE = 'TILDE',         // ~
  EQUALS = 'EQUALS',       // =
  DASH_DASH = 'DASH_DASH', // --
  DIAMOND = 'DIAMOND',     // <>
  COLON = 'COLON',         // :
  AT = 'AT',               // @
  CARET = 'CARET',         // ^
  HASH = 'HASH',           // #
  LBRACE = 'LBRACE',       // {
  RBRACE = 'RBRACE',       // }
  COMMA = 'COMMA',         // ,
  DOLLAR = 'DOLLAR',       // $
  DOT = 'DOT',             // .
  SLASH_SLASH = 'SLASH_SLASH', // //

  // Values
  ID = 'ID',
  INTEGER = 'INTEGER',
  HEX_COLOR = 'HEX_COLOR',
  QUOTED_STRING = 'QUOTED_STRING',
  MULTILINE_STRING = 'MULTILINE_STRING',
  /** Raw style property value (`1.5`, `12px`, `bold`) — only emitted after `prop:` inside a style block */
  STYLE_VALUE = 'STYLE_VALUE',

  // Whitespace / control
  NEWLINE = 'NEWLINE',
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

function isLetter(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isHexDigit(ch: string): boolean {
  return isDigit(ch) || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F');
}

function isIdContinue(ch: string): boolean {
  return isLetter(ch) || isDigit(ch) || ch === '_';
}

/** Characters that end a raw style value: whitespace and the grammar's reserved set */
const STYLE_VALUE_STOP = new Set([' ', '\t', '\n', '\r', '>', '~', '=', ':', '@', '^', '#', '{', '}', '"']);

/** A bare style value is ASCII-only, like bare labels; anything else must be quoted */
const BARE_STYLE_VALUE = /^[A-Za-z0-9._%,+-]+$/;

export class Lexer {
  private input: string;
  private pos = 0;
  private line = 1;
  private column = 1;
  private tokens: Token[] = [];
  readonly errors: ParseError[] = [];
  /** Inside the braces of a `$selector{...}` style block (style blocks are single-line) */
  private inStyleBlock = false;
  /** Just lexed `prop:` inside a style block, so the next token is a property value */
  private expectStyleValue = false;

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    while (this.pos < this.input.length) {
      this.skipSpaces();
      if (this.pos >= this.input.length) break;

      const ch = this.input[this.pos];

      if (ch === '\n' || ch === '\r') {
        this.inStyleBlock = false;
        this.expectStyleValue = false;
      }

      if (this.expectStyleValue) {
        this.expectStyleValue = false;
        // Quoted values and #hex colors keep their usual tokens
        if (!STYLE_VALUE_STOP.has(ch)) {
          this.readStyleValue();
          continue;
        }
      }

      if (ch === '\n') {
        this.emit(TokenType.NEWLINE, '\n');
        this.advance();
        this.line++;
        this.column = 1;
        continue;
      }

      if (ch === '\r') {
        // Handle \r\n and lone \r
        if (this.peek(1) === '\n') {
          this.emit(TokenType.NEWLINE, '\n');
          this.pos += 2;
        } else {
          this.emit(TokenType.NEWLINE, '\n');
          this.pos++;
        }
        this.line++;
        this.column = 1;
        continue;
      }

      if (ch === '/' && this.peek(1) === '/') {
        this.readComment();
        continue;
      }

      if (ch === '"') {
        this.readString();
        continue;
      }

      if (ch === '#') {
        this.readHash();
        continue;
      }

      if (ch === '<' && this.peek(1) === '>') {
        this.emit(TokenType.DIAMOND, '<>');
        this.pos += 2;
        this.column += 2;
        continue;
      }

      if (ch === '>') { this.emit(TokenType.GT, '>'); this.advance(); continue; }
      if (ch === '~') { this.emit(TokenType.TILDE, '~'); this.advance(); continue; }
      if (ch === '=') { this.emit(TokenType.EQUALS, '='); this.advance(); continue; }
      if (ch === ':') {
        if (this.inStyleBlock && this.lastToken()?.type === TokenType.ID) this.expectStyleValue = true;
        this.emit(TokenType.COLON, ':');
        this.advance();
        continue;
      }
      if (ch === '@') { this.emit(TokenType.AT, '@'); this.advance(); continue; }
      if (ch === '^') { this.emit(TokenType.CARET, '^'); this.advance(); continue; }
      if (ch === '{') {
        if (this.isStyleSelectorBehind()) this.inStyleBlock = true;
        this.emit(TokenType.LBRACE, '{');
        this.advance();
        continue;
      }
      if (ch === '}') {
        this.inStyleBlock = false;
        this.emit(TokenType.RBRACE, '}');
        this.advance();
        continue;
      }
      if (ch === ',') { this.emit(TokenType.COMMA, ','); this.advance(); continue; }
      if (ch === '$') { this.emit(TokenType.DOLLAR, '$'); this.advance(); continue; }
      if (ch === '.') { this.emit(TokenType.DOT, '.'); this.advance(); continue; }

      if (ch === '-' && this.peek(1) === '-') {
        this.emit(TokenType.DASH_DASH, '--');
        this.pos += 2;
        this.column += 2;
        continue;
      }

      if (isDigit(ch)) {
        this.readInteger();
        continue;
      }

      if (isLetter(ch)) {
        this.readId();
        continue;
      }

      this.readUnexpected();
    }

    this.emit(TokenType.EOF, '');
    return this.tokens;
  }

  private lastToken(): Token | undefined {
    return this.tokens[this.tokens.length - 1];
  }

  /** True when the last tokens are `$` plus a selector (`:r`, `.cls`, `#id`) */
  private isStyleSelectorBehind(): boolean {
    const n = this.tokens.length;
    if (n < 3) return false;
    const [dollar, sigil, name] = this.tokens.slice(n - 3);
    return dollar.type === TokenType.DOLLAR
      && (sigil.type === TokenType.COLON || sigil.type === TokenType.DOT || sigil.type === TokenType.HASH)
      && name.type === TokenType.ID;
  }

  private readStyleValue(): void {
    const startCol = this.column;
    let value = '';
    while (this.pos < this.input.length && !STYLE_VALUE_STOP.has(this.input[this.pos])) {
      value += this.input[this.pos];
      this.advance();
    }
    if (!BARE_STYLE_VALUE.test(value)) {
      this.errors.push({
        message: `Style value '${value}' must be quoted — bare values may only use ASCII letters, digits and . _ % , + -`,
        line: this.line,
        column: startCol,
      });
    }
    this.tokens.push({ type: TokenType.STYLE_VALUE, value, line: this.line, column: startCol });
  }

  private peek(offset: number): string | undefined {
    return this.input[this.pos + offset];
  }

  private advance(): void {
    this.pos++;
    this.column++;
  }

  private skipSpaces(): void {
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === ' ' || ch === '\t') {
        this.advance();
      } else {
        break;
      }
    }
  }

  private emit(type: TokenType, value: string): void {
    this.tokens.push({ type, value, line: this.line, column: this.column });
  }

  private readComment(): void {
    this.emit(TokenType.SLASH_SLASH, '//');
    this.pos += 2;
    this.column += 2;
    // Skip rest of line (don't emit — comments are consumed by parser)
    while (this.pos < this.input.length && this.input[this.pos] !== '\n' && this.input[this.pos] !== '\r') {
      this.advance();
    }
  }

  private readString(): void {
    // Check for triple-quote
    if (this.peek(1) === '"' && this.peek(2) === '"') {
      this.readMultilineString();
      return;
    }
    this.readQuotedString();
  }

  private readQuotedString(): void {
    const startLine = this.line;
    const startCol = this.column;
    this.pos++; // skip opening "
    this.column++;
    let value = '';

    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === '"') {
        this.pos++;
        this.column++;
        this.tokens.push({ type: TokenType.QUOTED_STRING, value, line: startLine, column: startCol });
        return;
      }
      if (ch === '\\') {
        const esc = this.input[this.pos + 1];
        // A backslash before a line break or EOF escapes nothing, so the string
        // is unterminated. Stop before the break so the main loop still counts
        // the line.
        if (esc === undefined || esc === '\n' || esc === '\r') {
          this.pos++;
          this.column++;
          break;
        }
        if (esc === 'n') value += '\n';
        else if (esc === 't') value += '\t';
        else if (esc === '\\') value += '\\';
        else if (esc === '"') value += '"';
        else {
          this.errors.push({
            message: `Unknown escape sequence '\\${esc}' — supported escapes are \\n, \\t, \\\\ and \\" (use \\\\ for a literal backslash)`,
            line: this.line,
            column: this.column,
          });
          value += '\\' + esc;
        }
        this.pos += 2;
        this.column += 2;
        continue;
      }
      if (ch === '\n' || ch === '\r') {
        // Quoted strings can't span lines
        break;
      }
      value += ch;
      this.pos++;
      this.column++;
    }
    this.errors.push({
      message: 'Unterminated string — add a closing " on the same line (use triple quotes for multiline labels)',
      line: startLine,
      column: startCol,
    });
    this.tokens.push({ type: TokenType.QUOTED_STRING, value, line: startLine, column: startCol });
  }

  private readMultilineString(): void {
    const startLine = this.line;
    const startCol = this.column;
    this.pos += 3; // skip opening """
    this.column += 3;
    let value = '';

    while (this.pos < this.input.length) {
      if (this.input[this.pos] === '"' && this.peek(1) === '"' && this.peek(2) === '"') {
        this.pos += 3;
        this.column += 3;
        this.tokens.push({ type: TokenType.MULTILINE_STRING, value, line: startLine, column: startCol });
        return;
      }
      const ch = this.input[this.pos];
      if (ch === '\n') {
        value += '\n';
        this.pos++;
        this.line++;
        this.column = 1;
      } else if (ch === '\r') {
        value += '\n';
        this.pos++;
        if (this.input[this.pos] === '\n') this.pos++;
        this.line++;
        this.column = 1;
      } else {
        value += ch;
        this.pos++;
        this.column++;
      }
    }
    // Report at the opening quotes: that's the cause, not the end of the file
    // the string swallowed
    this.errors.push({
      message: 'Unterminated multiline string — add a closing """',
      line: startLine,
      column: startCol,
    });
    this.tokens.push({ type: TokenType.MULTILINE_STRING, value, line: startLine, column: startCol });
  }

  private readHash(): void {
    // After `$`, `#` starts an id selector (`$#add{...}`), never a color, even
    // when the id happens to be valid hex
    if (this.lastToken()?.type === TokenType.DOLLAR) {
      this.emit(TokenType.HASH, '#');
      this.advance();
      return;
    }
    // Check if this is a hex color: # followed by 3 or 6 hex digits
    let hexLen = 0;
    let i = this.pos + 1;
    while (i < this.input.length && isHexDigit(this.input[i]) && hexLen < 6) {
      hexLen++;
      i++;
    }

    if (hexLen === 3 || hexLen === 6) {
      // `#abcxyz` is not the color #abc followed by xyz: the color must not run
      // into more identifier characters
      const nextCh = this.input[i];
      if (nextCh === undefined || (!isIdContinue(nextCh) && nextCh !== '-')) {
        this.emit(TokenType.HASH, '#');
        this.advance(); // skip #
        const colorVal = this.input.slice(this.pos, this.pos + hexLen);
        this.tokens.push({ type: TokenType.HEX_COLOR, value: colorVal, line: this.line, column: this.column });
        this.pos += hexLen;
        this.column += hexLen;
        return;
      }
    }

    // Just a plain hash (for style selectors like $#id)
    this.emit(TokenType.HASH, '#');
    this.advance();
  }

  private readInteger(): void {
    const startCol = this.column;
    let value = '';
    while (this.pos < this.input.length && isDigit(this.input[this.pos])) {
      value += this.input[this.pos];
      this.pos++;
      this.column++;
    }
    this.tokens.push({ type: TokenType.INTEGER, value, line: this.line, column: startCol });
  }

  private readUnexpected(): void {
    const line = this.line;
    const column = this.column;
    const ch = this.input[this.pos];

    if (ch === '-') {
      this.errors.push({
        message: `Unexpected character '-' — negative coordinates are not supported`,
        line, column,
      });
      this.advance();
      return;
    }

    if (ch.charCodeAt(0) > 127) {
      // Collect the run of non-ASCII characters so unquoted CJK/emoji text
      // produces one error, not one per character
      let run = '';
      while (this.pos < this.input.length && this.input[this.pos].charCodeAt(0) > 127) {
        run += this.input[this.pos];
        this.advance();
      }
      this.errors.push({
        message: `Unquoted non-ASCII text '${run}' — wrap it in quotes: "${run}"`,
        line, column,
      });
      return;
    }

    this.errors.push({ message: `Unexpected character '${ch}'`, line, column });
    this.advance();
  }

  private readId(): void {
    const startCol = this.column;
    let value = '';
    value += this.input[this.pos];
    this.pos++;
    this.column++;

    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (isIdContinue(ch)) {
        value += ch;
        this.pos++;
        this.column++;
        continue;
      }
      if (ch === '-') {
        // Check for -- (DASH_DASH operator) — end the ID here
        if (this.peek(1) === '-') {
          break;
        }
        // Otherwise hyphen is part of ID if followed by a valid ID continue char
        const next = this.peek(1);
        if (next !== undefined && isIdContinue(next)) {
          value += ch;
          this.pos++;
          this.column++;
          continue;
        }
        // Trailing hyphen — don't include
        break;
      }
      break;
    }

    this.tokens.push({ type: TokenType.ID, value, line: this.line, column: startCol });
  }
}
