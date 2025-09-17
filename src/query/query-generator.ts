/**
 * Query Generator for TQL
 * 
 * Analyzes JSON structure and suggests relevant EQL-S queries
 * based on entity types, attributes, and patterns in the data.
 */

import { EAVStore } from '../eav-engine.js';
import type { CatalogEntry } from '../eav-engine.js';

export interface QuerySuggestion {
    query: string;
    description: string;
    complexity: 'basic' | 'intermediate' | 'advanced';
    focus: 'exploration' | 'filtering' | 'aggregation' | 'relationship';
}

export interface QueryGeneratorOptions {
    maxSuggestions?: number;
    includeComplex?: boolean;
    preferredTypes?: string[];
}

/**
 * Query Generator - Analyzes EAV store and suggests meaningful queries
 */
export class QueryGenerator {
    private store: EAVStore;

    constructor(store: EAVStore) {
        this.store = store;
    }

    /**
     * Generate query suggestions based on catalog analysis
     */
    generateSuggestions(options: QueryGeneratorOptions = {}): QuerySuggestion[] {
        const catalog = this.store.getCatalog();
        const stats = this.store.getStats();
        const suggestions: QuerySuggestion[] = [];

        // Default options
        const maxSuggestions = options.maxSuggestions || 10;
        const includeComplex = options.includeComplex || true;

        // Get entity types from the catalog
        const entityTypes = this.extractEntityTypes();

        // Generate basic exploration queries for each entity type
        for (const entityType of entityTypes) {
            if (options.preferredTypes && !options.preferredTypes.includes(entityType)) {
                continue;
            }

            suggestions.push(...this.generateBasicQueries(entityType, catalog));

            if (includeComplex) {
                suggestions.push(...this.generateFilteringQueries(entityType, catalog));
                suggestions.push(...this.generateRelationshipQueries(entityType, catalog));
            }
        }

        // Sort by complexity (basic first) and limit
        return suggestions
            .sort((a, b) => this.complexityScore(a) - this.complexityScore(b))
            .slice(0, maxSuggestions);
    }

    /**
     * Extract all entity types from the store
     */
    private extractEntityTypes(): string[] {
        const typeFacts = this.store.getFactsByAttribute('type');
        const entityTypes = new Set<string>();

        for (const fact of typeFacts) {
            if (typeof fact.v === 'string') {
                entityTypes.add(fact.v);
            }
        }

        return Array.from(entityTypes);
    }

    /**
     * Generate basic exploration queries for an entity type
     */
    private generateBasicQueries(entityType: string, catalog: CatalogEntry[]): QuerySuggestion[] {
        const suggestions: QuerySuggestion[] = [];

        // Basic entity listing
        suggestions.push({
            query: `FIND ${entityType} AS ?e RETURN ?e`,
            description: `List all ${entityType} entities`,
            complexity: 'basic',
            focus: 'exploration'
        });

        // Find key attributes for this entity type
        const keyAttributes = this.findKeyAttributes(entityType, catalog);

        if (keyAttributes.length > 0) {
            const projections = keyAttributes.map(attr => `?e.${attr}`).join(', ');

            suggestions.push({
                query: `FIND ${entityType} AS ?e RETURN ${projections}`,
                description: `Show key information for all ${entityType} entities`,
                complexity: 'basic',
                focus: 'exploration'
            });
        }

        return suggestions;
    }

    /**
     * Generate filtering queries based on attribute types
     */
    private generateFilteringQueries(entityType: string, catalog: CatalogEntry[]): QuerySuggestion[] {
        const suggestions: QuerySuggestion[] = [];

        // Find numeric attributes for range filters
        const numericAttrs = catalog.filter(entry =>
            entry.type === 'number' &&
            this.attributeBelongsToEntityType(entry.attribute, entityType)
        );

        for (const attr of numericAttrs.slice(0, 2)) {
            // If we have min/max information, use it for range suggestions
            if (attr.min !== undefined && attr.max !== undefined) {
                const midpoint = Math.floor((attr.max - attr.min) / 2 + attr.min);

                suggestions.push({
                    query: `FIND ${entityType} AS ?e WHERE ?e.${attr.attribute} > ${midpoint} RETURN ?e`,
                    description: `Find ${entityType} entities with ${attr.attribute} greater than ${midpoint}`,
                    complexity: 'intermediate',
                    focus: 'filtering'
                });
            }
        }

        // Find string attributes for text search
        const stringAttrs = catalog.filter(entry =>
            entry.type === 'string' &&
            this.attributeBelongsToEntityType(entry.attribute, entityType) &&
            !entry.attribute.includes('id') // Avoid IDs
        );

        for (const attr of stringAttrs.slice(0, 2)) {
            if (attr.examples.length > 0 && typeof attr.examples[0] === 'string') {
                // Extract a word from the first example
                const example = attr.examples[0];
                const words = example.split(/\s+/).filter(w => w.length > 3);

                if (words.length > 0) {
                    suggestions.push({
                        query: `FIND ${entityType} AS ?e WHERE ?e.${attr.attribute} CONTAINS "${words[0]}" RETURN ?e`,
                        description: `Search for ${entityType} entities with "${words[0]}" in ${attr.attribute}`,
                        complexity: 'intermediate',
                        focus: 'filtering'
                    });
                }
            }
        }

        return suggestions;
    }

    /**
     * Generate relationship queries between entity types
     */
    private generateRelationshipQueries(entityType: string, catalog: CatalogEntry[]): QuerySuggestion[] {
        const suggestions: QuerySuggestion[] = [];
        const entityTypes = this.extractEntityTypes();

        // Look for foreign key relationships
        for (const otherType of entityTypes) {
            if (otherType === entityType) continue;

            // Check for attributes that might be foreign keys
            const possibleFKs = [
                `${otherType}Id`,
                `${otherType}_id`,
                `${otherType.toLowerCase()}Id`,
                `${otherType.toLowerCase()}_id`
            ];

            for (const fk of possibleFKs) {
                if (this.attributeExists(`${fk}`, entityType)) {
                    suggestions.push({
                        query: `FIND ${entityType} AS ?e1, ${otherType} AS ?e2 WHERE ?e1.${fk} = ?e2.id RETURN ?e1, ?e2`,
                        description: `Join ${entityType} with ${otherType} via ${fk}`,
                        complexity: 'advanced',
                        focus: 'relationship'
                    });
                    break;
                }
            }

            // Check for explicit link relationships
            const links = this.store.getLinksByAttribute(`BY`);
            if (links.length > 0) {
                for (const link of links) {
                    const [sourceType,] = link.e1.split(':');
                    const [targetType,] = link.e2.split(':');

                    if (
                        (sourceType === entityType && targetType === otherType) ||
                        (sourceType === otherType && targetType === entityType)
                    ) {
                        suggestions.push({
                            query: `FIND ${sourceType} AS ?e1, ${targetType} AS ?e2 WHERE LINK(?e1, "BY", ?e2) RETURN ?e1, ?e2`,
                            description: `Show ${sourceType} entities linked to ${targetType} entities`,
                            complexity: 'advanced',
                            focus: 'relationship'
                        });
                    }
                }
            }
        }

        return suggestions;
    }

    /**
     * Check if an attribute exists for an entity type
     */
    private attributeExists(attribute: string, entityType: string): boolean {
        const facts = this.store.getFactsByAttribute(attribute);

        for (const fact of facts) {
            const [type,] = fact.e.split(':');
            if (type === entityType) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if an attribute belongs to an entity type
     */
    private attributeBelongsToEntityType(attribute: string, entityType: string): boolean {
        // Skip the 'type' attribute itself
        if (attribute === 'type') return false;

        const facts = this.store.getFactsByAttribute(attribute);

        for (const fact of facts) {
            const [type,] = fact.e.split(':');
            if (type === entityType) {
                return true;
            }
        }

        return false;
    }

    /**
     * Find key attributes for an entity type (excluding technical fields)
     */
    private findKeyAttributes(entityType: string, catalog: CatalogEntry[]): string[] {
        const attributes: string[] = [];
        const skipAttrs = new Set(['type', 'id', '_id']);

        // Add ID attribute as first key
        attributes.push('id');

        // Look for common key attributes
        const nameAttrs = ['name', 'title', 'label'];
        for (const attr of nameAttrs) {
            if (this.attributeBelongsToEntityType(attr, entityType)) {
                attributes.push(attr);
            }
        }

        // Add a few more informative attributes
        for (const entry of catalog) {
            if (
                attributes.length < 5 &&
                this.attributeBelongsToEntityType(entry.attribute, entityType) &&
                !skipAttrs.has(entry.attribute) &&
                !attributes.includes(entry.attribute) &&
                !entry.attribute.endsWith('Id') &&
                entry.cardinality === 'one' // Avoid array attributes for basic queries
            ) {
                attributes.push(entry.attribute);
            }
        }

        return attributes;
    }

    /**
     * Score complexity for sorting
     */
    private complexityScore(suggestion: QuerySuggestion): number {
        const complexityScores = {
            'basic': 1,
            'intermediate': 2,
            'advanced': 3
        };

        return complexityScores[suggestion.complexity];
    }
}