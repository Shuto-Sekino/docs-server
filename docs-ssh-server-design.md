# 独自ドキュメントSSHサーバー 設計書

## 概要

このドキュメントは、supabase-ssh と同じアーキテクチャを使って、**自分専用のドキュメントをSSH経由で提供するサーバー**を構築するための設計書です。

ユーザーは以下のようにドキュメントを参照できます：

```bash
# トピックを検索
ssh docs.example.com grep -rl 'authentication' /docs/

# ファイルを読む
ssh docs.example.com cat /docs/guides/getting-started.md

# インタラクティブシェル
ssh docs.example.com
```

---

## アーキテクチャ全体像

```
                          ┌─────────────────────────────────────┐
                          │           docs-ssh-server            │
                          │                                       │
  SSH Client ──:22──────► │  ssh.ts                              │
                          │   └─ just-bash (仮想Bash)            │
  HTTP Client ──:8080───► │  api.ts (REST + 静的ファイル配信)    │
                          │                                       │
  Prometheus ──:9091────► │  metrics.ts                          │
                          │                                       │
                          │  ┌─── VFS (/docs) ────────────────┐ │
                          │  │  ./docs/ ディレクトリをマウント  │ │
                          │  └────────────────────────────────┘ │
                          └─────────────────────────────────────┘
                                         │
                               Redis (Upstash) ← レート制限（任意）
```

---

## 技術スタック

| 役割 | ライブラリ | バージョン |
|------|-----------|-----------|
| SSH サーバー | `ssh2` | ^1.16.0 |
| 仮想 Bash エンジン | `just-bash` | ^2.11.15 |
| HTTP フレームワーク | `hono` + `@hono/node-server` | ^4.12.7 |
| レート制限 | `@upstash/ratelimit` + `@upstash/redis` | ^2.0.8 |
| メトリクス | `prom-client` | ^15.1.3 |
| テレメトリ | `@opentelemetry/*` | ^1.9.0 |
| 色付き出力 | `chalk` | ^5.4.1 |
| 言語 | TypeScript | ~5.9.0 |
| ランタイム | Node.js | 22 |

---

## ディレクトリ構成

```
my-docs-ssh/
├── src/
│   ├── server.ts              # エントリーポイント・起動処理
│   ├── ssh.ts                 # SSHサーバー実装
│   ├── api.ts                 # HTTP APIサーバー
│   ├── metrics.ts             # Prometheusメトリクス
│   ├── ratelimit.ts           # Redisレート制限
│   ├── telemetry.ts           # OpenTelemetry統合
│   ├── command-cache.ts       # LRUキャッシュ
│   └── shell/
│       ├── bash.ts            # 仮想Bash作成・VFSマウント  ← ここを主にカスタマイズ
│       ├── session.ts         # インタラクティブシェルREPL
│       ├── completion.ts      # タブ補完
│       └── extended-mountable-fs.ts  # ファイルシステム拡張
├── scripts/
│   └── generate-host-key.ts   # SSHホストキー生成
├── docs/                      # ← ドキュメントを配置するディレクトリ
├── package.json
├── tsconfig.json
└── Dockerfile
```

---

## カスタマイズポイント

### 1. ドキュメントの差し替え（最重要）

`src/shell/bash.ts` の `createBash()` 関数が仮想ファイルシステムを構成します。

```typescript
// src/shell/bash.ts

const DEFAULT_DOCS_DIR = resolve(process.env.DOCS_DIR ?? './docs')

export async function createBash(docsDir = DEFAULT_DOCS_DIR) {
  const fs = new ExtendedMountableFs({
    readOnly: true,
    initialFiles: {
      // ── ここに自分のメタファイルを定義 ──────────────────────────
      '/docs/AGENTS.md': MY_AGENTS_MD,   // AIエージェント向け説明
      '/docs/SKILL.md': MY_SKILL_MD,     // スキル定義
    },
    mounts: [
      {
        // ── ここにドキュメントをマウント ─────────────────────────
        mountPoint: '/docs',             // SSH上でのパス
        filesystem: new OverlayFs({
          root: docsDir,                 // ローカルのディレクトリ
          mountPoint: '/',
          readOnly: true,
        }),
      },
    ],
  })

  const bash = new Bash({
    fs,
    cwd: '/docs',                        // デフォルトのカレントディレクトリ
    env: {
      HOME: '/docs',
      // ── エイリアス定義 ───────────────────────────────────────
      BASH_ALIAS_ll: 'ls -alF',
      BASH_ALIAS_help: 'cat /docs/AGENTS.md',
    },
    defenseInDepth: true,
    executionLimits: EXECUTION_LIMITS,   // セキュリティ制限（変更不要）
  })

  await bash.exec('shopt -s expand_aliases')
  return { bash, fs }
}
```

**ドキュメントの配置例：**

```
docs/
├── guides/
│   ├── getting-started.md
│   ├── authentication.md
│   └── api-reference.md
├── tutorials/
│   └── quickstart.md
└── reference/
    └── config.md
```

---

### 2. バナーとプロンプトのカスタマイズ

`src/ssh.ts` でウェルカムバナーとシェルプロンプトを変更します。

```typescript
// src/ssh.ts

const BANNER =
  `My Docs SSH Server\r\n\r\n` +
  `Use bash commands to search and read documentation:\r\n\r\n` +
  `  grep -rl 'keyword' /docs/\r\n` +
  `  cat /docs/guides/getting-started.md\r\n\r\n`

// シェルセッション作成時
const shell = createShellSession({
  bash,
  input: channel,
  output: channel,
  terminal: hasPty,
  execTimeout,
  banner: BANNER,
  prompt: (cwd) => `${green(posix.basename(cwd))} $ `,  // プロンプト形式
  // ...
})
```

---

### 3. 認証の追加（オプション）

デフォルトでは認証なし（全接続を accept）です。パスワード認証や公開鍵認証を追加できます。

```typescript
// src/ssh.ts - authentication イベントハンドラ内

client.on('authentication', async (ctx) => {
  const proto = getProtocol(ctx)
  if (rejectIfAtCapacity(proto)) return
  if (rejectIfOverIpLimit(proto)) return
  if (await rejectIfRateLimited(proto)) return

  // ── パスワード認証を追加する場合 ───────────────────────────
  if (ctx.method === 'password') {
    if (ctx.password === process.env.SSH_PASSWORD) {
      ctx.accept()
    } else {
      ctx.reject(['password'])
    }
    return
  }

  // ── 公開鍵認証を追加する場合 ───────────────────────────────
  if (ctx.method === 'publickey') {
    // ctx.key.data, ctx.key.algo でキーを検証
    ctx.accept()
    return
  }

  // 認証不要（誰でも接続可能）にする場合はこのまま
  ctx.accept()
})
```

---

### 4. カスタムコマンドの追加（オプション）

`just-bash` の `defineCommand` で独自コマンドを実装できます。

```typescript
// src/shell/bash.ts

import { defineCommand } from 'just-bash'

// 例: バージョン情報を返すコマンド
const versionCommand = defineCommand('version', async () => ({
  stdout: 'My Docs SSH Server v1.0.0\n',
  stderr: '',
  exitCode: 0,
}))

// 例: ドキュメントのインデックスを返すコマンド
const indexCommand = defineCommand('index', async () => {
  // 任意のNode.jsコードを実行可能
  return {
    stdout: 'Available sections:\n  guides/\n  tutorials/\n  reference/\n',
    stderr: '',
    exitCode: 0,
  }
})

// Bashインスタンスに登録
const bash = new Bash({
  // ...
  customCommands: [versionCommand, indexCommand],
})
```

---

## 環境変数一覧

```env
# ── ネットワーク ──────────────────────────────────────────
PORT=22                          # SSH リッスンポート
METRICS_PORT=9091                # Prometheus メトリクスポート
API_PORT=8080                    # HTTP API ポート

# ── SSHホストキー ─────────────────────────────────────────
SSH_HOST_KEY=<PEM文字列>          # または
SSH_HOST_KEY_PATH=./ssh_host_key # ホストキーファイルパス

# ── ドキュメント ──────────────────────────────────────────
DOCS_DIR=./docs                  # ドキュメントディレクトリ
WEB_DIR=./web/out                # 静的ウェブファイル（任意）

# ── タイムアウト（ミリ秒）────────────────────────────────
IDLE_TIMEOUT=60000               # 無操作での切断
SESSION_TIMEOUT=600000           # セッション最大時間
EXEC_TIMEOUT=10000               # コマンド実行タイムアウト
DRAIN_TIMEOUT=15000              # シャットダウン待機時間

# ── 接続制限 ──────────────────────────────────────────────
MAX_CONNECTIONS=100              # 最大同時接続数
MAX_CONNECTIONS_PER_IP=10        # IP別最大同時接続数

# ── レート制限（Redis/Upstash、任意）────────────────────
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
RATE_LIMIT_MAX=30                # 接続数/ウィンドウ
RATE_LIMIT_WINDOW_SECONDS=60     # レート制限ウィンドウ

# ── キャッシュ ────────────────────────────────────────────
COMMAND_CACHE=true
COMMAND_CACHE_MAX_ENTRIES=1000
COMMAND_CACHE_MAX_OUTPUT_BYTES=524288  # 512KB

# ── テレメトリ（任意）────────────────────────────────────
LOGFLARE_SOURCE=
LOGFLARE_API_KEY=
OTEL_EXPORTER_OTLP_ENDPOINT=
OTEL_TRACE_SAMPLE_RATE=1.0

# ── その他 ────────────────────────────────────────────────
ENABLE_EXEC_API=false            # /api/exec エンドポイント
VERSION=1.0.0
WEB_ORIGIN=*                     # CORS 許可オリジン
```

---

## 起動フロー（server.ts）

```
main()
  │
  ├─ 1. initTelemetry()
  │      OpenTelemetry トレーシング初期化
  │
  ├─ 2. loadHostKey()
  │      SSH_HOST_KEY 環境変数 または SSH_HOST_KEY_PATH ファイルを読み込み
  │      SHA256 フィンガープリントをログ出力
  │
  ├─ 3. createRateLimiter()
  │      UPSTASH_REDIS_* が設定されていれば Redis レート制限を初期化
  │
  ├─ 4. new CommandCache()
  │      LRU キャッシュを初期化（COMMAND_CACHE=false で無効化可能）
  │
  ├─ 5. createSSHServer({ hostKey, port, ... })
  │      ssh2 サーバーインスタンスを作成
  │
  ├─ 6. srv.listen()
  │      ポート 22 でリッスン開始
  │
  ├─ 7. serve(metricsApp, METRICS_PORT)
  │      /metrics、/healthz を :9091 で提供
  │
  ├─ 8. serve(apiApp, API_PORT)
  │      /api/exec、静的ファイルを :8080 で提供
  │
  └─ 9. SIGTERM/SIGINT ハンドラ登録
         グレースフルシャットダウン
```

---

## クライアント接続フロー（ssh.ts）

```
TCP 接続
  │
  ├─ handshake イベント
  │    暗号化方式の合意（curve25519-sha256 優先）
  │
  ├─ authentication イベント
  │    ├─ 1. 容量チェック（probabilistic drop）
  │    │      activeClients < softLimit(80)  → OK
  │    │      activeClients >= hardLimit(100) → 100% 拒否
  │    │      中間 → 線形確率で拒否
  │    ├─ 2. IP別同時接続チェック（maxConnectionsPerIp=10）
  │    ├─ 3. Redis レート制限チェック（30接続/60秒/IP）
  │    └─ 全パス → ctx.accept()
  │
  └─ ready イベント → session イベント
       │
       ├─ exec モード（ssh host <command>）
       │    ├─ キャッシュ確認（CommandCache.get）
       │    ├─ ヒット → 即座に返す
       │    └─ ミス → createBash() → bash.exec() → キャッシュ保存
       │
       └─ shell モード（ssh host）
            ├─ createBash() でBashインスタンス作成
            ├─ createShellSession() でREPLループ開始
            ├─ バナー表示
            ├─ タブ補完有効
            └─ exit/Ctrl+D で終了
```

---

## セキュリティ設計

### just-bash の実行制限

コマンドはOSシェルではなくNode.js内の仮想Bashで実行されます。外部プロセスへのアクセスは完全に遮断されています。

```typescript
const EXECUTION_LIMITS = {
  maxCommandCount: 1000,       // コマンド実行回数
  maxLoopIterations: 1000,     // ループ反復数
  maxCallDepth: 50,            // 関数呼び出し深度
  maxOutputSize: 1024 * 1024,  // 出力サイズ 1MB
  maxStringLength: 1024 * 1024,
  // ...
}
```

### 接続制限（3段階）

| 段階 | 種類 | デフォルト設定 | 説明 |
|------|------|--------------|------|
| 1 | 容量制限（確率的） | soft=80, hard=100 | サーバー全体の同時接続数 |
| 2 | IP別同時接続 | 10接続/IP | 単一IPからの並列接続 |
| 3 | Redis レート制限 | 30接続/60秒/IP | 短時間での大量接続 |

### 仮想ファイルシステム

- ドキュメントは読み取り専用（`readOnly: true`）でマウント
- VFS の外（ホストのファイルシステム）へのアクセスは不可能
- ネットワークアクセスも不可能

---

## ホストキーの生成

```bash
# 開発用（ファイルに書き出し）
pnpm run generate:host-key:local

# 本番用（標準出力 → シークレット登録）
SSH_HOST_KEY="$(pnpm run --silent generate:host-key)"
```

`scripts/generate-host-key.ts` の実装：

```typescript
import { generateKeyPairSync } from 'node:crypto'

const { privateKey } = generateKeyPairSync('ed25519', {
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

process.stdout.write(privateKey)
```

---

## Dockerfile

```dockerfile
# Stage 1: ビルダー（TypeScript コンパイル + native binding）
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ssh2 の native binding をコンパイル
RUN cd node_modules/.pnpm/ssh2@*/node_modules/ssh2 && node install.js || true

COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# Stage 2: 実行環境
FROM node:22-alpine
WORKDIR /app

RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist
COPY docs ./docs

EXPOSE 22 8080 9091

CMD ["node", "dist/server.js"]
```

---

## デプロイ手順（Fly.io）

```bash
# 1. アプリ作成
fly apps create my-docs-ssh

# 2. IPv4 割り当て（SSH には静的 IPv4 が必要）
fly ips allocate-v4 --app my-docs-ssh
fly ips allocate-v6 --app my-docs-ssh

# 3. ホストキーをシークレットとして登録
fly secrets set SSH_HOST_KEY="$(node scripts/generate-host-key.js)" \
  --app my-docs-ssh

# 4. （任意）レート制限用 Redis
fly redis create --app my-docs-ssh
fly secrets set \
  UPSTASH_REDIS_REST_URL="<url>" \
  UPSTASH_REDIS_REST_TOKEN="<token>" \
  --app my-docs-ssh

# 5. デプロイ
fly deploy --app my-docs-ssh
```

`fly.toml` の設定例：

```toml
app = "my-docs-ssh"

[[services]]
  internal_port = 22
  protocol = "tcp"

  [[services.ports]]
    port = 22

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443
```

---

## 開発・テスト

```bash
# 依存関係インストール
pnpm install

# ドキュメントディレクトリ準備
mkdir -p docs
# docs/ に自分のドキュメントを配置

# ホストキー生成
pnpm run generate:host-key:local

# 開発サーバー起動（ホットリロード）
pnpm dev

# 別ターミナルで動作確認
ssh -p 22 -o StrictHostKeyChecking=no localhost grep -rl 'keyword' /docs/
ssh -p 22 -o StrictHostKeyChecking=no localhost  # インタラクティブシェル
```

---

## 実装チェックリスト

- [ ] `docs/` ディレクトリにドキュメント（Markdownファイル）を配置
- [ ] `src/shell/bash.ts` のパス・エイリアス・メタファイルをカスタマイズ
- [ ] `src/ssh.ts` のバナーテキストをカスタマイズ
- [ ] `scripts/generate-host-key.ts` でホストキーを生成
- [ ] 環境変数を `.env.local` に設定
- [ ] `pnpm dev` で動作確認
- [ ] 認証が必要なら `authentication` イベントハンドラに実装
- [ ] Dockerfile をビルドして本番動作確認
- [ ] Fly.io または任意のプラットフォームにデプロイ