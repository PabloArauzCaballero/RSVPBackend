import { InvariantError } from '../errors.js';

/**
 * Money is an integer amount of minor units plus an ISO-4217 code (lane 14).
 * There is no floating point anywhere: parsing, arithmetic and rounding use
 * integers, and formatting hands Intl a decimal *string*.
 */

const NO_MINOR_UNITS = 0;
const CENTS = 2;
const MILS = 3;

/** ISO-4217 minor-unit exponents for the currencies the product supports. Adding one is a data change. */
export const MINOR_UNIT_EXPONENTS = {
  BOB: CENTS, USD: CENTS, EUR: CENTS, ARS: CENTS, BRL: CENTS, CLP: NO_MINOR_UNITS, COP: CENTS, MXN: CENTS,
  PEN: CENTS, PYG: NO_MINOR_UNITS, UYU: CENTS, GBP: CENTS, JPY: NO_MINOR_UNITS, KWD: MILS
} as const satisfies Record<string, number>;
export type CurrencyCode = keyof typeof MINOR_UNIT_EXPONENTS;
export const DEFAULT_CURRENCY: CurrencyCode = 'BOB';

const BASIS_POINTS_PER_UNIT = 10_000n;
const ZERO = 0n;
const ONE = 1n;
const MINUS_ONE = -1n;
const TWO = 2n;

// Three uppercase letters. Matches "BOB"; rejects "bob".
// https://regex101.com/?flavor=javascript&regex=%5E%5BA-Z%5D%7B3%7D%24&flags=gm&testString=BOB%0Abob
const ISO_CODE = /^[A-Z]{3}$/;

// Plain decimal string, optional sign. Matches "-150.50" → ("-", "150", "50"); rejects "1e3".
// https://regex101.com/?flavor=javascript&regex=%5E(-)%3F(%5Cd%2B)(%3F%3A%5C.(%5Cd%2B))%3F%24&flags=gm&testString=-150.50%0A1e3
const DECIMAL = /^(-)?(\d+)(?:\.(\d+))?$/;

export function isCurrencyCode(value: string): value is CurrencyCode {
  return ISO_CODE.test(value) && Object.hasOwn(MINOR_UNIT_EXPONENTS, value);
}

export function assertCurrency(value: string): CurrencyCode {
  if (!isCurrencyCode(value)) throw new InvariantError('UNSUPPORTED_CURRENCY', `"${value}" is not a supported ISO-4217 currency`, { field: 'currency' });
  return value;
}

/** Banker's rounding of numerator/denominator, both integers, denominator > 0. */
export function roundHalfEven(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const twiceRemainder = (remainder < ZERO ? -remainder : remainder) * TWO;
  const direction = numerator < ZERO ? MINUS_ONE : ONE;
  if (twiceRemainder > denominator) return quotient + direction;
  if (twiceRemainder < denominator) return quotient;
  return quotient % TWO === ZERO ? quotient : quotient + direction;
}

export class Money {
  private constructor(readonly minorUnits: number, readonly currency: CurrencyCode) {}

  static of(minorUnits: number, currency: string = DEFAULT_CURRENCY): Money {
    if (!Number.isSafeInteger(minorUnits)) throw new InvariantError('INVALID_MONEY', 'Money must be an integer number of minor units', { field: 'amountMinor' });
    return new Money(minorUnits, assertCurrency(currency));
  }

  /** Parses "150.50" for BOB as 15050 minor units; more decimals than the currency allows is an error, not a rounding. */
  static parse(decimal: string, currency: string = DEFAULT_CURRENCY): Money {
    const code = assertCurrency(currency);
    const match = DECIMAL.exec(decimal.trim());
    if (!match) throw new InvariantError('INVALID_MONEY', `"${decimal}" is not a decimal amount`);
    const [, sign, whole, fraction = ''] = match;
    const exponent = MINOR_UNIT_EXPONENTS[code];
    if (fraction.length > exponent) throw new InvariantError('INVALID_MONEY', `${code} allows ${exponent} decimals`);
    const minor = BigInt(`${whole}${fraction.padEnd(exponent, '0')}`) * (sign ? MINUS_ONE : ONE);
    return Money.of(Number(minor), code);
  }

  add(other: Money): Money { this.assertSameCurrency(other); return Money.of(this.minorUnits + other.minorUnits, this.currency); }
  subtract(other: Money): Money { this.assertSameCurrency(other); return Money.of(this.minorUnits - other.minorUnits, this.currency); }

  /** `basisPoints` of this amount (1250 = 12.5 %), rounded half-even to the minor unit. */
  percentage(basisPoints: number): Money {
    if (!Number.isSafeInteger(basisPoints)) throw new InvariantError('INVALID_PERCENTAGE', 'Percentages are expressed in integer basis points');
    return Money.of(Number(roundHalfEven(BigInt(this.minorUnits) * BigInt(basisPoints), BASIS_POINTS_PER_UNIT)), this.currency);
  }

  /** Splits the amount by integer weights without losing or inventing a single minor unit (largest remainder). */
  allocate(weights: readonly number[]): Money[] {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (!weights.length || total <= 0 || weights.some((weight) => !Number.isSafeInteger(weight) || weight < 0)) {
      throw new InvariantError('INVALID_ALLOCATION', 'Weights must be non-negative integers with a positive sum');
    }
    const amount = BigInt(this.minorUnits);
    const divisor = BigInt(total);
    const shares = weights.map((weight, index) => ({ index, floor: (amount * BigInt(weight)) / divisor, remainder: (amount * BigInt(weight)) % divisor }));
    const leftover = Number(amount - shares.reduce((sum, share) => sum + share.floor, ZERO));
    const ranked = [...shares].sort((a, b) => Number(b.remainder - a.remainder) || a.index - b.index);
    const bonus = new Set(ranked.slice(0, leftover).map((share) => share.index));
    return shares.map((share) => Money.of(Number(share.floor) + (bonus.has(share.index) ? 1 : 0), this.currency));
  }

  equals(other: Money): boolean { return this.currency === other.currency && this.minorUnits === other.minorUnits; }

  /** "150.50" for 15050 BOB. */
  toDecimalString(): string {
    const exponent = MINOR_UNIT_EXPONENTS[this.currency];
    const digits = Math.abs(this.minorUnits).toString().padStart(exponent + 1, '0');
    const sign = this.minorUnits < 0 ? '-' : '';
    if (!exponent) return `${sign}${digits}`;
    return `${sign}${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`;
  }

  format(locale: string): string {
    const exponent = MINOR_UNIT_EXPONENTS[this.currency];
    // Intl accepts numeric strings exactly (ES2023), so no float is ever created for the amount.
    return new Intl.NumberFormat(locale, { style: 'currency', currency: this.currency, minimumFractionDigits: exponent, maximumFractionDigits: exponent })
      .format(this.toDecimalString() as Intl.StringNumericLiteral);
  }

  toJSON(): { readonly amountMinor: number; readonly currency: CurrencyCode } { return { amountMinor: this.minorUnits, currency: this.currency }; }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) throw new InvariantError('CURRENCY_MISMATCH', `Cannot combine ${this.currency} with ${other.currency}`);
  }
}
