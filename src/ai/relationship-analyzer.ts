import { EAVStore } from '../store/eav-store.js';

export interface ForeignKeyRelationship {
  sourceEntityType: string;
  sourceAttribute: string;
  targetEntityType: string;
  targetAttribute: string;
}

export interface SameAttributeRelationship {
  entityType1: string;
  entityType2: string;
  attribute: string;
}

export interface DetectedRelationships {
  entityTypes: string[];
  entityAttributes: Record<string, string[]>;
  foreignKeys: ForeignKeyRelationship[];
  sameAttributes: SameAttributeRelationship[];
  valueReferences: any[]; // Placeholder for future use
}

/**
 * Analyzes an EAV store to detect relationships between entity types
 * @param store The EAV store to analyze
 * @returns Detected relationships
 */
export function detectRelationships(store: EAVStore): DetectedRelationships {
  const relationships: DetectedRelationships = {
    entityTypes: [],
    entityAttributes: {},
    foreignKeys: [],
    sameAttributes: [],
    valueReferences: [],
  };

  // Get all entities and their attributes
  const entities: Record<
    string,
    { type: string; attributes: Record<string, any> }
  > = {};
  const attributesByType: Record<string, Set<string>> = {};

  // Get all facts from the store
  const facts = store.getAllFacts();

  // Group entities by type and collect attributes
  facts.forEach((fact) => {
    if (!fact) return;
    const { e: entity, a: attribute, v: value } = fact;

    // Extract entity type from id (format: type:id)
    const entityParts = entity.split(':');
    if (entityParts.length < 2) return;

    const entityType = entityParts[0]!;

    // Track entity types
    if (!relationships.entityTypes.includes(entityType)) {
      relationships.entityTypes.push(entityType);
      relationships.entityAttributes[entityType] = [];
    }

    // Track attributes by entity type
    const entityAttrs = relationships.entityAttributes[entityType];
    if (entityAttrs && !entityAttrs.includes(attribute)) {
      entityAttrs.push(attribute);
    }

    // Store entity attributes for later analysis
    if (!entities[entity]) {
      entities[entity] = { type: entityType, attributes: {} };
    }
    entities[entity]!.attributes[attribute] = value;

    // Group by entity type
    if (!attributesByType[entityType]) {
      attributesByType[entityType] = new Set();
    }
    attributesByType[entityType]!.add(attribute);
  });

  // Detect foreign key relationships
  Object.keys(attributesByType).forEach((sourceType) => {
    const sourceAttrs = Array.from(attributesByType[sourceType]!);

    sourceAttrs.forEach((sourceAttr) => {
      // Common foreign key patterns
      if (
        sourceAttr.endsWith('Id') ||
        sourceAttr.includes('_id') ||
        sourceAttr === 'id'
      ) {
        // Check if this attribute references another entity type
        Object.keys(attributesByType).forEach((targetType) => {
          // Skip self-references for this simple analysis
          if (sourceType === targetType) return;

          // Common primary key attribute is 'id'
          if (attributesByType[targetType]!.has('id')) {
            // Check if the attribute name matches the target type
            if (
              sourceAttr === targetType + 'Id' ||
              sourceAttr === targetType + '_id' ||
              sourceAttr === targetType
            ) {
              relationships.foreignKeys.push({
                sourceEntityType: sourceType,
                sourceAttribute: sourceAttr,
                targetEntityType: targetType,
                targetAttribute: 'id',
              });
            }
          }
        });
      }
    });
  });

  // Check for exact attribute matches across entity types
  Object.keys(attributesByType).forEach((sourceType) => {
    const sourceAttrs = Array.from(attributesByType[sourceType]!);

    Object.keys(attributesByType).forEach((targetType) => {
      if (sourceType === targetType) return;

      const targetAttrs = Array.from(attributesByType[targetType]!);
      const commonAttrs = sourceAttrs.filter(
        (attr) => targetAttrs.includes(attr) && attr !== 'id',
      );

      commonAttrs.forEach((attr) => {
        // Avoid duplicate pairs by checking if they're already added in reverse
        const alreadyAdded = relationships.sameAttributes.some(
          (rel) =>
            rel.attribute === attr &&
            ((rel.entityType1 === sourceType &&
              rel.entityType2 === targetType) ||
              (rel.entityType1 === targetType &&
                rel.entityType2 === sourceType)),
        );

        if (!alreadyAdded) {
          relationships.sameAttributes.push({
            entityType1: sourceType,
            entityType2: targetType,
            attribute: attr,
          });
        }
      });
    });
  });

  return relationships;
}
