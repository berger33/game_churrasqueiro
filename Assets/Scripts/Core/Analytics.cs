// CHURRASCO! O Mestre da Brasa — analytics event contract (Unity client).
//
// Port of tools/sim-core/src/analytics.ts. One checker for everyone who emits
// or receives events: the TutorialDirector's output, and the runtime
// AnalyticsService, which drops and logs any parameter an event does not
// declare (docs/09-ANALYTICS.md §1). The taxonomy is shared/data/analytics.json
// (generated class: AnalyticsTable).
//
// tools/csharp/parity replays the TypeScript's verdicts on the same events
// (tools/golden/vectors.json → tutorial.analytics) and requires identical
// problem strings.

#nullable enable
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using Churrasco.Core.Generated;

namespace Churrasco.Core
{
    /// <summary>
    /// One analytics event. Parameter values are <c>string</c>, <c>bool</c>, an
    /// integer type (<c>long</c> by convention) or <c>double</c> — the C# side of
    /// the TypeScript <c>AnalyticsValue = string | number | boolean</c>.
    /// </summary>
    public sealed class AnalyticsEvent
    {
        public string Name { get; }
        public IReadOnlyDictionary<string, object> Params { get; }

        public AnalyticsEvent(string name, IReadOnlyDictionary<string, object> parameters)
        {
            Name = name;
            Params = parameters;
        }
    }

    public static class AnalyticsContract
    {
        /// <summary>
        /// Problems with one event: unknown name, a declared parameter that is
        /// missing, a parameter that is not declared, or a value of the wrong type.
        /// Empty = valid. Worded exactly like checkAnalyticsEvent().
        /// </summary>
        public static List<string> Check(AnalyticsTable taxonomy, AnalyticsEvent e)
        {
            AnalyticsEvents? def = null;
            foreach (var d in taxonomy.Events)
            {
                if (d.Name == e.Name) { def = d; break; }
            }
            if (def == null) return new List<string> { $"unknown event \"{e.Name}\"" };

            var problems = new List<string>();
            foreach (var declared in def.Params)
            {
                if (!e.Params.TryGetValue(declared.Key, out var v))
                {
                    problems.Add($"{e.Name}: missing param \"{declared.Key}\"");
                    continue;
                }
                if (!Matches(declared.Value, v))
                    problems.Add($"{e.Name}.{declared.Key}: expected {declared.Value}, got {JsJson(v)}");
            }
            foreach (var key in e.Params.Keys)
            {
                if (!def.Params.ContainsKey(key)) problems.Add($"{e.Name}: undeclared param \"{key}\"");
            }
            return problems;
        }

        /// <summary>
        /// Same type rules as the TypeScript, where every number is a double:
        /// <c>long</c> = an integral number, <c>double</c> = any finite number.
        /// </summary>
        public static bool Matches(string type, object v)
        {
            switch (type)
            {
                case "string": return v is string;
                case "boolean": return v is bool;
                case "long": return IsIntegral(v) || (AsDouble(v) is double d && IsFinite(d) && Math.Floor(d) == d);
                case "double": return IsIntegral(v) || (AsDouble(v) is double f && IsFinite(f));
                default: return false;
            }
        }

        private static bool IsIntegral(object v) =>
            v is int || v is long || v is short || v is byte || v is sbyte || v is ushort || v is uint;

        private static double? AsDouble(object v) => v switch
        {
            double d => d,
            float f => f,
            decimal m => (double)m,
            _ => (double?)null
        };

        private static bool IsFinite(double d) => !double.IsNaN(d) && !double.IsInfinity(d);

        /// <summary>
        /// <c>JSON.stringify</c> for the values an event can carry — enough to word
        /// a problem the way the TypeScript does. Numbers use JavaScript's
        /// formatting for the everyday range (integers, plain decimals).
        /// </summary>
        public static string JsJson(object? v)
        {
            switch (v)
            {
                case null: return "null";
                case string s: return Quote(s);
                case bool b: return b ? "true" : "false";
                case int or long or short or byte or sbyte or ushort or uint:
                    return Convert.ToInt64(v, CultureInfo.InvariantCulture).ToString(CultureInfo.InvariantCulture);
            }
            var d = AsDouble(v);
            if (d == null) return Quote(v.ToString() ?? "");
            double x = d.Value;
            if (!IsFinite(x)) return "null";
            if (Math.Floor(x) == x && Math.Abs(x) < 1e21) return x.ToString("0", CultureInfo.InvariantCulture);
            var r = x.ToString("R", CultureInfo.InvariantCulture);
            int e = r.IndexOf('E');
            if (e < 0) return r;
            // .NET "1E-07" → JavaScript "1e-7"
            var mantissa = r.Substring(0, e);
            var exp = int.Parse(r.Substring(e + 1), NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture);
            return mantissa + "e" + (exp < 0 ? "-" : "+") + Math.Abs(exp).ToString(CultureInfo.InvariantCulture);
        }

        private static string Quote(string s)
        {
            var sb = new StringBuilder(s.Length + 2);
            sb.Append('"');
            foreach (var c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    case '\b': sb.Append("\\b"); break;
                    case '\f': sb.Append("\\f"); break;
                    default:
                        if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        else sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
            return sb.ToString();
        }
    }
}
