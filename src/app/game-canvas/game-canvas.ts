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
      width: 640,
      height: 480,
      parent: this.host.nativeElement,
      pixelArt: true,
      physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: true } },
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
  private ground?: Phaser.Tilemaps.TilemapLayer;

  private hit: boolean = false
  private keyAttack: any;
  private life = 3;
  private isAttacking = false;
  private wasd!: Record<'up' | 'left' | 'down' | 'right', Phaser.Input.Keyboard.Key>;
  private slimes!: Phaser.Physics.Arcade.Group;
  private startTime = 0;   // ⏱ memorizza quando inizia
  private survivedTime = 0;
  private map: any
  private validSpawnTiles: { tx: number; ty: number }[] = [];
  private tp_now = false;


  private facing: 'down' | 'right' | 'up' | 'left' = "down";

  constructor() { super('map'); }

  preload() {
    // ✅ carica la mappa JSON e il tileset PNG
    this.load.tilemapTiledJSON('map', 'assets/maps/mappa_1.json');
    this.load.image('terreno', 'assets/tiles/terreno.png');
    this.load.image('case', 'assets/tiles/case.png');


    // sprite del player
    this.load.spritesheet('player', 'assets/sprites/player.png', {
      frameWidth: 48, frameHeight: 48
    });

    //sprite slime
    this.load.spritesheet('slime', 'assets/sprites/slime.png', { frameWidth: 32, frameHeight: 32 });

  }

  create() {
    this.map = this.make.tilemap({ key: 'map' });

    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);


    // ⚠️ "terreno" deve essere il NOME del tileset in Tiled
    const tiles = this.map.addTilesetImage('terreno', 'terreno');
    const house_tiles = this.map.addTilesetImage("case", "case")

    const tilesets = [tiles, house_tiles].filter(Boolean) as Phaser.Tilemaps.Tileset[];


    // ⚠️ usa i NOMI DEI LAYER come in Tiled (es. "ground" e "walls")
    this.ground = this.map.createLayer('ground', tilesets!, 0, 0);
    this.walls = this.map.createLayer('walls', tilesets!, 0, 0) ?? undefined;
    this.walls?.setDepth(999);
    // Abilita collisione sui tile con proprietà { collider: true }
    this.walls?.setCollisionByProperty({ collider: true });


    // --- animazioni ---
    // Idle: prendi tutta la riga
    makeRowAnim(this, 'idle-down', 0, { fps: 6 });
    makeRowAnim(this, 'idle-right', 1, { fps: 6 });
    makeRowAnim(this, 'idle-up', 2, { fps: 6 });

    // Move: solo i primi 6 frame della riga (se la riga è più lunga)
    makeRowAnim(this, 'move-down', 3, { fps: 10, count: 6 });
    makeRowAnim(this, 'move-right', 4, { fps: 10, count: 6 });
    makeRowAnim(this, 'move-up', 5, { fps: 10, count: 6 });

    // Attack: 4 frame, riproduci una volta
    makeRowAnim(this, 'attack-down', 6, { fps: 12, count: 4, repeat: 0 });
    makeRowAnim(this, 'attack-right', 7, { fps: 12, count: 4, repeat: 0 });
    makeRowAnim(this, 'attack-up', 8, { fps: 12, count: 4, repeat: 0 });

    // hit: tutta la riga, una volta sola, con yoyo opzionale
    makeRowAnim(this, 'hit', 9, { fps: 8, repeat: 0 });



    /*
    slime
    */
    this.slimes = this.physics.add.group();

    const objLayer = this.map.getObjectLayer('Objects');
    objLayer?.objects.forEach((o: Phaser.Types.Tilemaps.TiledObject) => {
      const props = Object.fromEntries((o.properties ?? []).map((p: any) => [p.name, p.value]));
      if (props['sprite'] === 'slime') {
        // crea anim solo una volta

        makeRowAnim(this, 'slime-idle', 0, {
          fps: 8,
          count: 4,
          repeat: -1,
          textureKey: 'slime',
          frameWidth: 32
        });
        // Coordinate da Tiled:
        // - se l’oggetto è un "Rectangle": Tiled salva x,y in alto-sinistra.
        //   Per centrare lo sprite sul rettangolo:
        const rx = (o.x ?? 0) + (o.width ?? 0) / 2;
        const ry = (o.y ?? 0) + (o.height ?? 0) / 2;

        const slime = this.physics.add.sprite(rx, ry, 'slime', 0);
        slime.play('slime-idle');

        // hitbox più tonda (opzionale)
        slime.body.setCircle(10, 6, 8); // raggio 12 dentro 32x32
        slime.setDepth(10);
        slime.setBounce(1, 1);               // rimbalzo elastico
        slime.setCollideWorldBounds(true);

        this.slimes.add(slime);
        this.time.addEvent({
          delay: 200,
          loop: true,
          callback: () => {
            const dirs = [
              { vx: 50, vy: 0 },  // right
              { vx: -50, vy: 0 },  // left
              { vx: 0, vy: 50 }, // down
              { vx: 0, vy: -50 }, // up
              { vx: -50, vy: +50 }, //basso a sx
              { vx: +50, vy: +50 }, //in basso a dx
              { vx: -50, vy: -50 }, //in alto a dx
              { vx: +50, vy: +50 } //in alto a sx

            ];
            const choice = Phaser.Math.RND.pick(dirs);
            slime.setVelocity(choice.vx, choice.vy);
          }
        });
      }

    });



    // --- player ---
    this.player = this.physics.add.sprite(96, 96, 'player', 0);
    this.player.setSize(24, 30).setOffset(12, 18); // hitbox un po' più bassa (opzionale)
    this.player.setDepth(10); // sopra i muri bassi

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyAttack = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.wasd = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      right: Phaser.Input.Keyboard.KeyCodes.D
    }) as Record<'up' | 'left' | 'down' | 'right', Phaser.Input.Keyboard.Key>;

    this.facing = 'down';


    // Player
    this.player.setCollideWorldBounds(true);

    // Collisione player ↔ walls
    if (this.walls) {
      this.physics.add.collider(this.slimes, this.walls);
      this.physics.add.collider(this.player, this.walls);
      this.physics.add.collider(this.slimes, this.slimes);
    }

    this.physics.add.overlap(this.player, this.slimes, (obj1, obj2) => {
      if (this.hit) return;

      const player = obj1 as Phaser.Physics.Arcade.Sprite;
      const slime = obj2 as Phaser.Physics.Arcade.Sprite;
      const dir = new Phaser.Math.Vector2(player.x - slime.x, player.y - slime.y).normalize();
      player.setVelocity(dir.x * 50, dir.y * 50);
      player.setTintFill(0xffffff);
      this.time.delayedCall(120, () => player.clearTint());
      this.hit = true
      this.player.play("hit", true)
      this.player.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        this.hit = false
        this.life -= 1
      });
    }, undefined, this);

    // Camera
    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.cameras.main.setZoom(2);

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();

    this.startTime = this.time.now;
    this.setupValidSpawn();

    this.time.addEvent({
      delay: 1200, // ogni 1.2s
      loop: true,
      callback: () => this.createSlime()
    });

    //setuppo i tp
    // --- TP: trigger 8x8 centrato dentro ogni rettangolo 16x16 di "tp"
    const tpLayer = this.map.getObjectLayer('tp');
    const tpGroup = this.physics.add.staticGroup();

    tpLayer?.objects.forEach((o: Phaser.Types.Tilemaps.TiledObject) => {
      const ow = o.width ?? 16;
      const oh = o.height ?? 16;

      // centro del rettangolo di Tiled (x,y = top-left)
      const cx = (o.x ?? 0) + ow / 2;
      const cy = (o.y ?? 0) + oh / 2;

      // props da Tiled -> dizionario semplice
      const props = Object.fromEntries((o.properties ?? []).map((p: any) => [p.name, p.value]));

      // zona 12x12 con collider 8x8 centrato
      const zone = this.add.zone(cx, cy, 12, 12).setName(o.name || '');
      this.physics.world.enable(zone, Phaser.Physics.Arcade.STATIC_BODY);
      const body = zone.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(8, 8).updateFromGameObject();

      zone.setData('props', props);
      zone.setData('raw', o);

      tpGroup.add(zone);
    });

    this.physics.add.overlap(this.player, tpGroup, (_p, z: any) => {
      const children = tpGroup.getChildren();              // GameObject[]
      if (children.length === 0) return;

      const zone = Phaser.Utils.Array.GetRandom(children) as Phaser.GameObjects.Zone;
      if (!this.tp_now && this.facing==="up") {
        this.player.x = zone.x
        this.player.y = zone.y+10
        this.tp_now = true;

        this.time.addEvent({
          delay: 1200, // dopo 1.2 sec
          loop: false,
          callback: () => { this.tp_now = false; }
        });
      }

    });
  }

  // Firma corretta per Phaser.Scene
  override update() {
    this.walls?.setDepth(999);
    this.player.setDepth(10);


    console.log(this.life)
    if (this.life <= 0) {
      this.survivedTime = Math.floor((this.time.now - this.startTime) / 1000); // secondi
      alert("SEI MORTO, hai fatto " + this.survivedTime + " punti");
      this.life = 3
      // restart scena → ricrea player, slimes, mappa ecc.
      this.scene.restart();
    }

    if (this.hit) {
      return;
    }

    if (!this.isAttacking && Phaser.Input.Keyboard.JustDown(this.keyAttack)) {
      this.startAttack();
      return; // non fare altro in questo frame
    }

    if (this.isAttacking) return;


    const speed = 140;
    let vx = 0, vy = 0;


    const left = this.cursors.left?.isDown || this.wasd.left.isDown;
    const right = this.cursors.right?.isDown || this.wasd.right.isDown;
    const up = this.cursors.up?.isDown || this.wasd.up.isDown;
    const down = this.cursors.down?.isDown || this.wasd.down.isDown;

    if (left) { vx = -speed; this.facing = 'left'; }
    else if (right) { vx = speed; this.facing = 'right'; }

    if (up) { vy = -speed; this.facing = 'up'; }
    else if (down) { vy = speed; this.facing = 'down'; }



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

  private setupValidSpawn() {

    this.ground?.forEachTile((t) => {
      if (!t) return;                    // nessun tile
      if (t.index == -1) return;
      const tx = t.x, ty = t.y;

      // esiste un tile di walls qui?
      const w = this.walls?.getTileAt(tx, ty);
      const isBlocked = !!w && ((w.properties as any)?.collider === true || w.index !== -1 && w.collides);

      if (!isBlocked) {
        this.validSpawnTiles.push({ tx, ty });
      }
    });
  }

  private pickSpawnWorldPos(): { x: number; y: number } {
    const { tx, ty } = Phaser.Utils.Array.GetRandom(this.validSpawnTiles);

    if (!this.ground) { return { x: 0, y: 0 } }

    const x = this.ground.tileToWorldX(tx) + this.map.tileWidth / 2;
    const y = this.ground.tileToWorldY(ty) + this.map.tileHeight / 2;
    return { x: x, y: y };
  }
  private createSlime() {
    const { x, y } = this.pickSpawnWorldPos();

    const slime = this.physics.add.sprite(x, y, 'slime', 0);
    slime.play('slime-idle');

    // hitbox più tonda (opzionale)
    slime.body.setCircle(10, 6, 8); // raggio 12 dentro 32x32
    slime.setDepth(10);
    slime.setBounce(1, 1);               // rimbalzo elastico
    slime.setCollideWorldBounds(true);

    this.slimes.add(slime);
    this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        const dirs = [
          { vx: 50, vy: 0 },  // right
          { vx: -50, vy: 0 },  // left
          { vx: 0, vy: 50 }, // down
          { vx: 0, vy: -50 }, // up
          { vx: -50, vy: +50 }, //basso a sx
          { vx: +50, vy: +50 }, //in basso a dx
          { vx: -50, vy: -50 }, //in alto a dx
          { vx: +50, vy: +50 } //in alto a sx

        ];
        const choice = Phaser.Math.RND.pick(dirs);
        slime.setVelocity(choice.vx, choice.vy);
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
  const end = row * cols + toCol;
  if (scene.anims.exists(key)) return;

  scene.anims.create({
    key,
    frames: scene.anims.generateFrameNumbers(texKey, { start, end }),
    frameRate: opts.fps ?? 10,
    repeat: opts.repeat ?? -1,
    yoyo: !!opts.yoyo
  });

}




