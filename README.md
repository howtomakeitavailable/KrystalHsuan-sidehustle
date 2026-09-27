# Krystal 書頁工作室：接案 Dashboard

書籍排版・校對・翻譯的接案網站。前台（案主看的）和後台（你管理的）在同一個專案裡，一起部署到 Cloudflare，免費方案就夠用。

| 頁面 | 網址 | 內容 |
| --- | --- | --- |
| 收費與規則 | `/#rules` | 服務介紹、關於我、價目表、急件／折扣／訂金、合作流程、條款 |
| 作品集 | `/#portfolio` | **文件檢視**（仿 Word：尺規、縮放、修訂標示、字數統計）與**翻頁檢視**（3D 翻書） |
| 委託試算 | `/#quote` | 案主填單時即時算出金額、訂金、工作天，判斷交件日趕不趕得上，並直接送出委託 |
| 檔期行事曆 | `/#schedule` | 時間軸與月曆兩種檢視，顯示手上每件案子從開工到截稿的區塊 |
| **後台** | `/admin` | 需要密碼。委託收件匣（改狀態、寫備註、排入檔期）和檔期管理（新增、編輯、刪除） |

```
案主                                   你
 │ 在「委託試算」送出                     │ 登入 /admin
 ▼                                     ▼
┌──────────────── 同一個網站（Cloudflare Pages）────────────────┐
│  前台 public/          API functions/          資料庫 D1       │
│  委託試算  ── 送出 ──▶  /api/requests  ──────▶  委託（私人）   │
│  後台      ── 排入檔期 ▶ /api/admin/…   ──────▶  檔期           │
│  檔期行事曆 ◀─ 讀取 ─── /api/projects  ◀──────  （只給公開欄位）│
└──────────────────────────────────────────────────────────────┘
```

---

## 第一步：換成你的資料

打開 `public/assets/js/config.js`，照順序改這幾個區塊：

| 區塊 | 要改什麼 |
| --- | --- |
| `site` | 工作室名稱、你的名字、一句話介紹、Email |
| `about` | 規則頁的「關於我」：大頭照、自我介紹、經歷／工具／語言 |
| `capacity` | 同時可接幾件（`maxConcurrent`）、休假日（`daysOff`） |
| `pricing` | 所有單價、每日產能、急件級距、折扣、最低收費、訂金比例 |
| `rules` | 合作流程與條款文字 |
| `portfolio` | 作品集（見第二步） |

`projects` 只是範例檔期，用來在你自己電腦上預覽；上線後的檔期都在後台管理。

**大頭照**：把照片放進 `public/assets/img/`，例如 `me.jpg`，再把 `about.photo` 改成 `'assets/img/me.jpg'`。

**每日產能（`perDay`）很重要**：它決定試算出來的工作天，以及交件日會不會被判成急件。建議拿你最近幾個案子實際花的天數回推：例如 9 萬字的一般校對做了 5 天，每天就是 18,000 字。

> 小提醒：`config.js` 是程式檔，改文字時保留前後的引號 `'…'` 和結尾的逗號。改壞了網頁會變空白，這時把最後改的地方還原就好。

**預覽**：直接用瀏覽器打開 `public/index.html` 就能看（這時送出委託會改成「複製內容」，檔期用範例資料）。

---

## 第二步：放入你的作品集

每本書是 `portfolio` 裡的一筆。有兩種放法，可以混用。

### 方法 A：整頁圖片（推薦，排版作品用這個）

1. **匯出頁面圖**
   - InDesign：「檔案 → 轉存 → 格式選 JPEG」，**轉存為「頁面」不是「跨頁」**，解析度 150 ppi、品質「高」。
   - 只有 PDF：Acrobat「匯出 PDF → 影像 → JPEG」；或用免費的 [iLovePDF](https://www.ilovepdf.com/zh-tw/pdf_to_jpg)。
2. **挑 8～16 頁**：封面、目次、章首頁、內文頁、圖文頁各挑幾張。第 1 張會當成封面。
3. **放進資料夾**：例如 `public/assets/img/island/`，檔名改成 `p01.jpg`、`p02.jpg`……
4. **在 config.js 加一筆**：
   ```js
   {
     id: 'island',
     title: '島嶼慢讀',
     kind: '散文集',
     role: '排版＋一校',
     year: 2025,
     trim: [148, 210],            // 成品尺寸 mm，決定頁面比例
     coverColor: '#34505e',       // 作品按鈕上書背的顏色，挑封面主色
     note: '25 開、內文 10.5pt、行距 1.75。',
     scans: { folder: 'assets/img/island', count: 12 }
   },
   ```
   檔名不想改的話：`scans: { folder: 'assets/img/island', files: ['封面.jpg', '目次.jpg', '內文1.jpg'] }`。

### 方法 B：用文字重現（校對、翻譯作品用這個）

照 `config.js` 裡現有的三本範例改：

- **校對示範**：內文用 `[-刪掉的字-]` 和 `{+加上的字+}`，文件檢視打開「顯示修訂」會出現紅色刪除線和藍色底線。建議挑 300～500 字、修改密度高的段落。
- **翻譯示範**：用 `bilingual` 頁面，放 2～4 組原文與譯文對照。
- 其他頁面類型：`cover`（封面）、`toc`（目次）、`chapter`（章首）、`text`（內文）、`image`（插圖＋圖說）、`blank`（空白頁）。

放進作品集之前，請先確認出版社或作者同意公開。

---

## 第三步：上線（Cloudflare，一次性設定約 10 分鐘）

全部在 Cloudflare 網頁上點選完成，不需要安裝任何東西。

1. **註冊**：到 [dash.cloudflare.com](https://dash.cloudflare.com/sign-up) 註冊免費帳號。
2. **建立資料庫**：左側選單「Storage & Databases → D1 SQL Database」→「Create」，名稱填 `krystal-studio`，按建立。資料表會在網站第一次被使用時自動建立。
3. **連接網站**：左側「Workers & Pages」→「Create」→ 切到「Pages」分頁 →「Connect to Git」→ 授權 GitHub 並選這個 repo：
   - Production branch：`main`
   - Framework preset：`None`
   - Build command：留空
   - Build output directory：`public`
   - 按「Save and Deploy」。
4. **綁定資料庫**：進入剛建立的專案 →「Settings → Bindings」→「Add」→「D1 database」：
   - Variable name：`DB`
   - D1 database：選 `krystal-studio`
5. **設定後台密碼**：同一頁「Settings → Variables and Secrets」→「Add」：
   - Type：`Secret`
   - Variable name：`ADMIN_PASSWORD`
   - Value：你的後台密碼（至少 12 個字元，不要和其他網站重複）
6. **重新部署**：「Deployments」分頁，最新一筆右邊「⋯ → Retry deployment」，讓綁定和密碼生效。
7. **完成**：網址會是 `https://<專案名稱>.pages.dev`，後台在 `https://<專案名稱>.pages.dev/admin`。之後推到 `main` 就會自動更新網站。

想用自己的網域（例如 `krystal-books.com`）：專案的「Custom domains」→「Set up a custom domain」照指示設定。

---

## 日常使用：後台

1. **收到委託**：打開 `/admin`，「委託收件匣」旁的紅色數字是待回覆件數。點開一筆可以看到完整試算、聯絡方式和稿件連結，點 Email 就能直接回信。
2. **回覆報價**：狀態改成「已報價」。可以在「我的備註」記下正式報價、談過的條件。
3. **委託成立**：按「排入檔期」，日期和案主名稱會自動帶入。
   - 「代稱」和「工作內容」會公開在網站上，不要寫書名或作者名。
   - 「真實案主名稱」和「私人備註」只有你看得到。
   - 儲存後，這筆委託會自動標成「成立」，網站行事曆和側欄的「可接新案／檔期已滿」立刻更新。
4. **其他案子**：熟客私下找你的案子，在「檔期管理」按「新增檔期」直接加。還在談的勾「洽談中」（虛線顯示、不佔檔期）；不想公開的勾「不公開」。

登入一次會記住 30 天。在 Cloudflare 改掉 `ADMIN_PASSWORD` 後，所有裝置都會被登出。

目前新委託**不會寄 Email 通知**，要登入後台才看得到。如果需要通知信，之後可以再串接寄信服務。

---

## 試算怎麼算

1. 各項服務依單價算小計（排版每頁、校對每千字 × 校次倍率、翻譯每字 × 文類倍率）。
2. 同時委託兩項以上，小計打折（`comboDiscount`）。
3. 預估工作天 = 數量 ÷ 每日產能（`perDay`）。
4. 開工日取「明天」「原稿可給日」「你的下一個空檔」三者最晚的一天。
5. 開工日到交件日的可用工作天 ÷ 預估工作天，對照 `rush` 級距決定一般件／急件／特急件；低於最低級距就提示「時程不足，需要另外討論」。
6. 套用最低收費，金額取整到 10 元，並列出訂金。

## 檔案結構

```
public/                    網站（前台＋後台頁面）
  index.html               四個公開分頁
  admin.html               後台
  assets/js/config.js      ← 你會改的內容都在這裡
  assets/js/app.js         試算、行事曆、作品集
  assets/js/admin.js       後台
  assets/css/style.css     樣式（含深色模式）
  assets/img/              大頭照、作品集圖片
functions/api/             後端 API（Cloudflare Pages Functions）
server/lib.js              後端共用：資料表結構、登入驗證、欄位檢查
```

### 給會寫程式的人：本機開發

```bash
npm install
npm run dev        # http://localhost:8788 ，後台密碼 dev-password，資料存在 .wrangler/
```
