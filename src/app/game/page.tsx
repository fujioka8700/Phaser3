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
            this.scene.start("GameScene");
          });
        }
      }

      // ゲームシーン（ワンクリックゲーム）
      class GameScene extends Phaser.Scene {
        constructor() {
          super({ key: "GameScene" });
        }

        create() {
          // 背景色を設定
          this.cameras.main.setBackgroundColor("#34495e");

          // ゲーム説明テキスト
          this.add
            .text(
              this.cameras.main.width / 2,
              this.cameras.main.height / 2,
              "画面をクリック！",
              {
                fontSize: "20px",
                color: "#ecf0f1",
                fontFamily: "Arial",
              }
            )
            .setOrigin(0.5);

          // クリックでクリアシーンに遷移
          this.input.once("pointerdown", () => {
            this.scene.start("ClearScene");
          });
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
        ? [GameScene, TitleScene, ClearScene]
        : [TitleScene, GameScene, ClearScene];
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
            gravity: { x: 0, y: 0 },
            debug: isDebug,
          },
        },
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
