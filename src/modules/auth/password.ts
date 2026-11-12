import * as argon2 from "argon2";

/**
 * Password hashing (Argon2id).
 * Plain password kabhi database mein save nahi hota, sirf hash.
 * Parameters OWASP ke recommended minimum ke qareeb hain.
 */

const HASH_OPTIONS: argon2.HashOptions & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, HASH_OPTIONS);
}

export async function verifyPassword(
  hash: string,
  plain: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
