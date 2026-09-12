"use client";
import { getLocale } from "@/lib/language";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Heart, MessageCircle } from "lucide-react";
import { photoUrl } from "@/lib/photo-storage";

interface Post {
  id: string; display_name: string; display_emoji: string | null;
  category: string; content: string; photo: string | null;
  created_at: string; comment_count: number; like_count: number;
}

const CATEGORIES = [
  { key: "vitoria", label: "🏆 Vitória" },
  { key: "dica", label: "💡 Dica" },
  { key: "reflexao", label: "🤔 Reflexão" },
  { key: "gratidao", label: "🙏 Gratidão" },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString(getLocale(), { day: "numeric", month: "short" });
}

export default function CommunityProfilePage() {
  // Comunidade oculta temporariamente — remover redirect ao reativar
  const router = useRouter();
  useEffect(() => { router.push("/dashboard"); }, [router]);
  const { userId } = useParams<{ userId: string }>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("");
  const [profileEmoji, setProfileEmoji] = useState("");

  useEffect(() => {
    // Fetch posts for this user via the main feed and filter
    fetch("/api/community/posts?limit=50")
      .then(r => r.json())
      .then((data: Post[]) => {
        if (Array.isArray(data)) {
          const userPosts = data.filter(p => {
            // Posts by this user (we need to match by display info since we don't expose user_id)
            return true; // We'll filter differently
          });
          // Actually, let's fetch the user's profile first
        }
      }).catch(() => {});

    // Fetch user profile to get display name/emoji
    fetch(`/api/community/user/${userId}`)
      .then(r => r.json())
      .then(d => {
        if (d.display_name) setProfileName(d.display_name);
        if (d.display_emoji) setProfileEmoji(d.display_emoji);
        if (Array.isArray(d.posts)) setPosts(d.posts);
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [userId]);

  return (
    <div style={{ minHeight: "100dvh", background: "#0B0B10", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: "22px 20px 4px", display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: "50%", background: "#1a1530", border: "1px solid rgba(167,139,250,0.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#A78BFA" }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(124,92,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
            {profileEmoji || "💬"}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#e0d6ff" }}>{profileName || "Usuário"}</h1>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9e96b5" }}>{posts.length} {posts.length === 1 ? "publicação" : "publicações"}</p>
          </div>
        </div>
      </div>

      {/* Posts */}
      <div style={{ padding: "16px 20px" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "#9e96b5", padding: 40 }}>Carregando...</p>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <span style={{ fontSize: 40 }}>🌱</span>
            <p style={{ color: "#9e96b5", fontSize: 14, marginTop: 8 }}>Nenhuma publicação ainda</p>
          </div>
        ) : posts.map(post => {
          const catCfg = CATEGORIES.find(c => c.key === post.category);
          return (
            <div key={post.id} style={{ background: "#1a1530", borderRadius: 16, padding: 16, marginBottom: 10, border: "1px solid rgba(167,139,250,0.1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: "#9e96b5" }}>{catCfg?.label || "💬"}</span>
                <span style={{ fontSize: 10, color: "#5a5470" }}>{timeAgo(post.created_at)}</span>
              </div>
              <p style={{ margin: "0 0 8px", fontSize: 14, color: "#e0d6ff", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{post.content}</p>
              {post.photo && (
                <img src={photoUrl(post.photo)!} alt="" style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 12, marginBottom: 8, objectFit: "cover" }} />
              )}
              <div style={{ display: "flex", gap: 16, borderTop: "1px solid rgba(167,139,250,0.06)", paddingTop: 8 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#9e96b5", fontSize: 12 }}>
                  <Heart size={14} /> {post.like_count || 0}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#9e96b5", fontSize: 12 }}>
                  <MessageCircle size={14} /> {post.comment_count || 0}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
