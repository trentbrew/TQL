# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2024-01-XX

### Added

- **BREAKING**: Enhanced `needs` validation with helpful error messages
- New `tql wf` alias for `workflow` command
- `tql workflow plan` command with `--dot`, `--mermaid`, and `--json` output formats
- `--no-color` option for CI-friendly logging
- Cache key prefix display in pretty logs (`[abc12345]`)
- Map cap display in dry run mode
- Comprehensive edge case validation and error handling
- Duplicate output name detection
- Minimal cycle detection in dependency graphs
- Enhanced error messages with step/dataset suggestions

### Changed

- **BREAKING**: `needs` field now strictly validates step IDs (not dataset names)
- Improved error messages with actionable hints
- Enhanced dry run banner with map cap information
- Better cycle detection showing minimal cycles (e.g., `a → b → a`)

### Fixed

- CLI shape locking with proper unknown option rejection
- Schema validation with line/column error reporting
- Exit code consistency (1 for validation, 2 for runtime)
- Windows path compatibility improvements

### Documentation

- Added comprehensive troubleshooting section
- Enhanced common mistakes documentation
- Updated CLI usage examples
- Added template variable documentation

## [1.0.0] - 2024-01-XX

### Added

- Initial release of TQL workflow engine
- EAV-based datalog engine with path-aware JSON ingestion
- Workflow execution with source, query, and output steps
- HTTP source support with batch and map modes
- EQL-S query processing
- File and stdout output formats
- Caching system for workflow steps
- Template variable interpolation
- Comprehensive test suite
