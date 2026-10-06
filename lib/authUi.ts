export async function withAuthTimeout<T>(operation: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Request timed out. Please try again.")), 30000);
      }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

export function authMessage(error: { code?: string; message: string }) {
  if (error.code === "invalid_credentials") return "Incorrect email or password.";
  if (["user_already_exists", "email_exists"].includes(error.code || "")) return "An account with this email already exists. Please sign in.";
  if (error.code === "weak_password") return "Choose a stronger password with at least 6 characters.";
  if (error.code === "email_not_confirmed") return "Confirm your email before signing in.";
  return error.message;
}
