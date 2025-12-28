## Hypothetical: HIPAA Compliance Audit for a Healthcare Startup

**Situation**: A healthcare startup uses 5 different SaaS tools (EHR, scheduling, billing, patient portal, lab integrations). An auditor asks: _"Show me every instance where patient data was accessed by a user who wasn't part of the care team AND the access happened outside business hours."_

### The Problem

Each system has a different API, different schema, different terminology:

- EHR calls it `patient_id`, billing calls it `member_number`
- Scheduling has `provider_id`, EHR has `physician_npi`
- Access logs are in different formats (ISO timestamps, Unix epochs, etc.)

**With traditional tools**: You'd need to build an ETL pipeline, normalize schemas, load into a data warehouse, write complex SQL with multiple JOINs across 5+ tables, handle timezone conversions, and define "care team" membership somewhere.

**Time to answer**: Days to weeks.

### TQL Approach

```typescript
// 1. Ingest all APIs directly (no schema design)
for (const log of ehrAccessLogs)
  store.addFacts(jsonEntityFacts(`access:${log.id}`, log, 'access'));
for (const patient of patientRecords)
  store.addFacts(jsonEntityFacts(`patient:${patient.id}`, patient, 'patient'));
for (const team of careTeams)
  store.addLinks(
    team.members.map((m) => ({
      e1: `patient:${team.patientId}`,
      a: 'CARE_TEAM',
      e2: `user:${m}`,
    })),
  );

// 2. Define the violation rule
evaluator.addRule({
  head: {
    predicate: 'hipaa_violation',
    terms: ['?Access', '?User', '?Patient'],
  },
  body: [
    { predicate: 'attr', terms: ['?Access', 'type', 'access'] },
    { predicate: 'attr', terms: ['?Access', 'userId', '?User'] },
    { predicate: 'attr', terms: ['?Access', 'patientId', '?Patient'] },
    { predicate: 'attr', terms: ['?Access', 'timestamp', '?Time'] },
    {
      predicate: 'not',
      terms: [
        {
          predicate: 'link',
          terms: [`patient:?Patient`, 'CARE_TEAM', `user:?User`],
        },
      ],
    },
    { predicate: 'outside_hours', terms: ['?Time'] }, // custom predicate for 6pm-8am
  ],
});

// 3. Query and get immediate results
const violations = evaluator.evaluate({
  goals: [{ predicate: 'hipaa_violation', terms: ['?A', '?U', '?P'] }],
  variables: new Set(['A', 'U', 'P']),
});
```

**Time to answer**: Minutes.

### Why This is Hard Elsewhere

| Tool              | Blocker                                                                         |
| ----------------- | ------------------------------------------------------------------------------- |
| **SQL**           | Requires normalized schema design, cross-system ID mapping, timezone handling   |
| **Elasticsearch** | No negation ("NOT in care team"), no rule-based inference                       |
| **Splunk**        | Great for logs, but correlating with patient/team data requires complex lookups |
| **Custom code**   | You're just building TQL from scratch                                           |

**TQL's edge**: Ingest raw JSON from any source → define logic rules declaratively → query across all data with graph traversal and negation—no ETL, no schema, no external services.
