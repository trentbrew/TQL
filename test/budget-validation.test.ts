import { describe, it, expect } from 'vitest';
import { TrellisKernel } from '../src/kernel/trellis-kernel.js';
import { jsonEntityFacts } from '../src/store/eav-store.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('TQL Budget Data Validation', () => {
  it('should ingest and query budget data', async () => {
    const kernel = new TrellisKernel();

    // Load budget data
    const budgetPath = join(process.cwd(), 'data', 'budget.json');
    const budgetData = JSON.parse(readFileSync(budgetPath, 'utf-8'));

    // Ingest the budget data
    const facts = jsonEntityFacts('default', budgetData, 'budget');
    kernel.getStore().addFacts(facts);

    // Query: Find all departments
    const deptResult = await kernel.query(
      'FIND budget AS ?b RETURN ?b.budget.departments.name, ?b.budget.departments.allocated, ?b.budget.departments.spent',
    );

    // TQL creates Cartesian products, so we get multiple rows
    expect(deptResult.rows.length).toBeGreaterThan(0);
    // Verify all three departments are present
    const deptNames = new Set(
      deptResult.rows.map((r) => r['?b.budget.departments.name']),
    );
    expect(deptNames.has('Engineering')).toBe(true);
    expect(deptNames.has('Marketing')).toBe(true);
    expect(deptNames.has('Operations')).toBe(true);
  });

  it('should calculate budget utilization', async () => {
    const kernel = new TrellisKernel();

    const budgetPath = join(process.cwd(), 'data', 'budget.json');
    const budgetData = JSON.parse(readFileSync(budgetPath, 'utf-8'));
    const facts = jsonEntityFacts('default', budgetData, 'budget');
    kernel.getStore().addFacts(facts);

    // Query departments with their budget metrics
    const result = await kernel.query(
      'FIND budget AS ?b RETURN ?b.budget.departments.name, ?b.budget.departments.allocated, ?b.budget.departments.spent',
    );

    // Due to Cartesian products, we need to filter for correct combinations
    // Match against the expected data
    const expectedDepts = [
      { name: 'Engineering', allocated: 250000, spent: 180000 },
      { name: 'Marketing', allocated: 150000, spent: 120000 },
      { name: 'Operations', allocated: 100000, spent: 85000 },
    ];

    for (const expected of expectedDepts) {
      const matchingRow = result.rows.find(
        (row) =>
          row['?b.budget.departments.name'] === expected.name &&
          Number(row['?b.budget.departments.allocated']) ===
            expected.allocated &&
          Number(row['?b.budget.departments.spent']) === expected.spent,
      );

      expect(matchingRow).toBeDefined();
      expect(matchingRow?.['?b.budget.departments.name']).toBe(expected.name);
      expect(Number(matchingRow?.['?b.budget.departments.allocated'])).toBe(
        expected.allocated,
      );
      expect(Number(matchingRow?.['?b.budget.departments.spent'])).toBe(
        expected.spent,
      );
    }
  });

  it('should query nested category data', async () => {
    const kernel = new TrellisKernel();

    const budgetPath = join(process.cwd(), 'data', 'budget.json');
    const budgetData = JSON.parse(readFileSync(budgetPath, 'utf-8'));
    const facts = jsonEntityFacts('default', budgetData, 'budget');
    kernel.getStore().addFacts(facts);

    // Query categories
    const result = await kernel.query(
      'FIND budget AS ?b RETURN ?b.budget.departments.categories.name, ?b.budget.departments.categories.allocated, ?b.budget.departments.categories.spent',
    );

    // TQL creates Cartesian products, verify we have data
    expect(result.rows.length).toBeGreaterThan(0);

    // Verify specific categories exist
    const categoryNames = result.rows.map(
      (r) => r['?b.budget.departments.categories.name'],
    );
    expect(categoryNames).toContain('Salaries');
    expect(categoryNames).toContain('Advertising');
    expect(categoryNames).toContain('Office');
  });

  it('should identify over-budget categories', async () => {
    const kernel = new TrellisKernel();

    const budgetPath = join(process.cwd(), 'data', 'budget.json');
    const budgetData = JSON.parse(readFileSync(budgetPath, 'utf-8'));
    const facts = jsonEntityFacts('default', budgetData, 'budget');
    kernel.getStore().addFacts(facts);

    const result = await kernel.query(
      'FIND default AS ?b RETURN ?b.budget.departments.categories.name, ?b.budget.departments.categories.allocated, ?b.budget.departments.categories.spent',
    );

    // Find categories where spent > allocated
    const overBudget = result.rows.filter((row) => {
      const allocated = Number(
        row['?b.budget.departments.categories.allocated'],
      );
      const spent = Number(row['?b.budget.departments.categories.spent']);
      return spent > allocated;
    });

    // In our test data, no categories should be over budget
    expect(overBudget.length).toBe(0);
  });

  it('should calculate total budget metrics', async () => {
    const kernel = new TrellisKernel();

    const budgetPath = join(process.cwd(), 'data', 'budget.json');
    const budgetData = JSON.parse(readFileSync(budgetPath, 'utf-8'));
    const facts = jsonEntityFacts('default', budgetData, 'budget');
    kernel.getStore().addFacts(facts);

    // Query fiscal year and total
    const fiscalResult = await kernel.query(
      'FIND budget AS ?b RETURN ?b.budget.fiscal_year, ?b.budget.total_allocated',
    );

    expect(fiscalResult.rows.length).toBe(1);
    expect(fiscalResult.rows[0]?.['?b.budget.fiscal_year']).toBe(2024);
    expect(fiscalResult.rows[0]?.['?b.budget.total_allocated']).toBe(500000);

    // Query all departments and sum their spending
    const deptResult = await kernel.query(
      'FIND budget AS ?b RETURN ?b.budget.departments.spent',
    );

    const totalSpent = deptResult.rows.reduce((sum, row) => {
      return sum + Number(row['?b.budget.departments.spent']);
    }, 0);

    expect(totalSpent).toBe(385000); // 180000 + 120000 + 85000
  });
});
