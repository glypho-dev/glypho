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

export class Lexer {
  private input: string;
  private pos = 0;
  private line = 1;
  private column = 1;
  private tokens: Token[] = [];

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    while (this.pos < this.input.length) {
      this.skipSpaces();
      if (this.pos >= this.input.length) break;

      const ch = this.input[this.pos];

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
      if (ch === ':') { this.emit(TokenType.COLON, ':'); this.advance(); continue; }
      if (ch === '@') { this.emit(TokenType.AT, '@'); this.advance(); continue; }
      if (ch === '^') { this.emit(TokenType.CARET, '^'); this.advance(); continue; }
      if (ch === '{') { this.emit(TokenType.LBRACE, '{'); this.advance(); continue; }
      if (ch === '}') { this.emit(TokenType.RBRACE, '}'); this.advance(); continue; }
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

      // Skip unexpected characters
      this.advance();
    }

    this.emit(TokenType.EOF, '');
    return this.tokens;
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
        this.pos++;
        this.column++;
        const esc = this.input[this.pos];
        if (esc === 'n') value += '\n';
        else if (esc === 't') value += '\t';
        else if (esc === '\\') value += '\\';
        else if (esc === '"') value += '"';
        else value += esc; // pass through unknown escapes
        this.pos++;
        this.column++;
        continue;
      }
      if (ch === '\n' || ch === '\r') {
        // Unterminated string — stop at newline
        break;
      }
      value += ch;
      this.pos++;
      this.column++;
    }
    // Unterminated — emit what we have
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
    // Unterminated — emit what we have
    this.tokens.push({ type: TokenType.MULTILINE_STRING, value, line: startLine, column: startCol });
  }

  private readHash(): void {
    const startCol = this.column;
    // Check if this is a hex color: # followed by 3 or 6 hex digits
    let hexLen = 0;
    let i = this.pos + 1;
    while (i < this.input.length && isHexDigit(this.input[i]) && hexLen < 6) {
      hexLen++;
      i++;
    }

    if (hexLen === 3 || hexLen === 6) {
      // Check that it's followed by a non-hex-digit (or end of input)
      const nextCh = this.input[i];
      if (nextCh === undefined || !isHexDigit(nextCh)) {
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
