export function getRateKey(currency, type) {
  return `${currency}-${type}`;
}

export function fix(value) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}
