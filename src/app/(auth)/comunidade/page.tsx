"use client";
import { getLocale } from "@/lib/language";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Plus, X, Send, User, Flag, Trash2, Edit3, Users, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { photoUrl, compressImage, uploadToCloud } from "@/lib/photo-storage";
import { Button } from "@/components/ui/button";

interface Post {
  id: string; user_id: string; display_name: string; display_emoji: string | null;
  category: string; content: string; photo: string | null;
  created_at: string; comment_count: number; like_count: number; liked_by_me: boolean;
}
interface Comment { id: string; user_id: string; display_name: string; display_emoji: string | null; content: string; created_at: string; }

const CATEGORIES = [
  { key: "vitoria", label: "🏆 Vitória", desc: "Algo que conseguiu fazer" },
  { key: "dica", label: "💡 Dica", desc: "Algo que funcionou pra você" },
  { key: "reflexao", label: "🤔 Reflexão", desc: "Um pensamento ou percepção" },
  { key: "gratidao", label: "🙏 Gratidão", desc: "Algo pelo qual é grato" },
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

const modalInputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12,
  border: "1px solid rgba(167,139,250,0.2)", background: "#0B0B10", color: "#e0d6ff",
  fontSize: 14, fontFamily: "inherit", outline: "none",
};

export default function ComunidadePage() {
  // Comunidade oculta temporariamente — remover redirect ao reativar
  const router = useRouter();
  useEffect(() => { router.push("/dashboard"); }, [router]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("reflexao");
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [inspireOpen, setInspireOpen] = useState(false);
  const [inspireData, setInspireData] = useState<{ message: string; posts: any[] } | null>(null);
  const [inspireLoading, setInspireLoading] = useState(false);
  const [myUserId, setMyUserId] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showLikes, setShowLikes] = useState<string | null>(null);
  const [likedUsers, setLikedUsers] = useState<{ user_id: string; display_name: string }[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [profileName, setProfileName] = useState("");
  const [profileEmoji, setProfileEmoji] = useState("");

  // Load profile and user ID
  useEffect(() => {
    fetch("/api/profile").then(r => r.json()).then(d => {
      if (d.id) setMyUserId(d.id);
    }).catch(() => {});
    fetch("/api/preferences").then(r => r.json()).then(d => {
      const ctx = d?.context || {};
      setProfileName(ctx.community_name || "");
      setProfileEmoji(ctx.community_emoji || "");
    }).catch(() => {});
  }, []);

  const saveProfile = async () => {
    await fetch("/api/community/profile", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: profileName || "Anônimo", display_emoji: profileEmoji || null }),
    });
    setShowProfile(false);
    // Update local posts too
    setPosts(prev => prev.map(p => p.user_id === myUserId ? { ...p, display_name: profileName || "Anônimo", display_emoji: profileEmoji || null } : p));
    toast.success("Perfil atualizado!");
  };

  const deletePost = async (postId: string) => {
    if (!confirm("Excluir esta publicação?")) return;
    await fetch(`/api/community/posts/${postId}`, { method: "DELETE" });
    setPosts(prev => prev.filter(p => p.id !== postId));
    toast.success("Publicação excluída");
  };

  const deleteComment = async (commentId: string) => {
    // Simple inline delete via a direct fetch
    await fetch(`/api/community/comments/${commentId}`, { method: "DELETE" });
    setComments(prev => prev.filter(c => c.id !== commentId));
    if (expandedComments) {
      setPosts(prev => prev.map(p => p.id === expandedComments ? { ...p, comment_count: p.comment_count - 1 } : p));
    }
  };

  const reportPost = async (postId: string) => {
    await fetch("/api/community/report", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: postId }),
    });
    toast.success("Denúncia enviada. Obrigado.");
  };

  const handleInspire = async () => {
    setInspireLoading(true); setInspireOpen(true);
    try {
      const res = await fetch("/api/community/inspire");
      if (res.ok) { setInspireData(await res.json()); }
      else { toast.error("Tente de novo"); setInspireOpen(false); }
    } catch { toast.error("Erro ao buscar"); setInspireOpen(false); }
    setInspireLoading(false);
  };

  const startEdit = (post: Post) => { setEditingPost(post.id); setEditContent(post.content); };
  const saveEdit = async (postId: string) => {
    await fetch(`/api/community/posts/${postId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: editContent }) });
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, content: editContent } : p));
    setEditingPost(null);
  };

  const viewLikes = async (postId: string) => {
    setShowLikes(postId);
    const res = await fetch(`/api/community/posts/${postId}`);
    if (res.ok) { const d = await res.json(); setLikedUsers(d.likes || []); }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const lastPost = posts[posts.length - 1];
    const res = await fetch(`/api/community/posts?limit=20&before=${lastPost?.created_at}`);
    if (res.ok) {
      const newPosts = await res.json();
      if (newPosts.length < 20) setHasMore(false);
      setPosts(prev => [...prev, ...newPosts]);
    }
    setLoadingMore(false);
  };

  // Infinite scroll — observe sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting && hasMore && !loadingMore) loadMore(); }, { rootMargin: "400px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadingMore]);

  const fetchPosts = async () => {
    try {
      const res = await fetch("/api/community/posts?limit=30");
      if (res.ok) setPosts(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  const handleCreate = async () => {
    if (!newContent.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/community/posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent.trim(), category: newCategory, photo: newPhoto }),
      });
      if (res.ok) {
        toast.success("Publicado!");
        setShowCreate(false); setNewContent(""); setNewPhoto(null);
        fetchPosts();
      } else { toast.error("Erro ao publicar"); }
    } catch { toast.error("Erro ao publicar"); }
    setSaving(false);
  };

  const handleLike = async (postId: string) => {
    const res = await fetch(`/api/community/posts/${postId}`, { method: "PATCH" });
    if (res.ok) {
      const { liked } = await res.json();
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, liked_by_me: liked, like_count: p.like_count + (liked ? 1 : -1) } : p));
    }
  };

  const loadComments = async (postId: string) => {
    if (expandedComments === postId) { setExpandedComments(null); return; }
    setExpandedComments(postId);
    try {
      const res = await fetch(`/api/community/posts/${postId}/comments`);
      if (res.ok) setComments(await res.json());
    } catch { setComments([]); }
  };

  const addComment = async (postId: string) => {
    if (!commentText.trim()) return;
    const res = await fetch(`/api/community/posts/${postId}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: commentText.trim() }),
    });
    if (res.ok) {
      const c = await res.json();
      setComments(prev => [...prev, c]);
      setCommentText("");
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p));
    }
  };

  const handlePhotoUpload = async (file: File) => {
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const path = await uploadToCloud(compressed, "diary");
      setNewPhoto(path);
    } catch { toast.error("Erro ao processar imagem"); }
    setUploading(false);
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#0B0B10", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: "22px 20px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#e0d6ff" }}>Comunidade</h1>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#9e96b5" }}>O que te fez bem hoje?</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => setShowProfile(!showProfile)}
            style={{ width: 44, height: 44, borderRadius: "50%", background: "#1a1530", border: "1px solid rgba(167,139,250,0.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#A78BFA", fontSize: 18 }}>
            {profileEmoji || <User size={20} style={{ color: "#A78BFA" }} />}
          </button>
          <button type="button" onClick={() => setShowCreate(!showCreate)}
            style={{ width: 44, height: 44, borderRadius: "50%", background: "#7C5CFF", border: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(124,92,255,0.4)" }}>
            {showCreate ? <X size={20} color="#fff" /> : <Plus size={22} color="#fff" />}
          </button>
        </div>
      </div>

      {/* Profile editor */}
      {showProfile && (
        <div style={{ padding: "8px 20px 0" }}>
          <div style={{ background: "#1a1530", borderRadius: 14, padding: 14, border: "1px solid rgba(167,139,250,0.15)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input value={profileEmoji} onChange={e => setProfileEmoji(e.target.value)} maxLength={4}
              placeholder="😊" style={{ width: 48, padding: "8px 4px", borderRadius: 10, border: "1px solid rgba(167,139,250,0.2)", background: "#0B0B10", color: "#e0d6ff", fontSize: 20, textAlign: "center", fontFamily: "inherit", outline: "none" }} />
            <input value={profileName} onChange={e => setProfileName(e.target.value)} maxLength={20}
              placeholder="Seu nome público" style={{ flex: 1, minWidth: 120, padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(167,139,250,0.2)", background: "#0B0B10", color: "#e0d6ff", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
            <button type="button" onClick={saveProfile}
              style={{ padding: "8px 14px", borderRadius: 10, background: "#7C5CFF", border: 0, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
              Salvar
            </button>
          </div>
        </div>
      )}

      {/* Create post form */}
      {showCreate && (
        <div style={{ padding: "12px 20px" }}>
          <div style={{ background: "#1a1530", borderRadius: 18, padding: 16, border: "1px solid rgba(167,139,250,0.15)" }}>
            {/* Category selector */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {CATEGORIES.map(c => (
                <button key={c.key} type="button" onClick={() => setNewCategory(c.key)}
                  style={{ padding: "5px 10px", borderRadius: 9999, border: newCategory === c.key ? "1.5px solid #7C5CFF" : "1px solid rgba(167,139,250,0.15)", background: newCategory === c.key ? "rgba(124,92,255,0.1)" : "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, color: newCategory === c.key ? "#A78BFA" : "#9e96b5", whiteSpace: "nowrap" }}>
                  {c.label}
                </button>
              ))}
            </div>
            <textarea value={newContent} onChange={e => setNewContent(e.target.value)}
              placeholder={CATEGORIES.find(c => c.key === newCategory)?.desc || "Compartilhe algo..."}
              rows={3} autoFocus style={{ ...modalInputStyle, resize: "none", marginBottom: 10 }} />
            {newPhoto && (
              <div style={{ position: "relative", display: "inline-block", marginBottom: 8 }}>
                <img src={photoUrl(newPhoto)!} alt="" style={{ maxWidth: 200, maxHeight: 160, borderRadius: 10 }} />
                <button type="button" onClick={() => setNewPhoto(null)}
                  style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: 0, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={12} />
                </button>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ cursor: "pointer", color: "#A78BFA", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                📷 {uploading ? "Enviando..." : "Foto"}
                <input type="file" accept="image/*" style={{ display: "none" }}
                  onChange={e => { if (e.target.files?.[0]) handlePhotoUpload(e.target.files[0]); e.target.value = ""; }} />
              </label>
              <div style={{ flex: 1 }} />
              <Button onClick={handleCreate} disabled={saving || !newContent.trim()}
                style={{ height: 36, paddingInline: 16, borderRadius: 10, background: (saving || !newContent.trim()) ? "#1e1840" : "#7C5CFF", border: 0, color: "#fff", fontSize: 13, fontWeight: 600 }}>
                {saving ? "Publicando..." : "Publicar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Maya inspire button */}
      <div style={{ padding: "0 20px 12px" }}>
        <button type="button" onClick={handleInspire} disabled={inspireLoading}
          style={{ width: "100%", padding: "14px 16px", borderRadius: 16, border: "1px solid rgba(167,139,250,0.2)", background: "linear-gradient(135deg, rgba(124,92,255,0.12) 0%, rgba(167,139,250,0.06) 100%)", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit", opacity: inspireLoading ? 0.6 : 1 }}>
          <span style={{ fontSize: 22 }}>✨</span>
          <span style={{ flex: 1, textAlign: "left", fontSize: 13, fontWeight: 600, color: "#A78BFA" }}>
            {inspireLoading ? "Buscando inspirações..." : "Maya, me inspira"}
          </span>
          <Sparkles size={16} style={{ color: "#A78BFA" }} />
        </button>
      </div>

      {/* Inspire result modal */}
      {inspireOpen && inspireData && (
        <div onClick={() => setInspireOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, maxHeight: "80dvh", overflowY: "auto", background: "#1a1530", borderRadius: 24, padding: 24, border: "1px solid rgba(167,139,250,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 28 }}>✨</span>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#e0d6ff" }}>Maya</h3>
              </div>
              <button type="button" onClick={() => setInspireOpen(false)} style={{ background: "none", border: 0, color: "#9e96b5", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#e0d6ff", lineHeight: 1.6 }}>{inspireData.message}</p>
            {inspireData.posts.map((p: any) => {
              const catCfg = CATEGORIES.find((c: any) => c.key === p.category);
              return (
                <div key={p.id} onClick={() => { setInspireOpen(false); router.push(`/comunidade/perfil/${p.id}`); }}
                  style={{ background: "rgba(124,92,255,0.06)", borderRadius: 14, padding: 14, marginBottom: 8, border: "1px solid rgba(167,139,250,0.1)", cursor: "default" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 14 }}>{p.display_emoji || "💬"}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#A78BFA" }}>{p.display_name}</span>
                    <span style={{ fontSize: 10, color: "#9e96b5" }}>{catCfg?.label || ""}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "#e0d6ff", lineHeight: 1.5 }}>{p.content}</p>
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Heart size={12} style={{ color: "#FF4D4D" }} />
                      <span style={{ fontSize: 10, color: "#9e96b5" }}>{p.like_count || 0}</span>
                    </div>
                    <button type="button" onClick={async (e) => { e.stopPropagation();
                      await fetch("/api/community/inspire", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ post_id: p.id, helpful: true }) });
                      toast.success("Obrigado pelo feedback!");
                    }} style={{ background: "none", border: 0, cursor: "pointer", fontSize: 14, padding: 0 }} title="Ajudou">👍</button>
                    <button type="button" onClick={async (e) => { e.stopPropagation();
                      await fetch("/api/community/inspire", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ post_id: p.id, helpful: false }) });
                      toast.success("Obrigado pelo feedback!");
                    }} style={{ background: "none", border: 0, cursor: "pointer", fontSize: 14, padding: 0, opacity: 0.4 }} title="Não ajudou">👎</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Feed */}
      <div style={{ padding: "12px 20px" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "#9e96b5", padding: 40 }}>Carregando...</p>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <span style={{ fontSize: 48 }}>🌱</span>
            <p style={{ color: "#9e96b5", fontSize: 15, marginTop: 12 }}>Nenhuma publicação ainda.</p>
            <p style={{ color: "#9e96b5", fontSize: 13 }}>Seja o primeiro a compartilhar algo bom!</p>
          </div>
        ) : (
          posts.map(post => {
            const catCfg = CATEGORIES.find(c => c.key === post.category);
            return (
              <div key={post.id} style={{ background: "#1a1530", borderRadius: 16, padding: 16, marginBottom: 10, border: "1px solid rgba(167,139,250,0.1)" }}>
                {/* Author + time */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(124,92,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                    {post.display_emoji || <User size={18} style={{ color: "#A78BFA" }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span onClick={(e) => { e.stopPropagation(); router.push(`/comunidade/perfil/${post.user_id}`); }}
                      style={{ fontSize: 13, fontWeight: 700, color: "#A78BFA", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
                      {post.display_name}
                    </span>
                    <span style={{ fontSize: 10, color: "#9e96b5", marginLeft: 8 }}>{catCfg?.label || "💬"}</span>
                  </div>
                  <span style={{ fontSize: 10, color: "#5a5470" }}>{timeAgo(post.created_at)}</span>
                </div>
                {/* Content */}
                <p style={{ margin: "0 0 8px", fontSize: 14, color: "#e0d6ff", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{post.content}</p>
                {/* Photo */}
                {post.photo && (
                  <img src={photoUrl(post.photo)!} alt="" style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 12, marginBottom: 8, objectFit: "cover" }} />
                )}
                {/* Actions */}
                <div style={{ display: "flex", gap: 16, alignItems: "center", borderTop: "1px solid rgba(167,139,250,0.06)", paddingTop: 8 }}>
                  <button type="button" onClick={() => handleLike(post.id)}
                    style={{ background: "none", border: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: post.liked_by_me ? "#FF4D4D" : "#9e96b5", fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: 0 }}>
                    <Heart size={15} fill={post.liked_by_me ? "#FF4D4D" : "none"} /> {post.like_count || 0}
                  </button>
                  <button type="button" onClick={() => loadComments(post.id)}
                    style={{ background: "none", border: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#9e96b5", fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: 0 }}>
                    <MessageCircle size={15} /> {post.comment_count || 0}
                  </button>
                  <button type="button" onClick={() => viewLikes(post.id)}
                    style={{ background: "none", border: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#9e96b5", fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: 0 }}>
                    <Users size={14} />
                  </button>
                  {post.user_id === myUserId && (<>
                    <button type="button" onClick={() => startEdit(post)}
                      style={{ background: "none", border: 0, cursor: "pointer", color: "#5a5470", padding: 0 }}>
                      <Edit3 size={12} />
                    </button>
                    <button type="button" onClick={() => deletePost(post.id)}
                      style={{ background: "none", border: 0, cursor: "pointer", color: "#5a5470", padding: 0 }}>
                      <Trash2 size={12} />
                    </button>
                  </>)}
                  <button type="button" onClick={() => { if (confirm("Denunciar esta publicação?")) reportPost(post.id); }}
                    style={{ background: "none", border: 0, cursor: "pointer", color: "#5a5470", marginLeft: "auto", padding: 0 }}>
                    <Flag size={12} />
                  </button>
                </div>
                {/* Edit mode */}
                {editingPost === post.id && (
                  <div style={{ marginTop: 8 }}>
                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                      rows={3} style={{ ...modalInputStyle, marginBottom: 8 }} autoFocus />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={() => setEditingPost(null)}
                        style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(167,139,250,0.2)", background: "transparent", color: "#9e96b5", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
                      <button type="button" onClick={() => saveEdit(post.id)}
                        style={{ padding: "6px 12px", borderRadius: 8, border: 0, background: "#7C5CFF", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Salvar</button>
                    </div>
                  </div>
                )}

                {/* Comments */}
                {expandedComments === post.id && (
                  <div style={{ borderTop: "1px solid rgba(167,139,250,0.08)", marginTop: 8, paddingTop: 8 }}>
                    {comments.map(c => (
                      <div key={c.id} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>{c.display_emoji || "💬"}</span>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#A78BFA" }}>{c.display_name}</span>
                          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#e0d6ff", lineHeight: 1.4 }}>{c.content}</p>
                        </div>
                        {c.user_id === myUserId && (
                          <button type="button" onClick={() => deleteComment(c.id)}
                            style={{ background: "none", border: 0, cursor: "pointer", color: "#5a5470", padding: 0, flexShrink: 0 }}>
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <input value={commentText} onChange={e => setCommentText(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") addComment(post.id); }}
                        placeholder="Escreva um comentário..." style={{ ...modalInputStyle, padding: "8px 12px", fontSize: 12, flex: 1 }} />
                      <button type="button" onClick={() => addComment(post.id)}
                        style={{ width: 36, height: 36, borderRadius: "50%", background: "#7C5CFF", border: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Send size={14} color="#fff" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
        {/* Likes modal */}
        {showLikes && (
          <div onClick={() => setShowLikes(null)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 300, background: "#1a1530", borderRadius: 20, padding: 20, border: "1px solid rgba(167,139,250,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#e0d6ff" }}>❤️ Curtidas</h3>
                <button type="button" onClick={() => setShowLikes(null)} style={{ background: "none", border: 0, color: "#9e96b5", fontSize: 18, cursor: "pointer" }}>✕</button>
              </div>
              {likedUsers.length === 0 ? (
                <p style={{ color: "#9e96b5", fontSize: 13, textAlign: "center" }}>Nenhuma curtida ainda</p>
              ) : likedUsers.map(u => (
                <div key={u.user_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid rgba(167,139,250,0.05)" }}>
                  <span style={{ fontSize: 16 }}>💬</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#e0d6ff" }}>{u.display_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} style={{ height: 1 }} />
        {loadingMore && (
          <p style={{ textAlign: "center", color: "#9e96b5", fontSize: 11, padding: 12 }}>Carregando...</p>
        )}
      </div>
    </div>
  );
}
