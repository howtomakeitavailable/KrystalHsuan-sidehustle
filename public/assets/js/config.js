/* =====================================================================
 * 網站設定檔：日常維護只需要改這個檔案
 * ---------------------------------------------------------------------
 * - site      ：工作室名稱、聯絡方式
 * - about     ：關於我
 * - capacity  ：接案量、暫停接案期間（例如 CWT 擺攤前）
 * - pricing   ：收費公式與加價項目（規則頁與委託試算共用，改一次兩邊同步）
 * - rules     ：委託說明、校稿原則、流程、其他加價
 * - layoutSpecs：委託單上的「排版規格」選項
 * - projects  ：直接打開 index.html 預覽時用的範例檔期（上線後改在後台 /admin 管理）
 * - portfolio ：作品集內容
 * 日期一律寫成 'YYYY-MM-DD'。
 * ===================================================================== */
window.SITE_CONFIG = {
  site: {
    name: 'Krystal 書頁工作室',
    owner: 'Krystal Hsuan',
    tagline: '校對、實體書內頁排版、電子書 EPUB、翻譯。接受原創、同人、BL、BG、R18 作品。',
    email: 'your-email@example.com',
    line: ''
  },

  // 規則頁上的「關於我」
  about: {
    photo: '',                     // 大頭照，例如 'assets/img/me.jpg'；留空會顯示名字的第一個字
    heading: '你好，我是 Krystal',
    paragraphs: [
      '這裡放你的自我介紹：接案多久、做過哪些類型的本子、你在意的細節。'
    ],
    facts: [
      ['服務類型', '校對、實體書內頁排版、電子書 EPUB、翻譯'],
      ['校稿工具', 'Word 追蹤修訂與註解'],
      ['每月件數', '2～3 件（總字數 12 萬字內）']
    ]
  },

  capacity: {
    maxConcurrent: 3,              // 同時進行的案子上限，達到上限時顯示「檔期已滿」
    monthlyWords: 120000,          // 每月總字數上限；單件超過會在試算提醒
    daysOff: [],                   // 不工作的日子，例如 ['2026-12-25']
    // 暫停接案期間：會標在行事曆上，交稿日落在期間內時試算會提醒。
    // CWT 前兩個月有擺攤就加一筆，例如：
    //   { start: '2026-12-01', end: '2027-01-31', label: 'CWT 擺攤準備，暫停接案' }
    closed: []
  },

  pricing: {
    currency: 'NT$',
    depositRate: 0.5,              // 訂金比例
    minimumFee: 500,               // 單筆最低收費
    tableWords: [5000, 10000, 50000, 100000],   // 規則頁價目表列出的字數

    // 案主可選：校對 / 校對＋排版 / 排版（無校對）
    // 有校對（含校對＋排版）用 proofread 公式；只排版用 none 公式。
    // 基本費 =（字數 + add）× multiply ÷ divide，四捨五入。
    // 排版、EPUB、代印、全包都是「基本費的百分比」；EPUB、代印、拆本只能搭配排版。
    modes: {
      proofread: {
        label: '校對',
        formula: { add: 5000, multiply: 5, divide: 100 },
        formulaText: '5 ×（字數 + 5,000）÷ 100',
        layout: 0.4,                                   // 校對＋排版：排版 +40%
        extras: { epub: 0.25, print: 0.4 },
        bundle: { items: ['epub', 'print'], rate: 0.6 },  // 以上全包：排版＋EPUB＋代印 共 +60%
        rush: { days: 14, text: '兩週內要交稿' }
      },
      none: {
        label: '排版（無校對）',
        formula: { add: 7000, multiply: 1, divide: 25 },
        formulaText: '（字數 + 7,000）÷ 25',
        layout: 0.6,                                   // 排版 +60%
        extras: { epub: 0.25, print: 0.4 },
        bundle: { items: ['epub'], rate: 0.7 },        // 以上全包：排版＋EPUB 共 +70%（代印另計）
        rush: { perWords: 80000, days: 10, text: '每 8 萬字工期 10 天內' }
      }
    },
    rushRate: 0.5,                 // 急件：加收總額的 50%
    volumeFee: 150,                // 拆本費：一本不收，每多拆 1 本 +150（2 本 +150、3 本 +300）
    printCap: 1000,                // 代印服務每件作品最多收
    printVendors: { north: '千業印刷', other: '樺舍印前' },

    // 服務名稱（規則頁、行事曆、後台共用）
    services: {
      proofread: { name: '校對',           short: '校對', intro: '用 Word 追蹤修訂校正錯字與標點，建議以註解標示，不改動文句。' },
      layout:    { name: '實體書內頁排版', short: '排版', intro: '依你的開本、字型與版面需求排版，交付可送印的 PDF。' },
      epub:      { name: '電子書 EPUB',    short: 'EPUB', intro: '製作可上架電子書平台的 EPUB 檔。' },
      print:     { name: '代印服務',       short: '代印', intro: '北北基客戶交由千業印刷，其他縣市交由樺舍印前。' },
      // 翻譯：規則還在整理，委託單上可以勾選，但不計算金額（quoteLater），由你另外報價
      translate: { name: '翻譯',           short: '翻譯', intro: '翻譯規則整理中，勾選後請描述需求，我會另外報價。', quoteLater: true }
    }
  },

  rules: {
    // 委託說明
    intro: [
      ['接受作品類型', '原創、同人、BL、BG、R18'],
      ['每月件數', '基本上 2～3 件（總字數 12 萬字內）'],
      ['CWT 前後', 'CWT 前兩個月，如果我有擺攤就不接案；沒有擺攤的話，這兩個月可多接一件（總字數仍在 12 萬字內）'],
      ['服務類型', '校對、實體書內頁排版、電子書 EPUB、翻譯（規則整理中，請來信詢問）']
    ],
    // 校稿原則
    proofPrinciples: [
      '使用 Word 的校稿功能（追蹤修訂）。',
      '「的、地、得」將依我的判斷及使用習慣校正。',
      '初次校稿時，標點符號將依我的習慣校正。',
      '只改錯字和誤用的標點符號，不修改文句邏輯；如果有相關建議，會用 Word 註解標示。',
      '如果你有自己的寫作習慣，請務必在委託單的「寫作習慣」欄詳細說明，否則將依照第 2～4 點原則校稿。'
    ],
    // 流程（依序顯示）
    processes: [
      {
        title: '校稿流程',
        steps: [
          '收到委託單後，寄委託資訊到你的電子信箱。',
          '收到稿件後先校五百字回傳，讓你參考我的校稿風格；你也可以在這一步喊停。',
          '收到 50% 訂金後開始校稿。',
          '檢查、校稿三遍後寄回初校。收到後可以要求再修改一次（也就是我再校兩次）。',
          '交回二校後，如果還要再修改，每次加收 100 元。',
          '你滿意並匯尾款後，回寄本次交易資訊及檔案。'
        ]
      },
      {
        title: '排版流程',
        steps: [
          '收到委託單後，寄委託資訊到你的電子信箱。',
          '收到稿件後，和你討論希望的樣式（開版、字型大小、特殊設計）。',
          '收到 50% 訂金後試排第 1 版，檢查明顯錯字、標點符號方向、段落後回傳。',
          '可以重複第 2、3 步，重新開版 1 次；第 3 次開版起加價 200 元（兩本或以上的案件要重開版：第一本 +200 元，第二本起每本 +100 元）。',
          '你滿意並匯尾款後，回傳本次委託結案資訊及 PDF 檔案。',
          '之後聯絡印刷廠時如果有版型問題，在不重新開版的前提下可以調整；必須再次開版的話，再酌收 200 元（第二本也是 200 元）。'
        ],
        note: '重新開版的調整天數少於 7 天視為急件，每本再多收 100 元（即第一本 300 元；有第二本的話 300 元 + 300 元）。'
      }
    ],
    // 交件後的其他加價（顯示在價目表下方）
    extraFees: [
      ['二校後再修改', '每次 +100 元'],
      ['排版第 3 次開版起', '+200 元；兩本或以上：第一本 +200 元，第二本起每本 +100 元'],
      ['聯絡印刷廠後需再次開版', '每本 +200 元'],
      ['重新開版調整天數少於 7 天', '視為急件，每本再 +100 元（即每本 300 元）']
    ]
  },

  // 委託單的「排版規格」。每題最後一個選項如果是「其他」，會多一個輸入框。
  layoutSpecs: [
    { id: 'size',   label: '書本尺寸', options: ['A5', '其他'] },
    { id: 'font',   label: '字型',     options: ['新細明體', '其他'] },
    { id: 'pt',     label: '字級',     options: ['10.5', '11', '其他'] },
    { id: 'dir',    label: '方向',     options: ['直排', '橫排'] },
    { id: 'folio',  label: '頁碼位置', options: ['上方外邊角落', '下方外邊角落', '下方正中間'] },
    { id: 'design', label: '其他設計', text: true, placeholder: '例如：書名圖示、篇章名樣式、扉頁、角色介紹頁……' }
  ],
  workTypes: ['原創', '同人', 'BL', 'BG', 'R18'],

  /* 範例檔期 --------------------------------------------------------------
   * 上線後的檔期在後台（網址/admin）管理，這裡只在「直接打開 index.html 預覽」時使用。
   * service：proofread（校對）/ layout（排版）/ epub（EPUB）/ translate（翻譯） */
  projects: [
    { client: '案主A', service: 'proofread', title: '同人長篇 校對',       start: '2026-09-14', end: '2026-10-08' },
    { client: '案主B', service: 'layout',    title: '原創 BL 本 內頁排版', start: '2026-09-21', end: '2026-10-23' },
    { client: '案主C', service: 'translate', title: '日文同人短篇 翻譯',   start: '2026-10-26', end: '2026-11-06' },
    { client: '案主D', service: 'proofread', title: 'BG 短篇集 校對＋排版', start: '2026-11-02', end: '2026-11-27', tentative: true }
  ],

  /* 作品集 ---------------------------------------------------------------
   * trim：成品尺寸（mm），用來決定頁面比例與尺規
   * pages 的 type：
   *   cover     封面：title / subtitle / author / publisher
   *   toc       目次：entries: [['篇名', 頁碼], ...]
   *   chapter   章首：label / title / paragraphs
   *   text      內文：paragraphs
   *   bilingual 翻譯對照：pairs: [{ src, tgt }, ...]
   *   image     圖片（保留頁眉頁碼）：src / caption
   *   scan      整頁圖片（滿版，適合放 InDesign／PDF 匯出的頁面圖）：src
   *   blank     空白頁
   * 內文可以用 [-刪除-] 與 {+新增+} 標記校對修改，在文件檢視中會顯示成修訂；
   * 用 [[原文|註解內容]] 標示 Word 註解（黃色底，旁邊附註解）。
   *
   * 已經排好的書，最省事的做法是把每頁匯出成圖片，不用寫 pages：
   *   scans: { folder: 'assets/img/island', count: 12 }
   * 會依序讀取 assets/img/island/p01.jpg、p02.jpg … p12.jpg（第 1 張當封面）。
   * 副檔名不是 jpg 的話加上 ext: 'png'。
   * 檔名不想改的話，也可以直接列出來：scans: { folder: 'assets/img/island', files: ['封面.jpg', '內頁1.jpg'] } */
  portfolio: [
    {
      id: 'island',
      title: '島嶼慢讀',
      kind: '散文集',
      role: '實體書內頁排版＋校對',
      year: 2025,
      trim: [148, 210],
      coverColor: '#34505e',
      note: '25 開、內文 10.5pt 思源宋體、行距 1.75，章首頁留白三分之一。',
      pages: [
        { type: 'cover', title: '島嶼慢讀', subtitle: '在海風裡寫下的二十篇日常', author: '林予安　著', publisher: '示範出版社' },
        { type: 'blank' },
        { type: 'toc', entries: [['輯一　港口', 3], ['清晨的魚市', 3], ['等一班渡輪', 5], ['輯二　山線', 9], ['雨停之後', 9], ['輯三　回家', 15]] },
        { type: 'chapter', label: '輯一　港口', title: '清晨的魚市', paragraphs: [
          '五點半，天色還是灰藍的，魚市已經亮起一排白色的燈。攤販把碎冰倒進保麗龍箱，聲音像一場很短的雨。',
          '我不是來買魚的。只是想在城市醒來以前，看一看這座島最早開始工作的人。'
        ] },
        { type: 'text', paragraphs: [
          '賣白帶魚的阿姨認得我，每次都說：「妳又來看喔？」然後遞給我一杯很燙的薑茶。她的手凍得通紅，動作卻一點都不慢，刀子劃過魚腹，乾淨俐落。',
          '我常想，所謂的熟練，大概就是把同一件事做了一萬次以後，身體比腦子更早知道下一步。',
          '太陽出來時，魚市的燈一盞一盞熄掉。地上的水反著光，海鷗停在屋簷上，等著收攤後的剩料。',
          '我喝完薑茶，把紙杯捏扁，走向碼頭。第一班渡輪七點十分開。'
        ] },
        { type: 'text', paragraphs: [
          '渡輪上的人不多。一個穿制服的學生靠著欄杆背單字，嘴裡小聲念著，風一吹，單字卡翻了好幾頁。',
          '船身駛離港口時，整座城市慢慢縮成一條線。我突然明白，原來從海上看回去，家是這麼小、這麼安靜的東西。'
        ] }
      ]
    },
    {
      id: 'botany',
      title: '給忙碌者的植物學',
      kind: '科普譯著',
      role: '英譯中＋排版',
      year: 2025,
      trim: [170, 230],
      coverColor: '#3f6b4a',
      note: '中英對照樣張：專有名詞首次出現附原文，學名以斜體標示。',
      pages: [
        { type: 'cover', title: '給忙碌者的植物學', subtitle: 'Botany for Busy People', author: 'M. Harlow　著／Krystal Hsuan　譯', publisher: '示範出版社' },
        { type: 'chapter', label: '第一章', title: '葉子為什麼是綠的', paragraphs: [
          '走進任何一座公園，你看到的顏色大多是綠色。這不是巧合，而是植物在數億年間做出的選擇：吸收紅光與藍光，把用不到的綠光反射回來。',
          '負責這件事的是葉綠素（chlorophyll），一種藏在葉綠體裡的色素。'
        ] },
        { type: 'bilingual', pairs: [
          { src: 'A leaf is, in essence, a solar panel that builds itself.', tgt: '說穿了，葉子就是一片會自己長出來的太陽能板。' },
          { src: 'It unfolds in spring, works through summer, and is let go in autumn when the cost of keeping it exceeds what it earns.', tgt: '它在春天展開，整個夏天勤奮工作；到了秋天，當維持它的成本高過它帶來的收益，植物就放手讓它落下。' },
          { src: 'Nothing about this is sentimental. It is simply good accounting.', tgt: '這件事一點也不感傷，只是精打細算而已。' }
        ] },
        { type: 'text', paragraphs: [
          '以銀杏（Ginkgo biloba）為例，它的葉子在入秋後會在短短幾天內轉黃。那是因為葉綠素被分解回收，原本就存在、卻一直被綠色蓋住的類胡蘿蔔素（carotenoid）終於露出臉來。',
          '所以秋天的黃，其實不是新長出來的顏色，而是一直都在的顏色。'
        ] }
      ]
    },
    {
      id: 'rain',
      title: '雨停之前',
      kind: '原創小說',
      role: '校對（初校）',
      year: 2026,
      trim: [148, 210],
      coverColor: '#4a4f6b',
      note: '校對示範：文件檢視打開「顯示修訂」，可以看到錯字、標點與「的地得」的修正；對文句的建議放在黃色註解，不直接改動。',
      pages: [
        { type: 'cover', title: '雨停之前', subtitle: '示範樣張', author: '範例作者　著', publisher: '' },
        { type: 'chapter', label: '第一章', title: '傘', paragraphs: [
          '雨下[-的-]{+得+}很大[-,-]{+，+}他站在騎樓下，看著對街的燈號一次次[-在-]{+再+}變紅。',
          '「你沒帶傘嗎[-?-]{+？+}」她問。聲音很輕，像是怕打擾到誰。',
          '他搖搖頭，[-慢慢的-]{+慢慢地+}把手機收進口袋[-...-]{+……+}其實他帶了，只是不想打開。'
        ] },
        { type: 'text', paragraphs: [
          '她沒有再問，只是把自己的傘往他那邊移了一點。傘不大，兩個人[-已-]{+以+}一種很彆扭的姿勢站著，誰都沒有先開口。',
          '[[過了很久，雨還是沒停。|這裡和上一章「雨勢漸小」的描述有點出入，要不要確認一下時間順序？（僅供參考）]]',
          '「我等一下要去車站[-.-]{+。+}」她終於說，「你呢[-?-]{+？+}」',
          '他想了想[-,-]{+，+}說：「我也是。」其實他根本不知道自己要去哪裡。'
        ] }
      ]
    }
  ]
};
