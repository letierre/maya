const DB_NAME = "maya_photos";
const DB_VERSION = 1;
const STORE_NAME = "photos";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB não disponível"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Salva uma foto (base64) no IndexedDB, retorna a chave
export async function savePhoto(base64: string): Promise<string> {
  const key = `foto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(base64, key);
    tx.oncomplete = () => resolve(key);
    tx.onerror = () => reject(tx.error);
    db.close();
  });
}

// Recupera uma foto pelo caminho/chave
export async function getPhoto(path: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(path);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
      db.close();
    });
  } catch {
    return null;
  }
}

// Remove uma foto
export async function removePhoto(path: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(path);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      db.close();
    });
  } catch {
    // silent
  }
}

// Comprime imagem redimensionando para max 512px (menor lado) e qualidade 0.6
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 512;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.onerror = () => reject(new Error("Falha ao carregar imagem"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

// Gera hash de uma string base64 para cache
export function photoHash(base64: string): string {
  let hash = 0;
  // Usa só primeiros 5000 caracteres para performance
  const sample = base64.slice(0, 5000);
  for (let i = 0; i < sample.length; i++) {
    const char = sample.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/** Upload a base64 image to Supabase Storage. Returns the cloud path. */
export async function uploadToCloud(base64: string, folder: "meals" | "diary" | "avatars"): Promise<string> {
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, folder }),
  });

  if (!res.ok) {
    throw new Error("Falha ao enviar foto");
  }

  const data = await res.json();
  return data.path as string;
}

/** Build the URL to load a photo. Cloud paths (with /) use /api/media, local keys use IndexedDB. */
export function photoUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.includes("/")) return `/api/media?path=${encodeURIComponent(path)}`;
  return null; // Local IndexedDB key — caller must use getPhoto()
}

/** True if the path is a cloud storage path (not an IndexedDB key). */
export function isCloudPath(path: string | null): boolean {
  return !!path && path.includes("/");
}
