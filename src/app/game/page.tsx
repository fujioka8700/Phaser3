"use client";

import { useEffect, useRef, useState } from "react";

const isDebug = false; // 開発時は true にする

// グローバルなコントロール状態（PhaserシーンとReactコンポーネント間で共有）
const globalControls = {
  left: false,
  right: false,
  up: false,
};

export default function GamePage() {
  const gameRef = useRef<HTMLDivElement>(null);
  const phaserGameRef = useRef<any>(null);
  // ボタンの視覚的フィードバック用のstate（Phaserゲームの再初期化には影響しない）
  const [buttonStates, setButtonStates] = useState({
    left: false,
    right: false,
    up: false,
  });

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
              "Super Mango",
              {
                fontSize: "24px",
                color: "#ecf0f1",
                fontFamily: "Arial",
              },
            )
            .setOrigin(0.5);

          // please click!!のテキスト
          this.add
            .text(
              this.cameras.main.width / 2,
              this.cameras.main.height / 2 + 30,
              "please click!!",
              {
                fontSize: "16px",
                color: "#95a5a6",
                fontFamily: "Arial",
              },
            )
            .setOrigin(0.5);

          // クリックでゲームシーンに遷移
          this.input.once("pointerdown", () => {
            this.scene.start("MainScene");
          });
        }
      }

      // ゲーム定数
      const GAME_CONSTANTS = {
        // プレイヤー設定
        PLAYER: {
          FRAME_WIDTH: 48,
          FRAME_HEIGHT: 48,
          ACTUAL_WIDTH: 16,
          ACTUAL_HEIGHT: 16,
          DEFAULT_START_X: 48,
          DEFAULT_START_Y: 48,
        },
        // 敵設定
        ENEMY: {
          DISPLAY_WIDTH: 64,
          DISPLAY_HEIGHT: 48,
          BODY_WIDTH: 24,
          BODY_HEIGHT: 10,
          OFFSET_X: 20,
          OFFSET_Y: 22,
          SPEED_X: 50,
          SPEED_Y: 300,
          INITIAL_DIRECTION: -1, // -1: 左, 1: 右
          SENSOR_DISTANCE: 1, // 前方のセンサー距離（px）
          FLIP_ADJUST: 4, // 反転時の位置調整（px）
        },
        // プレイヤー移動パラメータ
        MOVEMENT: {
          MAX_SPEED: 160,
          ACCELERATION: 800,
          DECELERATION: 1000,
          AIR_CONTROL: 0.5,
          JUMP_VELOCITY: -350,
          JUMP_CANCEL_FACTOR: 0.2,
          MIN_VELOCITY_THRESHOLD: 10,
        },
        // カメラ設定
        CAMERA: {
          FOLLOW_LERP_X: 0.1,
          FOLLOW_LERP_Y: 0.1,
        },
        // 衝突判定の許容範囲
        COLLISION: {
          ONE_WAY_TOLERANCE_PREV: 2,
          ONE_WAY_TOLERANCE_CURRENT: 8,
        },
      };

      // 敵の拡張型定義
      interface EnemySprite extends Phaser.Physics.Arcade.Sprite {
        moveDirection: number;
      }

      // メインゲームシーン
      class MainScene extends Phaser.Scene {
        private player!: Phaser.Physics.Arcade.Sprite;
        private playerBody!: Phaser.Physics.Arcade.Body;
        private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
        private controls = globalControls;
        private isMoving = false;
        private wasJumpPressed = false;
        private map!: Phaser.Tilemaps.Tilemap;
        private readonly maxSpeed = GAME_CONSTANTS.MOVEMENT.MAX_SPEED;
        private readonly acceleration = GAME_CONSTANTS.MOVEMENT.ACCELERATION;
        private readonly deceleration = GAME_CONSTANTS.MOVEMENT.DECELERATION;
        private readonly airControl = GAME_CONSTANTS.MOVEMENT.AIR_CONTROL;
        private tileset!: Phaser.Tilemaps.Tileset;
        private backgroundLayer!: Phaser.Tilemaps.TilemapLayer;
        private platformLayer!: Phaser.Tilemaps.TilemapLayer;
        private enemies: EnemySprite[] = [];
        private debugGraphics!: Phaser.GameObjects.Graphics;

        constructor() {
          super({ key: "MainScene" });
        }

        preload(): void {
          this.load.spritesheet("player", "/assets/Player.png", {
            frameWidth: GAME_CONSTANTS.PLAYER.FRAME_WIDTH,
            frameHeight: GAME_CONSTANTS.PLAYER.FRAME_HEIGHT,
          });

          this.load.spritesheet("spider", "/assets/Spider_1.png", {
            frameWidth: GAME_CONSTANTS.ENEMY.DISPLAY_WIDTH,
            frameHeight: GAME_CONSTANTS.ENEMY.DISPLAY_HEIGHT,
          });

          this.load.tilemapTiledJSON("tilemap", "/assets/maps/tilemap.json");
          this.load.image("tileset", "/assets/maps/tilesheet.png");
        }

        create() {
          this.physics.world.drawDebug = isDebug;
          this.setupTilemap();
          const objectLayer = this.setupPlayer();
          this.setupCamera();
          this.setupPlayerCollision();
          this.createAnimations();
          this.createEnemies(objectLayer);
          this.setupInput();
          this.debugGraphics = this.add.graphics();
        }

        private setupTilemap(): void {
          this.map = this.make.tilemap({ key: "tilemap" });
          const tileset = this.map.addTilesetImage("tilesheet", "tileset");
          if (!tileset) {
            console.error("Failed to load tileset");
            return;
          }
          this.tileset = tileset;

          const backgroundLayer = this.map.createLayer(
            "background",
            this.tileset,
            0,
            0,
          );
          const platformLayer = this.map.createLayer(
            "platform",
            this.tileset,
            0,
            0,
          );
          if (!backgroundLayer || !platformLayer) {
            console.error("Failed to create tilemap layers");
            return;
          }
          this.backgroundLayer = backgroundLayer;
          this.platformLayer = platformLayer;

          this.platformLayer.setCollisionByProperty({ collides: true });

          // oneWayタイルの設定
          this.platformLayer.forEachTile((tile) => {
            if (tile.properties && tile.properties.oneWay) {
              tile.setCollision(false, false, true, false);
              tile.collideDown = false;
              tile.collideLeft = false;
              tile.collideRight = false;
            }
          });
        }

        private setupPlayer(): Phaser.Tilemaps.ObjectLayer | null {
          const objectLayer = this.map.getObjectLayer("objectsLayer");
          let playerStartX = GAME_CONSTANTS.PLAYER.DEFAULT_START_X;
          let playerStartY = GAME_CONSTANTS.PLAYER.DEFAULT_START_Y;

          if (objectLayer) {
            const playerObj = objectLayer.objects.find(
              (obj) => obj.name === "player",
            );
            if (
              playerObj &&
              playerObj.x !== undefined &&
              playerObj.y !== undefined
            ) {
              playerStartX = playerObj.x;
              playerStartY = playerObj.y;
            }
          }

          this.player = this.physics.add.sprite(
            playerStartX,
            playerStartY,
            "player",
            0,
          );

          const offsetX =
            (GAME_CONSTANTS.PLAYER.FRAME_WIDTH -
              GAME_CONSTANTS.PLAYER.ACTUAL_WIDTH) /
            2;
          const offsetY =
            (GAME_CONSTANTS.PLAYER.FRAME_HEIGHT -
              GAME_CONSTANTS.PLAYER.ACTUAL_HEIGHT) /
            2;

          this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
          this.playerBody.setSize(
            GAME_CONSTANTS.PLAYER.ACTUAL_WIDTH,
            GAME_CONSTANTS.PLAYER.ACTUAL_HEIGHT,
          );
          this.playerBody.setOffset(offsetX, offsetY);
          this.playerBody.setCollideWorldBounds(true);

          return objectLayer;
        }

        private setupCamera(): void {
          const mapWidth = this.map.widthInPixels;
          const mapHeight = this.map.heightInPixels;

          this.cameras.main.startFollow(
            this.player,
            true,
            GAME_CONSTANTS.CAMERA.FOLLOW_LERP_X,
            GAME_CONSTANTS.CAMERA.FOLLOW_LERP_Y,
          );
          this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
          this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
        }

        private setupPlayerCollision(): void {
          this.physics.add.collider(
            this.player,
            this.platformLayer,
            undefined,
            (playerObj, tileObj) => {
              const player = playerObj as Phaser.Physics.Arcade.Sprite;
              const tile = tileObj as Phaser.Tilemaps.Tile;
              const playerBody = player.body as Phaser.Physics.Arcade.Body;

              if (tile.properties && tile.properties.oneWay !== true) {
                return true;
              }

              if (playerBody.velocity.y < 0) {
                return false;
              }

              const playerBottom = playerBody.bottom;
              const prevPlayerBottom = playerBody.prev.y + playerBody.height;
              const tileTop = tile.pixelY;

              if (
                prevPlayerBottom <=
                  tileTop + GAME_CONSTANTS.COLLISION.ONE_WAY_TOLERANCE_PREV ||
                playerBottom <=
                  tileTop + GAME_CONSTANTS.COLLISION.ONE_WAY_TOLERANCE_CURRENT
              ) {
                return true;
              }

              return false;
            },
          );
        }

        private createAnimations(): void {
          this.anims.create({
            key: "idle",
            frames: this.anims.generateFrameNumbers("player", {
              start: 0,
              end: 3,
            }),
            frameRate: 8,
            repeat: -1,
          });

          this.anims.create({
            key: "walk",
            frames: this.anims.generateFrameNumbers("player", {
              start: 4,
              end: 7,
            }),
            frameRate: 10,
            repeat: -1,
          });

          this.anims.create({
            key: "jump",
            frames: [{ key: "player", frame: 8 }],
            frameRate: 1,
          });

          this.anims.create({
            key: "fall",
            frames: [{ key: "player", frame: 9 }],
            frameRate: 1,
          });

          this.anims.create({
            key: "spider-walk",
            frames: this.anims.generateFrameNumbers("spider", {
              start: 0,
              end: 2,
            }),
            frameRate: 8,
            repeat: -1,
          });
        }

        private createEnemies(
          objectLayer: Phaser.Tilemaps.ObjectLayer | null,
        ): void {
          this.enemies = [];
          if (!objectLayer) return;

          const enemyObjects = objectLayer.objects.filter(
            (obj) => obj.name === "Spider_1",
          );

          enemyObjects.forEach((enemyObj) => {
            if (enemyObj.x !== undefined && enemyObj.y !== undefined) {
              const enemy = this.physics.add.sprite(
                enemyObj.x,
                enemyObj.y,
                "spider",
                0,
              ) as EnemySprite;

              enemy.setDisplaySize(
                GAME_CONSTANTS.ENEMY.DISPLAY_WIDTH,
                GAME_CONSTANTS.ENEMY.DISPLAY_HEIGHT,
              );

              const enemyBody = enemy.body as Phaser.Physics.Arcade.Body;
              enemyBody.setSize(
                GAME_CONSTANTS.ENEMY.BODY_WIDTH,
                GAME_CONSTANTS.ENEMY.BODY_HEIGHT,
              );
              enemyBody.setOffset(
                GAME_CONSTANTS.ENEMY.OFFSET_X,
                GAME_CONSTANTS.ENEMY.OFFSET_Y,
              );
              enemyBody.setCollideWorldBounds(true);

              enemy.moveDirection = GAME_CONSTANTS.ENEMY.INITIAL_DIRECTION;
              enemy.setFlipX(false);
              enemy.play("spider-walk", true);

              this.physics.add.collider(enemy, this.platformLayer, () => {
                const enemyBody = enemy.body as Phaser.Physics.Arcade.Body;
                if (enemyBody.blocked.left || enemyBody.blocked.right) {
                  enemy.moveDirection *= -1;
                  enemy.setFlipX(enemy.moveDirection > 0);
                }
              });

              this.enemies.push(enemy);
            }
          });
        }

        private setupInput(): void {
          if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
          }
        }

        update(): void {
          if (!this.player || !this.player.body) {
            return;
          }

          const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
          const deltaTime = this.game.loop.delta / 1000;

          this.handleJump(playerBody);
          this.handleMovement(playerBody, deltaTime);
          this.updateEnemies();
        }

        private handleJump(playerBody: Phaser.Physics.Arcade.Body): void {
          const onFloor = playerBody.touching.down || playerBody.blocked.down;
          const jumpInput = this.cursors.up.isDown || globalControls.up;
          const jumpJustPressed = jumpInput && !this.wasJumpPressed && onFloor;

          if (jumpJustPressed) {
            playerBody.setVelocityY(GAME_CONSTANTS.MOVEMENT.JUMP_VELOCITY);
            this.player.play("jump", true);
          }

          if (
            !jumpInput &&
            this.wasJumpPressed &&
            playerBody.velocity.y < 0 &&
            !onFloor
          ) {
            playerBody.setVelocityY(
              playerBody.velocity.y *
                GAME_CONSTANTS.MOVEMENT.JUMP_CANCEL_FACTOR,
            );
          }

          this.wasJumpPressed = jumpInput;
        }

        private handleMovement(
          playerBody: Phaser.Physics.Arcade.Body,
          deltaTime: number,
        ): void {
          const onFloor = playerBody.touching.down || playerBody.blocked.down;
          const leftInput = this.cursors.left.isDown || globalControls.left;
          const rightInput = this.cursors.right.isDown || globalControls.right;
          const currentVelocityX = playerBody.velocity.x;

          if (leftInput) {
            this.handleLeftMovement(
              playerBody,
              onFloor,
              currentVelocityX,
              deltaTime,
            );
          } else if (rightInput) {
            this.handleRightMovement(
              playerBody,
              onFloor,
              currentVelocityX,
              deltaTime,
            );
          } else {
            this.handleNoInput(
              playerBody,
              onFloor,
              currentVelocityX,
              deltaTime,
            );
          }
        }

        private handleLeftMovement(
          playerBody: Phaser.Physics.Arcade.Body,
          onFloor: boolean,
          currentVelocityX: number,
          deltaTime: number,
        ): void {
          const controlFactor = onFloor ? 1.0 : this.airControl;
          const targetVelocity = -this.maxSpeed * controlFactor;

          if (currentVelocityX > targetVelocity) {
            const accel = onFloor
              ? this.acceleration
              : this.acceleration * this.airControl;
            const newVelocity = Math.max(
              currentVelocityX - accel * deltaTime,
              targetVelocity,
            );
            playerBody.setVelocityX(newVelocity);
          }

          this.player.setFlipX(true);
          this.isMoving = true;
          this.updatePlayerAnimation(playerBody, onFloor);
        }

        private handleRightMovement(
          playerBody: Phaser.Physics.Arcade.Body,
          onFloor: boolean,
          currentVelocityX: number,
          deltaTime: number,
        ): void {
          const controlFactor = onFloor ? 1.0 : this.airControl;
          const targetVelocity = this.maxSpeed * controlFactor;

          if (currentVelocityX < targetVelocity) {
            const accel = onFloor
              ? this.acceleration
              : this.acceleration * this.airControl;
            const newVelocity = Math.min(
              currentVelocityX + accel * deltaTime,
              targetVelocity,
            );
            playerBody.setVelocityX(newVelocity);
          }

          this.player.setFlipX(false);
          this.isMoving = true;
          this.updatePlayerAnimation(playerBody, onFloor);
        }

        private handleNoInput(
          playerBody: Phaser.Physics.Arcade.Body,
          onFloor: boolean,
          currentVelocityX: number,
          deltaTime: number,
        ): void {
          if (onFloor) {
            if (
              Math.abs(currentVelocityX) >
              GAME_CONSTANTS.MOVEMENT.MIN_VELOCITY_THRESHOLD
            ) {
              const decel = this.deceleration * deltaTime;
              if (currentVelocityX > 0) {
                playerBody.setVelocityX(Math.max(0, currentVelocityX - decel));
              } else {
                playerBody.setVelocityX(Math.min(0, currentVelocityX + decel));
              }
              this.isMoving = true;
              this.player.play("walk", true);
            } else {
              playerBody.setVelocityX(0);
              this.isMoving = false;
              this.player.play("idle", true);
            }
          } else {
            this.updatePlayerAnimation(playerBody, onFloor);
          }
        }

        private updatePlayerAnimation(
          playerBody: Phaser.Physics.Arcade.Body,
          onFloor: boolean,
        ): void {
          if (onFloor) {
            this.player.play("walk", true);
          } else {
            if (playerBody.velocity.y < 0) {
              this.player.play("jump", true);
            } else {
              this.player.play("fall", true);
            }
          }
        }

        private updateEnemies(): void {
          this.debugGraphics.clear();

          this.enemies.forEach((enemy) => {
            const enemyBody = enemy.body as Phaser.Physics.Arcade.Body;

            if (enemy.moveDirection === undefined) {
              enemy.moveDirection = GAME_CONSTANTS.ENEMY.INITIAL_DIRECTION;
            }

            const { checkX, checkY } = this.getEnemySensorPosition(
              enemy,
              enemyBody,
            );
            const hasFloor = this.checkEnemyFloor(checkX, checkY);
            const hitWall = enemyBody.blocked.left || enemyBody.blocked.right;
            const isGake = !hasFloor && enemyBody.blocked.down;

            if (hitWall || isGake) {
              this.flipEnemy(enemy, enemyBody);
            }

            enemyBody.setVelocityX(
              GAME_CONSTANTS.ENEMY.SPEED_X * enemy.moveDirection,
            );

            if (!enemyBody.blocked.down) {
              enemyBody.setVelocityY(GAME_CONSTANTS.ENEMY.SPEED_Y);
            }
          });
        }

        private getEnemySensorPosition(
          enemy: EnemySprite,
          enemyBody: Phaser.Physics.Arcade.Body,
        ): { checkX: number; checkY: number } {
          const checkX =
            enemy.moveDirection > 0
              ? enemyBody.right + GAME_CONSTANTS.ENEMY.SENSOR_DISTANCE
              : enemyBody.x - GAME_CONSTANTS.ENEMY.SENSOR_DISTANCE;
          const checkY =
            enemyBody.bottom + GAME_CONSTANTS.ENEMY.SENSOR_DISTANCE;

          return { checkX, checkY };
        }

        private checkEnemyFloor(checkX: number, checkY: number): boolean {
          const tileAhead = this.platformLayer.getTileAtWorldXY(checkX, checkY);
          return (
            !!tileAhead &&
            (tileAhead.properties.collides || tileAhead.properties.oneWay)
          );
        }

        private flipEnemy(
          enemy: EnemySprite,
          enemyBody: Phaser.Physics.Arcade.Body,
        ): void {
          enemy.moveDirection *= -1;
          enemy.setFlipX(enemy.moveDirection > 0);
          enemy.x += enemy.moveDirection * GAME_CONSTANTS.ENEMY.FLIP_ADJUST;
          enemyBody.setVelocityY(0);
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
              },
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
              },
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
        ? [MainScene, TitleScene, ClearScene]
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
  }, []); // 初回のみ実行（Phaserゲームの再初期化を防ぐ）

  // コントロールボタンのハンドラー
  // 視覚的フィードバック用のstateのみ更新（Phaserゲームの再初期化には影響しない）
  const handleLeftDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    globalControls.left = true;
    setButtonStates((prev) => ({ ...prev, left: true }));
  };
  const handleLeftUp = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    globalControls.left = false;
    setButtonStates((prev) => ({ ...prev, left: false }));
  };
  const handleRightDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    globalControls.right = true;
    setButtonStates((prev) => ({ ...prev, right: true }));
  };
  const handleRightUp = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    globalControls.right = false;
    setButtonStates((prev) => ({ ...prev, right: false }));
  };
  const handleADown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    globalControls.up = true;
    setButtonStates((prev) => ({ ...prev, up: true }));
  };
  const handleAUp = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    globalControls.up = false;
    setButtonStates((prev) => ({ ...prev, up: false }));
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
      <div ref={gameRef} />
      {/* バーチャルコントローラー */}
      <div className="flex items-center justify-center gap-4 mt-4 pb-4">
        {/* 左ボタン */}
        <button
          onMouseDown={handleLeftDown}
          onMouseUp={handleLeftUp}
          onMouseLeave={handleLeftUp}
          onTouchStart={handleLeftDown}
          onTouchEnd={handleLeftUp}
          className={`w-16 h-16 rounded-full border-2 border-black flex items-center justify-center shadow-md transition-all duration-75 select-none touch-none ${
            buttonStates.left
              ? "bg-gray-200 scale-95 shadow-inner"
              : "bg-white scale-100"
          }`}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="black">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>

        {/* 右ボタン */}
        <button
          onMouseDown={handleRightDown}
          onMouseUp={handleRightUp}
          onMouseLeave={handleRightUp}
          onTouchStart={handleRightDown}
          onTouchEnd={handleRightUp}
          className={`w-16 h-16 rounded-full border-2 border-black flex items-center justify-center shadow-md transition-all duration-75 select-none touch-none ${
            buttonStates.right
              ? "bg-gray-200 scale-95 shadow-inner"
              : "bg-white scale-100"
          }`}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="black">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
          </svg>
        </button>

        {/* Aボタン */}
        <button
          onMouseDown={handleADown}
          onMouseUp={handleAUp}
          onMouseLeave={handleAUp}
          onTouchStart={handleADown}
          onTouchEnd={handleAUp}
          className={`w-16 h-16 rounded-full border-2 border-black flex items-center justify-center shadow-md transition-all duration-75 select-none touch-none ml-8 ${
            buttonStates.up
              ? "bg-gray-200 scale-95 shadow-inner"
              : "bg-white scale-100"
          }`}
        >
          <span className="text-black font-bold text-xl">A</span>
        </button>
      </div>
    </div>
  );
}
