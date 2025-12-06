import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../utils/firebaseClient";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface SignInProps {
  email: string;
  password: string;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const provider = new GoogleAuthProvider();
  const navigate = useNavigate();

  const persistToken = async (tokenPromise: Promise<string>) => {
    const idToken = await tokenPromise;
    localStorage.setItem("token", idToken);
    return idToken;
  };

  const signIn = async ({ email, password }: SignInProps) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    return user.getIdToken(true);
  };

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    return user.getIdToken();
  };

  const handleEmailPasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await persistToken(signIn({ email, password }));
    } catch (err: any) {
      setError(err?.message || "Unable to sign in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await persistToken(signInWithGoogle());
    } catch (err: any) {
      setError(err?.message || "Google sign-in failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        navigate("/home");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[var(--color-primary)] text-[var(--text-color-default)]">
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
        <section className="relative overflow-hidden bg-gradient-to-br from-[var(--color-accent)] via-[#2f3140] to-[var(--color-primary)] text-white hidden sm:flex">
          <div
            className="absolute inset-0 opacity-50"
            style={{
              background:
                "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 30%), radial-gradient(circle at 80% 10%, rgba(108,99,255,0.18), transparent 25%), radial-gradient(circle at 50% 80%, rgba(0,190,255,0.15), transparent 25%)",
            }}
          />
          <div className="relative flex h-full flex-col justify-between gap-10 p-10 lg:p-14">
            <div className="flex items-center gap-3">
              <img src="/cogniva-landscape-logo.svg" className="h-10" alt="Cogniva logo" />
              <span className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70">Private preview</span>
            </div>

            <div className="space-y-6 max-w-2xl">
              <p className="text-3xl font-semibold leading-tight lg:text-4xl">Conversational intelligence crafted for teams.</p>
              <p className="text-base text-white/80 lg:text-lg">
                Jump back into your Cogniva workspace, keep ideas flowing, and ship faster with structured outputs that stay organized.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {["Secure Firebase auth", "History that syncs", "Code-ready replies", "Live collaboration"].map((item) => (
                  <div key={item} className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/85 backdrop-blur">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-white/70">
              <span className="rounded-full border border-white/20 px-3 py-1">Powered by Firebase</span>
              <span className="rounded-full border border-white/20 px-3 py-1">Protected chat storage</span>
              <span className="rounded-full border border-white/20 px-3 py-1">Dark UI inspired</span>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center p-8 lg:p-12">
          <div className="w-full max-w-md space-y-8 rounded-2xl border border-[var(--color-secondary)]/50 bg-[var(--color-accent)]/60 p-8 shadow-xl backdrop-blur">
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-semibold text-white">Welcome back</h1>
              <p className="text-sm text-[var(--text-color-default)]">Sign in to continue your Cogniva conversations.</p>
            </div>

            {error ? (
              <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <form className="space-y-4" onSubmit={handleEmailPasswordSubmit}>
              <div className="space-y-2">
                <label className="text-sm text-[var(--text-color-default)]" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-secondary)]/50 bg-[var(--color-primary)]/40 px-4 py-3 text-white placeholder:text-[var(--text-color-default)]/60 shadow-inner focus:border-white/60 focus:outline-none"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-[var(--text-color-default)]" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-secondary)]/50 bg-[var(--color-primary)]/40 px-4 py-3 text-white placeholder:text-[var(--text-color-default)]/60 shadow-inner focus:border-white/60 focus:outline-none"
                  required
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="button w-full bg-[var(--color-secondary)] hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <div className="flex items-center gap-3 text-xs text-[var(--text-color-default)]/80">
              <span className="h-px flex-1 bg-[var(--color-secondary)]/40" />
              <span>or</span>
              <span className="h-px flex-1 bg-[var(--color-secondary)]/40" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSubmit}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-[var(--color-secondary)]/50 bg-[var(--color-primary)]/60 px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--color-accent)]/70 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continue with Google
            </button>

            <p className="text-center text-xs text-[var(--text-color-default)]/80">
              Secure, token-based sign in keeps your workspace encrypted.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
