/**
 * Insights Engine
 * 
 * Automatically identifies potential insights and generates TQL queries
 * from multiple related datasets.
 */

import { EAVStore } from '../eav-engine.js';
import { DatasetRelationshipAnalyzer, type DatasetRelationship, type RelationshipType } from './dataset-relationship-analyzer.js';
import type { Atom, CatalogEntry } from '../eav-engine.js';

/**
 * Types of insights the engine can generate
 */
export enum InsightType {
    // Basic insights
    COUNT = 'count',
    DISTRIBUTION = 'distribution',
    TOP_VALUES = 'top_values',
    BOTTOM_VALUES = 'bottom_values',

    // Statistical insights
    AVERAGE = 'average',
    MIN_MAX = 'min_max',
    OUTLIERS = 'outliers',

    // Relationship insights
    CORRELATION = 'correlation',
    JOIN_STATS = 'join_stats',
    CARDINALITY = 'cardinality',

    // Time-based insights (if date fields present)
    TREND = 'trend',
    TIME_COMPARISON = 'time_comparison'
}

/**
 * Represents a generated insight with metadata and query
 */
export interface InsightResult {
    id: string;
    type: InsightType;
    title: string;
    description: string;
    query: string;
    datasets: string[];
    confidence: number; // 0-1 indicating how likely this insight is to be valuable
    attributes: string[]; // attributes analyzed in this insight
    entityTypes: string[]; // entity types analyzed
}

/**
 * Configuration for insight generation
 */
export interface InsightEngineConfig {
    // Minimum confidence threshold (0-1) for returned insights
    confidenceThreshold?: number;

    // Maximum number of insights to generate
    maxInsights?: number;

    // Types of insights to include (all by default)
    insightTypes?: InsightType[];

    // Whether to include verbose descriptions with each insight
    verbose?: boolean;
}

/**
 * Attribute metadata extracted from store
 */
interface AttributeMetadata {
    name: string;
    entityType: string;
    dataType: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object' | 'unknown';
    uniqueValues: Set<any>;
    uniqueCount: number;
    totalCount: number;
    min?: number | Date;
    max?: number | Date;
    avgLength?: number;
    hasNulls: boolean;
    distribution?: Record<string, number>;
    sample?: any[];
}

/**
 * Main insights engine class
 */
export class InsightsEngine {
    private stores: Map<string, EAVStore> = new Map();
    private attributeMetadata: Map<string, AttributeMetadata> = new Map();
    private relationships: DatasetRelationship[] = [];
    private analyzer: DatasetRelationshipAnalyzer = new DatasetRelationshipAnalyzer();
    private config: InsightEngineConfig = {
        confidenceThreshold: 0.5,
        maxInsights: 20,
        insightTypes: Object.values(InsightType),
        verbose: true
    };

    /**
     * Create a new insights engine
     */
    constructor(config?: Partial<InsightEngineConfig>) {
        if (config) {
            this.config = { ...this.config, ...config };
        }
    }

    /**
     * Register a dataset with the engine
     */
    registerDataset(name: string, store: EAVStore): void {
        this.stores.set(name, store);
        this.analyzer.addDataset(name, store);
        this.analyzeDataset(name, store);
    }

    /**
     * Generate insights across all registered datasets
     */
    generateInsights(): InsightResult[] {
        // First analyze relationships if we have multiple datasets
        if (this.stores.size > 1) {
            // Analyze relationships using the DatasetRelationshipAnalyzer
            this.relationships = this.analyzer.analyzeRelationships({
                minConfidence: this.config.confidenceThreshold
            });
        }

        const insights: InsightResult[] = [];

        // Generate single-dataset insights
        for (const [datasetName, store] of this.stores.entries()) {
            const datasetInsights = this.generateDatasetInsights(datasetName, store);
            insights.push(...datasetInsights);
        }

        // Generate cross-dataset insights if relationships exist
        if (this.relationships.length > 0) {
            const crossDatasetInsights = this.generateCrossDatasetInsights();
            insights.push(...crossDatasetInsights);
        }

        // Sort by confidence and limit
        return insights
            .filter(insight => insight.confidence >= (this.config.confidenceThreshold || 0))
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, this.config.maxInsights);
    }

    /**
     * Analyze dataset and extract metadata
     */
    private analyzeDataset(datasetName: string, store: EAVStore): void {
        const catalog = store.getCatalog();
        const entityTypes = new Set<string>();
        const attributes: Record<string, Set<any>> = {};

        // Track counts by entity type
        const entityTypeCounts: Record<string, number> = {};

        // Extract entity types
        const typeFacts = store.getFactsByAttribute('type');
        typeFacts.forEach(fact => {
            const entityId = fact.e;
            const type = fact.v as string;
            entityTypes.add(type);
            entityTypeCounts[type] = (entityTypeCounts[type] || 0) + 1;
        });

        // Process catalog for attribute information
        for (const entry of catalog) {
            const attr = entry.attribute;
            const attrValues = new Set<any>();
            const typeMap: Record<string, number> = {};
            let numericalCount = 0;
            let stringCount = 0;
            let booleanCount = 0;
            let dateCount = 0;
            let nullCount = 0;
            let totalLength = 0;
            let minNum: number | undefined;
            let maxNum: number | undefined;
            let minDate: Date | undefined;
            let maxDate: Date | undefined;
            const distribution: Record<string, number> = {};
            const samples: any[] = [];

            // Sample some values (up to 10)
            let sampleCount = 0;

            // Get facts for this attribute to analyze
            const facts = store.getFactsByAttribute(attr);

            // Process each fact
            for (const fact of facts) {
                const value = fact.v;

                // Track distribution
                const valueStr = String(value);
                distribution[valueStr] = (distribution[valueStr] || 0) + 1;

                // Sample values
                if (sampleCount < 10) {
                    samples.push(value);
                    sampleCount++;
                }

                // Track value for uniqueness calculation
                attrValues.add(value);

                // Determine data type
                if (value === null || value === undefined) {
                    nullCount++;
                } else if (typeof value === 'number') {
                    numericalCount++;
                    if (minNum === undefined || value < minNum) minNum = value;
                    if (maxNum === undefined || value > maxNum) maxNum = value;
                } else if (typeof value === 'string') {
                    stringCount++;
                    totalLength += value.length;

                    // Check if string is a date
                    const dateTest = new Date(value);
                    if (!isNaN(dateTest.getTime())) {
                        dateCount++;
                        if (minDate === undefined || dateTest < minDate) minDate = dateTest;
                        if (maxDate === undefined || dateTest > maxDate) maxDate = dateTest;
                    }
                } else if (typeof value === 'boolean') {
                    booleanCount++;
                }

                // Extract entity type from the entity ID
                const entityId = fact.e;
                const entityTypeFacts = store.getFactsByEntity(entityId)
                    .filter(f => f.a === 'type');

                if (entityTypeFacts.length > 0) {
                    const entityType = entityTypeFacts[0].v as string;
                    typeMap[entityType] = (typeMap[entityType] || 0) + 1;
                }
            }

            // Determine predominant type
            let primaryEntityType = '';
            let maxCount = 0;

            for (const [type, count] of Object.entries(typeMap)) {
                if (count > maxCount) {
                    maxCount = count;
                    primaryEntityType = type;
                }
            }

            // Determine predominant data type
            let dataType: AttributeMetadata['dataType'] = 'unknown';
            if (numericalCount > stringCount && numericalCount > booleanCount) {
                dataType = 'number';
            } else if (stringCount > numericalCount && stringCount > booleanCount) {
                dataType = dateCount > stringCount / 2 ? 'date' : 'string';
            } else if (booleanCount > numericalCount && booleanCount > stringCount) {
                dataType = 'boolean';
            }

            // Calculate average string length if applicable
            const avgLength = stringCount > 0 ? totalLength / stringCount : undefined;

            // Store metadata
            const metadata: AttributeMetadata = {
                name: attr,
                entityType: primaryEntityType,
                dataType,
                uniqueValues: attrValues,
                uniqueCount: attrValues.size,
                totalCount: facts.length,
                hasNulls: nullCount > 0,
                avgLength,
                distribution,
                sample: samples
            };

            // Add min/max for numbers and dates
            if (dataType === 'number') {
                metadata.min = minNum;
                metadata.max = maxNum;
            } else if (dataType === 'date') {
                metadata.min = minDate;
                metadata.max = maxDate;
            }

            // Store with qualified name (dataset.attribute)
            this.attributeMetadata.set(`${datasetName}.${attr}`, metadata);
        }
    }

    /**
     * Generate insights for a single dataset
     */
    private generateDatasetInsights(datasetName: string, store: EAVStore): InsightResult[] {
        const insights: InsightResult[] = [];
        const entityTypes = new Set<string>();

        // Get all entity types in this dataset
        const typeFacts = store.getFactsByAttribute('type');
        typeFacts.forEach(fact => {
            const type = fact.v as string;
            entityTypes.add(type);
        });

        // Generate insights for each entity type
        for (const entityType of entityTypes) {
            // Basic count insight
            if (this.config.insightTypes?.includes(InsightType.COUNT)) {
                insights.push(this.createCountInsight(datasetName, entityType));
            }

            // Get all attributes for this entity type
            const typeAttributes = Array.from(this.attributeMetadata.entries())
                .filter(([key, meta]) => {
                    return key.startsWith(datasetName) && meta.entityType === entityType;
                })
                .map(([key, meta]) => meta);

            // Generate distribution insights for categorical attributes
            if (this.config.insightTypes?.includes(InsightType.DISTRIBUTION)) {
                const categoricalAttrs = typeAttributes.filter(meta =>
                    meta.dataType === 'string' &&
                    meta.uniqueCount > 1 &&
                    meta.uniqueCount <= 20 &&
                    meta.uniqueCount < meta.totalCount / 2
                );

                for (const attr of categoricalAttrs) {
                    insights.push(this.createDistributionInsight(datasetName, entityType, attr));
                }
            }

            // Generate top/bottom values insights for numerical attributes
            if (this.config.insightTypes?.includes(InsightType.TOP_VALUES) ||
                this.config.insightTypes?.includes(InsightType.BOTTOM_VALUES)) {
                const numericalAttrs = typeAttributes.filter(meta =>
                    meta.dataType === 'number' &&
                    meta.uniqueCount > 5
                );

                for (const attr of numericalAttrs) {
                    if (this.config.insightTypes?.includes(InsightType.TOP_VALUES)) {
                        insights.push(this.createTopValuesInsight(datasetName, entityType, attr));
                    }
                    if (this.config.insightTypes?.includes(InsightType.BOTTOM_VALUES)) {
                        insights.push(this.createBottomValuesInsight(datasetName, entityType, attr));
                    }
                }
            }

            // Generate time-based insights if date fields exist
            if (this.config.insightTypes?.includes(InsightType.TREND)) {
                const dateAttrs = typeAttributes.filter(meta => meta.dataType === 'date');

                for (const attr of dateAttrs) {
                    insights.push(this.createTrendInsight(datasetName, entityType, attr));
                }
            }

            // Generate statistical insights
            if (this.config.insightTypes?.includes(InsightType.AVERAGE) ||
                this.config.insightTypes?.includes(InsightType.MIN_MAX)) {
                const statAttrs = typeAttributes.filter(meta =>
                    meta.dataType === 'number' &&
                    meta.uniqueCount > 3
                );

                for (const attr of statAttrs) {
                    if (this.config.insightTypes?.includes(InsightType.AVERAGE)) {
                        insights.push(this.createAverageInsight(datasetName, entityType, attr));
                    }
                    if (this.config.insightTypes?.includes(InsightType.MIN_MAX)) {
                        insights.push(this.createMinMaxInsight(datasetName, entityType, attr));
                    }
                }
            }

            // Generate outlier insights
            if (this.config.insightTypes?.includes(InsightType.OUTLIERS)) {
                const outlierAttrs = typeAttributes.filter(meta =>
                    meta.dataType === 'number' &&
                    meta.uniqueCount > 10
                );

                for (const attr of outlierAttrs) {
                    insights.push(this.createOutlierInsight(datasetName, entityType, attr));
                }
            }
        }

        return insights;
    }

    /**
     * Generate insights that span multiple datasets
     */
    private generateCrossDatasetInsights(): InsightResult[] {
        const insights: InsightResult[] = [];

        // Generate insights for each relationship
        for (const relationship of this.relationships) {
            const { sourceDataset, targetDataset, sourceAttribute, targetAttribute, relationship: relInfo } = relationship;

            // Skip low confidence relationships
            if (relInfo.confidence < this.config.confidenceThreshold!) continue;

            // Get entity types
            const sourceEntityTypes = new Set<string>();
            const targetEntityTypes = new Set<string>();

            // Find all entity types that have these attributes
            for (const [key, meta] of this.attributeMetadata.entries()) {
                if (key === `${sourceDataset}.${sourceAttribute}`) {
                    sourceEntityTypes.add(meta.entityType);
                }
                if (key === `${targetDataset}.${targetAttribute}`) {
                    targetEntityTypes.add(meta.entityType);
                }
            }

            // Generate join statistics insights
            if (this.config.insightTypes?.includes(InsightType.JOIN_STATS)) {
                for (const sourceType of sourceEntityTypes) {
                    for (const targetType of targetEntityTypes) {
                        insights.push(this.createJoinStatsInsight(
                            relationship,
                            sourceType,
                            targetType
                        ));
                    }
                }
            }

            // Generate cardinality insights
            if (this.config.insightTypes?.includes(InsightType.CARDINALITY)) {
                for (const sourceType of sourceEntityTypes) {
                    for (const targetType of targetEntityTypes) {
                        insights.push(this.createCardinalityInsight(
                            relationship,
                            sourceType,
                            targetType
                        ));
                    }
                }
            }

            // Find correlated attributes across datasets
            if (this.config.insightTypes?.includes(InsightType.CORRELATION)) {
                for (const sourceType of sourceEntityTypes) {
                    for (const targetType of targetEntityTypes) {
                        // Find numerical attributes for potential correlation
                        const sourceNumericalAttrs = this.findNumericalAttributes(sourceDataset, sourceType);
                        const targetNumericalAttrs = this.findNumericalAttributes(targetDataset, targetType);

                        for (const sourceAttr of sourceNumericalAttrs) {
                            for (const targetAttr of targetNumericalAttrs) {
                                // Skip the join attributes themselves
                                if (sourceAttr === sourceAttribute || targetAttr === targetAttribute) continue;

                                insights.push(this.createCorrelationInsight(
                                    relationship,
                                    sourceType,
                                    targetType,
                                    sourceAttr,
                                    targetAttr
                                ));
                            }
                        }
                    }
                }
            }
        }

        return insights;
    }

    /**
     * Helper to find numerical attributes for an entity type in a dataset
     */
    private findNumericalAttributes(dataset: string, entityType: string): string[] {
        return Array.from(this.attributeMetadata.entries())
            .filter(([key, meta]) =>
                key.startsWith(`${dataset}.`) &&
                meta.entityType === entityType &&
                meta.dataType === 'number'
            )
            .map(([key]) => key.split('.').slice(1).join('.'));
    }

    /**
     * Create a basic count insight
     */
    private createCountInsight(dataset: string, entityType: string): InsightResult {
        return {
            id: `count-${dataset}-${entityType}`,
            type: InsightType.COUNT,
            title: `Total ${entityType} count`,
            description: `Shows the total number of ${entityType} records in the ${dataset} dataset`,
            query: `FIND ${entityType} AS ?e RETURN COUNT(?e) AS count`,
            datasets: [dataset],
            confidence: 0.9, // Basic counts are generally useful
            attributes: [],
            entityTypes: [entityType]
        };
    }

    /**
     * Create a distribution insight for categorical data
     */
    private createDistributionInsight(dataset: string, entityType: string, attr: AttributeMetadata): InsightResult {
        return {
            id: `distribution-${dataset}-${entityType}-${attr.name}`,
            type: InsightType.DISTRIBUTION,
            title: `Distribution of ${entityType} by ${attr.name}`,
            description: `Shows the distribution of ${entityType} records by ${attr.name} categories`,
            query: `FIND ${entityType} AS ?e RETURN ?e.${attr.name} AS category, COUNT(?e) AS count ORDER BY count DESC`,
            datasets: [dataset],
            confidence: 0.75 + (Math.min(attr.uniqueCount, 10) / 40), // Higher confidence for reasonable cardinality
            attributes: [attr.name],
            entityTypes: [entityType]
        };
    }

    /**
     * Create a top values insight
     */
    private createTopValuesInsight(dataset: string, entityType: string, attr: AttributeMetadata): InsightResult {
        return {
            id: `top-values-${dataset}-${entityType}-${attr.name}`,
            type: InsightType.TOP_VALUES,
            title: `Top ${entityType} by ${attr.name}`,
            description: `Lists the top 10 ${entityType} records with the highest ${attr.name} values`,
            query: `FIND ${entityType} AS ?e RETURN ?e.id, ?e.${attr.name} ORDER BY ?e.${attr.name} DESC LIMIT 10`,
            datasets: [dataset],
            confidence: 0.7,
            attributes: [attr.name],
            entityTypes: [entityType]
        };
    }

    /**
     * Create a bottom values insight
     */
    private createBottomValuesInsight(dataset: string, entityType: string, attr: AttributeMetadata): InsightResult {
        return {
            id: `bottom-values-${dataset}-${entityType}-${attr.name}`,
            type: InsightType.BOTTOM_VALUES,
            title: `Bottom ${entityType} by ${attr.name}`,
            description: `Lists the bottom 10 ${entityType} records with the lowest ${attr.name} values`,
            query: `FIND ${entityType} AS ?e RETURN ?e.id, ?e.${attr.name} ORDER BY ?e.${attr.name} ASC LIMIT 10`,
            datasets: [dataset],
            confidence: 0.65,
            attributes: [attr.name],
            entityTypes: [entityType]
        };
    }

    /**
     * Create a trend insight for time-based data
     */
    private createTrendInsight(dataset: string, entityType: string, attr: AttributeMetadata): InsightResult {
        // Add appropriate aggregation if we can find a numerical attribute
        const numericalAttrs = Array.from(this.attributeMetadata.entries())
            .filter(([key, meta]) =>
                key.startsWith(`${dataset}.`) &&
                meta.entityType === entityType &&
                meta.dataType === 'number'
            )
            .map(([key, meta]) => meta);

        let aggregation = '';
        let aggDescription = '';

        if (numericalAttrs.length > 0) {
            // Pick first numerical attribute for aggregation
            const numAttr = numericalAttrs[0];
            if (numAttr) {
                aggregation = `, SUM(?e.${numAttr.name}) AS total, AVG(?e.${numAttr.name}) AS average`;
                aggDescription = ` with ${numAttr.name} metrics`;
            }
        }

        return {
            id: `trend-${dataset}-${entityType}-${attr.name}`,
            type: InsightType.TREND,
            title: `${entityType} trend over time by ${attr.name}`,
            description: `Shows the trend of ${entityType} records over time based on ${attr.name}${aggDescription}`,
            query: `FIND ${entityType} AS ?e RETURN ?e.${attr.name} AS period, COUNT(?e) AS count${aggregation} ORDER BY period`,
            datasets: [dataset],
            confidence: 0.8, // Time trends are usually insightful
            attributes: [attr.name, ...(aggregation && numericalAttrs.length > 0 && numericalAttrs[0] ? [numericalAttrs[0].name] : [])],
            entityTypes: [entityType]
        };
    }

    /**
     * Create an average insight
     */
    private createAverageInsight(dataset: string, entityType: string, attr: AttributeMetadata): InsightResult {
        return {
            id: `average-${dataset}-${entityType}-${attr.name}`,
            type: InsightType.AVERAGE,
            title: `Average ${attr.name} for ${entityType}`,
            description: `Shows the average ${attr.name} value across all ${entityType} records`,
            query: `FIND ${entityType} AS ?e RETURN AVG(?e.${attr.name}) AS average, COUNT(?e) AS count`,
            datasets: [dataset],
            confidence: 0.6,
            attributes: [attr.name],
            entityTypes: [entityType]
        };
    }

    /**
     * Create a min/max insight
     */
    private createMinMaxInsight(dataset: string, entityType: string, attr: AttributeMetadata): InsightResult {
        return {
            id: `min-max-${dataset}-${entityType}-${attr.name}`,
            type: InsightType.MIN_MAX,
            title: `${attr.name} range for ${entityType}`,
            description: `Shows the minimum and maximum ${attr.name} values across all ${entityType} records`,
            query: `FIND ${entityType} AS ?e RETURN MIN(?e.${attr.name}) AS minimum, MAX(?e.${attr.name}) AS maximum, COUNT(?e) AS count`,
            datasets: [dataset],
            confidence: 0.6,
            attributes: [attr.name],
            entityTypes: [entityType]
        };
    }

    /**
     * Create an outlier insight
     */
    private createOutlierInsight(dataset: string, entityType: string, attr: AttributeMetadata): InsightResult {
        return {
            id: `outlier-${dataset}-${entityType}-${attr.name}`,
            type: InsightType.OUTLIERS,
            title: `${attr.name} outliers for ${entityType}`,
            description: `Finds ${entityType} records with unusually high or low ${attr.name} values (beyond 2 standard deviations)`,
            query: `FIND ${entityType} AS ?e 
WHERE ?e.${attr.name} > AVG(?x.${attr.name}) + 2 * STDDEV(?x.${attr.name}) OR 
      ?e.${attr.name} < AVG(?x.${attr.name}) - 2 * STDDEV(?x.${attr.name})
WITH ${entityType} AS ?x
RETURN ?e.id, ?e.${attr.name}`,
            datasets: [dataset],
            confidence: 0.75,
            attributes: [attr.name],
            entityTypes: [entityType]
        };
    }

    /**
     * Create a join statistics insight
     */
    private createJoinStatsInsight(
        relationship: DatasetRelationship,
        sourceType: string,
        targetType: string
    ): InsightResult {
        const { sourceDataset, targetDataset, sourceAttribute, targetAttribute } = relationship;

        return {
            id: `join-stats-${sourceDataset}-${targetDataset}-${sourceAttribute}-${targetAttribute}`,
            type: InsightType.JOIN_STATS,
            title: `Join statistics between ${sourceType} and ${targetType}`,
            description: `Shows the connection statistics between ${sourceType} from ${sourceDataset} and ${targetType} from ${targetDataset}`,
            query: `FIND ${sourceType} AS ?s, ${targetType} AS ?t 
WHERE ?s.${sourceAttribute} = ?t.${targetAttribute}
RETURN COUNT(?s) AS matched_${sourceType}, 
       COUNT(DISTINCT ?s.${sourceAttribute}) AS unique_keys,
       COUNT(DISTINCT ?s) AS total_${sourceType},
       COUNT(DISTINCT ?t) AS total_${targetType}`,
            datasets: [sourceDataset, targetDataset],
            confidence: relationship.relationship.confidence,
            attributes: [sourceAttribute, targetAttribute],
            entityTypes: [sourceType, targetType]
        };
    }

    /**
     * Create a cardinality insight
     */
    private createCardinalityInsight(
        relationship: DatasetRelationship,
        sourceType: string,
        targetType: string
    ): InsightResult {
        const { sourceDataset, targetDataset, sourceAttribute, targetAttribute } = relationship;

        return {
            id: `cardinality-${sourceDataset}-${targetDataset}-${sourceAttribute}-${targetAttribute}`,
            type: InsightType.CARDINALITY,
            title: `Relationship cardinality between ${sourceType} and ${targetType}`,
            description: `Analyzes the cardinality (one-to-one, one-to-many, etc) between ${sourceType} and ${targetType}`,
            query: `-- Join stats query to understand cardinality
FIND ${sourceType} AS ?s, ${targetType} AS ?t 
WHERE ?s.${sourceAttribute} = ?t.${targetAttribute}
RETURN ?s.${sourceAttribute} AS key,
       COUNT(DISTINCT ?s) AS source_count,
       COUNT(DISTINCT ?t) AS target_count
ORDER BY source_count DESC, target_count DESC
LIMIT 10`,
            datasets: [sourceDataset, targetDataset],
            confidence: relationship.relationship.confidence * 0.9,
            attributes: [sourceAttribute, targetAttribute],
            entityTypes: [sourceType, targetType]
        };
    }

    /**
     * Create a correlation insight
     */
    private createCorrelationInsight(
        relationship: DatasetRelationship,
        sourceType: string,
        targetType: string,
        sourceAttr: string,
        targetAttr: string
    ): InsightResult {
        const { sourceDataset, targetDataset, sourceAttribute, targetAttribute } = relationship;

        return {
            id: `correlation-${sourceDataset}-${targetDataset}-${sourceAttr}-${targetAttr}`,
            type: InsightType.CORRELATION,
            title: `Correlation between ${sourceType}.${sourceAttr} and ${targetType}.${targetAttr}`,
            description: `Analyzes potential correlation between ${sourceAttr} in ${sourceType} and ${targetAttr} in ${targetType}`,
            query: `FIND ${sourceType} AS ?s, ${targetType} AS ?t 
WHERE ?s.${sourceAttribute} = ?t.${targetAttribute}
RETURN ?s.${sourceAttr} AS source_value,
       ?t.${targetAttr} AS target_value,
       ?s.id AS source_id,
       ?t.id AS target_id
LIMIT 100`,
            datasets: [sourceDataset, targetDataset],
            confidence: relationship.relationship.confidence * 0.7,
            attributes: [sourceAttribute, targetAttribute, sourceAttr, targetAttr],
            entityTypes: [sourceType, targetType]
        };
    }
}