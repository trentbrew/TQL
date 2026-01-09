import { describe, it, expect } from 'vitest';
import { TrellisKernel } from '../src/kernel/trellis-kernel.js';
import type { WorkspaceConfig } from '../src/kernel/workspace.js';

describe('TrellisKernel: Workspace Boot', () => {
  it('should boot a full .trellis workspace configuration', async () => {
    const kernel = new TrellisKernel();

    const config: WorkspaceConfig = {
      workspace: {
        name: 'Test Workspace',
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
        graph: {
          nodes: [
            {
              '@id': 'proj:1',
              '@type': 'Project',
              'trellis:title': 'Website Redesign',
              status: 'active',
              priority: 'High',
            },
          ],
          edges: [
            // Example edge if needed
          ],
        },
        projections: {
          'proj:active-projects': {
            '@id': 'proj:active-projects',
            '@type': 'trellis:Projection',
            name: 'Active Projects',
            type: 'card-grid',
            query:
              'FIND Project AS ?p WHERE ?p.status = "active" RETURN ?p.trellis:title',
          },
        },
      },
    };

    await kernel.boot(config);

    // Verify metadata
    expect(kernel.getOntology('trellis:schema/project')).toBeDefined();
    expect(kernel.getProjection('proj:active-projects')).toBeDefined();

    // Verify data
    const res = await kernel.query(
      'FIND Project AS ?p RETURN ?p.trellis:title',
    );
    expect(res.rows.length).toBe(1);
    expect(res.rows[0]?.['?p.trellis:title']).toBe('Website Redesign');

    // Verify executeProjection
    const resProj = await kernel.executeProjection('proj:active-projects');
    expect(resProj.rows.length).toBe(1);
    expect(resProj.rows[0]?.['?p.trellis:title']).toBe('Website Redesign');
  });
});
