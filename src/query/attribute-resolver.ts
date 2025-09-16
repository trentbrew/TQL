/**
 * Attribute Resolver - Schema-aware attribute name resolution
 *
 * This module provides robust attribute name resolution by:
 * 1. Building a schema from loaded data
 * 2. Validating query attributes against the schema
 * 3. Providing case-insensitive matching with exact name resolution
 */

export interface AttributeSchema {
  [entityType: string]: {
    [attributeName: string]: {
      type: string;
      distinctCount: number;
      examples: any[];
    };
  };
}

export class AttributeResolver {
  private schema: AttributeSchema = {};

  /**
   * Build schema from EAV store catalog
   */
  buildSchema(
    catalog: Array<{
      attribute: string;
      type: string;
      distinctCount: number;
      examples: any[];
    }>,
  ): void {
    this.schema = {};

    for (const entry of catalog) {
      // For now, assume all attributes belong to a single entity type
      // In the future, we could parse entity type from attribute paths
      const entityType = 'default';
      const attributeName = entry.attribute;

      if (!this.schema[entityType]) {
        this.schema[entityType] = {};
      }

      this.schema[entityType]![attributeName] = {
        type: entry.type,
        distinctCount: entry.distinctCount,
        examples: entry.examples,
      };
    }
  }

  /**
   * Resolve attribute name with case-insensitive matching
   * Returns the exact attribute name from the schema
   */
  resolveAttribute(entityType: string, queryAttribute: string): string | null {
    const entitySchema = this.schema[entityType];
    if (!entitySchema) {
      return null;
    }

    const queryLower = queryAttribute.toLowerCase();

    // First try exact match
    if (entitySchema[queryAttribute]) {
      return queryAttribute;
    }

    // Then try case-insensitive match
    for (const [actualAttribute] of Object.entries(entitySchema)) {
      if (actualAttribute.toLowerCase() === queryLower) {
        return actualAttribute;
      }
    }

    return null;
  }

  /**
   * Validate all attributes in a query against the schema
   */
  validateQuery(
    entityType: string,
    attributes: string[],
  ): { valid: boolean; errors: string[]; resolved: Map<string, string> } {
    const errors: string[] = [];
    const resolved = new Map<string, string>();

    for (const attr of attributes) {
      const resolvedAttr = this.resolveAttribute(entityType, attr);
      if (resolvedAttr) {
        resolved.set(attr, resolvedAttr);
      } else {
        errors.push(
          `Unknown attribute '${attr}' for entity type '${entityType}'. Available attributes: ${Object.keys(
            this.schema[entityType] || {},
          ).join(', ')}`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      resolved,
    };
  }

  /**
   * Get all available attributes for an entity type
   */
  getAvailableAttributes(entityType: string): string[] {
    return Object.keys(this.schema[entityType] || {});
  }

  /**
   * Get schema for debugging
   */
  getSchema(): AttributeSchema {
    return this.schema;
  }
}
