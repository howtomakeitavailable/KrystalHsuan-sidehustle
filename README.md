# Krystal 書頁工作室：接案 Dashboard

書籍排版・校對・翻譯的接案網站。這是純靜態網頁（HTML + CSS + JS），不需要安裝任何東西，可以直接放上 GitHub Pages。

| 分頁 | 網址 | 內容 |
| --- | --- | --- |
| 收費與規則 | `#rules` | 服務介紹、價目表、急件／折扣／訂金、合作流程、條款 |
| 作品集 | `#portfolio` | **文件檢視**（仿 Word：尺規、縮放、修訂標示、字數統計）與**翻頁檢視**（3D 翻書） |
| 委託試算 | `#quote` | 案主填單時即時算出金額、訂金、工作天，並判斷交件日趕不趕得上 |
| 檔期行事曆 | `#schedule` | 時間軸與月曆兩種檢視，顯示手上每件案子從開工到截稿的區塊 |

## 日常維護：只改 `assets/js/config.js`

所有內容都集中在這個檔案，其他檔案不用動。

- **改價錢**：`pricing` 區塊。規則頁的價目表和試算表單讀的是同一份設定，改一次兩邊同步。
- **新委託成立**：在 `projects` 加一筆：
  ```js
  { client: '案主G', service: 'proofread', title: '小說 一校', start: '2026-12-01', end: '2026-12-20' },
  ```
  `service` 填 `layout`（排版）、`proofread`（校對）或 `translate`（翻譯）。還在洽談、沒付訂金的加上 `tentative: true`，會以虛線顯示，也不會算進檔期。狀態（已排定／進行中／已完成）依今天日期自動判斷。
- **休假**：`capacity.daysOff` 加日期；`capacity.maxConcurrent` 是同時可接的件數，滿了側欄會顯示「檔期已滿」和最快可開工日。
- **作品集**：`portfolio` 陣列，每本書一筆。頁面類型有 `cover`、`toc`、`chapter`、`text`、`bilingual`、`image`、`blank`。
  - 想放實際版面的截圖：把圖片放進 `assets/img/`，用 `{ type: 'image', src: 'assets/img/xxx.jpg', caption: '說明' }`。
  - 校對示範：內文用 `[-刪除的字-]` 和 `{+新增的字+}`，文件檢視打開「顯示修訂」就會出現紅色刪除線與藍色底線。

## 試算怎麼算

1. 各項服務依單價算小計（排版每頁、校對每千字 × 校次倍率、翻譯每字 × 文類倍率）。
2. 同時委託兩項以上，小計打折（`comboDiscount`）。
3. 預估工作天 = 數量 ÷ 每日產能（設定在各選項的 `perDay`）。
4. 開工日取「明天」「原稿可給日」「你的下一個空檔」三者最晚的一天。
5. 開工日到交件日的可用工作天 ÷ 預估工作天，對照 `rush` 級距決定一般件／急件／特急件；低於最低級距就提示「時程不足，需要另外討論」。
6. 套用最低收費，金額取整到 10 元，並列出訂金。

## 讓表單真的寄到你信箱

預設（`formEndpoint` 留空）時，案主按「送出委託」後會看到整理好的委託內容，按「複製」後自己寄 Email 給你。

想讓表單直接寄到你的信箱：

1. 到 [Formspree](https://formspree.io) 註冊（免費方案每月 50 筆），新增一個表單。
2. 複製它給的網址，例如 `https://formspree.io/f/abcdwxyz`。
3. 貼到 `config.js` 的 `site.formEndpoint`。

之後每筆委託都會寄到你的信箱，信件主旨含專案名稱與試算金額，內文是完整的試算明細。

## 放上網路（GitHub Pages）

1. 到 repo 的 **Settings → Pages**。
2. Source 選 **Deploy from a branch**，Branch 選 `main`、資料夾 `/ (root)`，按 Save。
3. 約一分鐘後會出現網址，例如 `https://<帳號>.github.io/KrystalHsuan-sidehustle/`。

在自己電腦上預覽：直接用瀏覽器打開 `index.html` 即可。

## 檔案結構

```
index.html            四個分頁的骨架
assets/css/style.css  樣式（含深色模式）
assets/js/config.js   ← 你會改的只有這個
assets/js/app.js      試算、行事曆、作品集的程式
assets/img/           作品集圖片
```
