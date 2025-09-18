# TQL v1.1.0 Release Notes

## 🚀 Ready for Production

TQL v1.1.0 is a **production-ready** release with comprehensive hardening, professional CLI ergonomics, and enterprise-grade error handling.

## ✨ What's New

### CLI Enhancements

- **`tql wf` alias**: Common muscle memory shortcut for `tql workflow`
- **Enhanced JSON plan output**: Includes `type` and `source.kind` for better tooling integration
- **`--no-color` option**: CI-friendly logging without emojis
- **Structured error messages**: Human-first errors with actionable hints

### Validation & Error Handling

- **Smart dependency validation**: Helpful suggestions when `needs` references are wrong
- **Minimal cycle detection**: Shows `a → b → a` instead of full dependency graph
- **Duplicate output detection**: Prevents accidental dataset overwrites
- **Consistent ID warnings**: Alerts when `out` names match step IDs

### Developer Experience

- **Cache key correlation**: Pretty logs show `[abc12345]` for easy debugging
- **Map cap display**: Dry run shows `mapFrom=<id> cap=20` for map mode sources
- **Comprehensive troubleshooting**: Complete error message reference
- **Windows compatibility**: Cross-platform path handling

### Telemetry (Opt-in)

- **Anonymous usage analytics**: Command types, durations, success/failure
- **No PII collected**: Privacy-first approach
- **Environment controlled**: `TQL_TELEMETRY=true` to enable

## 🔧 Technical Improvements

### Exit Code Consistency

- **Exit 1**: Validation errors (schema, dependencies, cycles)
- **Exit 2**: Runtime errors (network, execution failures)
- **Exit 0**: Success

### Enhanced JSON Schema

```json
{
  "name": "workflow-name",
  "version": 1,
  "steps": [
    {
      "id": "fetch_data",
      "type": "source",
      "needs": [],
      "from": null,
      "out": "data",
      "source": {
        "kind": "http",
        "mode": "batch",
        "url": "https://api.example.com/data"
      }
    }
  ]
}
```

### Error Message Examples

```
❌ Step "process_data" references unknown dependency "posts".
   Did you mean step id "fetch_posts"?

❌ Workflow has circular dependencies: a → b → a

⚠️  Warning: Step "fetch_data" output "fetch_data" matches a step ID.
   This may cause confusion in scripts.
```

## 📋 Release Checklist ✅

- [x] **Version bump**: 1.0.0 → 1.1.0
- [x] **Changelog**: Complete with breaking changes noted
- [x] **CLI shape locked**: No unknown options, proper help
- [x] **Exit codes verified**: 1 for validation, 2 for runtime
- [x] **Help parity**: All options documented
- [x] **Windows compatibility**: Path handling tested
- [x] **Telemetry stub**: Opt-in analytics ready
- [x] **Edge case coverage**: Comprehensive test suite
- [x] **Documentation updated**: Troubleshooting guide added

## 🧪 Test Coverage

### Edge Cases Covered

- Empty dataset handling
- Missing output validation
- `from` vs `needs` behavior
- Map mode validation
- Duplicate output detection
- CLI alias functionality
- JSON plan output
- No-color mode
- Windows path compatibility
- Exit code consistency

### Test Files

- `test/workflow-hardening.test.ts`: Core hardening tests
- `test/edge-cases.test.ts`: Edge case validation
- `test/windows-compatibility.test.ts`: Cross-platform support

## 🚀 Quick Start

```bash
# Install and test
pnpm install
pnpm build

# Run a workflow
tql wf run examples/workflows/simple-demo.yml --dry

# Plan a workflow
tql wf plan examples/workflows/simple-demo.yml --json

# Enable telemetry (optional)
export TQL_TELEMETRY=true
tql wf run examples/workflows/simple-demo.yml
```

## 🔮 Post-GA Roadmap

### Easy Wins (Next Release)

- `--dry-map-cap` and `--dry-limit` explicit knobs
- HTTP retry with `--retries` and `--backoff-ms`
- Per-step timeouts with `source.timeoutMs`
- Artifact manifest in `./out/_manifest.json`

### Self-Improvement Engine

- Automated regression detection
- Performance monitoring dashboard
- Usage pattern analysis
- Feature adoption tracking

## 🎯 Production Readiness

This release is **production-ready** with:

- ✅ Professional CLI ergonomics
- ✅ Comprehensive error handling
- ✅ Cross-platform compatibility
- ✅ Complete test coverage
- ✅ Enterprise-grade logging
- ✅ Privacy-first telemetry
- ✅ Extensive documentation

**Ship it!** 🚢
