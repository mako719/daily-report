# 営業日報システム 要件定義（叩き台）

※【想定】は確認前の仮決め。合意したら【想定】を外す。

## 1. 目的
- 営業担当者の日々の訪問活動を記録し、上長がタイムリーに状況を把握して助言できるようにする。
- 課題（Problem）と翌日の予定（Plan）を共有し、上長のコメントで営業活動の質を上げる。

## 2. 利用者
| ロール | できること |
|---|---|
| 営業 | 自分の日報を作成・編集・提出、上長のコメントを閲覧 |
| 上長 | 全営業の日報を閲覧し、Problem・Plan にコメント。顧客マスタ・営業マスタの登録・更新。日報は書かない |

【想定】上長も営業マスタに登録し、`role`（営業／上長）で区別する。上長と部下の対応は管理しない。

## 3. 機能要件
### 3.1 日報
- 営業は、1日につき1件の日報を作成する（同じ日の日報は2件作れない）。
- 日報には次の内容を書く。
  - 訪問記録（複数行）
  - Problem：今の課題や相談
  - Plan：明日やること
- 【想定】日報の状態は「下書き」「提出済み」の2つ。上長が見られるのは提出済みのものだけ。
- 【想定】提出後も、本人が修正できる。

### 3.2 訪問記録
- 1件の日報に、訪問記録を何行でも追加できる。
- 1行に書く内容：訪問した顧客（顧客マスタから選ぶ）、訪問内容。
- 【想定】訪問時刻は任意で入力できる。
- 同じ日に同じ顧客を複数回訪問した場合も、別の行として登録できる。

### 3.3 コメント
- 上長は、営業の日報の Problem と Plan に、それぞれコメントできる。
- 1つの Problem・Plan に、コメントを複数つけられる。
- 【想定】コメントするのは上長だけ。営業本人の返信機能は今回は作らない。

### 3.4 マスタ管理
- 顧客マスタ：顧客名、住所、電話番号
- 営業マスタ：氏名、メールアドレス、部署、ロール（営業／上長）、パスワード
- 【想定】削除はせず、「無効」にする（過去の日報から参照されているため）。

### 3.5 閲覧範囲
- 営業：自分の日報だけ
- 上長：【想定】全営業の日報
- 【想定】日付・営業担当者・顧客で日報を検索できる。

## 4. 今回の対象外【想定】
- 商談・売上の管理（SFA の機能）
- 営業本人の返信、コメントへの「いいね」などのリアクション
- 通知（メール・チャット）
- スマートフォン専用のアプリ

## 5. 非機能要件【想定】
- メールアドレスとパスワードでログインした人だけが使える。権限は上の「閲覧範囲」に従う。
- パスワードはハッシュ化して保存する。
- 社内の PC のブラウザから使う。

## 6. ER図

```mermaid
erDiagram
    SALES_STAFF ||--o{ DAILY_REPORT : "作成する"
    SALES_STAFF ||--o{ COMMENT : "コメントする"
    DAILY_REPORT ||--o{ VISIT_RECORD : "含む"
    CUSTOMER ||--o{ VISIT_RECORD : "訪問される"
    DAILY_REPORT ||--o{ COMMENT : "コメントされる"

    SALES_STAFF {
        bigint id PK
        varchar name "氏名"
        varchar email "メールアドレス(一意)"
        varchar password_hash "パスワード(ハッシュ)"
        varchar department "部署"
        varchar role "SALES/MANAGER"
        boolean is_active "有効フラグ"
    }

    CUSTOMER {
        bigint id PK
        varchar name "顧客名"
        varchar address "住所"
        varchar phone "電話番号"
        boolean is_active "有効フラグ"
    }

    DAILY_REPORT {
        bigint id PK
        bigint sales_staff_id FK "作成者"
        date report_date "日報日付"
        text problem "課題・相談"
        text plan "明日やること"
        varchar status "DRAFT/SUBMITTED"
        datetime submitted_at "提出日時"
        datetime created_at
        datetime updated_at
    }

    VISIT_RECORD {
        bigint id PK
        bigint daily_report_id FK
        bigint customer_id FK
        time visited_at "訪問時刻(任意)"
        text content "訪問内容"
        int sort_order "表示順"
    }

    COMMENT {
        bigint id PK
        bigint daily_report_id FK
        bigint commenter_id FK "コメントした上長"
        varchar target "PROBLEM/PLAN"
        text body "コメント本文"
        datetime created_at
    }
```

### 設計のポイント
- **日報は「1人1日1件」**：`DAILY_REPORT` の (`sales_staff_id`, `report_date`) に一意制約をつける。
- **訪問記録を別テーブルにする**：1日に何件訪問しても対応できるように、日報と1対多の関係にした。
- **上長は営業マスタの `role` で区別**：上長用のテーブルを別に作らず、営業マスタの `role` 列（SALES/MANAGER）で上長かどうかを判断する。上長と部下の対応は持たない。
- **コメントは1つのテーブルにまとめる**：`target` 列で、Problem と Plan のどちらへのコメントかを区別する。Problem 用と Plan 用でテーブルを分けるより、シンプルになる。

## 7. 決定事項
| No | 内容 | 理由 |
|---|---|---|
| 1 | ログインはメールアドレス＋パスワード。`SALES_STAFF.password_hash` を追加 | 社内 SSO の前提がないため、最小構成にした |
| 2 | マスタ管理は上長（`MANAGER`）が行う。「管理者」ロールは作らない | ロールを増やさずに済む小さな組織を想定 |
| 3 | 上長は日報を書かない | 日報は営業の活動報告であり、上長はコメントする側のため |
