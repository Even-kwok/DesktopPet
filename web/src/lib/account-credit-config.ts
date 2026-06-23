export function initialCreditBalanceFromEnv(value = process.env.INITIAL_CREDIT_BALANCE) {
  const raw = value?.trim() ?? "";

  if (!/^\d+$/.test(raw)) {
    return 0;
  }

  const amount = Number(raw);

  return Number.isSafeInteger(amount) ? amount : 0;
}
