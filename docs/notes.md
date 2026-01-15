# 開発前の準備

```bash
# Next.jsアプリ作成
$ docker compose run --rm app sh -c 'npx create-next-app . --typescript'

# package-lock.jsonからインストール
$ docker compose run --rm app sh -c 'npm ci'

# コンテナ起動
$ docker compose up

# 所有者と所有グループの変更
$ sudo chown -R $USER:$USER src/

# Dockerコンテナを再作成し、デタッチモードでバックグラウンド起動
$ docker compose up --build -d

# サービス'app'の稼働中のコンテナ内でbashシェルを実行
$ docker compose exec app bash

# Prisma CLIとPrisma Clientをインストール(Version6を使用)
$ npm install prisma@6 @prisma/client@6

# Prismaの設定ファイルを初期化
$ npx prisma init

# Prismaスキーマを強制的にデータベースに同期（開発環境向け）
$ npx prisma db push

# Prismaスキーマに基づきPrisma Clientを生成する。
$ npx prisma generate

# 以下を実行し、http://localhost:5555/にアクセスするとPrisma Studioが使える
$ npx prisma studio
```

# Git

```bash
# タグの作成
$ git tag v1.0.0

# タグの一覧表示
$ git tag

# ブランチの切り替え
$ git switch develop

# 既存のブランチを一時的に切り替える（チェックアウト）
$ git checkout <タグ名>

# 過去のタグから新しいブランチを作成する
$ git checkout -b <新しいブランチ名> <タグ名>

# ローカルブランチを安全に削除する
$ git branch -d <branch-name>
```

# その他

prisma/schema.prisma の定義

```text
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Todo {
  id    Int     @id @default(autoincrement())
  title String
}
```
