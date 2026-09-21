const fs = require('fs');

// 先ほど添付いただいた日記テキスト全量
const diaryData = `[source: 1]10年日記
日記:2162 写真:728 タグ:0
2016/01/01 ~ 2026/08/30
` + fs.readFileSync('import_source.txt', 'utf8');
