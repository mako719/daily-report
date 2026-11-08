# 営業日報システム API設計書（叩き台）

※【想定】は確認前の仮決め。合意したら【想定】を外す。
※ 要件定義・ER図は `sales-daily-report-requirements.md`、画面は `sales-daily-report-screens.md` を参照。

## 1. 共通仕様

| 項目 | 内容 |
|---|---|
| 形式 | REST / JSON（UTF-8） |
| ベースURL | `/api` |
| 認証 | 【想定】メールアドレス＋パスワードでログインし、セッション（Cookie）で認証する |
| 項目名 | camelCase |
| 日付・時刻 | 日付 `YYYY-MM-DD`、時刻 `HH:mm`、日時 ISO 8601（`2026-11-08T18:30:00+09:00`） |
| ロール | `SALES`（営業）／`MANAGER`（上長） |

### 1.1 ステータスコード

| コード | 意味 | 使う場面 |
|---|---|---|
| 200 | OK | 取得・更新の成功 |
| 201 | Created | 登録の成功 |
| 204 | No Content | ログアウトなど、返す内容がない成功 |
| 400 | Bad Request | 入力チェックエラー |
| 401 | Unauthorized | 未ログイン、ログイン失敗 |
| 403 | Forbidden | 権限がない操作 |
| 404 | Not Found | 対象がない、または見る権限がない |
| 409 | Conflict | 重複（同じ日付の日報、同じメールアドレス）、状態の矛盾 |

### 1.2 エラーレスポンス

```json
{
  "code": "VALIDATION_ERROR",
  "message": "入力内容に誤りがあります",
  "details": [
    { "field": "visits", "message": "訪問記録を1件以上入力してください" }
  ]
}
```

| code | ステータス | 説明 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | 入力チェックエラー。`details` に項目ごとの内容 |
| `UNAUTHORIZED` | 401 | 未ログイン |
| `LOGIN_FAILED` | 401 | メールアドレスまたはパスワードが違う |
| `FORBIDDEN` | 403 | 権限がない |
| `NOT_FOUND` | 404 | 対象がない |
| `DUPLICATE_REPORT_DATE` | 409 | 同じ日付の日報が既にある |
| `DUPLICATE_EMAIL` | 409 | メールアドレスが登録済み |
| `INVALID_STATUS` | 409 | 提出済みの日報を下書きに戻そうとした |

### 1.3 ページング（一覧API共通）【想定】

リクエスト：`page`（0始まり、初期値 0）、`size`（初期値 20、最大 100）

```json
{
  "items": [ ],
  "page": 0,
  "size": 20,
  "totalElements": 35
}
```

---

## 2. API一覧

| No | メソッド | パス | 概要 | 利用者 | 画面 |
|---|---|---|---|---|---|
| A-01 | POST | `/api/auth/login` | ログイン | 全員 | SCR-01 |
| A-02 | POST | `/api/auth/logout` | ログアウト | 全員 | 共通 |
| A-03 | GET | `/api/auth/me` | ログイン中のユーザー情報 | 全員 | 共通 |
| R-01 | GET | `/api/daily-reports` | 日報の検索 | 営業・上長 | SCR-02 |
| R-02 | GET | `/api/daily-reports/{id}` | 日報の詳細（訪問記録・コメント付き） | 営業・上長 | SCR-03, 04 |
| R-03 | POST | `/api/daily-reports` | 日報の作成 | 営業 | SCR-03 |
| R-04 | PUT | `/api/daily-reports/{id}` | 日報の更新 | 営業（本人） | SCR-03 |
| C-01 | POST | `/api/daily-reports/{id}/comments` | コメントの登録 | 上長 | SCR-04 |
| M-01 | GET | `/api/customers` | 顧客の検索 | 営業・上長 | SCR-03, 05 |
| M-02 | GET | `/api/customers/{id}` | 顧客の取得 | 上長 | SCR-06 |
| M-03 | POST | `/api/customers` | 顧客の登録 | 上長 | SCR-06 |
| M-04 | PUT | `/api/customers/{id}` | 顧客の更新 | 上長 | SCR-06 |
| M-05 | GET | `/api/sales-staff` | 営業の検索 | 上長 | SCR-02, 07 |
| M-06 | GET | `/api/sales-staff/{id}` | 営業の取得 | 上長 | SCR-08 |
| M-07 | POST | `/api/sales-staff` | 営業の登録 | 上長 | SCR-08 |
| M-08 | PUT | `/api/sales-staff/{id}` | 営業の更新 | 上長 | SCR-08 |

削除APIは作らない。マスタは `isActive: false` で無効にする。

---

## 3. 認証

### A-01 ログイン `POST /api/auth/login`

リクエスト
```json
{ "email": "suzuki@example.com", "password": "********" }
```

レスポンス `200`
```json
{ "id": 2, "name": "鈴木", "email": "suzuki@example.com", "role": "SALES" }
```

- 失敗した場合、または無効（`isActive: false`）の営業の場合は `401 LOGIN_FAILED`。どちらの理由かは返さない。

### A-02 ログアウト `POST /api/auth/logout`

レスポンス `204`

### A-03 ログイン中のユーザー `GET /api/auth/me`

レスポンス `200`：A-01 と同じ形式。未ログインなら `401`。

---

## 4. 日報

### R-01 日報の検索 `GET /api/daily-reports`

| クエリ | 必須 | 説明 |
|---|---|---|
| `from` | − | 日付（開始）。省略時は7日前【想定】 |
| `to` | − | 日付（終了）。省略時は当日 |
| `salesStaffId` | − | 営業で絞り込む。`SALES` が指定しても無視し、自分の日報だけを返す |
| `customerId` | − | その顧客を訪問した日報に絞り込む |
| `page`, `size` | − | ページング |

レスポンス `200`（並び順：日付の新しい順）
```json
{
  "items": [
    {
      "id": 101,
      "reportDate": "2026-11-08",
      "salesStaff": { "id": 2, "name": "鈴木" },
      "status": "SUBMITTED",
      "visitCount": 3,
      "commentCount": 2
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1
}
```

**取得できる範囲**
- `SALES`：自分の日報（下書き・提出済み）
- `MANAGER`：全営業の**提出済み**の日報

### R-02 日報の詳細 `GET /api/daily-reports/{id}`

レスポンス `200`
```json
{
  "id": 101,
  "reportDate": "2026-11-08",
  "salesStaff": { "id": 2, "name": "鈴木" },
  "status": "SUBMITTED",
  "submittedAt": "2026-11-08T18:00:00+09:00",
  "problem": "B工業の値引き要望にどこまで応じるか相談したい",
  "plan": "A商事へ見積もり送付、C物産へ初回訪問",
  "visits": [
    {
      "id": 501,
      "visitedAt": "10:00",
      "customer": { "id": 10, "name": "A商事" },
      "content": "新商品の提案。好感触",
      "sortOrder": 1
    }
  ],
  "comments": [
    {
      "id": 901,
      "target": "PROBLEM",
      "commenter": { "id": 1, "name": "佐藤" },
      "body": "5%までなら可。明日相談しよう",
      "createdAt": "2026-11-08T18:30:00+09:00"
    }
  ],
  "createdAt": "2026-11-08T17:40:00+09:00",
  "updatedAt": "2026-11-08T18:00:00+09:00"
}
```

- `visits` は `sortOrder` 順、`comments` は古い順。
- 見る権限がない日報（他人の下書きなど）は `404`。

### R-03 日報の作成 `POST /api/daily-reports`

リクエスト
```json
{
  "reportDate": "2026-11-08",
  "status": "SUBMITTED",
  "problem": "B工業の値引き要望にどこまで応じるか相談したい",
  "plan": "A商事へ見積もり送付、C物産へ初回訪問",
  "visits": [
    { "visitedAt": "10:00", "customerId": 10, "content": "新商品の提案。好感触" },
    { "visitedAt": "14:00", "customerId": 11, "content": "見積もりの説明" }
  ]
}
```

レスポンス `201`：R-02 と同じ形式。`Location: /api/daily-reports/{id}`

| 項目 | 型 | 下書き時 | 提出時 | チェック |
|---|---|---|---|---|
| `reportDate` | date | 必須 | 必須 | 本人の同じ日付の日報があれば `409 DUPLICATE_REPORT_DATE` |
| `status` | string | 必須 | 必須 | `DRAFT` または `SUBMITTED` |
| `problem` | string | 任意 | 必須 | 2000文字以内【想定】 |
| `plan` | string | 任意 | 必須 | 2000文字以内【想定】 |
| `visits` | array | 任意 | 1件以上【想定】 | |
| `visits[].visitedAt` | time | 任意 | 任意 | `HH:mm` |
| `visits[].customerId` | number | 必須 | 必須 | 有効な顧客であること |
| `visits[].content` | string | 任意 | 必須 | 1000文字以内【想定】 |

- 作成者はログイン中のユーザー。`MANAGER` は `403`（上長は日報を書かない）。
- `visits` の並び順を `sortOrder` として保存する。
- `SUBMITTED` のとき `submittedAt` に現在日時を記録する。

### R-04 日報の更新 `PUT /api/daily-reports/{id}`

リクエスト：R-03 と同じ形式。訪問記録は**送られた内容で全件置き換える**。

レスポンス `200`：R-02 と同じ形式。

- 本人以外は `403`。
- 下書き → 提出済みへの変更は可。このとき `submittedAt` を記録する。
- 提出済み → 下書きへの変更は `409 INVALID_STATUS`。
- 提出済みのまま内容を修正することは可（`submittedAt` は最初の提出日時のまま）【想定】。

---

## 5. コメント

### C-01 コメントの登録 `POST /api/daily-reports/{id}/comments`

リクエスト
```json
{ "target": "PROBLEM", "body": "5%までなら可。明日相談しよう" }
```

レスポンス `201`
```json
{
  "id": 901,
  "target": "PROBLEM",
  "commenter": { "id": 1, "name": "佐藤" },
  "body": "5%までなら可。明日相談しよう",
  "createdAt": "2026-11-08T18:30:00+09:00"
}
```

| 項目 | 型 | 必須 | チェック |
|---|---|---|---|
| `target` | string | ○ | `PROBLEM` または `PLAN` |
| `body` | string | ○ | 1000文字以内【想定】 |

- `MANAGER` 以外は `403`。
- 下書きの日報には登録できない（`404`）。
- コメントの更新・削除APIは作らない【想定】。

---

## 6. 顧客マスタ

### M-01 顧客の検索 `GET /api/customers`

| クエリ | 必須 | 説明 |
|---|---|---|
| `name` | − | 顧客名の部分一致 |
| `includeInactive` | − | `true` で無効な顧客も含める。`SALES` は指定しても無視する |
| `page`, `size` | − | ページング |

レスポンス `200`
```json
{
  "items": [
    { "id": 10, "name": "A商事", "address": "東京都千代田区…", "phone": "03-0000-0000", "isActive": true }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1
}
```

- 日報作成画面のプルダウンにも使うため、`SALES` も呼び出せる（有効な顧客のみ）。

### M-02 顧客の取得 `GET /api/customers/{id}`

レスポンス `200`：M-01 の `items` の1件と同じ形式。

### M-03 顧客の登録 `POST /api/customers` ／ M-04 顧客の更新 `PUT /api/customers/{id}`

リクエスト
```json
{ "name": "A商事", "address": "東京都千代田区…", "phone": "03-0000-0000", "isActive": true }
```

レスポンス：登録は `201`、更新は `200`。M-02 と同じ形式。

| 項目 | 型 | 必須 | チェック |
|---|---|---|---|
| `name` | string | ○ | 100文字以内【想定】 |
| `address` | string | − | 200文字以内【想定】 |
| `phone` | string | − | 数字とハイフンのみ |
| `isActive` | boolean | ○ | |

---

## 7. 営業マスタ

### M-05 営業の検索 `GET /api/sales-staff`

| クエリ | 必須 | 説明 |
|---|---|---|
| `name` | − | 氏名の部分一致 |
| `includeInactive` | − | `true` で無効な営業も含める |
| `page`, `size` | − | ページング |

レスポンス `200`
```json
{
  "items": [
    { "id": 2, "name": "鈴木", "email": "suzuki@example.com", "department": "営業1課", "role": "SALES", "isActive": true }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1
}
```

### M-06 営業の取得 `GET /api/sales-staff/{id}`

レスポンス `200`：M-05 の `items` の1件と同じ形式。パスワードは返さない。

### M-07 営業の登録 `POST /api/sales-staff` ／ M-08 営業の更新 `PUT /api/sales-staff/{id}`

リクエスト
```json
{
  "name": "鈴木",
  "email": "suzuki@example.com",
  "department": "営業1課",
  "role": "SALES",
  "password": "********",
  "isActive": true
}
```

レスポンス：登録は `201`、更新は `200`。M-06 と同じ形式。

| 項目 | 型 | 必須 | チェック |
|---|---|---|---|
| `name` | string | ○ | 50文字以内【想定】 |
| `email` | string | ○ | メール形式。重複は `409 DUPLICATE_EMAIL` |
| `department` | string | − | 50文字以内【想定】 |
| `role` | string | ○ | `SALES` または `MANAGER` |
| `password` | string | 登録時○ | 8文字以上【想定】。更新時に省略したら変更しない |
| `isActive` | boolean | ○ | |

- 自分自身を無効にしたり、自分の `role` を `SALES` に変えたりはできない（`409`）【想定】。上長が1人もいなくなるのを防ぐため。
