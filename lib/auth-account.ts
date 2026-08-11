type SignupResultLike = {
  session: unknown | null;
  user: {
    identities?: unknown[] | null;
  } | null;
};

/**
 * Hosted Supabase returns an obfuscated user with no identities when a
 * confirmed email is submitted to signUp again. Treat that response as an
 * existing account instead of pretending that another email was sent.
 */
export function isRepeatedSignup(result: SignupResultLike) {
  return (
    result.session === null &&
    Array.isArray(result.user?.identities) &&
    result.user.identities.length === 0
  );
}
