Perform a comprehensive code review of staged and unstaged changes before commit.

## Steps

1. **Gather changes**: Run `git diff` and `git diff --cached` to see all modified code
2. **Check conventions**:
   - TypeScript strict mode compliance
   - Consistent use of `@/*` path aliases
   - Zod schemas for API input validation
   - Proper async/await error handling (no unhandled promises)
3. **Review error handling**:
   - API routes return appropriate HTTP status codes
   - Database operations wrapped in try/catch where needed
   - User-facing errors are informative but don't leak internals
4. **Verify test coverage**:
   - New functions in `src/lib/` should have unit tests in `tests/unit/`
   - Breaking changes to existing behavior need test updates
   - Run `npm test` to confirm tests pass
5. **Security check**:
   - No hardcoded secrets or credentials
   - User input is validated before database queries
   - Room/membership authorization checks in API routes
   - No SQL injection risks (Prisma parameterizes by default)
6. **Room round gating**:
   - Mutations respect current round (e.g., offers only in OFFERS round)
   - Check `src/lib/room-*.ts` helpers are used correctly

## Output

Provide a summary with:
- **Approved**: Ready to commit, or
- **Changes requested**: List specific issues with file:line references

If changes are requested, suggest fixes but do not apply them automatically.
