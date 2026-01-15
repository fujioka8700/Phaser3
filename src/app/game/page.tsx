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

        constructor() {
          super({ key: "MainScene" });
        }

        preload(): void {
          // スプライトシートの読み込み（画像の並びから、1マスを 32x48 と定義）
          this.load.spritesheet("player", "/assets/Player.png", {
            frameWidth: 48,
            frameHeight: 48,
          });
        }

        create(): void {
          const mainText = this.add.text(5, 5, "本番画面", {
            color: "#00ff00",
            fontSize: "15px",
          });
          mainText.setPadding(0, 3, 0, 0);

          // 本番環境ではデバッグ表示を無効化
          this.physics.world.drawDebug = false;

          // 1. 簡易的な地面（物理ボディを持つ静的グループ）
          const ground = this.add.rectangle(187, 322, 374, 20, 0x888888);
          this.physics.add.existing(ground, true);

          // 2. プレイヤーの生成（スプライトシートのフレーム0を使用）
          this.player = this.physics.add.sprite(48, 48, "player", 0);
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

          // 地面との衝突判定を設定（めり込みを防ぐため）
          this.physics.add.collider(this.player, ground);

          // キャラクターの初期位置を地面の上に調整
          // 地面のY座標は322、高さ20pxなので、地面の上端は312
          // キャラクターの高さ16pxを考慮して、地面の上端から少し上に配置
          this.player.setY(312 - actualHeight / 2);

          // 3. アニメーションの作成
          // 待機アニメーション（最初のフレームのみ）
          this.anims.create({
            key: "idle",
            frames: [{ key: "player", frame: 0 }],
            frameRate: 1,
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

          // 4行目: ジャンプ (12番付近)
          this.anims.create({
            key: "jump",
            frames: [{ key: "player", frame: 12 }],
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
          const speed = 160;
          const onFloor = this.player.body?.touching.down;

          // 左右移動と反転処理
          if (this.cursors.left.isDown || this.controls.left) {
            this.player.setVelocityX(-speed);
            this.player.setFlipX(true);
            if (onFloor) this.player.play("walk", true);
          } else if (this.cursors.right.isDown || this.controls.right) {
            this.player.setVelocityX(speed);
            this.player.setFlipX(false);
            if (onFloor) this.player.play("walk", true);
          } else {
            this.player.setVelocityX(0);
            if (onFloor) this.player.play("idle", true);
          }

          // ジャンプ処理
          if ((this.cursors.up.isDown || this.controls.up) && onFloor) {
            this.player.setVelocityY(-350);
            this.player.play("jump", true);
            this.controls.up = false; // ボタンでの連続ジャンプを防止
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
        private isJumping = false;

        constructor() {
          super({ key: "DevScene" });
        }

        preload(): void {
          // スプライトシートの読み込み（MainSceneと同じ）
          this.load.spritesheet("player", "/assets/Player.png", {
            frameWidth: 48,
            frameHeight: 48,
          });
        }

        create() {
          const devText = this.add.text(5, 5, "開発画面", {
            color: "#ff0000",
            fontSize: "15px",
          });
          devText.setPadding(0, 3, 0, 0);

          // 1. 簡易的な地面（物理ボディを持つ静的グループ）
          const ground = this.add.rectangle(187, 322, 374, 20, 0x888888);
          this.physics.add.existing(ground, true);

          // 2. プレイヤーの生成（スプライトシートのフレーム0を使用）
          this.player = this.physics.add.sprite(48, 48, "player", 0);
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

          // 地面との衝突判定を設定（めり込みを防ぐため）
          this.physics.add.collider(this.player, ground);

          // キャラクターの初期位置を地面の上に調整
          // 地面のY座標は322、高さ20pxなので、地面の上端は312
          // キャラクターの高さ16pxを考慮して、地面の上端から少し上に配置
          this.player.setY(312 - actualHeight / 2);

          // 3. アニメーションの作成
          // 待機アニメーション（最初のフレームのみ）
          this.anims.create({
            key: "idle",
            frames: [{ key: "player", frame: 0 }],
            frameRate: 1,
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

          // ジャンプアニメーション (12番)
          this.anims.create({
            key: "jump",
            frames: [{ key: "player", frame: 12 }],
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
          const speed = 160;
          const onFloor = this.playerBody?.touching.down;

          // 左右移動とアニメーション
          if (this.cursors.left.isDown || this.controls.left) {
            this.playerBody.setVelocityX(-speed);
            this.player.setFlipX(true);
            this.isMoving = true;
            if (onFloor) this.player.play("walk", true);
          } else if (this.cursors.right.isDown || this.controls.right) {
            this.playerBody.setVelocityX(speed);
            this.player.setFlipX(false);
            this.isMoving = true;
            if (onFloor) this.player.play("walk", true);
          } else {
            this.playerBody.setVelocityX(0);
            this.isMoving = false;
            if (onFloor) this.player.play("idle", true);
          }

          // ジャンプ処理
          if ((this.cursors.up.isDown || this.controls.up) && onFloor) {
            this.playerBody.setVelocityY(-350);
            this.player.play("jump", true);
            this.isJumping = true;
            this.controls.up = false; // ボタンでの連続ジャンプを防止
          }

          // 着地時の処理
          if (onFloor && this.isJumping) {
            this.isJumping = false;
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
        width: 375,
        height: 333,
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
