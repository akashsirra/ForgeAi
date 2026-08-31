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
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
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

        setProject({
          id: snap.id,
          ...data,
        } as Project);
      } catch (err) {
        console.error(err);
        setError("Could not load project.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [params.id, router]);

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
            onClick={() => {
              setInstruction("");
              alert("🚀 AI editing is the next ForgeAI upgrade!");
            }}
            disabled={!instruction.trim()}
            className="mt-3 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ✨ Improve Website
          </button>

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
              srcDoc={project.html}
              title={`${project.name} live preview`}
              sandbox=""
              className="h-full min-h-[70vh] w-full border-0"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
