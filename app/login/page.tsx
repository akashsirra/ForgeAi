"use client";

import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signup, setSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setLoading(true);
    setError("");

    try {
      if (signup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      router.push("/");
    } catch (err: any) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-5 text-white">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-6 text-center">
          <div className="text-4xl">⚒️</div>

          <h1 className="mt-3 text-2xl font-bold">
            {signup ? "Create your ForgeAI account" : "Welcome back"}
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            {signup
              ? "Start building with AI."
              : "Sign in to access your projects."}
          </p>
        </div>

        <input
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-3 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none"
        />

        <input
          type="password"
          name="password"
          autoComplete={signup ? "new-password" : "current-password"}
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none"
        />

        {error && (
          <div className="mt-3 rounded-xl bg-red-950/50 p-3 text-sm text-red-300">
            ❌ {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="mt-4 w-full rounded-xl bg-white p-3 font-bold text-black disabled:opacity-50"
        >
          {loading
            ? "⚙️ Please wait..."
            : signup
              ? "🚀 Create Account"
              : "🔐 Sign In"}
        </button>

        <button
          onClick={() => {
            setSignup(!signup);
            setError("");
          }}
          className="mt-4 w-full text-sm text-zinc-400 hover:text-white"
        >
          {signup
            ? "Already have an account? Sign in"
            : "Don't have an account? Create one"}
        </button>
      </div>
    </main>
  );
}
