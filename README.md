# boatrace-app

展示データを用いた視覚的な展開予想を中心とした、ボートレース予想デモアプリ(第1弾MVP)。
詳細な要件は [requirements.md](./requirements.md) を参照。

## 技術スタック

- Next.js (App Router) + TypeScript + Tailwind CSS ─ スマホ/PC両対応のレスポンシブWebアプリ
- better-sqlite3 ─ 取得済みデータのキャッシュ用DB(常駐Nodeプロセス前提)
- cheerio ─ 公式サイトHTMLのパース
- node-cron ─ 低頻度・定時のデータ取得スケジューラ
- lhasa(外部コマンド、要インストール) + iconv-lite ─ 過去データ(LZH配布・Shift-JIS)の解凍/デコード

## セットアップ

```bash
npm install
npm run dev
```

デフォルトでは `data/boatrace.db` にSQLiteファイルが作成される(`.gitignore`済み)。

### モックデータで画面確認する(ネットワークアクセスなし)

公式サイトへアクセスせずにUIを確認したい場合:

```bash
npm run seed:mock
npm run dev
```

3場×12レース分のダミーデータが投入される(うち住之江1R・2Rのみ展示データ投入済みとして表示)。

### 実ネットワークアクセスのある環境での検証(Docker)

このリポジトリの開発環境はネットワークポリシーにより boatrace.jp / mbrace.or.jp へ
アクセスできないため、スクレイパー・LZH取り込みの実地検証は別環境で行う必要がある。
`Dockerfile` / `docker-compose.yml` を用意しており、`lhasa` もイメージにインストール
済みなので、Dockerが動く環境であれば以下だけで一式起動できる。

```bash
docker compose up --build
```

`data` はDocker volumeに永続化される。過去データの手動取り込みAPIを使う場合は
`docker-compose.yml` の `ADMIN_TOKEN` 環境変数のコメントを外して値を設定すること。

**注意**: 本開発環境にはDockerデーモンが無く、`docker build` 自体の実行検証はできていない
(Dockerfileの内容は妥当だが未実地検証)。`apt-get install lhasa` がこのサンドボックスの
Debianベース環境で問題なく動くことは別途確認済み(Dockerfileも同じ `node:22-bookworm-slim`
= Debianベースを使用)。

## データ取得についての重要な注意

公式サイト(boatrace.jp)の利用規約は、スクレイピングを明示的に許可してはいない。
確認した範囲では以下の制約がある:

- 「不正アクセス、大量の情報送受信及び大量のアクセスなど、本サイトの運営に支障を与える行為」を禁止
- サイト上のコンテンツは著作権保護されており、個人利用の範囲を超えた複製・改変・再配布は不許可

明確な「スクレイピング禁止」の文言はないが、グレーゾーンであることを踏まえ、本アプリでは以下の方針でリスクを最小化している。

- **全リクエストを `src/lib/scraper/client.ts` に一本化**し、常に1件ずつ・最低3秒間隔で直列実行(同時アクセスは発生しない設計。待機時間の予約だけでなく実際のfetch呼び出し自体をキューで直列化しており、複数リクエストが同時に飛ぶことはない)
- **失敗時も自動リトライは行わない**(取得できない場合に多重アクセスを発生させないため)
- **出走表・番組表は1日1回のバッチ取得**(`ingestDailySchedule`、毎日08:00 JST想定)
- **展示データ(直前情報)はレースごとに締切15分〜10分前の間に1回だけ取得**し、DB上のロック(`exhibition_fetch_lock`テーブル)で二重取得を防止
- **ユーザーのページ閲覧では一切スクレイピングを行わない**(常にDBキャッシュを読むだけ)

この方針は事業上・法務上のリスクをゼロにするものではない。継続的な商用運用に進む前に、
必ず自社で改めて規約を確認し、可能であれば運営団体(BOAT RACE振興会等)への確認や、
公式データ提供元との契約を検討すること。

また、本開発環境はネットワーク制限により対象サイトへのアクセスができない。
`parseVenueDays`(トップページの全24場の開催状況)は実際のページソース(view-source)を
もとに実装・検証済み(`ul.schedule1_lists > li.schedule-button` 構造、場は固定順のため
リスト順のindexをjcdとして採用)。一方 `parseRaceIndex` / `parseRaceCard` / `parseBeforeInfo`
(出走表・直前情報)は公開情報から得た一般的なテーブル構造を前提にした**未検証の実装**であり、
本番投入前に実際のページソースで検証・調整すること。

## 過去データ(データベース基盤)について

当日のライブスクレイピングとは別に、公式が明示的に提供している「ダウンロード」機能から
過去データを取り込むバッチ処理を用意している(要件定義書7「過去データ: まとめて取得し、
データベースに蓄積」に対応)。

- **レーサー期別成績**: `https://www.boatrace.jp/owpc/pc/extra/data/download.html`
  からLZHをダウンロードし、解凍後の固定長テキスト(143項目)をパースして `racers`
  テーブルへ格納。年数回更新される想定で、週1回チェックする(取り込み済みならスキップ)。
- **競走成績アーカイブ**: `http://www1.mbrace.or.jp/od2/K/YYYYMM/kYYMMDD.lzh` から
  日別のLZHをダウンロードし、`race_results` テーブルへ格納。毎日1回、前日分を取り込む。
  第2段階のAI予想・統計機能のための土台であり、現状の画面表示にはまだ使っていない。

**この2つのパーサー(`src/lib/historical/parsePlayers.ts` / `parseResults.ts`)は、
公式仕様書ではなく、同フォーマットを実際に処理している公開実装(GitHub: cstenmt/boatrace)
のロジックを移植したもの。** レーサー期別成績側はフィールド名とバイト位置定義の項目数が
一致することを検証済みだが、いずれも実際の配布ファイルに対するテストはネットワーク制限
により未実施。本番投入前に実データで検証すること。

**LZH解凍について**: Node.jsに実用的なLZH展開ライブラリが存在しないため、外部コマンド
`lhasa` (`apt-get install lhasa`)をchild_process経由で呼び出す方式を採用している
(`src/lib/lzh.ts`)。デプロイ環境に `lhasa` のインストールが必要。ダミーアーカイブでの
解凍・Shift-JISデコードのラウンドトリップ動作は確認済み。

低頻度バッチは `src/lib/scheduler.ts` の `startHistoricalJobs()` で、ライブの当日データ
取得ジョブとは独立したcronとして登録している(前日結果を毎日04:00 JST、期別成績を毎週
月曜05:00 JSTにチェック)。動作確認用に `POST /api/admin/ingest-historical?type=racers|results`
(要 `ADMIN_TOKEN` 環境変数)からも手動実行できる。

## ディレクトリ構成(抜粋)

```
src/
  app/
    page.tsx                 トップ画面(全24場の当日開催状況、日付ナビゲーション)
    venue/[jcd]/page.tsx     場別レース一覧画面(1〜12R選択式)
    race/[id]/page.tsx       レース詳細画面(出走表+展開予想)
    api/races/route.ts       レース一覧API
    api/races/[id]/route.ts  レース詳細API
  components/
    VenueCard.tsx            トップ画面の場カード(開催状況・時間帯/グレードバッジ)
    EntryTable.tsx           出走表テーブル
    RaceDevelopmentViz.tsx   展開予想(SVG)ビジュアライゼーション
  lib/
    scraper/                 公式サイト取得クライアント・パーサー・DB書き込み(当日ライブデータ)
    historical/              過去データ(期別成績・競走成績)のダウンロード・パーサー・取り込み
    lzh.ts                   LZH解凍(lhasa外部コマンド)・Shift-JISデコード
    scheduler.ts             node-cronによる定時取得ジョブ(ライブ+過去データ)
    repository.ts            DB読み出し(API/画面共通)
    prediction.ts            展示データ(展示タイム・進入コース・スタートタイミング)からの
                              簡易展開予想ロジック(AI予想ではない)
scripts/seed-mock.mjs        デモ用モックデータ投入スクリプト(全24場のvenue_daysも含む)
```

## 今後(第2段階以降、要件定義書10参照)

- AI/アルゴリズムによる自動予想
- ユーザー条件絞り込み予想
- ログイン・無料トライアル・月額課金
