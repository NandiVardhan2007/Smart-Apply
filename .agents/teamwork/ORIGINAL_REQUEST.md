# Original User Request

## Initial Request — 2026-09-30T12:53:52Z

# Teamwork Project Prompt

> Requested team: Large-scale agent team

Use a very large team of agents. Perform a comprehensive code and UI audit of the SMART APPLY project, focusing on identifying bugs and issues, particularly on the landing page and live interview page, and produce a detailed bug report.

Working directory: d:\SMARTAPPLY
Integrity mode: development

## Requirements

### R1. Comprehensive Static Audit
Audit every file in the codebase for bugs, anti-patterns, and potential vulnerabilities. You may use any external tools, linters, or custom scripts to aid this process.

### R2. Dynamic UI Testing
Start the application locally and perform a dynamic UI audit, placing special emphasis on the landing page and the live interview page.

### R3. Bug Report Generation
Compile all findings into a clean, clear, and actionable `bug_report.md` file in the root directory. Do not leave anything out.

## Acceptance Criteria

### Audit Completeness & Formatting
- [ ] `bug_report.md` exists in the root directory.
- [ ] The report contains a dedicated section for "Landing Page UI Issues".
- [ ] The report contains a dedicated section for "Live Interview Page UI Issues".
- [ ] The report contains a dedicated section for "General Codebase Issues".
- [ ] Every reported bug includes exact file/line numbers (for code issues) or steps to reproduce (for UI issues).
