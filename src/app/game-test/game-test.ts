import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import Phaser from 'phaser';
import { initMaps } from "../utils/MapUtils"

import { HumanPlayer } from "../components/player/HumanPlayer";
import { BotPlayer } from "../components/player/BotPlayer";
import { ActorEvent, AttackEventPayload, BaseActor, Facing } from "../components/base/BaseActor";
@Component({
  selector: 'app-game-test',
  templateUrl: './game-test.html',
  styleUrls: ['./game-test.css']
})
export class GameTest implements AfterViewInit, OnDestroy {
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;
  private game?: Phaser.Game;
  private debug = false

  ngAfterViewInit() {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 640,
      height: 480,
      parent: this.host.nativeElement,
      pixelArt: true,
      physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: this.debug } },
      scene: [MapScene]
    };
    this.game = new Phaser.Game(config);
  }

  ngOnDestroy() { this.game?.destroy(true); }
}

/** --- SCENA CON TILED --- */
class MapScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private player!: HumanPlayer;
  private bot!: BotPlayer; private walls?: Phaser.Tilemaps.TilemapLayer;
  private ground?: Phaser.Tilemaps.TilemapLayer;
  private slimes!: Phaser.Physics.Arcade.Group;
  private startTime = 0;   // ⏱ memorizza quando inizia
  private survivedTime = 0;
  private map: any
  private validSpawnTiles: { tx: number; ty: number }[] = [];
  private tp_now = false;
  private hitboxes!: Phaser.GameObjects.Rectangle[]; // solo per tenerne traccia (facoltativo)
  private debug!: boolean;
  constructor() { super('map'); }

  preload() {
    // ✅ carica la mappa JSON e il tileset PNG
    this.load.tilemapTiledJSON('map', 'assets/maps/mappa_1.json');
    this.load.image('terreno', 'assets/tiles/terreno.png');
    this.load.image('case', 'assets/tiles/case.png');

    this.hitboxes = [];
    // sprite del player
    this.load.spritesheet('player', 'assets/sprites/player.png', {
      frameWidth: 48, frameHeight: 48
    });

    this.load.spritesheet('bot', 'assets/sprites/player.png', {
      frameWidth: 48, frameHeight: 48
    });

    //sprite slime
    this.load.spritesheet('slime', 'assets/sprites/slime.png', { frameWidth: 32, frameHeight: 32 });

  }

  create() {
    this.debug = (this.physics.world as any).drawDebug === true;
    this.map = this.make.tilemap({ key: 'map' });

    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

    this.events.on(ActorEvent.DIED, (e: AttackEventPayload) => {
      this.bot.stop();
    });


    this.events.on(ActorEvent.ATTACK, (e: AttackEventPayload) => {
      const { owner, facing, range, size } = e;
      this.spawnHitbox(owner, facing, range, size);
    });
    // ⚠️ "terreno" deve essere il NOME del tileset in Tiled
    const tiles = this.map.addTilesetImage('terreno', 'terreno');
    const house_tiles = this.map.addTilesetImage("case", "case")

    const tilesets = [tiles, house_tiles].filter(Boolean) as Phaser.Tilemaps.Tileset[];

    this.ground = this.map.createLayer('ground', tilesets!, 0, 0);
    this.walls = this.map.createLayer('walls', tilesets!, 0, 0) ?? undefined;
    this.walls?.setDepth(999);
    // Abilita collisione sui tile con proprietà { collider: true }
    this.walls?.setCollisionByProperty({ collider: true });

    this.player = new HumanPlayer(this, 96, 96, {})

    // BOT
    // istanzia con qualche tweak ai parametri

    
    this.bot = new BotPlayer(this, 200, 140, this.player, {
      key: "player",
      sightRange: 180,
      attackRange: 38,
      attackCooldownMs: 1000,
      speedScale: 0.8,
      slideAngleDeg: 60,
      stuckMs: 250
    });

    if (this.walls) {
      this.physics.add.collider(this.player.getSprite(), this.walls);
      this.physics.add.collider(this.bot.getSprite(), this.walls);
    }

    this.startTime = this.time.now;
    initMaps(this.cameras, this.map, this.player.getSprite(), this)
  }

  // Firma corretta per Phaser.Scene
  override update(time: number, delta: number) {
    this.player.update()
    this.bot.update(); // legge gli input AI che il controller ha impostato
  }


  private spawnHitbox(owner: BaseActor, facing: Facing, range: number, size: number) {
    const spr = owner.getSprite();
    const body = spr.body as Phaser.Physics.Arcade.Body;
    const cx = body.center.x, cy = body.center.y, hw = body.halfWidth, hh = body.halfHeight;
    let w: number, h: number, hx = cx, hy = cy;
    const MARGIN = 2, biasY = hh * 0.1;

    switch (facing) {
      case "right": w = range; h = size; hx = cx + hw + MARGIN + w / 2; hy = cy + biasY; break;
      case "left": w = range; h = size; hx = cx - hw - MARGIN - w / 2; hy = cy + biasY; break;
      case "down": w = size; h = range; hx = cx; hy = cy + hh + MARGIN + h / 2; break;
      default: w = size; h = range; hx = cx; hy = cy - hh - MARGIN - h / 2; break;
    }

    hx = Math.round(hx); hy = Math.round(hy);

    const rect = this.add.rectangle(hx, hy, w, h, 0xff0000, 0.35).setOrigin(0.5);
    rect.setDepth(hy);
    rect.setVisible(this.debug);           // niente colore/shape senza debug
    this.physics.add.existing(rect, true);
    const rbody = rect.body as Phaser.Physics.Arcade.StaticBody;
    rbody.setSize(w, h).updateFromGameObject();

    // esempio di danno fra player e bot
    const target = owner === this.player ? this.bot.getSprite() : this.player.getSprite();
    this.physics.add.overlap(rect, target, () => {
      const src = owner.getSprite();
      const victim = owner === this.player ? this.bot : this.player;
      victim.damage(1, src.x, src.y);
    });

    this.time.delayedCall(100, () => rect.destroy());
  }
}