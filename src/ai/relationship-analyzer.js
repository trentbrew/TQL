
import { EAVStore } from '../eav-engine.js';

/**
 * Analyzes an EAV store to detect relationships between entity types
 * @param store The EAV store to analyze
 * @returns Detected relationships
 */
export function detectRelationships(store) {
  const relationships = {
    entityTypes: [],
    entityAttributes: {},
    foreignKeys: [],
    sameAttributes: [],
    valueReferences: []
  };

  // Get all entities and their attributes
  const entities = {};
  const attributesByType = {};
  
  // Get all facts from the store
  const facts = store.getFacts();
  
  // Group entities by type and collect attributes
  facts.forEach(fact => {
    const [entity, attribute, value] = fact;
    
    // Extract entity type from id (format: type:id)
    const entityParts = entity.split(':');
    if (entityParts.length < 2) return;
    
    const entityType = entityParts[0];
    
    // Track entity types
    if (!relationships.entityTypes.includes(entityType)) {
      relationships.entityTypes.push(entityType);
      relationships.entityAttributes[entityType] = [];
    }
    
    // Track attributes by entity type
    if (!relationships.entityAttributes[entityType].includes(attribute)) {
      relationships.entityAttributes[entityType].push(attribute);
    }
    
    // Store entity attributes for later analysis
    if (!entities[entity]) {
      entities[entity] = { type: entityType, attributes: {} };
    }
    entities[entity].attributes[attribute] = value;
    
    // Group by entity type
    if (!attributesByType[entityType]) {
      attributesByType[entityType] = new Set();
    }
    attributesByType[entityType].add(attribute);
  });
  
  // Detect foreign key relationships
  Object.keys(attributesByType).forEach(sourceType => {
    const sourceAttrs = Array.from(attributesByType[sourceType]);
    
    sourceAttrs.forEach(sourceAttr => {
      // Common foreign key patterns
      if (sourceAttr.endsWith('Id') || 
          sourceAttr.includes('_id') || 
          sourceAttr === 'id') {
        
        // Check if this attribute references another entity type
        Object.keys(attributesByType).forEach(targetType => {
          // Skip self-references for this simple analysis
          if (sourceType === targetType) return;
          
          // Common primary key attribute is 'id'
          if (attributesByType[targetType].has('id')) {
            // Check if the attribute name matches the target type
            if (sourceAttr === targetType + 'Id' || 
                sourceAttr === targetType + '_id' ||
                sourceAttr === targetType) {
              
              relationships.foreignKeys.push({
                sourceEntityType: sourceType,
                sourceAttribute: sourceAttr,
                targetEntityType: targetType,
                targetAttribute: 'id'
              });
            }
          }
        });
      }
    });
  });
  
  // Check for exact attribute matches across entity types
  Object.keys(attributesByType).forEach(sourceType => {
    const sourceAttrs = Array.from(attributesByType[sourceType]);
    
    Object.keys(attributesByType).forEach(targetType => {
      if (sourceType === targetType) return;
      
      const targetAttrs = Array.from(attributesByType[targetType]);
      const commonAttrs = sourceAttrs.filter(attr => 
        targetAttrs.includes(attr) && attr !== 'id'
      );
      
      commonAttrs.forEach(attr => {
        relationships.sameAttributes.push({
          entityType1: sourceType,
          entityType2: targetType,
          attribute: attr
        });
      });
    });
  });
  
  return relationships;
}
