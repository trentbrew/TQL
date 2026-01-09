import { describe, it, expect } from 'vitest';
import { TrellisKernel } from '../src/kernel/trellis-kernel.js';
import { SchemaMiddleware } from '../src/kernel/schema-middleware.js';
import type { WorkspaceConfig } from '../src/kernel/workspace.js';

describe('TrellisKernel Phase 8: Schema Enforcement', () => {
  it('should allow facts that match the defined schema', async () => {
    const kernel = new TrellisKernel();

    const config: WorkspaceConfig = {
      workspace: {
        ontologies: {
          'trellis:schema/project': {
            '@id': 'trellis:schema/project',
            '@type': 'trellis:Schema',
            version: '1.0.0',
            fields: [
              { name: 'status', valueType: 'status' },
              { name: 'priority', valueType: 'select' },
            ],
          },
        },
      },
    };

    await kernel.boot(config);

    // Add middleware after boot or as part of kernel options
    // For this test, we can just create a new kernel with the middleware
    const kernelWithSchema = new TrellisKernel({
      middleware: [new SchemaMiddleware(kernel)],
    });

    // We need to sync the ontologies manually for this test if we use a new kernel instance
    // or just use the same kernel instance and add middleware if possible (not yet supported in options)
    // Actually, TrellisKernel implements SchemaProvider via getOntology.

    // Let's boot the same kernel with middleware from the start
    const kernel2 = new TrellisKernel({
      middleware: [
        new SchemaMiddleware({
          getOntology: (id) => config.workspace.ontologies?.[id],
        }),
      ],
    });

    await expect(
      kernel2.createNode('proj:1', { status: 'active' }, 'Project'),
    ).resolves.not.toThrow();
  });

  it('should block facts that are not in the schema', async () => {
    const config: WorkspaceConfig = {
      workspace: {
        ontologies: {
          'trellis:schema/project': {
            '@id': 'trellis:schema/project',
            '@type': 'trellis:Schema',
            version: '1.0.0',
            fields: [{ name: 'status', valueType: 'status' }],
          },
        },
      },
    };

    const kernel = new TrellisKernel({
      middleware: [
        new SchemaMiddleware({
          getOntology: (id) => config.workspace.ontologies?.[id],
        }),
      ],
    });

    await expect(
      kernel.createNode(
        'proj:1',
        { status: 'active', unknownField: 'boom' },
        'Project',
      ),
    ).rejects.toThrow(
      /Schema violation: attribute "unknownField" is not allowed/,
    );
  });

  it('should allow any facts if no schema is defined for the type', async () => {
    const kernel = new TrellisKernel({
      middleware: [
        new SchemaMiddleware({
          getOntology: () => undefined,
        }),
      ],
    });

    await expect(
      kernel.createNode('any:1', { something: 'else' }, 'UnknownType'),
    ).resolves.not.toThrow();
  });
});
