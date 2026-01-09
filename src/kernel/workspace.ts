import { z } from 'zod';

/**
 * Property types based on VISION.md (Notion-compatible)
 */
export const PropertyTypeSchema = z.enum([
  'title',
  'rich_text',
  'number',
  'select',
  'multi_select',
  'status',
  'date',
  'people',
  'files',
  'checkbox',
  'url',
  'email',
  'phone_number',
  'relation',
  'rollup',
  'formula',
  'ai_generated',
]);

export type PropertyType = z.infer<typeof PropertyTypeSchema>;

/**
 * Schema field definition
 */
export const PropertyValueSpecificationSchema = z.object({
  name: z.string(),
  valueType: PropertyTypeSchema,
  required: z.boolean().optional(),
  description: z.string().optional(),
  // Type-specific config
  selectOptions: z.array(z.any()).optional(),
  relation: z
    .object({
      targetSchema: z.string().optional(),
      cardinality: z.enum(['one', 'many']).optional(),
      syncedProperty: z.string().optional(),
    })
    .optional(),
  formula: z.string().optional(),
  rollup: z
    .object({
      relationProperty: z.string(),
      targetProperty: z.string(),
      aggregation: z.enum([
        'count',
        'sum',
        'avg',
        'min',
        'max',
        'median',
        'mode',
      ]),
    })
    .optional(),
  aiGenerated: z
    .object({
      prompt: z.string(),
      model: z.string().optional(),
    })
    .optional(),
});

export type PropertyValueSpecification = z.infer<
  typeof PropertyValueSpecificationSchema
>;

/**
 * Ontology/Schema definition
 */
export const SchemaDefinitionSchema = z.object({
  '@id': z.string(),
  '@type': z.literal('trellis:Schema'),
  version: z.string(),
  fields: z.array(PropertyValueSpecificationSchema),
});

export type SchemaDefinition = z.infer<typeof SchemaDefinitionSchema>;

/**
 * Projection definition
 */
export const ProjectionDefinitionSchema = z.object({
  '@id': z.string(),
  '@type': z.literal('trellis:Projection'),
  name: z.string(),
  type: z.enum([
    'card-grid',
    'table',
    'timeline',
    'dashboard',
    'kanban',
    'graph',
  ]),
  query: z.string(), // EQL-S or Datalog
  config: z.record(z.string(), z.any()).optional(),
});

export type ProjectionDefinition = z.infer<typeof ProjectionDefinitionSchema>;

/**
 * Full .trellis Workspace Configuration
 */
export const WorkspaceConfigSchema = z.object({
  workspace: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    ontologies: z.record(z.string(), SchemaDefinitionSchema).optional(),
    graph: z
      .object({
        nodes: z.array(z.any()).optional(),
        edges: z.array(z.any()).optional(),
      })
      .optional(),
    projections: z.record(z.string(), ProjectionDefinitionSchema).optional(),
  }),
});

export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;
