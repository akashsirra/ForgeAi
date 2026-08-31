"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  deleteDoc,
  onSnapshot,
  query,
  where,
  doc,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { useRouter } from "next/navigation";

type Project = {
  id: string;
  name: string;
  prompt: string;
  html: string;
  createdAt: string;
  userId: string;
  deploymentUrl?: string;
};

export default function ProjectsPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setLoading(false);
        router.push("/login");
        return;
      }

      const q = query(
        collection(db, "projects"),
        where("userId", "==", currentUser.uid)
      );

      const unsubscribeProjects = onSnapshot(
        q,
        (snapshot) => {
          const loaded = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as Project[];

          loaded.sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt)
          );

          setProjects(loaded);
          setLoading(false);
        },
        (error) => {
          console.error(error);
          setLoading(false);
        }
      );

      return () => unsubscribeProjects();
    });

    return () => unsubscribeAuth();
  }, [router]);

  async function deleteProject(id: string) {
    const confirmed = window.confirm(
      "Delete this project permanently?"
    );

    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "projects", id));
    } catch (error) {
      console.error(error);
      alert("❌ Could not delete project.");
    }
  }

  function openProject(project: Project) {
    sessionStorage.setItem(
      "forgeai-open-project",
      JSON.stringify(project)
    );

    router.push("/");
  }

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(search.toLowerCase()) ||
    project.prompt.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="text-zinc-400">
          ⚒️ Loading your projects...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-5 py-3">
        <button
          onClick={() => router.push("/")}
          className="text-xl font-bold"
        >
          ⚒️ ForgeAI
        </button>

        <div className="flex items-center gap-2">
          <span className="hidden max-w-48 truncate text-xs text-zinc-500 sm:block">
            {user?.email}
          </span>

          <button
            onClick={() => router.push("/")}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black"
          >
            ✨ New Website
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            📁 My Projects
          </h1>

          <p className="mt-2 text-zinc-500">
            Your AI-generated websites, saved securely in the cloud.
          </p>
        </div>

        <div className="mb-6">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search your projects..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
          />
        </div>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center">
            <div className="text-5xl">🪄</div>

            <h2 className="mt-4 text-xl font-semibold">
              No projects yet
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              Build your first website with ForgeAI.
            </p>

            <button
              onClick={() => router.push("/")}
              className="mt-5 rounded-xl bg-white px-5 py-3 font-semibold text-black"
            >
              ✨ Build Website
            </button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="py-12 text-center text-zinc-500">
            No projects match your search.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-600"
              >
                <div className="mb-4 flex h-32 items-center justify-center overflow-hidden rounded-xl bg-zinc-950">
                  <div className="text-center">
                    <div className="text-4xl">🌐</div>
                    <div className="mt-2 text-xs text-zinc-600">
                      Website Preview
                    </div>
                  </div>
                </div>

                <h2 className="truncate font-semibold">
                  {project.name}
                </h2>

                <p className="mt-2 line-clamp-2 text-sm text-zinc-500">
                  {project.prompt}
                </p>

                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-zinc-600">
                    {new Date(project.createdAt).toLocaleString()}
                  </span>

                  {project.deploymentUrl && (
                    <span className="text-emerald-400">● Live</span>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => openProject(project)}
                    className="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black"
                  >
                    ✏️ Edit
                  </button>

                  {project.deploymentUrl && (
                    <button
                      onClick={() => window.open(project.deploymentUrl, "_blank")}
                      className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800"
                    >
                      🌐
                    </button>
                  )}

                  <button
                    onClick={() => deleteProject(project.id)}
                    className="rounded-lg border border-red-900 px-3 py-2 text-sm text-red-400 hover:bg-red-950/30"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
