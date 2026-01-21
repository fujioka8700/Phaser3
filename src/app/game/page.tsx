"use client";

import { useEffect, useRef } from "react";

const isDebug = true; // 開発時は true にする

export default function GamePage() {
  const gameRef = useRef<HTMLDivElement>(null);
  const phaserGameRef = useRef<any>(null);

  useEffect(() => {
    if (!gameRef.current) {
      return;
    }

    // 既存のゲームインスタンスがある場合は破棄
    if (phaserGameRef.current) {
      try {
        phaserGameRef.current.destroy(true);
      } catch (error) {
        console.warn("Error destroying Phaser game:", error);
      }
      phaserGameRef.current = null;
    }

    // DOMを完全にクリア（すべてのCanvas要素を削除）
    if (gameRef.current) {
      while (gameRef.current.firstChild) {
        gameRef.current.removeChild(gameRef.current.firstChild);
      }
      gameRef.current.innerHTML = "";
    }

    // Phaser3を動的にインポート
    import("phaser").then((Phaser) => {
      // タイトルシーン
      class TitleScene extends Phaser.Scene {
        constructor() {
          super({ key: "TitleScene" });
        }

        create() {
          // 背景色を設定
          this.cameras.main.setBackgroundColor("#3c3e50");

          // タイトルテキスト
          this.add
            .text(
              this.cameras.main.width / 2,
              this.cameras.main.height / 2 - 30,
              "ワンクリックゲーム",
              {
                fontSize: "24px",
                color: "#ecf0f1",
                fontFamily: "Arial",
              }
            )
            .setOrigin(0.5);

          // クリックして開始のテキスト
          this.add
            .text(
              this.cameras.main.width / 2,
              this.cameras.main.height / 2 + 30,
              "クリックして開始",
              {
                fontSize: "16px",
                color: "#95a5a6",
                fontFamily: "Arial",
              }
            )
            .setOrigin(0.5);

          // クリックでゲームシーンに遷移
          this.input.once("pointerdown", () => {
            this.scene.start("MainScene");
          });
        }
      }

      // 本番ゲームシーン
      class MainScene extends Phaser.Scene {
        // プロパティの型定義
        private player!: Phaser.Physics.Arcade.Sprite;
        private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
        private controls = {
          left: false,
          right: false,
          up: false,
        };
        private isMoving = false;
        private wasJumpPressed = false; // 前フレームでジャンプボタンが押されていたか
        // マリオ風の動きのパラメータ
        private readonly maxSpeed = 160; // 最大速度
        private readonly acceleration = 800; // 加速度
        private readonly deceleration = 1000; // 減速率（摩擦）
        private readonly airControl = 0.5; // 空中での制御性（0.0-1.0）
        private map!: Phaser.Tilemaps.Tilemap;
        private tileset!: Phaser.Tilemaps.Tileset;
        private backgroundLayer!: Phaser.Tilemaps.TilemapLayer;
        private platformLayer!: Phaser.Tilemaps.TilemapLayer;

        constructor() {
          super({ key: "MainScene" });
        }

        preload(): void {
          // スプライトシートの読み込み（画像の並びから、1マスを 32x48 と定義）
          this.load.spritesheet("player", "/assets/Player.png", {
            frameWidth: 48,
            frameHeight: 48,
          });

          // タイルマップの読み込み
          this.load.tilemapTiledJSON("tilemap", "/assets/maps/tilemap.json");
          this.load.image("tileset", "/assets/maps/tilesheet.png");
        }

        create(): void {
          const mainText = this.add.text(5, 5, "本番画面", {
            color: "#00ff00",
            fontSize: "15px",
          });
          mainText.setPadding(0, 3, 0, 0);

          // 本番環境ではデバッグ表示を無効化
          this.physics.world.drawDebug = false;

          // 1. タイルマップの作成
          this.map = this.make.tilemap({ key: "tilemap" });
          const tileset = this.map.addTilesetImage("tilesheet", "tileset");
          if (!tileset) {
            console.error("Failed to load tileset");
            return;
          }
          this.tileset = tileset;

          // 2. レイヤーの作成
          const backgroundLayer = this.map.createLayer("background", this.tileset, 0, 0);
          const platformLayer = this.map.createLayer("platform", this.tileset, 0, 0);
          if (!backgroundLayer || !platformLayer) {
            console.error("Failed to create tilemap layers");
            return;
          }
          this.backgroundLayer = backgroundLayer;
          this.platformLayer = platformLayer;

          // 3. 衝突判定の設定（collidesプロパティを持つタイル）
          this.platformLayer.setCollisionByProperty({ collides: true });

          // 3-1. oneWayプロパティを持つタイルの設定（下からの衝突を無視）
          this.platformLayer.forEachTile((tile) => {
            if (tile.properties && tile.properties.oneWay) {
              // 下からの衝突を無視するように設定（左, 右, 上, 下）
              tile.setCollision(false, false, true, false);
              // 重要：タイル自体の衝突判定（faces）を更新
              tile.collideDown = false;
              tile.collideLeft = false;
              tile.collideRight = false;
            }
          });

          // 4. プレイヤーの開始位置をobjectLayerから取得
          const objectLayer = this.map.getObjectLayer("objectsLayer");
          let playerStartX = 48;
          let playerStartY = 48;
          if (objectLayer) {
            const playerObj = objectLayer.objects.find((obj) => obj.name === "player");
            if (playerObj && playerObj.x !== undefined && playerObj.y !== undefined) {
              playerStartX = playerObj.x;
              playerStartY = playerObj.y;
              console.log(`Player start position from tilemap: x=${playerStartX}, y=${playerStartY}`);
            }
          } else {
            console.warn("objectsLayer not found in tilemap");
          }

          // 5. プレイヤーの生成（スプライトシートのフレーム0を使用）
          this.player = this.physics.add.sprite(playerStartX, playerStartY, "player", 0);
          // 表示サイズはデフォルト（48×48px）のまま

          // 物理ボディのサイズとオフセットを調整（透過部分を除外）
          const actualWidth = 16; // 実際のキャラクター幅
          const actualHeight = 16; // 実際のキャラクター高さ
          const frameWidth = 48;
          const frameHeight = 48;

          // オフセット = (フレームサイズ - 実際のサイズ) / 2
          // スプライトの原点が中心(0.5, 0.5)の場合、オフセットは中心からの相対位置
          const offsetX = (frameWidth - actualWidth) / 2;
          const offsetY = (frameHeight - actualHeight) / 2;

          const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
          playerBody.setSize(actualWidth, actualHeight);
          playerBody.setOffset(offsetX, offsetY);
          playerBody.setCollideWorldBounds(true);

          // 6. プレイヤーとタイルレイヤーの衝突判定を設定（oneWayタイルの特別処理）
          this.physics.add.collider(
            this.player,
            this.platformLayer,
            undefined, // 衝突コールバック（使用しない）
            (playerObj, tileObj) => {
              // processCallback: 衝突を処理する前に呼ばれるコールバック
              const player = playerObj as Phaser.Physics.Arcade.Sprite;
              const tile = tileObj as Phaser.Tilemaps.Tile;
              const playerBody = player.body as Phaser.Physics.Arcade.Body;

              if (tile.properties && tile.properties.oneWay !== true) {
                return true;
              }

              // 1. 上昇中は絶対にすり抜ける
              if (playerBody.velocity.y < 0) {
                return false;
              }

              // 2. 落下中の貫通防止ロジック
              // プレイヤーの足元の位置（今）
              const playerBottom = playerBody.bottom;
              // プレイヤーの足元の位置（1フレーム前）
              const prevPlayerBottom = playerBody.prev.y + playerBody.height;
              // タイルの上面
              const tileTop = tile.pixelY;

              // 「1フレーム前にタイルの上にいた」または「今タイルの上端より少し上にいる」なら着地
              // 許容範囲（tolerance）を少し広めに取る（例: 8px）のがコツです
              if (prevPlayerBottom <= tileTop + 2 || playerBottom <= tileTop + 8) {
                return true;
              }

              return false;
            }
          );

          // 3. アニメーションの作成
          // 待機アニメーション（1枚目から4枚目: フレーム0-3）
          this.anims.create({
            key: "idle",
            frames: this.anims.generateFrameNumbers("player", {
              start: 0,
              end: 3,
            }),
            frameRate: 8,
            repeat: -1,
          });

          // 2行目: 歩行 (4-7番)
          this.anims.create({
            key: "walk",
            frames: this.anims.generateFrameNumbers("player", {
              start: 4,
              end: 7,
            }),
            frameRate: 10,
            repeat: -1,
          });

          // ジャンプアニメーション（上昇中: 9枚目）
          this.anims.create({
            key: "jump",
            frames: [{ key: "player", frame: 8 }],
            frameRate: 1,
          });

          // 落下アニメーション（落下中: 10枚目）
          this.anims.create({
            key: "fall",
            frames: [{ key: "player", frame: 9 }],
            frameRate: 1,
          });

          // 4. 入力系の初期化
          if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
          }

          // 5. バーチャルコントローラーの配置
          this.createMobileControls();

          // スペースキーでDevSceneへ切り替え
          if (this.input.keyboard) {
            this.input.keyboard.once("keydown-SPACE", () => {
              this.scene.start("DevScene");
            });
          }
        }

        private createMobileControls(): void {
          const centerY = 500;
          const btnStyle: Phaser.Types.GameObjects.Text.TextStyle = {
            fontSize: "24px",
            backgroundColor: "#333",
            padding: { x: 20, y: 20 },
            fixedWidth: 100,
            align: "center",
          };

          // 各ボタンの生成とインタラクション設定
          this.add
            .text(10, centerY, "LEFT", btnStyle)
            .setInteractive()
            .on("pointerdown", () => (this.controls.left = true))
            .on("pointerup", () => (this.controls.left = false))
            .on("pointerout", () => (this.controls.left = false));

          this.add
            .text(120, centerY, "RIGHT", btnStyle)
            .setInteractive()
            .on("pointerdown", () => (this.controls.right = true))
            .on("pointerup", () => (this.controls.right = false))
            .on("pointerout", () => (this.controls.right = false));

          this.add
            .text(250, centerY, "JUMP", btnStyle)
            .setInteractive()
            .on("pointerdown", () => (this.controls.up = true))
            .on("pointerup", () => (this.controls.up = false));
        }

        update(): void {
          if (!this.player || !this.player.body) {
            return;
          }

          const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
          const onFloor = playerBody.touching.down || playerBody.blocked.down;
          const deltaTime = this.game.loop.delta / 1000; // 秒単位のデルタタイム

          // ジャンプ開始（地面にいる時のみ）
          const jumpInput = this.cursors.up.isDown || this.controls.up;
          const jumpJustPressed = (jumpInput && !this.wasJumpPressed) && onFloor;

          if (jumpJustPressed) {
            // ジャンプボタンが押された瞬間、最大ジャンプの初速を設定
            playerBody.setVelocityY(-350); // 最大ジャンプの初速（元のジャンプの高さ）
            this.player.play("jump", true);
            this.controls.up = false; // ボタンでの連続ジャンプを防止
          }

          // 上昇中にボタンが離されたら、上向きの速度を急ブレーキさせる
          if (!jumpInput && this.wasJumpPressed && playerBody.velocity.y < 0 && !onFloor) {
            // 現在の速度を20%にする（または 0 に近づける）
            playerBody.setVelocityY(playerBody.velocity.y * 0.2);
          }

          // 前フレームの状態を更新
          this.wasJumpPressed = jumpInput;

          // マリオ風の左右移動（加速度ベース）
          const leftInput = this.cursors.left.isDown || this.controls.left;
          const rightInput = this.cursors.right.isDown || this.controls.right;
          const currentVelocityX = playerBody.velocity.x;

          if (leftInput) {
            // 左入力
            const controlFactor = onFloor ? 1.0 : this.airControl;
            const targetVelocity = -this.maxSpeed * controlFactor;
            
            if (currentVelocityX > targetVelocity) {
              // 減速または加速
              const accel = onFloor ? this.acceleration : this.acceleration * this.airControl;
              const newVelocity = Math.max(
                currentVelocityX - accel * deltaTime,
                targetVelocity
              );
              playerBody.setVelocityX(newVelocity);
            }
            this.player.setFlipX(true);
            this.isMoving = true;
            if (onFloor) {
              this.player.play("walk", true);
            } else {
              // 空中にいる場合、velocity.yに基づいてアニメーションを選択
              if (playerBody.velocity.y < 0) {
                this.player.play("jump", true); // ジャンプ中（上昇中）
              } else {
                this.player.play("fall", true); // 落下中
              }
            }
          } else if (rightInput) {
            // 右入力
            const controlFactor = onFloor ? 1.0 : this.airControl;
            const targetVelocity = this.maxSpeed * controlFactor;
            
            if (currentVelocityX < targetVelocity) {
              // 減速または加速
              const accel = onFloor ? this.acceleration : this.acceleration * this.airControl;
              const newVelocity = Math.min(
                currentVelocityX + accel * deltaTime,
                targetVelocity
              );
              playerBody.setVelocityX(newVelocity);
            }
            this.player.setFlipX(false);
            this.isMoving = true;
            if (onFloor) {
              this.player.play("walk", true);
            } else {
              // 空中にいる場合、velocity.yに基づいてアニメーションを選択
              if (playerBody.velocity.y < 0) {
                this.player.play("jump", true); // ジャンプ中（上昇中）
              } else {
                this.player.play("fall", true); // 落下中
              }
            }
          } else {
            // 入力がない場合
            if (onFloor) {
              // 地面にいる時は減速（摩擦）
              if (Math.abs(currentVelocityX) > 10) {
                // 速度が大きい場合は減速
                const decel = this.deceleration * deltaTime;
                if (currentVelocityX > 0) {
                  playerBody.setVelocityX(Math.max(0, currentVelocityX - decel));
                } else {
                  playerBody.setVelocityX(Math.min(0, currentVelocityX + decel));
                }
                this.isMoving = true;
                this.player.play("walk", true);
              } else {
                // 速度が小さい場合は停止
                playerBody.setVelocityX(0);
                this.isMoving = false;
                this.player.play("idle", true);
              }
            } else {
              // ジャンプ中（空中）は、現在のX方向の速度を維持（慣性を維持）
              // velocity.yに基づいてアニメーションを選択
              if (playerBody.velocity.y < 0) {
                this.player.play("jump", true); // ジャンプ中（上昇中）
              } else {
                this.player.play("fall", true); // 落下中
              }
            }
          }
        }
      }

      // 開発ゲームシーン
      class DevScene extends Phaser.Scene {
        // プロパティの型定義
        private player!: Phaser.Physics.Arcade.Sprite;
        private playerBody!: Phaser.Physics.Arcade.Body;
        private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
        private controls = {
          left: false,
          right: false,
          up: false,
        };
        private isMoving = false;
        private wasJumpPressed = false; // 前フレームでジャンプボタンが押されていたか
        private map!: Phaser.Tilemaps.Tilemap;
        // マリオ風の動きのパラメータ
        private readonly maxSpeed = 160; // 最大速度
        private readonly acceleration = 800; // 加速度
        private readonly deceleration = 1000; // 減速率（摩擦）
        private readonly airControl = 0.5; // 空中での制御性（0.0-1.0）
        private tileset!: Phaser.Tilemaps.Tileset;
        private backgroundLayer!: Phaser.Tilemaps.TilemapLayer;
        private platformLayer!: Phaser.Tilemaps.TilemapLayer;

        constructor() {
          super({ key: "DevScene" });
        }

        preload(): void {
          // スプライトシートの読み込み（MainSceneと同じ）
          this.load.spritesheet("player", "/assets/Player.png", {
            frameWidth: 48,
            frameHeight: 48,
          });

          // タイルマップの読み込み
          this.load.tilemapTiledJSON("tilemap", "/assets/maps/tilemap.json");
          this.load.image("tileset", "/assets/maps/tilesheet.png");
        }

        create() {
          const devText = this.add.text(5, 5, "開発画面", {
            color: "#ff0000",
            fontSize: "15px",
          });
          devText.setPadding(0, 3, 0, 0);

          // 1. タイルマップの作成
          this.map = this.make.tilemap({ key: "tilemap" });
          const tileset = this.map.addTilesetImage("tilesheet", "tileset");
          if (!tileset) {
            console.error("Failed to load tileset");
            return;
          }
          this.tileset = tileset;

          // 2. レイヤーの作成
          const backgroundLayer = this.map.createLayer("background", this.tileset, 0, 0);
          const platformLayer = this.map.createLayer("platform", this.tileset, 0, 0);
          if (!backgroundLayer || !platformLayer) {
            console.error("Failed to create tilemap layers");
            return;
          }
          this.backgroundLayer = backgroundLayer;
          this.platformLayer = platformLayer;

          // 3. 衝突判定の設定（collidesプロパティを持つタイル）
          this.platformLayer.setCollisionByProperty({ collides: true });

          // 3-1. oneWayプロパティを持つタイルの設定（下からの衝突を無視）
          this.platformLayer.forEachTile((tile) => {
            if (tile.properties && tile.properties.oneWay) {
              // 下からの衝突を無視するように設定（左, 右, 上, 下）
              tile.setCollision(false, false, true, false);
              // 重要：タイル自体の衝突判定（faces）を更新
              tile.collideDown = false;
              tile.collideLeft = false;
              tile.collideRight = false;
            }
          });

          // 4. プレイヤーの開始位置をobjectLayerから取得
          const objectLayer = this.map.getObjectLayer("objectsLayer");
          let playerStartX = 48;
          let playerStartY = 48;
          if (objectLayer) {
            const playerObj = objectLayer.objects.find((obj) => obj.name === "player");
            if (playerObj && playerObj.x !== undefined && playerObj.y !== undefined) {
              playerStartX = playerObj.x;
              playerStartY = playerObj.y;
              console.log(`Player start position from tilemap: x=${playerStartX}, y=${playerStartY}`);
            }
          } else {
            console.warn("objectsLayer not found in tilemap");
          }

          // 5. プレイヤーの生成（スプライトシートのフレーム0を使用）
          this.player = this.physics.add.sprite(playerStartX, playerStartY, "player", 0);
          // 表示サイズはデフォルト（48×48px）のまま

          // 物理ボディのサイズとオフセットを調整（透過部分を除外）
          const actualWidth = 16; // 実際のキャラクター幅
          const actualHeight = 16; // 実際のキャラクター高さ
          const frameWidth = 48;
          const frameHeight = 48;

          // オフセット = (フレームサイズ - 実際のサイズ) / 2
          // スプライトの原点が中心(0.5, 0.5)の場合、オフセットは中心からの相対位置
          const offsetX = (frameWidth - actualWidth) / 2;
          const offsetY = (frameHeight - actualHeight) / 2;

          this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
          this.playerBody.setSize(actualWidth, actualHeight);
          this.playerBody.setOffset(offsetX, offsetY);
          this.playerBody.setCollideWorldBounds(true);

          // 6. プレイヤーとタイルレイヤーの衝突判定を設定（oneWayタイルの特別処理）
          this.physics.add.collider(
            this.player,
            this.platformLayer,
            undefined, // 衝突コールバック（使用しない）
            (playerObj, tileObj) => {
              // processCallback: 衝突を処理する前に呼ばれるコールバック
              const player = playerObj as Phaser.Physics.Arcade.Sprite;
              const tile = tileObj as Phaser.Tilemaps.Tile;
              const playerBody = player.body as Phaser.Physics.Arcade.Body;

              if (tile.properties && tile.properties.oneWay !== true) {
                return true;
              }

              // 1. 上昇中は絶対にすり抜ける
              if (playerBody.velocity.y < 0) {
                return false;
              }

              // 2. 落下中の貫通防止ロジック
              // プレイヤーの足元の位置（今）
              const playerBottom = playerBody.bottom;
              // プレイヤーの足元の位置（1フレーム前）
              const prevPlayerBottom = playerBody.prev.y + playerBody.height;
              // タイルの上面
              const tileTop = tile.pixelY;

              // 「1フレーム前にタイルの上にいた」または「今タイルの上端より少し上にいる」なら着地
              // 許容範囲（tolerance）を少し広めに取る（例: 8px）のがコツです
              if (prevPlayerBottom <= tileTop + 2 || playerBottom <= tileTop + 8) {
                return true;
              }

              return false;
            }
          );

          // 3. アニメーションの作成
          // 待機アニメーション（1枚目から4枚目: フレーム0-3）
          this.anims.create({
            key: "idle",
            frames: this.anims.generateFrameNumbers("player", {
              start: 0,
              end: 3,
            }),
            frameRate: 8,
            repeat: -1,
          });

          // 歩行アニメーション (4-7番)
          this.anims.create({
            key: "walk",
            frames: this.anims.generateFrameNumbers("player", {
              start: 4,
              end: 7,
            }),
            frameRate: 10,
            repeat: -1,
          });

          // ジャンプアニメーション（上昇中: 9枚目）
          this.anims.create({
            key: "jump",
            frames: [{ key: "player", frame: 8 }],
            frameRate: 1,
          });

          // 落下アニメーション（落下中: 10枚目）
          this.anims.create({
            key: "fall",
            frames: [{ key: "player", frame: 9 }],
            frameRate: 1,
          });

          // 4. 入力系の初期化
          if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
          }

          // 4. バーチャルコントローラーの配置
          this.createMobileControls();

          // スペースキーでMainSceneへ切り替え
          if (this.input.keyboard) {
            this.input.keyboard.once("keydown-SPACE", () => {
              this.scene.start("MainScene");
            });
          }
        }

        private createMobileControls(): void {
          const centerY = 500;
          const btnStyle: Phaser.Types.GameObjects.Text.TextStyle = {
            fontSize: "24px",
            backgroundColor: "#333",
            padding: { x: 20, y: 20 },
            fixedWidth: 100,
            align: "center",
          };

          // 各ボタンの生成とインタラクション設定
          this.add
            .text(10, centerY, "LEFT", btnStyle)
            .setInteractive()
            .on("pointerdown", () => (this.controls.left = true))
            .on("pointerup", () => (this.controls.left = false))
            .on("pointerout", () => (this.controls.left = false));

          this.add
            .text(120, centerY, "RIGHT", btnStyle)
            .setInteractive()
            .on("pointerdown", () => (this.controls.right = true))
            .on("pointerup", () => (this.controls.right = false))
            .on("pointerout", () => (this.controls.right = false));

          this.add
            .text(250, centerY, "JUMP", btnStyle)
            .setInteractive()
            .on("pointerdown", () => (this.controls.up = true))
            .on("pointerup", () => (this.controls.up = false));
        }

        update(): void {
          if (!this.player || !this.player.body) {
            return;
          }

          const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
          const onFloor = playerBody.touching.down || playerBody.blocked.down;
          const deltaTime = this.game.loop.delta / 1000; // 秒単位のデルタタイム

          // ジャンプ開始（地面にいる時のみ）
          const jumpInput = this.cursors.up.isDown || this.controls.up;
          const jumpJustPressed = (jumpInput && !this.wasJumpPressed) && onFloor;

          if (jumpJustPressed) {
            // ジャンプボタンが押された瞬間、最大ジャンプの初速を設定
            playerBody.setVelocityY(-350); // 最大ジャンプの初速（元のジャンプの高さ）
            this.player.play("jump", true);
            this.controls.up = false; // ボタンでの連続ジャンプを防止
          }

          // 上昇中にボタンが離されたら、上向きの速度を急ブレーキさせる
          if (!jumpInput && this.wasJumpPressed && playerBody.velocity.y < 0 && !onFloor) {
            // 現在の速度を20%にする（または 0 に近づける）
            playerBody.setVelocityY(playerBody.velocity.y * 0.2);
          }

          // 前フレームの状態を更新
          this.wasJumpPressed = jumpInput;

          // マリオ風の左右移動（加速度ベース）
          const leftInput = this.cursors.left.isDown || this.controls.left;
          const rightInput = this.cursors.right.isDown || this.controls.right;
          const currentVelocityX = playerBody.velocity.x;

          if (leftInput) {
            // 左入力
            const controlFactor = onFloor ? 1.0 : this.airControl;
            const targetVelocity = -this.maxSpeed * controlFactor;
            
            if (currentVelocityX > targetVelocity) {
              // 減速または加速
              const accel = onFloor ? this.acceleration : this.acceleration * this.airControl;
              const newVelocity = Math.max(
                currentVelocityX - accel * deltaTime,
                targetVelocity
              );
              playerBody.setVelocityX(newVelocity);
            }
            this.player.setFlipX(true);
            this.isMoving = true;
            if (onFloor) {
              this.player.play("walk", true);
            } else {
              // 空中にいる場合、velocity.yに基づいてアニメーションを選択
              if (playerBody.velocity.y < 0) {
                this.player.play("jump", true); // ジャンプ中（上昇中）
              } else {
                this.player.play("fall", true); // 落下中
              }
            }
          } else if (rightInput) {
            // 右入力
            const controlFactor = onFloor ? 1.0 : this.airControl;
            const targetVelocity = this.maxSpeed * controlFactor;
            
            if (currentVelocityX < targetVelocity) {
              // 減速または加速
              const accel = onFloor ? this.acceleration : this.acceleration * this.airControl;
              const newVelocity = Math.min(
                currentVelocityX + accel * deltaTime,
                targetVelocity
              );
              playerBody.setVelocityX(newVelocity);
            }
            this.player.setFlipX(false);
            this.isMoving = true;
            if (onFloor) {
              this.player.play("walk", true);
            } else {
              // 空中にいる場合、velocity.yに基づいてアニメーションを選択
              if (playerBody.velocity.y < 0) {
                this.player.play("jump", true); // ジャンプ中（上昇中）
              } else {
                this.player.play("fall", true); // 落下中
              }
            }
          } else {
            // 入力がない場合
            if (onFloor) {
              // 地面にいる時は減速（摩擦）
              if (Math.abs(currentVelocityX) > 10) {
                // 速度が大きい場合は減速
                const decel = this.deceleration * deltaTime;
                if (currentVelocityX > 0) {
                  playerBody.setVelocityX(Math.max(0, currentVelocityX - decel));
                } else {
                  playerBody.setVelocityX(Math.min(0, currentVelocityX + decel));
                }
                this.isMoving = true;
                this.player.play("walk", true);
              } else {
                // 速度が小さい場合は停止
                playerBody.setVelocityX(0);
                this.isMoving = false;
                this.player.play("idle", true);
              }
            } else {
              // ジャンプ中（空中）は、現在のX方向の速度を維持（慣性を維持）
              // velocity.yに基づいてアニメーションを選択
              if (playerBody.velocity.y < 0) {
                this.player.play("jump", true); // ジャンプ中（上昇中）
              } else {
                this.player.play("fall", true); // 落下中
              }
            }
          }
        }
      }

      // クリアシーン
      class ClearScene extends Phaser.Scene {
        constructor() {
          super({ key: "ClearScene" });
        }

        create() {
          // 背景色を設定
          this.cameras.main.setBackgroundColor("#27ae60");

          // クリアメッセージ
          this.add
            .text(
              this.cameras.main.width / 2,
              this.cameras.main.height / 2 - 30,
              "クリア！",
              {
                fontSize: "32px",
                color: "#ecf0f1",
                fontFamily: "Arial",
              }
            )
            .setOrigin(0.5);

          // タイトルに戻るテキスト
          this.add
            .text(
              this.cameras.main.width / 2,
              this.cameras.main.height / 2 + 30,
              "クリックしてタイトルに戻る",
              {
                fontSize: "16px",
                color: "#2c3e50",
                fontFamily: "Arial",
              }
            )
            .setOrigin(0.5);

          // クリックでタイトルシーンに戻る
          this.input.once("pointerdown", () => {
            this.scene.start("TitleScene");
          });
        }
      }

      // 既存のCanvasが存在する場合は削除
      if (gameRef.current) {
        const existingCanvas = gameRef.current.querySelector("canvas");
        if (existingCanvas) {
          existingCanvas.remove();
        }
      }

      const scenes = isDebug
        ? [DevScene, MainScene, TitleScene, ClearScene]
        : [TitleScene, MainScene, ClearScene];
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: 256,
        height: 240,
        parent: gameRef.current,
        backgroundColor: "#2c3e50",
        scene: scenes,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        physics: {
          default: "arcade",
          arcade: {
            gravity: { x: 0, y: 600 },
            debug: isDebug,
          },
        },
        pixelArt: true,
        // 1つのCanvasのみを使用するように設定
        dom: {
          createContainer: false,
        },
      };

      phaserGameRef.current = new Phaser.Game(config);
    });

    return () => {
      if (phaserGameRef.current) {
        try {
          phaserGameRef.current.destroy(true);
        } catch (error) {
          console.warn("Error destroying Phaser game:", error);
        }
        phaserGameRef.current = null;
      }
      // DOMを完全にクリア
      if (gameRef.current) {
        while (gameRef.current.firstChild) {
          gameRef.current.removeChild(gameRef.current.firstChild);
        }
        gameRef.current.innerHTML = "";
      }
    };
  }); // 毎回更新
  /*}, []); 初回のみ（1回だけ）*/

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div ref={gameRef} />
    </div>
  );
}
