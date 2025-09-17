/**
 * Dataset Relationship Analyzer
 * 
 * Analyzes multiple datasets in EAV stores to identify potential relationships
 * and join points. This helps with automated insights generation across
 * related datasets.
 */

import { EAVStore } from '../eav-engine.js';
import type { CatalogEntry } from '../eav-engine.js';

export interface RelationshipType {
    type: 'foreignKey' | 'sameAttribute' | 'valueReference' | 'similar';
    confidence: number; // 0-1 score
    description: string;
}

export interface DatasetRelationship {
    sourceDataset: string;
    sourceType: string;
    sourceAttribute: string;
    targetDataset: string;
    targetType: string;
    targetAttribute: string;
    relationship: RelationshipType;
    examples: Array<{ source: any, target: any }>;
}

export interface AnalyzerOptions {
    minConfidence?: number;
    maxRelationships?: number;
    ignoredAttributes?: string[];
    preferredTypes?: string[];
}

/**
 * Dataset Relationship Analyzer
 * Identifies potential connections between different datasets
 */
export class DatasetRelationshipAnalyzer {
    private datasets: Map<string, EAVStore> = new Map();

    /**
     * Add a dataset for relationship analysis
     */
    addDataset(name: string, store: EAVStore): void {
        this.datasets.set(name, store);
    }

    /**
     * Analyze relationships between all datasets
     */
    analyzeRelationships(options: AnalyzerOptions = {}): DatasetRelationship[] {
        const relationships: DatasetRelationship[] = [];
        const minConfidence = options.minConfidence || 0.5;
        const ignoredAttributes = new Set(options.ignoredAttributes || ['type', 'id']);

        // For each pair of datasets
        const datasetNames = Array.from(this.datasets.keys());
        for (let i = 0; i < datasetNames.length; i++) {
            const sourceDatasetName = datasetNames[i]!;
            const sourceStore = this.datasets.get(sourceDatasetName)!;

            for (let j = i + 1; j < datasetNames.length; j++) {
                const targetDatasetName = datasetNames[j]!;
                const targetStore = this.datasets.get(targetDatasetName)!;

                // Find potential relationships between these datasets
                const datasetRelationships = this.findRelationshipsBetweenDatasets(
                    sourceDatasetName,
                    sourceStore,
                    targetDatasetName,
                    targetStore,
                    ignoredAttributes
                );

                // Filter by confidence and add to results
                for (const relationship of datasetRelationships) {
                    if (relationship.relationship.confidence >= minConfidence) {
                        relationships.push(relationship);
                    }
                }
            }
        }

        // Sort by confidence and limit if needed
        relationships.sort((a, b) =>
            b.relationship.confidence - a.relationship.confidence
        );

        if (options.maxRelationships && relationships.length > options.maxRelationships) {
            return relationships.slice(0, options.maxRelationships);
        }

        return relationships;
    }

    /**
     * Find relationships between two specific datasets
     */
    private findRelationshipsBetweenDatasets(
        sourceDatasetName: string,
        sourceStore: EAVStore,
        targetDatasetName: string,
        targetStore: EAVStore,
        ignoredAttributes: Set<string>
    ): DatasetRelationship[] {
        const relationships: DatasetRelationship[] = [];

        const sourceCatalog = sourceStore.getCatalog();
        const targetCatalog = targetStore.getCatalog();

        // Get entity types from both datasets
        const sourceTypes = this.extractEntityTypes(sourceStore);
        const targetTypes = this.extractEntityTypes(targetStore);

        // For each source entity type
        for (const sourceType of sourceTypes) {
            // For each target entity type
            for (const targetType of targetTypes) {
                // Check for potential foreign key relationships
                relationships.push(...this.findForeignKeyRelationships(
                    sourceDatasetName,
                    sourceType,
                    sourceStore,
                    targetDatasetName,
                    targetType,
                    targetStore,
                    ignoredAttributes
                ));

                // Check for same attribute relationships
                relationships.push(...this.findCommonAttributeRelationships(
                    sourceDatasetName,
                    sourceType,
                    sourceStore,
                    sourceCatalog,
                    targetDatasetName,
                    targetType,
                    targetStore,
                    targetCatalog,
                    ignoredAttributes
                ));

                // Check for value reference relationships
                relationships.push(...this.findValueReferenceRelationships(
                    sourceDatasetName,
                    sourceType,
                    sourceStore,
                    targetDatasetName,
                    targetType,
                    targetStore,
                    ignoredAttributes
                ));
            }
        }

        return relationships;
    }

    /**
     * Extract all entity types from a store
     */
    private extractEntityTypes(store: EAVStore): string[] {
        const typeFacts = store.getFactsByAttribute('type');
        const entityTypes = new Set<string>();

        for (const fact of typeFacts) {
            if (typeof fact.v === 'string') {
                entityTypes.add(fact.v);
            }
        }

        return Array.from(entityTypes);
    }

    /**
     * Find potential foreign key relationships between datasets
     */
    private findForeignKeyRelationships(
        sourceDatasetName: string,
        sourceType: string,
        sourceStore: EAVStore,
        targetDatasetName: string,
        targetType: string,
        targetStore: EAVStore,
        ignoredAttributes: Set<string>
    ): DatasetRelationship[] {
        const relationships: DatasetRelationship[] = [];

        // Common patterns for foreign key attributes
        const possibleFKPatterns = [
            // Direct references
            `${targetType}Id`,
            `${targetType}_id`,
            `${targetType.toLowerCase()}Id`,
            `${targetType.toLowerCase()}_id`,
            // Plural forms
            `${targetType}sId`,
            `${targetType}s_id`,
            `${targetType.toLowerCase()}sId`,
            `${targetType.toLowerCase()}s_id`,
        ];

        // Check for any attribute that matches FK patterns
        for (const pattern of possibleFKPatterns) {
            if (ignoredAttributes.has(pattern)) continue;

            const sourceFacts = sourceStore.getFactsByAttribute(pattern);
            if (sourceFacts.length === 0) continue;

            // Check if values in source match IDs in target
            const targetIdFacts = targetStore.getFactsByAttribute('id');
            if (targetIdFacts.length === 0) continue;

            // Build a set of target IDs for quick lookup
            const targetIds = new Set<string>();
            for (const fact of targetIdFacts) {
                if (fact.v !== undefined) {
                    targetIds.add(String(fact.v));
                }
            }

            // Count matches to calculate confidence
            let matches = 0;
            let total = 0;
            const examples: Array<{ source: any, target: any }> = [];

            for (const fact of sourceFacts) {
                const [factType] = fact.e.split(':');
                if (factType !== sourceType) continue;

                total++;
                const sourceValue = String(fact.v);

                if (targetIds.has(sourceValue)) {
                    matches++;

                    // Add up to 3 examples
                    if (examples.length < 3) {
                        // Find corresponding target entity
                        for (const targetFact of targetIdFacts) {
                            if (String(targetFact.v) === sourceValue) {
                                examples.push({
                                    source: { entity: fact.e, value: fact.v },
                                    target: { entity: targetFact.e, value: targetFact.v }
                                });
                                break;
                            }
                        }
                    }
                }
            }

            // Calculate confidence
            const confidence = total > 0 ? matches / total : 0;

            // Add relationship if we found matches
            if (matches > 0) {
                relationships.push({
                    sourceDataset: sourceDatasetName,
                    sourceType,
                    sourceAttribute: pattern,
                    targetDataset: targetDatasetName,
                    targetType,
                    targetAttribute: 'id',
                    relationship: {
                        type: 'foreignKey',
                        confidence,
                        description: `${matches} of ${total} values in ${sourceType}.${pattern} match ${targetType}.id`
                    },
                    examples
                });
            }
        }

        return relationships;
    }

    /**
     * Find attributes with the same name/meaning across datasets
     */
    private findCommonAttributeRelationships(
        sourceDatasetName: string,
        sourceType: string,
        sourceStore: EAVStore,
        sourceCatalog: CatalogEntry[],
        targetDatasetName: string,
        targetType: string,
        targetStore: EAVStore,
        targetCatalog: CatalogEntry[],
        ignoredAttributes: Set<string>
    ): DatasetRelationship[] {
        const relationships: DatasetRelationship[] = [];

        // Create maps for quick attribute lookup
        const sourceAttributes = new Map<string, CatalogEntry>();
        const targetAttributes = new Map<string, CatalogEntry>();

        for (const entry of sourceCatalog) {
            if (!ignoredAttributes.has(entry.attribute)) {
                sourceAttributes.set(entry.attribute, entry);
            }
        }

        for (const entry of targetCatalog) {
            if (!ignoredAttributes.has(entry.attribute)) {
                targetAttributes.set(entry.attribute, entry);
            }
        }

        // Common business attributes that often have the same meaning
        const commonBusinessAttributes = [
            'name', 'title', 'description', 'email', 'phone',
            'address', 'city', 'state', 'country', 'zipCode',
            'price', 'cost', 'category', 'tags', 'status',
            'createdAt', 'updatedAt', 'date', 'author', 'owner'
        ];

        // Check for attributes with the same name
        for (const [sourceAttr, sourceEntry] of sourceAttributes) {
            // Skip if the attribute doesn't apply to sourceType
            if (!this.attributeBelongsToEntityType(sourceStore, sourceAttr, sourceType)) {
                continue;
            }

            for (const [targetAttr, targetEntry] of targetAttributes) {
                // Skip if the attribute doesn't apply to targetType
                if (!this.attributeBelongsToEntityType(targetStore, targetAttr, targetType)) {
                    continue;
                }

                // Exact match or common business attribute
                const isExactMatch = sourceAttr === targetAttr;
                const isCommonBusiness = commonBusinessAttributes.includes(sourceAttr) &&
                    commonBusinessAttributes.includes(targetAttr);

                if (isExactMatch || isCommonBusiness) {
                    // For exact matches, check if the data types are compatible
                    const typeCompatibility = this.getTypeCompatibility(
                        sourceEntry.type,
                        targetEntry.type
                    );

                    // Check value overlap
                    const overlapScore = this.calculateValueOverlap(
                        sourceStore,
                        sourceType,
                        sourceAttr,
                        targetStore,
                        targetType,
                        targetAttr
                    );

                    // Calculate confidence based on type compatibility and value overlap
                    const confidence = (typeCompatibility + overlapScore) / 2;

                    // Add relationship if confidence is high enough
                    if (confidence > 0.2) {
                        // Get examples
                        const examples = this.getValueExamples(
                            sourceStore,
                            sourceType,
                            sourceAttr,
                            targetStore,
                            targetType,
                            targetAttr
                        );

                        relationships.push({
                            sourceDataset: sourceDatasetName,
                            sourceType,
                            sourceAttribute: sourceAttr,
                            targetDataset: targetDatasetName,
                            targetType,
                            targetAttribute: targetAttr,
                            relationship: {
                                type: 'sameAttribute',
                                confidence,
                                description: isExactMatch
                                    ? `Both datasets have '${sourceAttr}' attribute with ${Math.round(overlapScore * 100)}% value similarity`
                                    : `'${sourceAttr}' in ${sourceType} may correspond to '${targetAttr}' in ${targetType}`
                            },
                            examples
                        });
                    }
                }
            }
        }

        return relationships;
    }

    /**
     * Find cases where values in one dataset might reference entities in another
     */
    private findValueReferenceRelationships(
        sourceDatasetName: string,
        sourceType: string,
        sourceStore: EAVStore,
        targetDatasetName: string,
        targetType: string,
        targetStore: EAVStore,
        ignoredAttributes: Set<string>
    ): DatasetRelationship[] {
        const relationships: DatasetRelationship[] = [];

        // Get attributes for the source type
        const sourceCatalog = sourceStore.getCatalog();
        const sourceAttributes = sourceCatalog
            .filter(entry => !ignoredAttributes.has(entry.attribute))
            .filter(entry => this.attributeBelongsToEntityType(sourceStore, entry.attribute, sourceType))
            .map(entry => entry.attribute);

        // Get name-like attributes for target type
        const targetNameAttrs = ['name', 'title', 'label', 'displayName']
            .filter(attr => this.attributeBelongsToEntityType(targetStore, attr, targetType));

        if (targetNameAttrs.length === 0) return relationships;

        // For each source attribute
        for (const sourceAttr of sourceAttributes) {
            // Skip id-like attributes (already handled by foreign key check)
            if (sourceAttr.toLowerCase().includes('id')) continue;

            // Get source facts
            const sourceFacts = sourceStore.getFactsByAttribute(sourceAttr);
            if (sourceFacts.length === 0) continue;

            // For each target name attribute
            for (const targetNameAttr of targetNameAttrs) {
                // Get target facts
                const targetFacts = targetStore.getFactsByAttribute(targetNameAttr);
                if (targetFacts.length === 0) continue;

                // Build a set of target names for quick lookup
                const targetNames = new Set<string>();
                for (const fact of targetFacts) {
                    const [factType] = fact.e.split(':');
                    if (factType === targetType && typeof fact.v === 'string') {
                        targetNames.add(fact.v.toLowerCase());
                    }
                }

                // Count matches
                let matches = 0;
                let total = 0;
                const examples: Array<{ source: any, target: any }> = [];

                for (const fact of sourceFacts) {
                    const [factType] = fact.e.split(':');
                    if (factType !== sourceType || typeof fact.v !== 'string') continue;

                    total++;
                    const sourceValue = fact.v.toLowerCase();

                    // Check if the source value exists in target names
                    if (targetNames.has(sourceValue)) {
                        matches++;

                        // Add up to 3 examples
                        if (examples.length < 3) {
                            // Find corresponding target entity
                            for (const targetFact of targetFacts) {
                                if (typeof targetFact.v === 'string' && targetFact.v.toLowerCase() === sourceValue) {
                                    examples.push({
                                        source: { entity: fact.e, value: fact.v },
                                        target: { entity: targetFact.e, value: targetFact.v }
                                    });
                                    break;
                                }
                            }
                        }
                    }
                }

                // Calculate confidence
                const confidence = total > 0 ? matches / total : 0;

                // Add relationship if we found matches
                if (matches > 0 && confidence > 0.1) {
                    relationships.push({
                        sourceDataset: sourceDatasetName,
                        sourceType,
                        sourceAttribute: sourceAttr,
                        targetDataset: targetDatasetName,
                        targetType,
                        targetAttribute: targetNameAttr,
                        relationship: {
                            type: 'valueReference',
                            confidence,
                            description: `${matches} of ${total} values in ${sourceType}.${sourceAttr} match ${targetType}.${targetNameAttr}`
                        },
                        examples
                    });
                }
            }
        }

        return relationships;
    }

    /**
     * Check if an attribute belongs to an entity type
     */
    private attributeBelongsToEntityType(
        store: EAVStore,
        attribute: string,
        entityType: string
    ): boolean {
        // Skip the 'type' attribute itself
        if (attribute === 'type') return false;

        const facts = store.getFactsByAttribute(attribute);

        for (const fact of facts) {
            const [type] = fact.e.split(':');
            if (type === entityType) {
                return true;
            }
        }

        return false;
    }

    /**
     * Calculate compatibility score between two attribute types
     */
    private getTypeCompatibility(type1: string, type2: string): number {
        if (type1 === type2) return 1.0;
        if (type1 === 'mixed' || type2 === 'mixed') return 0.5;

        // Some types are somewhat compatible
        const compatPairs = [
            ['string', 'date'],
            ['string', 'number'],
            ['number', 'date']
        ];

        for (const [t1, t2] of compatPairs) {
            if ((type1 === t1 && type2 === t2) || (type1 === t2 && type2 === t1)) {
                return 0.3;
            }
        }

        return 0.0;
    }

    /**
     * Calculate how much the values overlap between two attributes
     */
    private calculateValueOverlap(
        sourceStore: EAVStore,
        sourceType: string,
        sourceAttr: string,
        targetStore: EAVStore,
        targetType: string,
        targetAttr: string
    ): number {
        const sourceFacts = sourceStore.getFactsByAttribute(sourceAttr);
        const targetFacts = targetStore.getFactsByAttribute(targetAttr);

        if (sourceFacts.length === 0 || targetFacts.length === 0) return 0;

        // Filter facts by entity type
        const sourceValues = new Set<string>();
        const targetValues = new Set<string>();

        for (const fact of sourceFacts) {
            const [type] = fact.e.split(':');
            if (type === sourceType) {
                sourceValues.add(String(fact.v));
            }
        }

        for (const fact of targetFacts) {
            const [type] = fact.e.split(':');
            if (type === targetType) {
                targetValues.add(String(fact.v));
            }
        }

        if (sourceValues.size === 0 || targetValues.size === 0) return 0;

        // Count overlapping values
        let overlapCount = 0;
        for (const value of sourceValues) {
            if (targetValues.has(value)) {
                overlapCount++;
            }
        }

        // Calculate Jaccard similarity: |A ∩ B| / |A ∪ B|
        const unionSize = sourceValues.size + targetValues.size - overlapCount;
        return unionSize > 0 ? overlapCount / unionSize : 0;
    }

    /**
     * Get examples of matching values between attributes
     */
    private getValueExamples(
        sourceStore: EAVStore,
        sourceType: string,
        sourceAttr: string,
        targetStore: EAVStore,
        targetType: string,
        targetAttr: string
    ): Array<{ source: any, target: any }> {
        const examples: Array<{ source: any, target: any }> = [];
        const sourceFacts = sourceStore.getFactsByAttribute(sourceAttr);
        const targetFacts = targetStore.getFactsByAttribute(targetAttr);

        if (sourceFacts.length === 0 || targetFacts.length === 0) return examples;

        // Create a map of target values for quick lookup
        const targetValueMap = new Map<string, Array<{ entity: string, value: any }>>();

        for (const fact of targetFacts) {
            const [type] = fact.e.split(':');
            if (type === targetType) {
                const valueKey = String(fact.v);
                if (!targetValueMap.has(valueKey)) {
                    targetValueMap.set(valueKey, []);
                }
                targetValueMap.get(valueKey)!.push({
                    entity: fact.e,
                    value: fact.v
                });
            }
        }

        // Find matching values
        for (const fact of sourceFacts) {
            const [type] = fact.e.split(':');
            if (type === sourceType) {
                const valueKey = String(fact.v);
                if (targetValueMap.has(valueKey)) {
                    const targetMatch = targetValueMap.get(valueKey)![0];
                    examples.push({
                        source: { entity: fact.e, value: fact.v },
                        target: targetMatch
                    });

                    // Limit to 3 examples
                    if (examples.length >= 3) break;
                }
            }
        }

        return examples;
    }

    /**
     * Generate suggested join queries based on discovered relationships
     */
    generateJoinQueries(relationships: DatasetRelationship[]): Array<{
        query: string;
        description: string;
        datasets: string[];
    }> {
        const queries: Array<{
            query: string;
            description: string;
            datasets: string[];
        }> = [];

        // Group relationships by participating datasets
        const datasetPairs = new Map<string, DatasetRelationship[]>();

        for (const rel of relationships) {
            const key = [rel.sourceDataset, rel.targetDataset].sort().join(':');
            if (!datasetPairs.has(key)) {
                datasetPairs.set(key, []);
            }
            datasetPairs.get(key)!.push(rel);
        }

        // Generate queries for each dataset pair
        for (const [pairKey, relations] of datasetPairs) {
            // Sort by confidence
            relations.sort((a, b) =>
                b.relationship.confidence - a.relationship.confidence
            );

            // Take best relation for this pair
            const bestRelation = relations[0]!;

            // Generate EQL-S query based on relation type
            let query = '';
            let description = '';

            switch (bestRelation.relationship.type) {
                case 'foreignKey':
                    query = this.generateForeignKeyJoinQuery(bestRelation);
                    description = `Join ${bestRelation.sourceType} with ${bestRelation.targetType} using foreign key relationship`;
                    break;

                case 'sameAttribute':
                    query = this.generateSameAttributeJoinQuery(bestRelation);
                    description = `Join ${bestRelation.sourceType} with ${bestRelation.targetType} where they share the same ${bestRelation.sourceAttribute} value`;
                    break;

                case 'valueReference':
                    query = this.generateValueReferenceJoinQuery(bestRelation);
                    description = `Join ${bestRelation.sourceType} with ${bestRelation.targetType} where ${bestRelation.sourceAttribute} references ${bestRelation.targetAttribute}`;
                    break;

                default:
                    continue;
            }

            if (query) {
                queries.push({
                    query,
                    description,
                    datasets: pairKey.split(':')
                });
            }
        }

        return queries;
    }

    /**
     * Generate query for foreign key relationship
     */
    private generateForeignKeyJoinQuery(relation: DatasetRelationship): string {
        return `FIND ${relation.sourceType} AS ?source, ${relation.targetType} AS ?target
WHERE ?source.${relation.sourceAttribute} = ?target.${relation.targetAttribute}
RETURN ?source, ?target`;
    }

    /**
     * Generate query for same attribute relationship
     */
    private generateSameAttributeJoinQuery(relation: DatasetRelationship): string {
        return `FIND ${relation.sourceType} AS ?source, ${relation.targetType} AS ?target
WHERE ?source.${relation.sourceAttribute} = ?target.${relation.targetAttribute}
RETURN ?source.${relation.sourceAttribute}, ?source, ?target`;
    }

    /**
     * Generate query for value reference relationship
     */
    private generateValueReferenceJoinQuery(relation: DatasetRelationship): string {
        return `FIND ${relation.sourceType} AS ?source, ${relation.targetType} AS ?target
WHERE ?source.${relation.sourceAttribute} = ?target.${relation.targetAttribute}
RETURN ?source.${relation.sourceAttribute}, ?source, ?target`;
    }
}