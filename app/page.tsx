"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import JSZip from "jszip";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function DiaryApp() {
  const [content, setContent] = useState("");
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [imageFile, setImageFile] = useState<File | null>(null);
  
  const [todayDiaries, setTodayDiaries] = useState<any[]>([]);
  const [pastDiaries, setPastDiaries] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [exportStatus, setExportStatus] = useState("");

  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number>(0);
  
  // 画面の横スワイプで日付（selectedDate）を前日・翌日に切り替える
  useEffect(() => {
    let startX = 0;
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input") || target.closest("textarea") || target.closest("button")) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (viewerImageUrl) return;

      const target = e.target as HTMLElement;
      if (target.closest("input") || target.closest("textarea") || target.closest("button")) return;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const diffX = endX - startX;
      const diffY = endY - startY;

      // 横スワイプ判定（横幅が40px以上かつ縦方向の移動より大きい）
      if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
        setSelectedDate((prev) => {
          if (!prev) return prev;
          const [year, month, day] = prev.split("-").map(Number);
          const dateObj = new Date(year, month - 1, day);

          if (diffX > 0) {
            // 右スワイプ（画面を右へ払う）: 前日へ
            dateObj.setDate(dateObj.getDate() - 1);
          } else {
            // 左スワイプ（画面を左へ払う）: 翌日へ
            dateObj.setDate(dateObj.getDate() + 1);
          }

          const y = dateObj.getFullYear();
          const m = String(dateObj.getMonth() + 1).padStart(2, "0");
          const d = String(dateObj.getDate()).padStart(2, "0");
          return `${y}-${m}-${d}`;
        });
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [viewerImageUrl]);

  const handleDownloadImage = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const filename = "diary-photo-" + Date.now() + ".jpg";
      const file = new File([blob], filename, { type: blob.type || "image/jpeg" });

      // iPhoneなどのスマホ向け: 共有シートを呼び出して「画像を保存」を直接選ばせる
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "日記の写真",
        });
        return;
      }

      // PC向け: 通常の自動ダウンロード
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        window.open(url, "_blank");
      }
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [randomDiary, setRandomDiary] = useState<any | null>(null);
  const [isHighlightExpanded, setIsHighlightExpanded] = useState(false);

  // 編集用ステート
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [editingImageFile, setEditingImageFile] = useState<File | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const monthDay = selectedDate.slice(5, 10);

  const fetchDiaries = useCallback(async () => {
    if (!monthDay) return;

    const { data: todayData } = await supabase
      .from("diaries")
      .select("*, diary_images(*)")
      .eq("entry_date", selectedDate)
      .order("created_at", { ascending: false });

    if (todayData) setTodayDiaries(todayData);

    const { data: pastData } = await supabase
      .from("diaries")
      .select("*, diary_images(*)")
      .eq("month_day", monthDay)
      .neq("entry_date", selectedDate)
      .order("entry_date", { ascending: false });

    if (pastData) setPastDiaries(pastData);
  }, [monthDay, selectedDate]);

  const fetchRandomHighlight = useCallback(async () => {
    try {
      const { count, error: countError } = await supabase
        .from("diaries")
        .select("*", { count: "exact", head: true });

      if (!countError && typeof count === "number" && count > 0) {
        const randomIndex = Math.floor(Math.random() * count);
        const { data, error } = await supabase
          .from("diaries")
          .select("*, diary_images(*)")
          .range(randomIndex, randomIndex)
          .limit(1);

        if (!error && data && data.length > 0) {
          setRandomDiary(data[0]);
          setIsHighlightExpanded(false);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchDiaries();
  }, [fetchDiaries]);

  useEffect(() => {
    fetchRandomHighlight();
  }, [fetchRandomHighlight]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);

    try {
      const { data: diary, error: diaryError } = await supabase
        .from("diaries")
        .insert([{ entry_date: selectedDate, month_day: monthDay, content }])
        .select()
        .single();

      if (diaryError) throw diaryError;

      if (imageFile && diary) {
        const filePath = `${diary.id}/${Date.now()}_${imageFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("diary-images")
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("diary-images")
          .getPublicUrl(filePath);

        await supabase.from("diary_images").insert([
          { diary_id: diary.id, image_url: publicUrlData.publicUrl },
        ]);
      }

      setContent("");
      setImageFile(null);
      alert("日記を保存しました！");
      fetchDiaries();
      if (searchQuery) handleSearch();
    } catch (err: any) {
      alert("エラー: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (diary: any) => {
    setEditingId(diary.id);
    setEditingContent(diary.content);
    setEditingImageFile(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingContent("");
    setEditingImageFile(null);
  };

  // 写真の個別削除関数
  const handleDeleteImage = async (imageId: number, imageUrl: string) => {
    if (!window.confirm("この写真を削除しますか？")) return;

    try {
      // 1. データベースから画像レコードを削除
      const { error: dbError } = await supabase
        .from("diary_images")
        .delete()
        .eq("id", imageId);

      if (dbError) throw dbError;

      // 2. Storageからファイル実体を削除
      try {
        const pathPart = imageUrl.split("/diary-images/")[1];
        if (pathPart) {
          const filePath = decodeURIComponent(pathPart.split("?")[0]);
          await supabase.storage.from("diary-images").remove([filePath]);
        }
      } catch (storageErr) {
        console.warn("Storageファイル削除スキップ:", storageErr);
      }

      alert("写真を削除しました。");
      fetchDiaries();
      if (searchQuery) handleSearch();
      if (randomDiary) fetchRandomHighlight();
    } catch (err: any) {
      alert("写真の削除に失敗しました: " + err.message);
    }
  };

  // 編集保存
  const handleSaveEdit = async (id: number) => {
    if (!editingContent.trim()) return;
    setIsUpdating(true);

    try {
      const { error: textError } = await supabase
        .from("diaries")
        .update({ content: editingContent })
        .eq("id", id);

      if (textError) throw textError;

      if (editingImageFile) {
        const filePath = `${id}/${Date.now()}_${editingImageFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("diary-images")
          .upload(filePath, editingImageFile);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("diary-images")
          .getPublicUrl(filePath);

        await supabase.from("diary_images").insert([
          { diary_id: id, image_url: publicUrlData.publicUrl },
        ]);
      }

      alert("日記を更新しました！");
      setEditingId(null);
      setEditingContent("");
      setEditingImageFile(null);
      fetchDiaries();
      if (randomDiary?.id === id) {
        fetchRandomHighlight();
      }
      if (searchQuery) handleSearch();
    } catch (error: any) {
      alert("更新に失敗しました: " + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("この日記を削除してもよろしいですか？")) return;

    const { error } = await supabase.from("diaries").delete().eq("id", id);
    if (error) {
      alert("削除に失敗しました: " + error.message);
    } else {
      alert("削除しました。");
      fetchDiaries();
      if (searchQuery) {
        setSearchResults((prev) => prev.filter((item) => item.id !== id));
      }
      if (randomDiary?.id === id) {
        fetchRandomHighlight();
      }
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const { data, error } = await supabase
      .from("diaries")
      .select("*, diary_images(*)")
      .ilike("content", `%${searchQuery.trim()}%`)
      .order("entry_date", { ascending: false });

    if (!error && data) {
      setSearchResults(data);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setIsSearching(false);
    setSearchResults([]);
  };

  const handleExportFullBackup = async () => {
    setExportStatus("全データ取得中...");
    try {
      const { data: diaries, error } = await supabase
        .from("diaries")
        .select("*, diary_images(*)")
        .order("entry_date", { ascending: true });

      if (error) throw error;
      if (!diaries || diaries.length === 0) {
        alert("エクスポートするデータがありません。");
        setExportStatus("");
        return;
      }

      const zip = new JSZip();
      const imagesFolder = zip.folder("images");

      let csvContent = "date,content,image_urls,local_image_files\n";
      let imageCount = 0;

      for (let i = 0; i < diaries.length; i++) {
        const item = diaries[i];
        const dateStr = item.entry_date;
        const escapedContent = (item.content || "").replace(/"/g, '""');
        
        const imageUrls = (item.diary_images || []).map((img: any) => img.image_url).join(";");
        const localFileNames: string[] = [];

        if (item.diary_images && item.diary_images.length > 0) {
          for (let j = 0; j < item.diary_images.length; j++) {
            const imgUrl = item.diary_images[j].image_url;
            try {
              setExportStatus(`写真ダウンロード中 (${imageCount + 1})...`);
              const response = await fetch(imgUrl);
              const blob = await response.blob();
              
              const fileExt = imgUrl.split(".").pop()?.split("?")[0] || "jpg";
              const fileName = `${dateStr}_${item.id}_${j + 1}.${fileExt}`;
              
              imagesFolder?.file(fileName, blob);
              localFileNames.push(`images/${fileName}`);
              imageCount++;
            } catch (imgErr) {
              console.error("画像取得失敗:", imgUrl, imgErr);
            }
          }
        }

        csvContent += `"${dateStr}","${escapedContent}","${imageUrls}","${localFileNames.join(";")}"\n`;
      }

      const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
      const csvBlob = new Blob([bom, csvContent], { type: "text/csv;charset=utf-8;" });
      zip.file("diaries.csv", csvBlob);

      setExportStatus("ZIPファイル作成中...");
      const zipBlob = await zip.generateAsync({ type: "blob" });

      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `diary_full_backup_${getTodayStr()}.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportStatus("完了！");
      setTimeout(() => setExportStatus(""), 3000);
    } catch (err: any) {
      alert("エクスポート失敗: " + err.message);
      setExportStatus("");
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus("取り込み中...");
    const text = await file.text();
    const rows = text.split("\n").filter((r) => r.trim() !== "");

    const records = [];
    for (const row of rows) {
      const firstComma = row.indexOf(",");
      if (firstComma === -1) continue;

      const dateStr = row.slice(0, firstComma).trim();
      const body = row.slice(firstComma + 1).trim().replace(/^"|"$/g, "");

      if (dateStr.length >= 10 && dateStr.includes("-")) {
        records.push({
          entry_date: dateStr,
          month_day: dateStr.slice(5, 10),
          content: body,
        });
      }
    }

    if (records.length > 0) {
      const { error } = await supabase.from("diaries").insert(records);
      if (error) {
        setImportStatus("エラー: " + error.message);
      } else {
        setImportStatus(`${records.length} 件の過去日記を取り込みました！`);
        fetchDiaries();
        fetchRandomHighlight();
      }
    } else {
      setImportStatus("有効なデータが見つかりませんでした。");
    }
  };

  const renderDiaryCard = (diary: any, isHighlightColor = false) => {
    const isEditing = editingId === diary.id;

    return (
      <div
        key={diary.id}
        style={{
          borderLeft: `4px solid ${isHighlightColor ? "#10b981" : "#3b82f6"}`,
          padding: "12px",
          margin: "12px 0",
          background: "#ffffff",
          borderRadius: "0 8px 8px 0",
          border: "1px solid #e2e8f0",
          borderLeftWidth: "4px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <span style={{ fontWeight: "bold", color: isHighlightColor ? "#059669" : "#2563eb", fontSize: "0.9rem" }}>
            {diary.entry_date}（{new Date(diary.entry_date).getFullYear()}年）
          </span>
          <div style={{ display: "flex", gap: "6px" }}>
            {!isEditing && (
              <button
                onClick={() => handleStartEdit(diary)}
                style={{ background: "#e0f2fe", color: "#0284c7", border: "none", borderRadius: "4px", padding: "3px 8px", fontSize: "0.75rem", cursor: "pointer", fontWeight: "bold" }}
              >
                ✏️ 編集
              </button>
            )}
            <button
              onClick={() => handleDelete(diary.id)}
              style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: "4px", padding: "3px 8px", fontSize: "0.75rem", cursor: "pointer" }}
            >
              削除
            </button>
          </div>
        </div>

        {isEditing ? (
          <div style={{ marginTop: "8px" }}>
            <textarea
  ref={(el) => {
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }}
  value={editingContent}
  onChange={(e) => {
    setEditingContent(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
  }}
  autoFocus
  onFocus={(e) => {
    const val = e.target.value;
    e.target.value = "";
    e.target.value = val;
    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
  }}
  style={{
    width: "100%",
    minHeight: "240px",
    height: "auto",
    overflow: "hidden",
    resize: "none",
    fontSize: "1rem",
    lineHeight: "1.6",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    boxSizing: "border-box"
  }}
/>
            
            <div style={{ margin: "8px 0", background: "#f1f5f9", padding: "8px", borderRadius: "6px" }}>
              <label style={{ display: "block", fontSize: "0.78rem", color: "#475569", fontWeight: "bold", marginBottom: "4px" }}>
                📷 写真・スクショを追加:
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setEditingImageFile(e.target.files?.[0] || null)}
                style={{ fontSize: "0.75rem", width: "100%" }}
              />
            </div>

            <div style={{ display: "flex", gap: "6px", marginTop: "8px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isUpdating}
                style={{ background: "#f1f5f9", color: "#64748b", border: "1px solid #cbd5e1", borderRadius: "4px", padding: "4px 10px", fontSize: "0.8rem", cursor: "pointer" }}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => handleSaveEdit(diary.id)}
                disabled={isUpdating}
                style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 12px", fontSize: "0.8rem", fontWeight: "bold", cursor: "pointer" }}
              >
                {isUpdating ? "保存中..." : "💾 上書き保存"}
              </button>
            </div>
          </div>
        ) : (
              <p
                onClick={() => handleStartEdit(diary)}
                onTouchEnd={() => handleStartEdit(diary)}
                role="button"
                tabIndex={0}
                style={{
                  whiteSpace: "pre-wrap",
                  margin: "4px 0 0",
                  fontSize: "0.88rem",
                  color: "#334155",
                  lineHeight: "1.5",
                  cursor: "pointer",
                  WebkitTapHighlightColor: "rgba(0,0,0,0.1)",
                  padding: "6px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(0, 0, 0, 0.02)"
                }}
              >
            {diary.content}
          </p>
        )}

        {/* 添付画像一覧（写真ごとに削除用の✕ボタンを表示） */}
        {diary.diary_images && diary.diary_images.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", marginTop: "12px", width: "100%" }}>
            {diary.diary_images.map((img: any, imgIdx: number) => (
              <div key={img.id} style={{ position: "relative", width: "100%", aspectRatio: "1 / 1" }}>
                <img
    src={img.image_url}
    alt="添付画像"
    onClick={() => { const urls = diary.diary_images.map((i: any) => i.image_url); setViewerImages(urls); setViewerIndex(imgIdx); setViewerImageUrl(img.image_url); }}
    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "8px", border: "1px solid #cbd5e1" , cursor: "pointer"}}
  />
                <button
                  type="button"
                  onClick={() => handleDeleteImage(img.id, img.image_url)}
                  style={{
                    position: "absolute",
                    top: "-6px",
                    right: "-6px",
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: "#ef4444",
                    color: "#ffffff",
                    border: "2px solid #ffffff",
                    fontSize: "11px",
                    fontWeight: "bold",
                    lineHeight: "1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }}
                  title="この写真を削除"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "12px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        
        <header style={{ padding: "12px 0 16px 0", borderBottom: "2px solid #3b82f6", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: "1.3rem", fontWeight: "bold", margin: 0, color: "#1e3a8a" }}>📖 10年連用日記</h1>
          <span style={{ fontSize: "0.8rem", color: "#64748b", background: "#e2e8f0", padding: "4px 8px", borderRadius: "12px" }}>
            {selectedDate}
          </span>
        </header>

        {randomDiary && (
          <section
            onClick={() => setIsHighlightExpanded(!isHighlightExpanded)}
            style={{
              background: "linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)",
              border: "1px solid #bfdbfe",
              borderRadius: "10px",
              padding: "14px",
              marginBottom: "18px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#1d4ed8", display: "flex", alignItems: "center", gap: "4px" }}>
                🎲 あの日のハイライト
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fetchRandomHighlight();
                }}
                style={{ background: "#dbeafe", border: "none", color: "#1e40af", borderRadius: "6px", padding: "4px 8px", fontSize: "0.75rem", cursor: "pointer", fontWeight: "bold" }}
              >
                🔄 別の日の記録
              </button>
            </div>
            <div style={{ fontWeight: "bold", color: "#334155", fontSize: "0.9rem", marginBottom: "4px" }}>
              📅 {randomDiary.entry_date}
            </div>

            <p
              style={{
                margin: "0",
                fontSize: "0.88rem",
                color: "#475569",
                lineHeight: "1.5",
                whiteSpace: isHighlightExpanded ? "pre-wrap" : "nowrap",
                overflow: isHighlightExpanded ? "visible" : "hidden",
                textOverflow: isHighlightExpanded ? "clip" : "ellipsis",
              }}
            >
              {randomDiary.content}
            </p>

            <div style={{ marginTop: "6px", fontSize: "0.75rem", color: "#2563eb", fontWeight: "bold" }}>
              {isHighlightExpanded ? "▲ 閉じる" : "▼ タップして全文を表示"}
            </div>
          </section>
        )}

        <section style={{ background: "#ffffff", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", marginBottom: "18px", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
          <form onSubmit={handleSearch} style={{ display: "flex", gap: "6px" }}>
            <input
              type="text"
              placeholder="過去の日記を検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.9rem", outline: "none" }}
            />
            <button
              type="submit"
              style={{ padding: "8px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", fontSize: "0.85rem", cursor: "pointer" }}
            >
              検索
            </button>
            {isSearching && (
              <button
                type="button"
                onClick={handleClearSearch}
                style={{ padding: "8px 10px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer" }}
              >
                閉じる
              </button>
            )}
          </form>

          {isSearching && (
            <div style={{ marginTop: "12px" }}>
              <div style={{ fontWeight: "bold", fontSize: "0.85rem", color: "#64748b", marginBottom: "8px" }}>
                検索結果: {searchResults.length} 件
              </div>
              {searchResults.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: 0 }}>見つかりませんでした。</p>
              ) : (
                searchResults.map((d) => renderDiaryCard(d))
              )}
            </div>
          )}
        </section>

        <form onSubmit={handleSubmit} style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0", marginBottom: "20px", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <label style={{ fontWeight: "bold", fontSize: "0.9rem", color: "#334155" }}>日付:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ fontSize: "0.95rem", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", outline: "none", color: "#1e293b", background: "#f8fafc" }}
            />
          </div>

          <textarea
            rows={4}
            placeholder="今日あったこと、気づき、メモ..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{ width: "100%", padding: "10px", boxSizing: "border-box", fontSize: "0.95rem", borderRadius: "6px", border: "1px solid #cbd5e1", color: "#1e293b", background: "#f8fafc", resize: "vertical", outline: "none" }}
          />

          <div style={{ margin: "10px 0" }}>
            <label style={{ display: "block", fontSize: "0.8rem", color: "#64748b", marginBottom: "4px" }}>
              📷 写真を追加:
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              style={{ fontSize: "0.8rem", width: "100%" }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontSize: "1rem", fontWeight: "bold", cursor: "pointer" }}
          >
            {loading ? "保存中..." : "日記を記録する"}
          </button>
        </form>

        {todayDiaries.length > 0 && (
          <section style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "1rem", color: "#059669", borderBottom: "2px solid #a7f3d0", paddingBottom: "6px", marginBottom: "12px" }}>
              📝 選択した日（{selectedDate}）の記録
            </h2>
            {todayDiaries.map((diary) => renderDiaryCard(diary, true))}
          </section>
        )}

        <section style={{ marginBottom: "30px" }}>
          <h2 style={{ fontSize: "1rem", color: "#1e40af", borderBottom: "2px solid #bfdbfe", paddingBottom: "6px", marginBottom: "12px" }}>
            🕰️ 過去の同日（{monthDay}）の記録
          </h2>

          {pastDiaries.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: "0.85rem", padding: "8px 0" }}>過去の同日の記録はありません。</p>
          ) : (
            pastDiaries.map((diary) => renderDiaryCard(diary))
          )}
        </section>

        <details style={{ background: "#ffffff", padding: "12px", borderRadius: "8px", fontSize: "0.85rem", border: "1px solid #e2e8f0" }}>
          <summary style={{ cursor: "pointer", fontWeight: "bold", color: "#475569" }}>⚙️ データ管理 (完全バックアップ / 取り込み)</summary>
          
          <div style={{ marginTop: "12px", paddingBottom: "12px", borderBottom: "1px dashed #e2e8f0" }}>
            <div style={{ fontWeight: "bold", color: "#334155", marginBottom: "4px" }}>📦 完全バックアップ (CSV ＋ 写真全画像ZIP保存)</div>
            <p style={{ margin: "0 0 8px 0", color: "#64748b", fontSize: "0.8rem" }}>
              全日記データ（CSV）と、過去に投稿・添付した写真画像ファイルを丸ごと1つのZIP形式でまとめて保存します。
            </p>
            <button
              type="button"
              onClick={handleExportFullBackup}
              disabled={!!exportStatus}
              style={{ background: "#059669", color: "#fff", border: "none", borderRadius: "6px", padding: "8px 14px", fontWeight: "bold", fontSize: "0.85rem", cursor: "pointer" }}
            >
              {exportStatus || "📦 日記CSV ＋ 写真画像（ZIP一括保存）"}
            </button>
          </div>

          <div style={{ marginTop: "12px" }}>
            <div style={{ fontWeight: "bold", color: "#334155", marginBottom: "4px" }}>📥 過去日記のデータ取り込み (CSV)</div>
            <p style={{ margin: "0 0 6px 0", color: "#94a3b8", fontSize: "0.75rem" }}>
              形式：<code>YYYY-MM-DD,本文</code>
            </p>
            <input type="file" accept=".csv" onChange={handleCsvImport} style={{ fontSize: "0.75rem", width: "100%" }} />
            {importStatus && <p style={{ marginTop: "6px", color: "#2563eb", fontWeight: "bold" }}>{importStatus}</p>}
          </div>
        </details>

      
      {/* 写真の拡大表示モーダル（ピンチズーム・パン移動対応） */}
      {viewerImageUrl && (
        <div
          onClick={() => setViewerImageUrl(null)}
          onTouchStart={(e) => {
            (window as any).touchStartX = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            const startX = (window as any).touchStartX;
            const endX = e.changedTouches[0].clientX;
            if (startX && Math.abs(startX - endX) > 40) {
              if (startX > endX + 40 && viewerIndex < viewerImages.length - 1) {
                const nextIdx = viewerIndex + 1;
                setViewerIndex(nextIdx);
                setViewerImageUrl(viewerImages[nextIdx]);
              } else if (startX < endX - 40 && viewerIndex > 0) {
                const prevIdx = viewerIndex - 1;
                setViewerIndex(prevIdx);
                setViewerImageUrl(viewerImages[prevIdx]);
              }
            }
          }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.95)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px",
            boxSizing: "border-box",
            overflow: "hidden",
            touchAction: "pan-y pinch-zoom"
          }}
        >
          {/* 保存ボタン */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (viewerImageUrl) handleDownloadImage(viewerImageUrl);
            }}
            style={{
              position: "absolute",
              top: "20px",
              right: "70px",
              background: "rgba(255, 255, 255, 0.25)",
              color: "#ffffff",
              border: "none",
              borderRadius: "20px",
              padding: "8px 14px",
              fontSize: "14px",
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              zIndex: 10000
            }}
          >
            ⬇ 保存
          </button>

          {/* 閉じる✕ボタン */}
          <button
            type="button"
            onClick={() => setViewerImageUrl(null)}
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              background: "rgba(255, 255, 255, 0.25)",
              color: "#ffffff",
              border: "none",
              borderRadius: "50%",
              width: "38px",
              height: "38px",
              fontSize: "22px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10000
            }}
          >
            ✕
          </button>

          {/* 前の写真へ (左矢印) */}
          {viewerImages.length > 1 && viewerIndex > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const prevIdx = viewerIndex - 1;
                setViewerIndex(prevIdx);
                setViewerImageUrl(viewerImages[prevIdx]);
              }}
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(255, 255, 255, 0.3)",
                color: "#fff",
                border: "none",
                borderRadius: "50%",
                width: "44px",
                height: "44px",
                fontSize: "24px",
                cursor: "pointer",
                zIndex: 10000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              ❮
            </button>
          )}

          {/* 次の写真へ (右矢印) */}
          {viewerImages.length > 1 && viewerIndex < viewerImages.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const nextIdx = viewerIndex + 1;
                setViewerIndex(nextIdx);
                setViewerImageUrl(viewerImages[nextIdx]);
              }}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(255, 255, 255, 0.3)",
                color: "#fff",
                border: "none",
                borderRadius: "50%",
                width: "44px",
                height: "44px",
                fontSize: "24px",
                cursor: "pointer",
                zIndex: 10000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              ❯
            </button>
          )}

          {/* 枚数カウント表示 */}
          {viewerImages.length > 1 && (
            <div
              style={{
                position: "absolute",
                bottom: "24px",
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(0, 0, 0, 0.6)",
                color: "#ffffff",
                padding: "4px 14px",
                borderRadius: "14px",
                fontSize: "14px",
                zIndex: 10000
              }}
            >
              {viewerIndex + 1} / {viewerImages.length}
            </div>
          )}

          {/* メイン拡大画像 */}
          <img
            src={viewerImageUrl}
            alt="拡大表示"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "100%",
              maxHeight: "85%",
              objectFit: "contain",
              borderRadius: "8px",
              userSelect: "none"
            }}
          />
        </div>
      )}
</div>
    </main>
  );
}