/**
 * Runtime contract for analytics events against `shared/data/analytics.json`
 * (docs/09-ANALYTICS.md §1: "the runtime AnalyticsService drops and logs any
 * parameter that is not declared for that event").
 *
 * One checker for everyone who emits or receives events: the tests assert the
 * FTUE director's output with it, `npm run validate` uses it to prove the
 * taxonomy covers what the code sends, and the prototype's recorder runs every
 * logged event through it. Mirrored by `AnalyticsService.cs`.
 */

export type AnalyticsValue = string | number | boolean;

export interface AnalyticsEvent {
  name: string;
  params: Record<string, AnalyticsValue>;
}

export type AnalyticsSink = (event: AnalyticsEvent) => void;

/** Just the part of analytics.json the contract needs. */
export interface AnalyticsTaxonomy {
  events: { name: string; params: Record<string, string> }[];
}

function matchesType(type: string, v: AnalyticsValue): boolean {
  switch (type) {
    case 'string':
      return typeof v === 'string';
    case 'long':
      return typeof v === 'number' && Number.isInteger(v);
    case 'double':
      return typeof v === 'number' && Number.isFinite(v);
    case 'boolean':
      return typeof v === 'boolean';
    default:
      return false;
  }
}

/**
 * Problems with one event: unknown name, a declared parameter that is missing,
 * a parameter that is not declared, or a value of the wrong type. Empty = valid.
 */
export function checkAnalyticsEvent(tax: AnalyticsTaxonomy, e: AnalyticsEvent): string[] {
  const def = tax.events.find((d) => d.name === e.name);
  if (!def) return [`unknown event "${e.name}"`];
  const problems: string[] = [];
  for (const [param, type] of Object.entries(def.params)) {
    if (!Object.prototype.hasOwnProperty.call(e.params, param)) {
      problems.push(`${e.name}: missing param "${param}"`);
      continue;
    }
    const v = e.params[param]!;
    if (!matchesType(type, v)) problems.push(`${e.name}.${param}: expected ${type}, got ${JSON.stringify(v)}`);
  }
  for (const param of Object.keys(e.params)) {
    if (!Object.prototype.hasOwnProperty.call(def.params, param)) problems.push(`${e.name}: undeclared param "${param}"`);
  }
  return problems;
}
