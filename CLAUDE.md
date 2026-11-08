# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 現状

営業日報システムの実装を始めた段階。Next.js のプロジェクト（`src/app/`）ができたところで、DB・API・画面はまだない。進める順番は GitHub の Issue #29（実装ロードマップ）にある。コマンドが増えたら下の「コマンド」に追記すること。

このプロジェクトの目的は「Claude と一緒に、要件定義から実装・テストまでの流れを一通り体験すること」。作り込みよりも各工程を最後まで通すことを優先する。

## コマンド

- `npm run dev` — 開発サーバー（http://localhost:3000）
- `npm run build` — 本番ビルド
- `npm run typecheck` — 型チェック（`next typegen` でルートの型を作ってから `tsc --noEmit`）

ESLint は入れていない（決定済み）。

## 使用技術

- 言語：TypeScript
- フレームワーク：Next.js 16（App Router、`src/` ディレクトリ、Turbopack）。`next.config.ts` で `cacheComponents` が有効（`create-next-app` の初期値）
- UI コンポーネント：shadcn/ui + Tailwind CSS
- API スキーマ定義：OpenAPI（Zod による検証）
- DB スキーマ定義：Prisma（`prisma/schema.prisma`）
- テスト：Vitest

## 設計資料の関係

資料は上流から下流へ依存している。変更するときは下流の資料も合わせて直すこと。

1. `docs/sales-daily-report-requirements.md` — 要件定義・ER図・決定事項（すべての起点）
2. `docs/sales-daily-report-screens.md` — 画面定義（SCR-01〜08）
3. `docs/sales-daily-report-api.md` — REST API 設計（A-/R-/C-/M- の番号付き）
4. `docs/sales-daily-report-test-spec.md` — API・画面・非機能テスト（テストデータと実施日 2026-11-08 を前提にした期待値）
5. `docs/er-diagram.md` — 要件定義の ER図（mermaid）を単独で見るためのファイル。要件定義の ER図を変えたらここも同期する

### 読み込む資料

- @docs/sales-daily-report-requirements.md
- @docs/sales-daily-report-screens.md
- @docs/sales-daily-report-api.md
- @docs/sales-daily-report-test-spec.md

## 資料の書き方の決まり

- 確認前の仮決めには【想定】を付ける。ユーザーと合意したら【想定】を外す。
- 合意した設計判断は、要件定義の「7. 決定事項」に理由と一緒に追記する。
- 文字数上限・エラーコード・メッセージ文言は画面・API・テスト仕様の3資料で一致させる。

## 複数資料にまたがる業務ルール（実装時に見落としやすいもの）

- ロールは `SALES` / `MANAGER` の2つだけ。上長も `SALES_STAFF` に登録し、上長は日報を書かない（作成・更新は 403）。マスタ管理は上長が行う。
- 日報は (`sales_staff_id`, `report_date`) で一意。重複は `409 DUPLICATE_REPORT_DATE`。
- 状態は `DRAFT` → `SUBMITTED` の一方向のみ。戻すと `409 INVALID_STATUS`。提出済みでも本人は編集でき、`submitted_at` は最初の提出日時のまま。
- 入力チェックは提出時だけ厳しくなる（下書き保存はほぼチェックなし）。
- 閲覧範囲：営業は自分の日報（下書き含む）だけ、上長は全員の提出済みだけ。見えない日報は 403 ではなく 404 を返す。ただし日報の更新（R-04）は例外で、本人以外は 403。
- 一覧 API で `SALES` が `salesStaffId` や `includeInactive` を指定しても無視する（エラーにしない）。
- 訪問記録は更新時に全件置き換え、送られた順に `sort_order` を振り直す。
- 訪問記録の顧客は有効な顧客に限る。ただし日報の更新時は、`visits[].id` で既にある行を指定し、その顧客を変えないなら無効でも可。
- 削除 API・削除ボタンは作らない。マスタは `is_active` で無効化する（無効な顧客も過去の日報には表示される）。
- ログイン失敗の理由（パスワード誤り／未登録／無効）は区別せず `401 LOGIN_FAILED` を返す。
- メールアドレスは小文字にそろえて保存・照合する。上長が自分自身を無効にする・営業に変えるのは `409 CANNOT_MODIFY_SELF`、有効な上長が0人になる変更は `409 LAST_MANAGER`。無効にされた人は次のリクエストから 401。
- 「当日」「7日前」などの日付は日本時間（Asia/Tokyo）で決める。日付は `YYYY-MM-DD` の文字列のまま扱い、`Date` に変換して保存しない（1日ずれるため）。未来の日付の日報は作れない。
