// CHURRASCO! O Mestre da Brasa — deterministic pseudo-random number generator.
//
// EXACT port of tools/sim-core/src/rng.ts (mulberry32).
// State is held in a 32-bit unsigned integer with explicit unchecked arithmetic
// to guarantee identical sequence generation across platforms.

#nullable enable
using System;
using System.Collections.Generic;

namespace Churrasco.Core
{
    /// <summary>
    /// Deterministic RNG (mulberry32) — the C# mirror of <c>tools/sim-core/src/rng.ts</c>.
    /// </summary>
    public sealed class Rng
    {
        private const uint GoldenGamma = 0x9e3779b9;
        private const double TwoPow32 = 4294967296.0;

        private uint _s;

        public Rng(double seed) : this(ToUint32(seed))
        {
        }

        public Rng(uint seed)
        {
            _s = seed != 0 ? seed : GoldenGamma;
        }

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

        /// <summary>Uniform integer in [min, max] inclusive.</summary>
        public int Int(int min, int max) => (int)Math.Floor(Range(min, (double)max + 1 - 1e-9));

        /// <summary>True with probability p.</summary>
        public bool Chance(double p) => Next() < p;

        /// <summary>Weighted pick. Returns -1 when list empty or all weights &lt;= 0.</summary>
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

        private static uint Imul(uint a, uint b) => unchecked((uint)((int)a * (int)b));
    }
}
