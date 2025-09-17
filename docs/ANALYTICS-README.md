# TQL Analytics & Insights

The TQL Analytics Module provides tools for analyzing relationships between datasets and automatically generating insights through TQL queries.

## Features

1. **Dataset Relationship Analysis**
   - Automatic detection of foreign key relationships
   - Identification of common attributes across datasets
   - Value reference detection
   - Confidence scoring for potential joins

2. **Automated Insight Generation**
   - Single-dataset insights (counts, distributions, top/bottom values)
   - Statistical insights (averages, min/max, outliers)
   - Time-based insights for date fields
   - Cross-dataset insights based on detected relationships
   - Correlation and cardinality analysis

3. **CLI Integration**
   - Command-line tool for generating insights from multiple datasets
   - Output in table or JSON format
   - Filtering by confidence threshold and insight types

## Usage

### Dataset Relationship Analyzer

```typescript
import { EAVStore } from '../src/eav-engine.js';
import { DatasetRelationshipAnalyzer } from '../src/analytics/dataset-relationship-analyzer.js';

// Create analyzer
const analyzer = new DatasetRelationshipAnalyzer();

// Add datasets
analyzer.addDataset('posts', postsStore);
analyzer.addDataset('users', usersStore);

// Analyze relationships
const relationships = analyzer.analyzeRelationships({
  minConfidence: 0.6,
  maxRelationships: 20
});

// Use relationships
relationships.forEach(rel => {
  console.log(`Found relationship: ${rel.sourceDataset}.${rel.sourceAttribute} → ${rel.targetDataset}.${rel.targetAttribute}`);
  console.log(`Confidence: ${rel.relationship.confidence}, Type: ${rel.relationship.type}`);
});
```

### Insights Engine

```typescript
import { EAVStore } from '../src/eav-engine.js';
import { InsightsEngine, InsightType } from '../src/analytics/insights-engine.js';

// Create insights engine with configuration
const insightsEngine = new InsightsEngine({
  confidenceThreshold: 0.5,
  maxInsights: 20,
  insightTypes: [InsightType.COUNT, InsightType.DISTRIBUTION, InsightType.JOIN_STATS],
  verbose: true
});

// Register datasets
insightsEngine.registerDataset('posts', postsStore);
insightsEngine.registerDataset('users', usersStore);

// Generate insights
const insights = insightsEngine.generateInsights();

// Use insights
insights.forEach(insight => {
  console.log(`Insight: ${insight.title}`);
  console.log(`Query: ${insight.query}`);
  console.log(`Confidence: ${insight.confidence}`);
});
```

### Command Line Interface

```bash
# Generate insights from multiple datasets
bun run tql-insights generate -d data/posts.json data/users.json -c 0.6 -m 10

# Save insights to file
bun run tql-insights generate -d data/posts.json data/users.json -o insights.json -f json

# Filter by insight types
bun run tql-insights generate -d data/posts.json -t count distribution
```

## Insight Types

The insights engine can generate the following types of insights:

- **COUNT**: Basic entity counts
- **DISTRIBUTION**: Distribution of categorical attributes
- **TOP_VALUES**: Entities with highest values for an attribute
- **BOTTOM_VALUES**: Entities with lowest values for an attribute
- **AVERAGE**: Average of numerical attributes
- **MIN_MAX**: Min/max ranges of attributes
- **OUTLIERS**: Entities with values outside normal ranges
- **CORRELATION**: Potential correlations between attributes in different datasets
- **JOIN_STATS**: Statistics about joins between datasets
- **CARDINALITY**: Analysis of relationship cardinality (one-to-one, one-to-many)
- **TREND**: Time-based trends for date attributes
- **TIME_COMPARISON**: Comparing metrics across time periods

## Integration with TQL

All insights generate valid TQL queries that can be executed directly using the TQL CLI:

```bash
# Get an insight query
QUERY=$(bun run tql-insights generate -d data/posts.json -t count -m 1 -f json | jq -r '.[0].query')

# Run the insight query
bun run tql -d data/posts.json -q "$QUERY"
```