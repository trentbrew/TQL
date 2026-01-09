import { describe, it, expect } from 'vitest';
import { TrellisKernel } from '../src/kernel/trellis-kernel.js';
import type { WorkspaceConfig } from '../src/kernel/workspace.js';

describe('TrellisKernel: Workspace Export', () => {
  it('should export current state back into a .trellis configuration', async () => {
    const kernel = new TrellisKernel();

    const originalConfig: WorkspaceConfig = {
      workspace: {
        name: 'Test Workspace',
        ontologies: {
          'trellis:schema/project': {
            '@id': 'trellis:schema/project',
            '@type': 'trellis:Schema',
            version: '1.0.0',
            fields: [{ name: 'status', valueType: 'status' }],
          },
        },
        graph: {
          nodes: [
            {
              '@id': 'proj:1',
              '@type': 'Project',
              status: 'active',
            },
          ],
          edges: [],
        },
        projections: {
          'proj:active': {
            '@id': 'proj:active',
            '@type': 'trellis:Projection',
            name: 'Active',
            type: 'card-grid',
            query:
              'FIND Project AS ?p WHERE ?p.status = "active" RETURN ?p.@id',
          },
        },
      },
    };

    await kernel.boot(originalConfig);

    // Add an edge manually
    await kernel.createNode('task:1', { name: 'Task 1' }, 'Task');
    await kernel.link('proj:1', 'hasTask', 'task:1');

    const exported = await kernel.exportWorkspace();

    // Verify ontologies
    expect(
      exported.workspace.ontologies?.['trellis:schema/project'],
    ).toBeDefined();

    // Verify projections
    expect(exported.workspace.projections?.['proj:active']).toBeDefined();

    // Verify nodes (should have proj:1 and task:1)
    expect(exported.workspace.graph?.nodes?.length).toBe(2);
    const projNode = exported.workspace.graph?.nodes?.find(
      (n) => n['@id'] === 'proj:1',
    );
    expect(projNode?.status).toBe('active');
    expect(projNode?.['@type']).toBe('Project');

    // Verify edges
    expect(exported.workspace.graph?.edges?.length).toBe(1);
    expect(exported.workspace.graph?.edges?.[0]?.relationType).toBe('hasTask');
    expect(exported.workspace.graph?.edges?.[0]?.source['@id']).toBe('proj:1');
    expect(exported.workspace.graph?.edges?.[0]?.target['@id']).toBe('task:1');
  });
});
