import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import Phaser from 'phaser';

@Component({
  selector: 'app-game-canvas',
  templateUrl: './game-canvas.html',
  styleUrls: ['./game-canvas.css']
})
export class GameCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;
  private game?: Phaser.Game;

  ngAfterViewInit() {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 320,
      height: 240,
      parent: this.host.nativeElement,
      pixelArt: true,
      physics: { default: 'arcade', arcade: { gravity: {x : 0 , y: 0 }, debug: false } },
      scene: [MapScene]
    };
    this.game = new Phaser.Game(config);
  }

  ngOnDestroy() { this.game?.destroy(true); }
}

/** --- SCENA CON TILED --- */
class MapScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private walls?: Phaser.Tilemaps.TilemapLayer;
  private keyAttack: any;
  private isAttacking = false;

  private facing: 'down' | 'right' | 'up' | 'left' = "down";

  constructor() { super('map'); }

  preload() {
    // ✅ carica la mappa JSON e il tileset PNG
    this.load.tilemapTiledJSON('map', 'assets/maps/mappa.json');
    this.load.image('terreno', 'assets/tiles/terreno.png');

    // sprite del player
    this.load.spritesheet('player', 'assets/sprites/player.png', {
        frameWidth: 48, frameHeight: 48
    });
  }

  create() {
    const map = this.make.tilemap({ key: 'map' });

    // ⚠️ "terreno" deve essere il NOME del tileset in Tiled
    const tiles = map.addTilesetImage('terreno', 'terreno');

    // ⚠️ usa i NOMI DEI LAYER come in Tiled (es. "ground" e "walls")
    map.createLayer('ground', tiles!, 0, 0);
    this.walls = map.createLayer('walls', tiles!, 0, 0) ?? undefined;

    // Abilita collisione sui tile con proprietà { collider: true }
    this.walls?.setCollisionByProperty({ collider: true });


      // --- animazioni ---
// Idle: prendi tutta la riga
  makeRowAnim(this, 'idle-down',  0, { fps: 6 });
  makeRowAnim(this, 'idle-right', 1, { fps: 6 });
  makeRowAnim(this, 'idle-up',    2, { fps: 6 });

  // Move: solo i primi 6 frame della riga (se la riga è più lunga)
  makeRowAnim(this, 'move-down',  3, { fps: 10, count: 6 });
  makeRowAnim(this, 'move-right', 4, { fps: 10, count: 6 });
  makeRowAnim(this, 'move-up',    5, { fps: 10, count: 6 });

  // Attack: 4 frame, riproduci una volta
  makeRowAnim(this, 'attack-down',  6, { fps: 12, count: 4, repeat: 0 });
  makeRowAnim(this, 'attack-right', 7, { fps: 12, count: 4, repeat: 0 });
  makeRowAnim(this, 'attack-up',    8, { fps: 12, count: 4, repeat: 0 });

  // Death: tutta la riga, una volta sola, con yoyo opzionale
  makeRowAnim(this, 'death', 9, { fps: 8, repeat: 0 });

  // --- player ---
  this.player = this.physics.add.sprite(96, 96, 'player', 0);
  this.player.setSize(24, 30).setOffset(12, 18); // hitbox un po' più bassa (opzionale)
  this.cursors = this.input.keyboard!.createCursorKeys();
  this.keyAttack = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

  this.facing = 'down';


    // Player
   this.player.setCollideWorldBounds(true);

    // Collisione player ↔ walls
    if (this.walls) this.physics.add.collider(this.player, this.walls);

    // Camera
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.cameras.main.setZoom(2);

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
  }

  // Firma corretta per Phaser.Scene
  override update() {

    
    if (!this.isAttacking && Phaser.Input.Keyboard.JustDown(this.keyAttack)) {
      this.startAttack();
      return; // non fare altro in questo frame
    }

    if (this.isAttacking) return;

    
    const speed = 140;
    let vx = 0, vy = 0;



    if (this.cursors.left?.isDown)  { vx = -speed; this.facing = 'left'; }
    else if (this.cursors.right?.isDown) { vx =  speed; this.facing = 'right'; }
    if (this.cursors.up?.isDown)    { vy = -speed; this.facing = 'up'; }
    else if (this.cursors.down?.isDown)  { vy =  speed; this.facing = 'down'; }

    this.player.setVelocity(vx, vy);


    // MOVIMENTO / IDLE
    if (vx !== 0 || vy !== 0) {
      if (this.facing === 'left') {
        this.player.setFlipX(true);
        this.player.play('move-right', true); // usa right flippata
      } else {
        this.player.setFlipX(false);
        const key = `move-${this.facing}`;
        this.player.play(key, true);
      }
    } else {
      if (this.facing === 'left') {
        this.player.setFlipX(true);
        this.player.play('idle-right', true);
      } else {
        this.player.setFlipX(false);
        const key = `idle-${this.facing}`;
        this.player.play(key, true);
      }
    }
  }

  private startAttack() {
    this.isAttacking = true;

    // ferma il movimento durante l'attacco
    this.player.setVelocity(0, 0);

    // scegli anim + flip
    let animKey = '';
    if (this.facing === 'left') {
      this.player.setFlipX(true);
      animKey = 'attack-right'; // riuso la right flippata
    } else {
      this.player.setFlipX(false);
      animKey = `attack-${this.facing}`;
    }

    this.player.play(animKey, true);

    // quando finisce l'animazione, esci dallo stato "attacco"
    this.player.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.isAttacking = false;

      // torna a un idle coerente con la direzione
      if (this.facing === 'left') {
        this.player.setFlipX(true);
        this.player.play('idle-right', true);
      } else {
        this.player.setFlipX(false);
        this.player.play(`idle-${this.facing}`, true);
      }
    });
  }
}




type RowAnimOpts = {
  fps?: number;          // frame al secondo (default 10)
  repeat?: number;       // -1 infinito, 0 una volta (default -1)
  yoyo?: boolean;        // ping-pong (default false)
  from?: number;         // colonna di partenza nella riga (default 0)
  to?: number;           // colonna di fine nella riga (inclusa)
  count?: number;        // usa i primi N frame a partire da 'from'
  frameWidth?: number;   // default 48
  textureKey?: string;   // default 'player'
};

/** Crea un'animazione prendendo frame contigui da una riga dello spritesheet. */
function makeRowAnim(
  scene: Phaser.Scene,
  key: string,
  row: number,
  opts: RowAnimOpts = {}
) {
  const texKey = opts.textureKey ?? 'player';
  const fw = opts.frameWidth ?? 48;

  const img = scene.textures.get(texKey).getSourceImage() as HTMLImageElement;
  const cols = Math.max(1, Math.floor(img.width / fw));

  const fromCol = Math.max(0, Math.min(opts.from ?? 0, cols - 1));
  let toCol = opts.to ?? (opts.count != null ? fromCol + opts.count - 1 : cols - 1);
  toCol = Math.max(fromCol, Math.min(toCol, cols - 1));

  const start = row * cols + fromCol;
  const end   = row * cols + toCol;

  scene.anims.create({
    key,
    frames: scene.anims.generateFrameNumbers(texKey, { start, end }),
    frameRate: opts.fps ?? 10,
    repeat: opts.repeat ?? -1,
    yoyo: !!opts.yoyo
  });
}


