import { describe, it, expect } from 'vitest';
import { TrellisKernel } from '../src/kernel/trellis-kernel.js';
import { LogicMiddleware } from '../src/kernel/logic-middleware.js';
import { EAVStore } from '../src/store/eav-store.js';
import type { WorkspaceConfig } from '../src/kernel/workspace.js';

describe('TrellisKernel Phase 9 & 16: Logic Layer', () => {
  it('should compute virtual attributes via formulas', async () => {
    const config: WorkspaceConfig = {
      workspace: {
        ontologies: {
          'trellis:schema/project': {
            '@id': 'trellis:schema/project',
            '@type': 'trellis:Schema',
            version: '1.0.0',
            fields: [
              { name: 'budget', valueType: 'number' },
              { name: 'spent', valueType: 'number' },
              {
                name: 'remaining',
                valueType: 'formula',
                formula: 'budget - spent',
              },
            ],
          },
        },
        graph: {
          nodes: [
            {
              '@id': 'proj:1',
              '@type': 'Project',
              type: 'Project',
              budget: 1000,
              spent: 400,
            },
          ],
        },
      },
    };

    const store = new EAVStore();
    const kernel = new TrellisKernel({
      store,
      middleware: [
        new LogicMiddleware(
          {
            getOntology: (id) => config.workspace.ontologies?.[id],
          },
          store,
        ),
      ],
    });

    await kernel.boot(config);

    const res = await kernel.query(
      'FIND Project AS ?p RETURN ?p.budget, ?p.spent, ?p.type',
    );

    expect(res.rows.length).toBe(1);
    const row = res.rows[0]!;
    expect(row['remaining']).toBe(600);
    expect(row['?p.remaining']).toBe(600);
  });

  it('should handle complex arithmetic in formulas', async () => {
    const config: WorkspaceConfig = {
      workspace: {
        ontologies: {
          'trellis:schema/item': {
            '@id': 'trellis:schema/item',
            '@type': 'trellis:Schema',
            version: '1.0.0',
            fields: [
              { name: 'a', valueType: 'number' },
              { name: 'b', valueType: 'number' },
              { name: 'c', valueType: 'number' },
              {
                name: 'calc',
                valueType: 'formula',
                formula: '(a + b) * c',
              },
            ],
          },
        },
        graph: {
          nodes: [
            {
              '@id': 'item:1',
              '@type': 'Item',
              type: 'Item',
              a: 10,
              b: 20,
              c: 2,
            },
          ],
        },
      },
    };

    const store = new EAVStore();
    const kernel = new TrellisKernel({
      store,
      middleware: [
        new LogicMiddleware(
          {
            getOntology: (id) => config.workspace.ontologies?.[id],
          },
          store,
        ),
      ],
    });

    await kernel.boot(config);

    const res = await kernel.query(
      'FIND Item AS ?i RETURN ?i.a, ?i.b, ?i.c, ?i.type',
    );
    expect(res.rows[0]?.['calc']).toBe(60);
  });

  it('should compute virtual attributes via rollups (count, sum)', async () => {
    const config: WorkspaceConfig = {
      workspace: {
        ontologies: {
          'trellis:schema/project': {
            '@id': 'trellis:schema/project',
            '@type': 'trellis:Schema',
            version: '1.0.0',
            fields: [
              { name: 'name', valueType: 'title' },
              {
                name: 'taskCount',
                valueType: 'rollup',
                rollup: {
                  relationProperty: 'tasks',
                  targetProperty: '@id',
                  aggregation: 'count',
                },
              },
              {
                name: 'totalCost',
                valueType: 'rollup',
                rollup: {
                  relationProperty: 'tasks',
                  targetProperty: 'cost',
                  aggregation: 'sum',
                },
              },
            ],
          },
          'trellis:schema/task': {
            '@id': 'trellis:schema/task',
            '@type': 'trellis:Schema',
            version: '1.0.0',
            fields: [
              { name: 'name', valueType: 'title' },
              { name: 'cost', valueType: 'number' },
            ],
          },
        },
        graph: {
          nodes: [
            { '@id': 'p1', '@type': 'Project', type: 'Project', name: 'P1' },
            {
              '@id': 't1',
              '@type': 'Task',
              type: 'Task',
              name: 'T1',
              cost: 100,
            },
            {
              '@id': 't2',
              '@type': 'Task',
              type: 'Task',
              name: 'T2',
              cost: 250,
            },
          ],
          edges: [
            { source: 'p1', target: 't1', relationType: 'tasks' },
            { source: 'p1', target: 't2', relationType: 'tasks' },
          ],
        },
      },
    };

    const store = new EAVStore();
    const kernel = new TrellisKernel({
      store,
      middleware: [
        new LogicMiddleware(
          {
            getOntology: (id) => config.workspace.ontologies?.[id],
          },
          store,
        ),
      ],
    });

    await kernel.boot(config);

    const res = await kernel.query('FIND Project AS ?p RETURN ?p.@id, ?p.type');
    expect(res.rows.length).toBe(1);
    const row = res.rows[0]!;
    expect(row['taskCount']).toBe(2);
    expect(row['totalCost']).toBe(350);
  });

  it('should compute median and mode rollups', async () => {
    const config: WorkspaceConfig = {
      workspace: {
        ontologies: {
          'trellis:schema/dataset': {
            '@id': 'trellis:schema/dataset',
            '@type': 'trellis:Schema',
            version: '1.0.0',
            fields: [
              {
                name: 'medianVal',
                valueType: 'rollup',
                rollup: {
                  relationProperty: 'items',
                  targetProperty: 'val',
                  aggregation: 'median',
                },
              },
              {
                name: 'modeVal',
                valueType: 'rollup',
                rollup: {
                  relationProperty: 'items',
                  targetProperty: 'category',
                  aggregation: 'mode',
                },
              },
            ],
          },
        },
        graph: {
          nodes: [
            { '@id': 'd1', '@type': 'Dataset', type: 'Dataset' },
            {
              '@id': 'i1',
              '@type': 'Item',
              type: 'Item',
              val: 10,
              category: 'A',
            },
            {
              '@id': 'i2',
              '@type': 'Item',
              type: 'Item',
              val: 20,
              category: 'B',
            },
            {
              '@id': 'i3',
              '@type': 'Item',
              type: 'Item',
              val: 30,
              category: 'A',
            },
          ],
          edges: [
            { source: 'd1', target: 'i1', relationType: 'items' },
            { source: 'd1', target: 'i2', relationType: 'items' },
            { source: 'd1', target: 'i3', relationType: 'items' },
          ],
        },
      },
    };

    const store = new EAVStore();
    const kernel = new TrellisKernel({
      store,
      middleware: [
        new LogicMiddleware(
          {
            getOntology: (id) => config.workspace.ontologies?.[id],
          },
          store,
        ),
      ],
    });

    await kernel.boot(config);

    const res = await kernel.query('FIND Dataset AS ?d RETURN ?d.@id, ?d.type');
    const row = res.rows[0]!;
    expect(row['medianVal']).toBe(20);
    expect(row['modeVal']).toBe('A');
  });

  it('should support $if and $concat in formulas', async () => {
    const config: WorkspaceConfig = {
      workspace: {
        ontologies: {
          'trellis:schema/user': {
            '@id': 'trellis:schema/user',
            '@type': 'trellis:Schema',
            version: '1.0.0',
            fields: [
              { name: 'firstName', valueType: 'rich_text' },
              { name: 'lastName', valueType: 'rich_text' },
              { name: 'age', valueType: 'number' },
              {
                name: 'fullName',
                valueType: 'formula',
                formula: '$concat(firstName, " ", lastName)',
              },
              {
                name: 'status',
                valueType: 'formula',
                formula: '$if(age >= 18, "Adult", "Minor")',
              },
            ],
          },
        },
        graph: {
          nodes: [
            {
              '@id': 'u1',
              '@type': 'User',
              type: 'User',
              firstName: 'John',
              lastName: 'Doe',
              age: 25,
            },
            {
              '@id': 'u2',
              '@type': 'User',
              type: 'User',
              firstName: 'Jane',
              lastName: 'Smith',
              age: 15,
            },
          ],
        },
      },
    };

    const store = new EAVStore();
    const kernel = new TrellisKernel({
      store,
      middleware: [
        new LogicMiddleware(
          {
            getOntology: (id) => config.workspace.ontologies?.[id],
          },
          store,
        ),
      ],
    });

    await kernel.boot(config);

    const res = await kernel.query(
      'FIND User AS ?u RETURN ?u.firstName, ?u.lastName, ?u.age, ?u.type',
    );

    const john = res.rows.find(
      (r) => r['firstName'] === 'John' || r['?u.firstName'] === 'John',
    )!;
    const jane = res.rows.find(
      (r) => r['firstName'] === 'Jane' || r['?u.firstName'] === 'Jane',
    )!;

    expect(john['fullName']).toBe('John Doe');
    expect(john['status']).toBe('Adult');
    expect(jane['fullName']).toBe('Jane Smith');
    expect(jane['status']).toBe('Minor');
  });

  it('should compute virtual attributes via AI generation', async () => {
    const config: WorkspaceConfig = {
      workspace: {
        ontologies: {
          'trellis:schema/project': {
            '@id': 'trellis:schema/project',
            '@type': 'trellis:Schema',
            version: '1.0.0',
            fields: [
              { name: 'name', valueType: 'title' },
              { name: 'description', valueType: 'rich_text' },
              {
                name: 'summary',
                valueType: 'ai_generated',
                aiGenerated: {
                  prompt: 'Summarize this project description in one sentence.',
                },
              },
            ],
          },
        },
        graph: {
          nodes: [
            {
              '@id': 'p1',
              '@type': 'Project',
              type: 'Project',
              name: 'Website',
              description:
                'A long description of the website redesign project.',
            },
          ],
        },
      },
    };

    const mockAiProvider = {
      name: 'mock-ai',
      generate: async (prompt: string, input: any) => {
        if (prompt.includes('Summarize') && input.name === 'Website') {
          return 'A concise summary of the website project.';
        }
        return 'Default summary';
      },
    };

    const store = new EAVStore();
    const kernel = new TrellisKernel({
      store,
      middleware: [
        new LogicMiddleware(
          {
            getOntology: (id) => config.workspace.ontologies?.[id],
          },
          store,
          mockAiProvider,
        ),
      ],
    });

    await kernel.boot(config);

    const res = await kernel.query(
      'FIND Project AS ?p RETURN ?p.name, ?p.type',
    );
    expect(res.rows.length).toBe(1);
    const row = res.rows[0]!;
    expect(row['summary']).toBe('A concise summary of the website project.');
  });
});
