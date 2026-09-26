#nullable enable
using System;
using System.Collections.Generic;

namespace Churrasco.Core
{
    /// <summary>
    /// Deterministic RNG (mulberry32) — the C# mirror of <c>tools/sim-core/src/rng.ts</c>.
    ///
    /// The whole simulation has to be reproducible so balance reports and golden vectors are
    /// stable across machines, and this is the one place where "same algorithm" is not enough:
    /// the reference leans on JavaScript's 32-bit bit-operators (<c>Math.imul</c>,
    /// <c>&gt;&gt;&gt; 0</c>) and on <c>seed || fallback</c>. Everything here is <c>uint</c>
    /// arithmetic in an <c>unchecked</c> block, which is the same bit pattern for the same input,
    /// and the stream is pinned by the <c>golden.rng</c> vectors precisely so a divergence shows
    /// up as "draw 3 disagrees" instead of "coins 628 ≠ 631" twelve vectors deep.
    /// </summary>
    public sealed class Rng
    {
        private const uint GoldenGamma = 0x9e3779b9;
        private const double TwoPow32 = 4294967296.0;

        private uint _s;

        /// <summary>JS entry point: <c>new Rng(seed)</c> coerces with <c>seed &gt;&gt;&gt; 0</c>.</summary>
        public Rng(double seed) : this(ToUint32(seed))
        {
        }

        public Rng(uint seed)
        {
            // Force a non-zero 32-bit state — the reference's `|| 0x9e3779b9`.
            _s = seed != 0 ? seed : GoldenGamma;
        }

        /// <summary>
        /// ECMAScript <c>ToUint32</c>: truncate, then take the non-negative remainder mod 2³².
        /// NaN, ±∞ and 0 become 0. Seeds in this project are integers, so the double
        /// rounding of the modulo never decides a case.
        /// </summary>
        public static uint ToUint32(double value)
        {
            if (double.IsNaN(value) || double.IsInfinity(value) || value == 0) return 0;
            double truncated = Math.Truncate(value);
            double wrapped = truncated - Math.Floor(truncated / TwoPow32) * TwoPow32;
            return (uint)wrapped;
        }

        /// <summary>Uniform float in [0, 1).</summary>
        public double Next()
        {
            unchecked
            {
                _s = _s + 0x6d2b79f5u;
                uint t = _s;
                t = Imul(t ^ (t >> 15), t | 1u);
                t ^= t + Imul(t ^ (t >> 7), t | 61u);
                return (double)(t ^ (t >> 14)) / TwoPow32;
            }
        }

        /// <summary>Uniform float in [min, max).</summary>
        public double Range(double min, double max) => min + Next() * (max - min);

        /// <summary>
        /// Uniform integer in [min, max] inclusive. The <c>- 1e-9</c> is in the reference too:
        /// without it <c>next()</c> landing exactly on 1 (impossible for this generator, but the
        /// bound is <c>max + 1</c> after the epsilon) would return <c>max + 1</c>.
        /// </summary>
        public int Int(int min, int max) => (int)Math.Floor(Range(min, (double)max + 1 - 1e-9));

        /// <summary>True with probability p.</summary>
        public bool Chance(double p) => Next() < p;

        /// <summary>Weighted pick. Returns -1 when the list is empty or all weights are 0.</summary>
        public int PickWeighted(IReadOnlyList<double> weights)
        {
            double total = 0;
            for (int i = 0; i < weights.Count; i++)
            {
                double w = weights[i];
                total += w > 0 ? w : 0;
            }
            if (total <= 0) return -1;
            double roll = Next() * total;
            for (int i = 0; i < weights.Count; i++)
            {
                double w = weights[i];
                if (w <= 0) continue;
                roll -= w;
                if (roll <= 0) return i;
            }
            return weights.Count - 1;
        }

        public T Pick<T>(IReadOnlyList<T> items) => items[Int(0, items.Count - 1)];

        /// <summary>Fisher–Yates on a copy, in the reference's order (high index down).</summary>
        public T[] Shuffled<T>(IReadOnlyList<T> items)
        {
            var outItems = new T[items.Count];
            for (int i = 0; i < items.Count; i++) outItems[i] = items[i];
            for (int i = outItems.Length - 1; i > 0; i--)
            {
                int j = Int(0, i);
                T tmp = outItems[i];
                outItems[i] = outItems[j];
                outItems[j] = tmp;
            }
            return outItems;
        }

        /// <summary>
        /// <c>Math.imul</c>: multiply as int32, keep the low 32 bits. Signedness does not matter
        /// for the low bits, which is why <c>uint</c> operands survive the round trip.
        /// </summary>
        private static uint Imul(uint a, uint b) => unchecked((uint)((int)a * (int)b));
    }
}
