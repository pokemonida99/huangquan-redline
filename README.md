# 紅線護軍師

黃泉燒肉店同人小遊戲，玩法照「蜜蜂叮狗狗（Save the Doge）」：玩家是月老，畫一條紅線護住鼠軍師，撐過倒數不被蝙蝠咬到就過關。

- 開啟：`python3 -m http.server 4480 --bind 0.0.0.0`（上層 `.claude/launch.json` 的 `huangquan-redline`），手機連同一個 Wi‑Fi 開 `http://<電腦IP>:4480/`
- 程式：`js/sim.js` 物理（Matter.js，瀏覽器與 node 共用）、`js/levels.js` 關卡、`js/game.js` 畫面與觸控、`js/audio.js` 程式合成音效配樂
- 改關卡後一定要跑 `node tools/verify.js`：每關用 `sol` 解答實跑多個亂數種子，並確認不畫線會輸；`SEEDS=20` 可加測
- 美術：鼠軍師立繪、月老、紅蝙蝠、背景取自轉珠遊戲（huangquan-puzzle）；害怕／受傷表情用 GPT 依立繪重繪（`tools/gen.sh`），Vision 去背（`tools/lift.swift`）

## 物理注意
- Matter 組合物體的轉動慣量沒算平行軸，紅線會轉得像紙片 → `commit()` 裡自己補慣量
- Matter 推開重疊物體時不看重量，一大群蝙蝠一直壓會把紅線擠走 → 蝙蝠撞到東西會彈開一下（`back`），`slop: 1`
