/**
 * EQL-S (EAV Query Language - Strict) Parser and Compiler
 *
 * Implements the strict DSL grammar defined in the query-dsl.md notes
 * Compiles EQL-S queries into the internal Query format for the DatalogEvaluator
 */

import type { Query, Atom_ } from './datalog-evaluator.js';
import { AttributeResolver } from './attribute-resolver.js';

export interface EQLSQuery {
  find: string;
  as: string;
  where?: EQLSExpression;
  return?: string[];
  orderBy?: { field: string; direction: 'ASC' | 'DESC' };
  limit?: number;
}

export type EQLSExpression =
  | EQLSPredicate
  | { op: 'AND' | 'OR'; left: EQLSExpression; right: EQLSExpression };

export type EQLSPredicate =
  | {
    type: 'COMP';
    left: string;
    op: '=' | '!=' | '>' | '>=' | '<' | '<=';
    right: any;
  }
  | { type: 'BETWEEN'; field: string; min: number; max: number }
  | { type: 'EQUALS'; field: string; value: any }
  | { type: 'MEMBERSHIP'; value: any; field: string }
  | { type: 'CONTAINS'; field: string; pattern: string }
  | { type: 'MATCHES'; field: string; regex: string };

export interface EQLSError {
  line: number;
  column: number;
  message: string;
  expected?: string[];
}

export class EQLSParser {
  private tokens: Token[] = [];
  private current = 0;
  private errors: EQLSError[] = [];

  private static readonly KEYWORDS = new Set([
    'FIND',
    'AS',
    'WHERE',
    'AND',
    'OR',
    'RETURN',
    'ORDER',
    'BY',
    'LIMIT',
    'ASC',
    'DESC',
    'BETWEEN',
    'CONTAINS',
    'MATCHES',
    'IN',
  ]);

  private static readonly SINGLE_CHAR_OPERATORS = new Set(['=', '>', '<']);

  private static readonly MULTI_CHAR_OPERATORS = new Set([
    'CONTAINS',
    'MATCHES',
    'BETWEEN',
    'IN',
  ]);

  parse(query: string): { query?: EQLSQuery; errors: EQLSError[] } {
    this.tokens = this.tokenize(query);
    this.current = 0;
    this.errors = [];

    try {
      const parsed = this.parseQuery();
      if (this.errors.length > 0) {
        return { errors: this.errors };
      }
      return { query: parsed, errors: [] };
    } catch (error) {
      this.errors.push({
        line: 1,
        column: 1,
        message: `Parse error: ${error instanceof Error ? error.message : 'Unknown error'
          }`,
      });
      return { errors: this.errors };
    }
  }

  private tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    const lines = input.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum]!;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('--')) continue; // Skip empty lines and comments

      let pos = 0;
      while (pos < line.length) {
        const char = line[pos]!;

        if (char === ' ') {
          pos++;
          continue;
        }

        if (char === '"') {
          // String literal
          const start = pos;
          pos++;
          while (pos < line.length && line[pos] !== '"') {
            if (line[pos] === '\\' && pos + 1 < line.length) {
              pos += 2; // Skip escaped character
            } else {
              pos++;
            }
          }
          if (pos < line.length) {
            pos++; // Skip closing quote
            const value = line.slice(start + 1, pos - 1);
            tokens.push({
              type: 'STRING',
              value,
              line: lineNum + 1,
              column: start + 1,
            });
          } else {
            this.errors.push({
              line: lineNum + 1,
              column: start + 1,
              message: 'Unterminated string literal',
            });
            break;
          }
        } else if (
          char === '/' &&
          pos + 1 < line.length
        ) {
          // Regex literal
          const start = pos;
          pos++; // Skip opening slash
          while (pos < line.length && line[pos] !== '/') {
            if (line[pos] === '\\' && pos + 1 < line.length) {
              pos += 2; // Skip escaped character
            } else {
              pos++;
            }
          }
          if (pos < line.length) {
            pos++; // Skip closing slash
            const pattern = line.slice(start, pos);
            tokens.push({
              type: 'REGEX',
              value: pattern,
              line: lineNum + 1,
              column: start + 1,
            });
          } else {
            this.errors.push({
              line: lineNum + 1,
              column: start + 1,
              message: 'Unterminated regex literal',
            });
            break;
          }
        } else if (char.match(/[A-Za-z_]/)) {
          // Identifier or keyword
          const start = pos;
          while (pos < line.length && line[pos]!.match(/[A-Za-z0-9_]/)) {
            pos++;
          }
          const value = line.slice(start, pos);
          const upperValue = value.toUpperCase();
          let type = 'IDENTIFIER';
          let tokenValue = value; // Keep original case by default

          if (EQLSParser.KEYWORDS.has(upperValue)) {
            type = upperValue;
            tokenValue = upperValue; // Use uppercase for keywords
          } else if (EQLSParser.MULTI_CHAR_OPERATORS.has(upperValue)) {
            type = 'OPERATOR';
            tokenValue = upperValue; // Use uppercase for operators
          }

          tokens.push({
            type,
            value: tokenValue, // Use original case for identifiers, uppercase for keywords/operators
            line: lineNum + 1,
            column: start + 1,
          });
        } else if (char.match(/[0-9]/)) {
          // Number (including decimal numbers)
          const start = pos;
          let hasDecimal = false;

          while (pos < line.length) {
            const nextChar = line[pos]!;
            if (nextChar.match(/[0-9]/)) {
              pos++;
            } else if (nextChar === '.' && !hasDecimal && pos + 1 < line.length && line[pos + 1]!.match(/[0-9]/)) {
              // Only consume dot if it's followed by a digit (decimal number)
              hasDecimal = true;
              pos++;
            } else {
              break;
            }
          }

          const value = line.slice(start, pos);
          const numValue = value.includes('.')
            ? parseFloat(value)
            : parseInt(value, 10);
          tokens.push({
            type: 'NUMBER',
            value: numValue,
            line: lineNum + 1,
            column: start + 1,
          });
        } else if (char === '.') {
          // Dot for attribute access
          tokens.push({
            type: 'DOT',
            value: '.',
            line: lineNum + 1,
            column: pos + 1,
          });
          pos++;
        } else if (char === '?') {
          // Variable
          const start = pos;
          pos++;
          while (pos < line.length && line[pos]!.match(/[A-Za-z0-9_]/)) {
            pos++;
          }
          const value = line.slice(start, pos);
          tokens.push({
            type: 'VARIABLE',
            value,
            line: lineNum + 1,
            column: start + 1,
          });
        } else if (
          EQLSParser.SINGLE_CHAR_OPERATORS.has(char) ||
          (char === '!' && pos + 1 < line.length && line[pos + 1] === '=') ||
          (char === '>' && pos + 1 < line.length && line[pos + 1] === '=') ||
          (char === '<' && pos + 1 < line.length && line[pos + 1] === '=') ||
          (char === '=' && pos + 1 < line.length && line[pos + 1] === '=')
        ) {
          // Operator
          const start = pos;
          if (char === '!' || char === '>' || char === '<' || char === '=') {
            pos += 2;
          } else {
            pos++;
          }
          const value = line.slice(start, pos);
          tokens.push({
            type: 'OPERATOR',
            value,
            line: lineNum + 1,
            column: start + 1,
          });
        } else if (char === ',') {
          tokens.push({
            type: 'COMMA',
            value: ',',
            line: lineNum + 1,
            column: pos + 1,
          });
          pos++;
        } else if (char === '(') {
          tokens.push({
            type: 'LPAREN',
            value: '(',
            line: lineNum + 1,
            column: pos + 1,
          });
          pos++;
        } else if (char === ')') {
          tokens.push({
            type: 'RPAREN',
            value: ')',
            line: lineNum + 1,
            column: pos + 1,
          });
          pos++;
        } else {
          this.errors.push({
            line: lineNum + 1,
            column: pos + 1,
            message: `Unexpected character '${char}'`,
            expected: ['identifier', 'string', 'number', 'operator'],
          });
          pos++;
        }
      }
    }

    return tokens;
  }

  private parseQuery(): EQLSQuery {
    this.expect('FIND');
    const find = this.expect('IDENTIFIER').value;

    this.expect('AS');
    const as = this.expect('VARIABLE').value;

    let where: EQLSExpression | undefined;
    if (this.match('WHERE')) {
      where = this.parseExpression();
    }

    let returnFields: string[] | undefined;
    if (this.match('RETURN')) {
      returnFields = this.parseReturnFields();
    }

    let orderBy: { field: string; direction: 'ASC' | 'DESC' } | undefined;
    if (this.match('ORDER')) {
      this.expect('BY');
      const field = this.expect('VARIABLE').value;
      const direction = this.match('DESC')
        ? 'DESC'
        : this.match('ASC')
          ? 'ASC'
          : 'ASC';
      orderBy = { field, direction };
    }

    let limit: number | undefined;
    if (this.match('LIMIT')) {
      limit = this.expect('NUMBER').value as number;
    }

    return { find, as, where, return: returnFields, orderBy, limit };
  }

  private parseExpression(): EQLSExpression {
    let left = this.parseTerm();

    while (this.match('AND') || this.match('OR')) {
      const op = this.previous().value as 'AND' | 'OR';
      const right = this.parseTerm();
      left = { op, left, right };
    }

    return left;
  }

  private parseTerm(): EQLSExpression {
    if (this.match('LPAREN')) {
      const expr = this.parseExpression();
      this.expect('RPAREN');
      return expr;
    }

    return this.parsePredicate();
  }

  private parsePredicate(): EQLSPredicate {
    const field = this.parseAttributeReference();

    if (this.match('BETWEEN')) {
      const min = this.expect('NUMBER').value as number;
      this.expect('AND');
      const max = this.expect('NUMBER').value as number;
      return { type: 'BETWEEN', field, min, max };
    }

    if (this.match('CONTAINS')) {
      const pattern = this.expect('STRING').value;
      return { type: 'CONTAINS', field, pattern };
    }

    if (this.match('MATCHES')) {
      const regex = this.expect('REGEX').value;
      return { type: 'MATCHES', field, regex };
    }

    if (this.match('IN')) {
      const value = this.parseValue();
      return { type: 'MEMBERSHIP', value, field };
    }

    // Comparison or equality
    const op = this.expect('OPERATOR').value.trim();
    const right = this.parseValue();

    if (op === '=' || op === '==') {
      return { type: 'EQUALS', field, value: right };
    } else {
      return { type: 'COMP', left: field, op: op as any, right };
    }
  }

  private parseAttributeReference(): string {
    const variable = this.expect('VARIABLE').value;

    // Handle multiple levels of attribute nesting
    const attributeParts: string[] = [];

    // Keep consuming DOT + IDENTIFIER pairs for nested attributes
    while (this.check('DOT')) {
      this.advance(); // consume the DOT
      const attributePart = this.expect('IDENTIFIER').value;
      attributeParts.push(this.toCamelCase(attributePart));
    }

    // If we have attribute parts, join them with dots
    if (attributeParts.length > 0) {
      return `${variable}.${attributeParts.join('.')}`;
    }

    return variable;
  }

  private toCamelCase(str: string): string {
    // Simple fallback - just return the string as-is
    // Schema-aware resolution will handle proper attribute names
    return str;
  }

  private parseValue(): any {
    if (this.match('STRING')) return this.previous().value;
    if (this.match('NUMBER')) return this.previous().value;
    if (this.match('IDENTIFIER')) {
      const value = this.previous().value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    }
    if (this.match('VARIABLE')) return this.previous().value;

    throw new Error(`Expected value, got ${this.peek().type}`);
  }

  private parseReturnFields(): string[] {
    const fields: string[] = [];

    do {
      const field = this.parseAttributeReference();
      fields.push(field);
    } while (this.match('COMMA'));

    return fields;
  }

  private match(type: string): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private check(type: string): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }

  private peek(): Token {
    return (
      this.tokens[this.current] || {
        type: 'EOF',
        value: '',
        line: 0,
        column: 0,
      }
    );
  }

  private previous(): Token {
    return (
      this.tokens[this.current - 1] || {
        type: 'EOF',
        value: '',
        line: 0,
        column: 0,
      }
    );
  }

  private expect(type: string): Token {
    if (this.check(type)) {
      return this.advance();
    }

    const token = this.peek();
    this.errors.push({
      line: token.line,
      column: token.column,
      message: `Expected ${type}, got ${token.type}`,
      expected: [type],
    });

    throw new Error(`Expected ${type}, got ${token.type}`);
  }
}

interface Token {
  type: string;
  value: any;
  line: number;
  column: number;
}

/**
 * Compiler that converts EQL-S queries to internal Query format
 */
export class EQLSCompiler {
  private projectionMap: Map<string, string> = new Map(); // column -> output variable

  compile(eqlsQuery: EQLSQuery): Query {
    const goals: Atom_[] = [];
    const variables = new Set<string>();
    this.projectionMap.clear();

    // Add the main entity type goal
    goals.push({
      predicate: 'attr',
      terms: [eqlsQuery.as, 'type', eqlsQuery.find],
    });
    variables.add(eqlsQuery.as.substring(1)); // Remove ? prefix

    // Compile WHERE clause
    if (eqlsQuery.where) {
      this.compileExpression(eqlsQuery.where, goals, variables);
    }

    // Add return variables with proper projection goals
    if (eqlsQuery.return) {
      for (const field of eqlsQuery.return) {
        if (this.isAttributeReference(field)) {
          // For attribute references like ?p.id, inject hidden attr goal
          const [entityVar, attributePath] =
            this.splitAttributeReference(field);
          const outputVar = this.generateTempVar();
          variables.add(outputVar);

          goals.push({
            predicate: 'attr',
            terms: [entityVar, attributePath, `?${outputVar}`],
          });

          // Map the original field to the output variable
          this.projectionMap.set(field, `?${outputVar}`);
        } else {
          // Plain variable reference
          variables.add(field.substring(1)); // Remove ? prefix
          this.projectionMap.set(field, field);
        }
      }
    }

    return { goals, variables };
  }

  getProjectionMap(): Map<string, string> {
    return this.projectionMap;
  }

  private isAttributeReference(field: string): boolean {
    return field.includes('.') && field.startsWith('?');
  }

  private splitAttributeReference(field: string): [string, string] {
    const parts = field.split('.');
    if (parts.length < 2) {
      throw new Error(`Invalid attribute reference: ${field}`);
    }
    const entityVar = parts[0]!;
    const attributePath = parts.slice(1).join('.');
    return [entityVar, attributePath];
  }

  private compileExpression(
    expr: EQLSExpression,
    goals: Atom_[],
    variables: Set<string>,
  ): void {
    if (!expr || typeof expr !== 'object') {
      throw new Error(`Invalid expression: ${expr}`);
    }

    if ('op' in expr && (expr.op === 'AND' || expr.op === 'OR')) {
      // Binary expression (AND/OR)
      this.compileExpression(expr.left as EQLSExpression, goals, variables);
      this.compileExpression(expr.right as EQLSExpression, goals, variables);
    } else {
      // Predicate
      this.compilePredicate(expr as EQLSPredicate, goals, variables);
    }
  }

  private compilePredicate(
    pred: EQLSPredicate,
    goals: Atom_[],
    variables: Set<string>,
  ): void {
    switch (pred.type) {
      case 'EQUALS':
        goals.push({
          predicate: 'attr',
          terms: [
            this.extractEntityVar(pred.field),
            this.extractAttributePath(pred.field),
            pred.value,
          ],
        });
        break;

      case 'MEMBERSHIP':
        goals.push({
          predicate: 'attr',
          terms: [
            this.extractEntityVar(pred.field),
            this.extractAttributePath(pred.field),
            pred.value,
          ],
        });
        break;

      case 'COMP':
        const tempVar = this.generateTempVar();
        variables.add(tempVar);
        goals.push({
          predicate: 'attr',
          terms: [
            this.extractEntityVar(pred.left),
            this.extractAttributePath(pred.left),
            `?${tempVar}`,
          ],
        });
        goals.push({
          predicate: pred.op.toLowerCase(),
          terms: [`?${tempVar}`, pred.right],
        });
        break;

      case 'BETWEEN':
        const tempVar2 = this.generateTempVar();
        variables.add(tempVar2);
        goals.push({
          predicate: 'attr',
          terms: [
            this.extractEntityVar(pred.field),
            this.extractAttributePath(pred.field),
            `?${tempVar2}`,
          ],
        });
        goals.push({
          predicate: 'between',
          terms: [`?${tempVar2}`, pred.min, pred.max],
        });
        break;

      case 'CONTAINS':
        const tempVar3 = this.generateTempVar();
        variables.add(tempVar3);
        goals.push({
          predicate: 'attr',
          terms: [
            this.extractEntityVar(pred.field),
            this.extractAttributePath(pred.field),
            `?${tempVar3}`,
          ],
        });
        goals.push({
          predicate: 'contains',
          terms: [`?${tempVar3}`, pred.pattern],
        });
        break;

      case 'MATCHES':
        const tempVar4 = this.generateTempVar();
        variables.add(tempVar4);

        // Store the attribute value for projection/output
        const attributePath = this.extractAttributePath(pred.field);
        const entityVar = this.extractEntityVar(pred.field);

        // First, get the attribute value
        goals.push({
          predicate: 'attr',
          terms: [
            entityVar,
            attributePath,
            `?${tempVar4}`,
          ],
        });

        // Then, add a regex predicate to filter results
        goals.push({
          predicate: 'regex',
          terms: [`?${tempVar4}`, pred.regex],
        });

        // For RETURN clause references, we'll handle in the compile method
        break;
    }
  }

  private extractEntityVar(field: string): string {
    // Convert ?p.reactions.likes to ?p
    const parts = field.split('.');
    return parts[0]!;
  }

  private extractAttributePath(field: string): string {
    // Convert ?p.reactions.likes to reactions.likes
    const parts = field.split('.');
    if (parts.length > 1) {
      return parts.slice(1).join('.');
    }
    return field.substring(1); // Remove ? prefix
  }

  private generateTempVar(): string {
    return `temp${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Main EQL-S processor that combines parsing and compilation
 */
export class EQLSProcessor {
  private parser = new EQLSParser();
  private compiler = new EQLSCompiler();
  private attributeResolver = new AttributeResolver();

  /**
   * Set the attribute schema for validation
   */
  setSchema(
    catalog: Array<{
      attribute: string;
      type: string;
      distinctCount: number;
      examples: any[];
    }>,
  ): void {
    this.attributeResolver.buildSchema(catalog);
  }

  process(query: string): {
    query?: Query;
    errors: EQLSError[];
    projectionMap?: Map<string, string>;
  } {
    const parseResult = this.parser.parse(query);
    if (parseResult.errors.length > 0) {
      return { errors: parseResult.errors };
    }

    // Make sure to include fields used in MATCHES/CONTAINS in the projection
    this.ensureFieldsInProjection(parseResult.query!);

    // Validate attributes against schema if available
    if (Object.keys(this.attributeResolver.getSchema()).length > 0) {
      const entityType = 'default'; // Use default entity type for now
      const attributes = this.extractAttributes(parseResult.query!);
      const validation = this.attributeResolver.validateQuery(
        entityType,
        attributes,
      );

      if (!validation.valid) {
        return {
          errors: validation.errors.map((msg) => ({
            message: msg,
            line: 1,
            column: 1,
          })),
        };
      }

      // Update the query with resolved attribute names
      this.resolveAttributesInQuery(parseResult.query!, validation.resolved);
    }

    const compiled = this.compiler.compile(parseResult.query!);
    const projectionMap = this.compiler.getProjectionMap();
    return { query: compiled, errors: [], projectionMap };
  }

  /**
   * Ensure that any fields used in WHERE clauses with MATCHES are also 
   * included in the RETURN clause for projection
   */
  private ensureFieldsInProjection(eqlsQuery: EQLSQuery): void {
    // Make sure return is initialized
    if (!eqlsQuery.return) {
      eqlsQuery.return = [];
    }

    // Extract fields from MATCHES predicates
    if (eqlsQuery.where) {
      const matchesFields = this.extractMatchesFields(eqlsQuery.where);

      // Add any MATCHES fields to the return projection if not already present
      for (const field of matchesFields) {
        if (!eqlsQuery.return.includes(field)) {
          eqlsQuery.return.push(field);
        }
      }
    }
  }

  /**
   * Extract all fields used in MATCHES predicates
   */
  private extractMatchesFields(expr: EQLSExpression): string[] {
    const fields: string[] = [];

    if ('op' in expr && (expr.op === 'AND' || expr.op === 'OR')) {
      // Binary expression (AND/OR)
      fields.push(...this.extractMatchesFields(expr.left));
      fields.push(...this.extractMatchesFields(expr.right));
    } else if ('type' in expr && expr.type === 'MATCHES' && 'field' in expr) {
      // MATCHES predicate
      fields.push(expr.field);
    }

    return fields;
  }

  private extractAttributes(eqlsQuery: EQLSQuery): string[] {
    const attributes = new Set<string>();

    // Extract from WHERE clause
    if (eqlsQuery.where) {
      this.extractAttributesFromExpression(eqlsQuery.where, attributes);
    }

    // Extract from RETURN clause
    if (eqlsQuery.return) {
      for (const field of eqlsQuery.return) {
        if (this.isAttributeReference(field)) {
          const [, attribute] = this.splitAttributeReference(field);
          attributes.add(attribute);
        }
      }
    }

    return Array.from(attributes);
  }

  private extractAttributesFromExpression(
    expr: EQLSExpression,
    attributes: Set<string>,
  ): void {
    if ('op' in expr && (expr.op === 'AND' || expr.op === 'OR')) {
      this.extractAttributesFromExpression(expr.left, attributes);
      this.extractAttributesFromExpression(expr.right, attributes);
    } else if ('field' in expr) {
      if (this.isAttributeReference(expr.field)) {
        const [, attribute] = this.splitAttributeReference(expr.field);
        attributes.add(attribute);
      }
    } else if ('left' in expr && 'right' in expr) {
      if (typeof expr.left === 'string' && this.isAttributeReference(expr.left)) {
        const [, attribute] = this.splitAttributeReference(expr.left);
        attributes.add(attribute);
      }
    }
  }

  private resolveAttributesInQuery(
    eqlsQuery: EQLSQuery,
    resolved: Map<string, string>,
  ): void {
    // Resolve attributes in WHERE clause
    if (eqlsQuery.where) {
      this.resolveAttributesInExpression(eqlsQuery.where, resolved);
    }

    // Resolve attributes in RETURN clause
    if (eqlsQuery.return) {
      for (let i = 0; i < eqlsQuery.return.length; i++) {
        const field = eqlsQuery.return[i]!;
        if (this.isAttributeReference(field)) {
          const [entityVar, attribute] = this.splitAttributeReference(field);
          const resolvedAttr = resolved.get(attribute);
          if (resolvedAttr) {
            eqlsQuery.return[i] = `${entityVar}.${resolvedAttr}`;
          }
        }
      }
    }
  }

  private resolveAttributesInExpression(
    expr: EQLSExpression,
    resolved: Map<string, string>,
  ): void {
    if ('op' in expr && (expr.op === 'AND' || expr.op === 'OR')) {
      this.resolveAttributesInExpression(expr.left, resolved);
      this.resolveAttributesInExpression(expr.right, resolved);
    } else if ('field' in expr) {
      if (this.isAttributeReference(expr.field)) {
        const [entityVar, attribute] = this.splitAttributeReference(expr.field);
        const resolvedAttr = resolved.get(attribute);
        if (resolvedAttr) {
          expr.field = `${entityVar}.${resolvedAttr}`;
        }
      }
    } else if ('left' in expr && 'right' in expr) {
      if (typeof expr.left === 'string' && this.isAttributeReference(expr.left)) {
        const [entityVar, attribute] = this.splitAttributeReference(expr.left);
        const resolvedAttr = resolved.get(attribute);
        if (resolvedAttr) {
          expr.left = `${entityVar}.${resolvedAttr}`;
        }
      }
    }
  }

  private isAttributeReference(field: string): boolean {
    return field.includes('.');
  }

  private splitAttributeReference(field: string): [string, string] {
    const parts = field.split('.');
    return [parts[0]!, parts.slice(1).join('.')];
  }
}
