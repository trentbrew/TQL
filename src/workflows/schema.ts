/**
 * JSON Schema for workflow validation
 * 
 * Version 1 workflow specification with comprehensive validation rules.
 */

export const WORKFLOW_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    version: {
      type: "number",
      const: 1,
      description: "Workflow specification version. Must be 1."
    },
    name: {
      type: "string",
      minLength: 1,
      description: "Human-readable workflow name"
    },
    env: {
      type: "object",
      additionalProperties: {
        type: "string"
      },
      description: "Environment variables merged with process.env and --var"
    },
    steps: {
      type: "array",
      minItems: 1,
      items: {
        $ref: "#/definitions/step"
      },
      description: "Workflow execution steps"
    }
  },
  required: ["version", "name", "steps"],
  additionalProperties: false,
  
  definitions: {
    step: {
      type: "object",
      properties: {
        id: {
          type: "string",
          pattern: "^[a-zA-Z][a-zA-Z0-9_]*$",
          description: "Unique step identifier"
        },
        type: {
          enum: ["source", "query", "output"],
          description: "Step type"
        },
        needs: {
          type: "array",
          items: {
            type: "string"
          },
          description: "Dependencies on other steps"
        },
        out: {
          type: "string",
          description: "Output dataset name"
        },
        source: { $ref: "#/definitions/httpSource" },
        from: { type: "string" },
        eqls: { type: "string" },
        output: { $ref: "#/definitions/output" }
      },
      required: ["id", "type"],
      additionalProperties: false,
      allOf: [
        {
          if: { properties: { type: { const: "source" } } },
          then: {
            required: ["source", "out"]
          }
        },
        {
          if: { properties: { type: { const: "query" } } },
          then: {
            required: ["needs", "eqls", "out"]
          }
        },
        {
          if: { properties: { type: { const: "output" } } },
          then: {
            required: ["needs", "output"]
          }
        }
      ]
    },
    
    httpSource: {
      type: "object",
      properties: {
        kind: {
          const: "http",
          description: "Source kind"
        },
        url: {
          type: "string",
          description: "HTTP URL with optional template variables"
        },
        headers: {
          type: "object",
          additionalProperties: {
            type: "string"
          },
          description: "HTTP headers"
        },
        mode: {
          enum: ["batch", "map"],
          description: "Execution mode: batch (single request) or map (per-row requests)"
        },
        mapFrom: {
          type: "string",
          description: "Dataset to iterate over in map mode"
        }
      },
      required: ["kind", "url", "mode"],
      allOf: [
        {
          if: { properties: { mode: { const: "map" } } },
          then: {
            required: ["mapFrom"]
          }
        }
      ],
      additionalProperties: false
    },
    
    output: {
      oneOf: [
        {
          type: "object",
          properties: {
            kind: { const: "file" },
            format: { enum: ["json", "csv"] },
            path: { type: "string" }
          },
          required: ["kind", "format", "path"],
          additionalProperties: false
        },
        {
          type: "object",
          properties: {
            kind: { const: "stdout" },
            format: { enum: ["json", "csv"] }
          },
          required: ["kind", "format"],
          additionalProperties: false
        }
      ]
    }
  }
} as const;