import { describe, it, expect } from 'vitest';
import {
  PROFILE_EXAMPLES,
  SCORECARD_EXAMPLES,
  RFP_EXAMPLES,
} from '@/lib/assistants/examples';
import {
  ProfileParamsSchema,
  ScorecardParamsSchema,
  RfpParamsSchema,
} from '@/lib/assistants/types';

// The whole point of the examples is that "Carregar exemplo" yields a form that
// submits without edits. So every example MUST satisfy the exact submit schema —
// this test fails loudly if any field name/type/length drifts.
describe('assistant form examples', () => {
  it('has at least one example per heavy form', () => {
    expect(PROFILE_EXAMPLES.length).toBeGreaterThan(0);
    expect(SCORECARD_EXAMPLES.length).toBeGreaterThan(0);
    expect(RFP_EXAMPLES.length).toBeGreaterThan(0);
  });

  it('every profile example satisfies ProfileParamsSchema', () => {
    for (const ex of PROFILE_EXAMPLES) {
      expect(() => ProfileParamsSchema.parse(ex.params), ex.id).not.toThrow();
    }
  });

  it('every scorecard example satisfies ScorecardParamsSchema', () => {
    for (const ex of SCORECARD_EXAMPLES) {
      expect(() => ScorecardParamsSchema.parse(ex.params), ex.id).not.toThrow();
    }
  });

  it('every rfp example satisfies RfpParamsSchema', () => {
    for (const ex of RFP_EXAMPLES) {
      expect(() => RfpParamsSchema.parse(ex.params), ex.id).not.toThrow();
    }
  });
});
