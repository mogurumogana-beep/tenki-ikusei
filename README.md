# くもそだて(天気連動 育成アプリ MVP)

実際の天気と連動する育成アプリのMVP。仕様書は `weather-pet-app-spec` を参照。

## 起動

```bash
npm install
npm run dev      # 開発サーバー (http://localhost:5173)
npm test         # ロジックのユニットテスト
npm run build    # 型チェック + PWAビルド (dist/)
```

## 構成(ロジックとUIの分離 — 仕様書§12)

```
src/
  logic/        ピュアロジック(UI・API非依存。ネイティブ移植時はここを持っていく)
    constants.ts   閾値・係数の外出し(バランス調整はこのファイルだけで行う)
    types.ts       内部型定義
    judge.ts       平年比の環境判定(§5-1, 5-2)
    mood.ts        機嫌の算出(§5-3〜5-5)
    materials.ts   素材と採取、災害時の反転ルール(§6-1, §7)
    resistance.ts  可変体質: 食べる→耐性上昇、時間で減衰、上限8割(§6-2)
    dialogue.ts    3層セリフ合成(§8)
  adapters/     天気API → 内部型への変換層(API差し替え可能)
  data/         キャラ定義JSON(画像パス・セリフ・体質。2体目はJSON追加のみ)
  state/        localStorage 永続化(サーバーなし、§2)
  ui/ + App.tsx UI層
public/assets/moko/  画像(現在はプレースホルダーSVG。同名で差し替え可)
```

## ⚠ 天気APIについて(未確定 — 仕様書§9)

現在は **Open-Meteo を開発検証用の暫定実装** として使っている
([openMeteo.ts](src/adapters/openMeteo.ts))。
Open-Meteo の無料枠は**非商用限定**のため、リリース時のAPIは
利用規約と気象業務法の観点で比較確認してから確定すること(気象庁公開データ /
Apple WeatherKit 等)。差し替えは `WeatherProvider` 実装の追加のみで済む。

- 表示は取得した公式データの提示のみ。独自予報は行わない
- 平年値の代わりに過去14日の実測移動平均を基準値に使用(§5-1の代用ルール)
- 気圧トレンドは実況の6時間差分(予報ではない)

## 安全設計(§7)の実装箇所

- 災害級の日: 通常の採取UIを非表示にし、屋内の防災タスクに反転
  ([materials.ts](src/logic/materials.ts) `harvestAllowed` / [App.tsx](src/App.tsx))
- キャラは安全宣言をしない(セリフは固定の注意喚起のみ、[dialogue.ts](src/logic/dialogue.ts))
- 警報連携(気象庁防災情報XML等)はAPI選定確定後の課題。現状は激しい天気コードからの機械判定

## MVP検証の使い方

画面下部の「🔧 デバッグ」で天気・気圧・災害モードを上書きすると、
セリフ・表情・お世話フローの切り替えを実際の天気を待たずに確認できる。

## 未実装(仕様書通り後回し)

進化分岐(累積は `fedTotals` に記録済み)/ お出かけ / ミニゲーム / 図鑑 /
課金・広告 / 2体目以降 / プッシュ通知(PWAの制約検討が必要)
