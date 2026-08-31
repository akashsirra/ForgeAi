"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

type Project = {
  id: string;
  name: string;
  prompt: string;
  html: string;
  createdAt: string;
  userId: string;
  deploymentUrl?: string;
};

export default function ProjectWorkspace() {
  const params = useParams();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const user = auth.currentUser;

        if (!user) {
          router.push("/login");
          return;
        }

        const id = String(params.id);
        const snap = await getDoc(doc(db, "projects", id));

        if (!snap.exists()) {
          setError("Project not found.");
          return;
        }

        const data = snap.data();

        if (data.userId !== user.uid) {
          setError("You don't have access to this project.");
          return;
        }

        if (!cancelled) {
          setProject({
            id: snap.id,
            ...data,
          } as Project);
        }
      } catch (err) {
        console.error(err);
        setError("Could not load project.");
      } finally {
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  async function improveWebsite() {
    if (!project || !instruction.trim()) return;

    try {
      setEditing(true);
      setError("");

      const user = auth.currentUser;

      if (!user) {
        router.push("/login");
        return;
      }

      const idToken = await user.getIdToken();

      const res = await fetch("/api/edit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          html: project.html,
          instruction: instruction.trim(),
        }),
      });

      const data = await res.json();
      console.log("FORGEAI EDIT RESPONSE:", data);

      if (!res.ok) {
        throw new Error(data.error || "AI editing failed.");
      }

      if (!data.html) {
        throw new Error("AI returned no updated website.");
      }

      // IMPORTANT:
      // Update the local preview FIRST.
      // The AI result must remain visible even if Firestore is offline.
      setProject((current) =>
        current
          ? {
              ...current,
              html: data.html,
            }
          : current
      );

      // Force iframe to reload the new HTML.
      setPreviewKey((key) => key + 1);

      setInstruction("");

      // Save to Firestore separately.
      // A Firestore outage must NOT make the successful AI edit look like a failure.
      try {
        await updateDoc(doc(db, "projects", project.id), {
          html: data.html,
          updatedAt: new Date().toISOString(),
        });

        console.log("✓ ForgeAI edit saved to Firestore");
      } catch (saveError) {
        console.warn(
          "⚠️ AI edit succeeded, but Firestore could not save right now:",
          saveError
        );
      }
    } catch (err) {
      console.error("ForgeAI edit error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not improve the website."
      );
    } finally {
      setEditing(false);
    }
  }

  async function saveProject() {
    if (!project) return;

    try {
      setSaving(true);

      await updateDoc(doc(db, "projects", project.id), {
        html: project.html,
        updatedAt: new Date().toISOString(),
      });

      setSaving(false);
    } catch (err) {
      console.error(err);
      setSaving(false);
      setError("Could not save project.");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="text-zinc-400">⚒️ Loading workspace...</div>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="text-red-400">{error || "Project not found."}</div>

        <button
          onClick={() => router.push("/projects")}
          className="mt-5 rounded-xl bg-white px-5 py-3 font-semibold text-black"
        >
          ← Back to Projects
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="flex min-h-16 items-center justify-between border-b border-zinc-800 px-4 sm:px-6">
        <div className="min-w-0">
          <button
            onClick={() => router.push("/projects")}
            className="mb-1 text-xs text-zinc-500 hover:text-white"
          >
            ← Projects
          </button>

          <h1 className="truncate text-lg font-semibold">
            {project.name}
          </h1>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            onClick={saveProject}
            disabled={saving}
            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-900 disabled:opacity-50"
          >
            {saving ? "Saving..." : "💾 Save"}
          </button>

          {project.deploymentUrl && (
            <button
              onClick={() =>
                window.open(
                  project.deploymentUrl,
                  "_blank",
                  "noopener,noreferrer"
                )
              }
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-200"
            >
              🌍 Live
            </button>
          )}
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[360px_1fr]">
        <aside className="border-b border-zinc-800 p-5 lg:border-b-0 lg:border-r">
          <div className="text-sm font-semibold">🤖 AI Workspace</div>

          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Tell ForgeAI what you want to change in this website.
          </p>

          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Make the hero section more modern..."
            className="mt-5 min-h-36 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-600"
          />

          <button
            onClick={improveWebsite}
            disabled={!instruction.trim() || editing}
            className="mt-3 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {editing ? "🤖 Improving..." : "✨ Improve Website"}
          </button>

          {error && (
            <div className="mt-3 rounded-xl border border-red-900/50 bg-red-950/20 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          {editing && (
            <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-400">
              🤖 ForgeAI is updating your website...
            </div>
          )}

          <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="text-xs font-semibold text-zinc-400">
              PROJECT INFO
            </div>

            <div className="mt-3 text-sm text-zinc-300">
              {project.prompt}
            </div>

            {project.deploymentUrl && (
              <div className="mt-4 truncate text-xs text-emerald-400">
                🌍 {project.deploymentUrl}
              </div>
            )}
          </div>
        </aside>

        <section className="min-w-0 bg-zinc-900 p-3 sm:p-5">
          <div className="h-full min-h-[70vh] overflow-hidden rounded-2xl border border-zinc-800 bg-white shadow-2xl">
            <iframe
                key={`${project.id}-${previewKey}`}
                srcDoc={project.html}
                title={`${project.name} preview`}
                sandbox=""
                className="h-full w-full border-0"
              />
          </div>
        </section>
      </div>
    </main>
  );
}
