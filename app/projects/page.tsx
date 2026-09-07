"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, deleteDoc, onSnapshot, query, where, doc } from "firebase/firestore";
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
  const [plan, setPlan] = useState<"free" | "pro">("free");

  useEffect(() => {
    let unsubscribeProjects: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      unsubscribeProjects?.();
      unsubscribeProjects = null;
      setUser(currentUser);

      if (!currentUser) {
        setLoading(false);
        router.push("/login");
        return;
      }

      void (async () => {
        try {
          const token = await currentUser.getIdToken();
          const billingResponse = await fetch("/api/billing", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (billingResponse.ok) {
            const billing = await billingResponse.json();
            setPlan(billing.plan === "pro" ? "pro" : "free");
          }
        } catch {
          setPlan("free");
        }
      })();

      const q = query(collection(db, "projects"), where("userId", "==", currentUser.uid));
      unsubscribeProjects = onSnapshot(
        q,
        (snapshot) => {
          const loaded = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Project[];
          loaded.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          setProjects(loaded);
          setLoading(false);
        },
        (error) => {
          console.error(error);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeProjects?.();
      unsubscribeAuth();
    };
  }, [router]);

  async function deleteProject(id: string) {
    if (!window.confirm("Delete this project permanently?")) return;
    try {
      await deleteDoc(doc(db, "projects", id));
    } catch (error) {
      console.error(error);
      alert("❌ Could not delete project.");
    }
  }

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(search.toLowerCase()) ||
    project.prompt.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="text-zinc-400">⚒️ Loading your projects...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-zinc-950/90 px-5 py-3 backdrop-blur-xl">
        <button onClick={() => router.push("/")} className="text-xl font-bold">⚒️ ForgeAI</button>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push("/pricing")} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${plan === "pro" ? "border-white/20 bg-white text-black" : "border-amber-400/30 bg-amber-400/10 text-amber-300"}`}>
            {plan === "pro" ? "⚡ Pro" : "Free · Upgrade"}
          </button>
          <span className="hidden max-w-48 truncate text-xs text-zinc-500 sm:block">{user?.email}</span>
          <button onClick={() => router.push("/")} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black">✨ New Website</button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-bold">📁 My Projects</h1>
            <p className="mt-2 text-zinc-500">Your AI-generated websites, saved securely in the cloud.</p>
          </div>
          {plan === "free" && (
            <button onClick={() => router.push("/pricing")} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10">
              <div className="text-xs font-semibold text-amber-300">SHIP MORE</div>
              <div className="mt-1 text-sm font-semibold">Upgrade to Pro →</div>
            </button>
          )}
        </div>

        <div className="mb-6">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Search your projects..." className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4 outline-none placeholder:text-zinc-600 focus:border-zinc-600" />
        </div>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center">
            <div className="text-5xl">🪄</div>
            <h2 className="mt-4 text-xl font-semibold">No projects yet</h2>
            <p className="mt-2 text-sm text-zinc-500">Build your first website with ForgeAI.</p>
            <button onClick={() => router.push("/")} className="mt-5 rounded-xl bg-white px-5 py-3 font-semibold text-black">✨ Build Website</button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="py-12 text-center text-zinc-500">No projects match your search.</div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <div key={project.id} className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-lg transition duration-300 hover:-translate-y-1 hover:border-zinc-600 hover:shadow-2xl">
                <div className="relative h-44 overflow-hidden border-b border-zinc-800 bg-white">
                  <iframe srcDoc={project.html} title={`${project.name} preview`} sandbox="" className="pointer-events-none h-[700px] w-[1100px] origin-top-left scale-[0.4]" />
                  {project.deploymentUrl && <div className="absolute right-3 top-3 rounded-full border border-emerald-500/30 bg-zinc-950/90 px-3 py-1 text-xs font-semibold text-emerald-400 shadow-lg">🌍 LIVE</div>}
                </div>
                <div className="p-5">
                  <h2 className="truncate text-lg font-semibold text-white">{project.name}</h2>
                  <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-zinc-500">{project.prompt}</p>
                  <div className="mt-4 text-xs text-zinc-600">Created {new Date(project.createdAt).toLocaleString()}</div>
                  <div className="mt-5 flex gap-2">
                    <button onClick={() => router.push(`/projects/${project.id}`)} className="flex-1 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200">✏️ Edit</button>
                    {project.deploymentUrl && <button onClick={() => window.open(project.deploymentUrl, "_blank", "noopener,noreferrer")} className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm transition hover:bg-zinc-800" title="Open live website">🌐</button>}
                    <button onClick={() => deleteProject(project.id)} className="rounded-xl border border-red-900/60 px-4 py-2.5 text-sm text-red-400 transition hover:bg-red-950/40" title="Delete project">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
