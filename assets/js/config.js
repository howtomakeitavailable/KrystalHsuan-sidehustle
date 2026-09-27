/* =====================================================================
 * 網站設定檔：日常維護只需要改這個檔案
 * ---------------------------------------------------------------------
 * - site      ：工作室名稱、聯絡方式、表單送出位置
 * - capacity  ：產能設定（同時可接幾件、休假日）
 * - pricing   ：收費標準（規則頁與試算表單共用，改一次兩邊同步）
 * - rules     ：合作流程與條款文字
 * - projects  ：行事曆上的工作區塊（新委託成立時在這裡加一筆）
 * - portfolio ：作品集內容
 * 日期一律寫成 'YYYY-MM-DD'。
 * ===================================================================== */
window.SITE_CONFIG = {
  site: {
    name: 'Krystal 書頁工作室',
    owner: 'Krystal Hsuan',
    tagline: '書籍排版・校對・翻譯，從原稿到可以付印的檔案。',
    email: 'your-email@example.com',
    line: '',
    // 表單送出位置。建議用 Formspree（https://formspree.io）免費方案，
    // 建好表單後把網址貼在這裡，例如 'https://formspree.io/f/abcdwxyz'。
    // 留空時，案主送出後會看到「複製委託內容」與你的 Email，改由他們自己寄信。
    formEndpoint: ''
  },

  capacity: {
    maxConcurrent: 3,              // 同時進行的案子上限，達到上限時顯示「檔期已滿」
    daysOff: ['2026-10-10']        // 不工作的日子（國定假日、休假），週六日已自動排除
  },

  pricing: {
    currency: 'NT$',
    minimumFee: 1500,              // 單筆最低收費
    depositRate: 0.3,              // 訂金比例
    comboDiscount: 0.05,           // 同時委託兩項以上服務的折扣
    roundTo: 10,                   // 金額取整到 10 元
    // 急件判斷：可用工作天 ÷ 預估工作天 的比例
    rush: [
      { minRatio: 1.2, rate: 0,   label: '一般件', note: '時間充裕，照一般行程排入' },
      { minRatio: 0.8, rate: 0.3, label: '急件',   note: '需壓縮其他案子或加班，加收 30%' },
      { minRatio: 0.6, rate: 0.5, label: '特急件', note: '需夜間與週末趕工，加收 50%' }
    ],
    // 比例低於最後一級時，試算會提示「時程不足，需另外討論」

    services: {
      layout: {
        name: '書籍排版',
        short: '排版',
        unit: '頁',
        intro: '以 InDesign 排版，交付印刷用 PDF（含出血、裁切線）與原始檔。',
        types: [
          { id: 'text',    label: '純文字書',     desc: '小說、散文、詩集，少量插圖',         rate: 60,  perDay: 45 },
          { id: 'mixed',   label: '圖文混排',     desc: '旅遊書、食譜、繪本式編排',           rate: 95,  perDay: 22 },
          { id: 'complex', label: '表格／教科書', desc: '大量表格、公式、多層標題與註腳',     rate: 130, perDay: 15 }
        ],
        extras: [
          { id: 'cover', label: '封面＋書背＋封底設計', price: 3500, per: 'fixed', days: 3 },
          { id: 'epub',  label: '加轉 EPUB 電子書',     price: 12,   per: 'page',  days: 2 },
          { id: 'index', label: '索引製作',             price: 1200, per: 'fixed', days: 1 }
        ]
      },
      proofread: {
        name: '校對・潤稿',
        short: '校對',
        unit: '千字',
        intro: '以 Word 修訂模式或 PDF 註解標示，每一處修改都看得到原因。',
        levels: [
          { id: 'basic',  label: '一般校對', desc: '錯別字、標點、體例統一、前後文一致', rate: 350, perDay: 18000 },
          { id: 'polish', label: '校對＋潤稿', desc: '另外調整語句通順、贅字與節奏',     rate: 650, perDay: 9000 }
        ],
        // 第一校全價，第二校 70%，第三校 50%
        rounds: [
          { label: '一校', multiplier: 1 },
          { label: '二校', multiplier: 0.7 },
          { label: '三校', multiplier: 0.5 }
        ]
      },
      translate: {
        name: '翻譯',
        short: '翻譯',
        unit: '字',
        intro: '譯稿附術語表，專有名詞首次出現附原文。',
        pairs: [
          { id: 'en-zh', label: '英譯中', desc: '以英文原文 word 數計', rate: 1.6, perDay: 2500 },
          { id: 'ja-zh', label: '日譯中', desc: '以日文原文字數計',     rate: 1.1, perDay: 4000 },
          { id: 'zh-en', label: '中譯英', desc: '以中文原文字數計',     rate: 2.2, perDay: 2500 }
        ],
        genres: [
          { id: 'general',  label: '一般',       multiplier: 1 },
          { id: 'literary', label: '文學',       multiplier: 1.2 },
          { id: 'academic', label: '學術／專業', multiplier: 1.35 }
        ]
      }
    }
  },

  rules: {
    // 合作流程依序顯示
    process: [
      { title: '填單試算', text: '在「委託試算」填寫需求，當場看到預估金額與工作天。' },
      { title: '確認報價與檔期', text: '我會在 2 個工作天內回覆，確認稿件狀態後給正式報價。' },
      { title: '支付訂金', text: '收到 30% 訂金後排入行事曆，檔期才算確定。' },
      { title: '進行工作', text: '依約定的節點回報進度，排版案會先給樣張確認版式。' },
      { title: '交件與修改', text: '交件後 14 天內可提出修改，範圍內免費。' },
      { title: '結清尾款', text: '確認無誤後付清尾款，交付最終檔案。' }
    ],
    terms: [
      {
        title: '修改範圍',
        items: [
          '排版：交件後含 2 次免費修改，每次以一份彙整好的修改清單為準。',
          '校對：若原稿在校對期間大幅改寫，改寫部分以新稿重新計價。',
          '翻譯：譯稿交付後 14 天內可針對譯文提出修改，原文變動另計。'
        ]
      },
      {
        title: '付款',
        items: [
          '訂金 30% 於開工前支付，尾款於交件確認後 7 天內支付。',
          '可開立收據；需要發票請在委託時註明，稅金另計。',
          '總額 NT$5,000 以下的案子可於交件時一次付清。'
        ]
      },
      {
        title: '取消與延期',
        items: [
          '開工前取消，訂金全額退還。',
          '開工後取消，依已完成比例計費，訂金不退。',
          '因稿件延遲交付造成的延期，交件日順延；若撞到其他檔期會另行協調。'
        ]
      },
      {
        title: '保密與作品使用',
        items: [
          '未出版稿件全程保密，不外流、不用於 AI 訓練。',
          '書籍正式出版後，會徵求你的同意才放進作品集。'
        ]
      }
    ]
  },

  /* 行事曆的工作區塊 ----------------------------------------------------
   * client  ：對外顯示的名稱，建議用「案主A」之類的代稱
   * service ：layout / proofread / translate
   * start   ：開始工作日；end：案主給的截稿日
   * tentative: true 表示還在洽談、尚未付訂金（會以虛線顯示，不佔檔期）
   * 狀態（已排定／進行中／已完成）會依今天日期自動判斷。 */
  projects: [
    { client: '案主A', service: 'proofread', title: '心理學譯著 二校',   start: '2026-09-14', end: '2026-10-08' },
    { client: '案主B', service: 'layout',    title: '旅遊散文集 圖文排版', start: '2026-09-21', end: '2026-10-23' },
    { client: '案主C', service: 'translate', title: '園藝繪本 英譯中',   start: '2026-10-05', end: '2026-11-06' },
    { client: '案主D', service: 'layout',    title: '詩集 純文字排版',   start: '2026-10-26', end: '2026-11-13' },
    { client: '案主E', service: 'proofread', title: '商業書 校對＋潤稿', start: '2026-11-02', end: '2026-11-27', tentative: true },
    { client: '案主F', service: 'translate', title: '日文料理書 翻譯',   start: '2026-08-03', end: '2026-09-11' }
  ],

  /* 作品集 ---------------------------------------------------------------
   * trim：成品尺寸（mm），用來決定頁面比例與尺規
   * pages 的 type：
   *   cover     封面：title / subtitle / author / publisher
   *   toc       目次：entries: [['篇名', 頁碼], ...]
   *   chapter   章首：label / title / paragraphs
   *   text      內文：paragraphs
   *   bilingual 對照：pairs: [{ src, tgt }, ...]
   *   image     圖片：src（放在 assets/img/）/ caption
   *   blank     空白頁
   * 內文可以用 [-刪除-] 與 {+新增+} 標記校對修改，在文件檢視中會顯示成修訂。 */
  portfolio: [
    {
      id: 'island',
      title: '島嶼慢讀',
      kind: '散文集',
      role: '排版＋一校',
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
      id: 'cafe',
      title: '咖啡館經營手記',
      kind: '商業書',
      role: '校對＋潤稿（二校）',
      year: 2026,
      trim: [148, 210],
      coverColor: '#6b4a3a',
      note: '校對示範：在文件檢視打開「顯示修訂」，可以看到刪改與新增的地方。',
      pages: [
        { type: 'cover', title: '咖啡館經營手記', subtitle: '一間二十坪小店的十年帳本', author: '陳文謙　著', publisher: '示範出版社' },
        { type: 'chapter', label: '第三章', title: '定價這件事', paragraphs: [
          '開店第一年，我把拿鐵定在[-八十元-]{+NT$80+}，理由很簡單：隔壁那家也是這個價錢。',
          '結果一整年[-下來-]，我[-都-]在算：為什麼客人不少，錢卻存不[-起-]{+下+}來？'
        ] },
        { type: 'text', paragraphs: [
          '後來我才[-知道-]{+明白+}，定價不能只看{+別人的+}價目表，要先算清楚自己的成本。一杯拿鐵的豆子、牛奶、杯子[-，-]{+、+}加上房租與人力攤提，其實已經接近[-六十元-]{+NT$60+}。',
          '{+換句話說，+}每賣出一杯，[-我-]只賺[-了-]二十元[-而已-]。',
          '第二年我做了一個[-很大膽-]{+大膽+}的決定：漲價十元，同時把牛奶換成在地牧場的鮮乳，並在菜單上寫明產地。'
        ] },
        { type: 'text', paragraphs: [
          '[-結果讓我很意外的是，-]{+出乎意料，+}客人幾乎沒有減少。有熟客告訴我，他們在乎的[-其實-]不是十塊錢，而是「知道自己喝的是什麼」。',
          '這件事讓我[-學到-]{+體會到+}：價格不只是數字，也是你跟客人之間的一種說明。'
        ] }
      ]
    }
  ]
};
