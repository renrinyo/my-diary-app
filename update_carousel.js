const fs = require("fs");
const file = "app/page.tsx";
let code = fs.readFileSync(file, "utf8");

// 1. viewerImages, viewerIndex の状態変数を追加
if (!code.includes("viewerImages")) {
  code = code.replace(
    /const \[viewerImageUrl, setViewerImageUrl\] = useState<string \| null>\(null\);/,
    `const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number>(0);`
  );
}

// 2. 写真タップ時に画像一覧とインデックスをセットするように置換
// diary_images.map の引数を (img: any, imgIdx: number) に調整
code = code.replace(/diary\.diary_images\.map\(\(img: any\)/g, "diary.diary_images.map((img: any, imgIdx: number)");
code = code.replace(/diary\.diary_images\.map\(\(img: any, index: number\)/g, "diary.diary_images.map((img: any, imgIdx: number)");  // img の onClick を置換 code = code.replace(   /<img([\s\S]*?)onClick=\{\(\) => setViewerImageUrl\(img\.image_url\)\}([\s\S]*?)\/>/g,
  `<img$1onClick={() => {
    const urls = diary.diary_images.map((i: any) => i.image_url);
    setViewerImages(urls);
    setViewerIndex(imgIdx);
    setViewerImageUrl(img.image_url);
  }}$2/>`
);

// 3. モーダル表示部分をカルーセル対応に置換
const modalTemplate = `{viewerImageUrl && (
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

          {/* ページネーション枚数表示 */}
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

          {/* メイン表示画像 */}
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
      )}`;

// 既存モーダルを置換
code = code.replace(/\{viewerImageUrl && \([\s\S]*?<\/div>\s*\)\}/, modalTemplate);

fs.writeFileSync(file, code, "utf8");
console.log("カルーセル・スワイプ設定の更新が完了しました！");
