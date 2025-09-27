// BaseActor.ts
import Phaser from "phaser";
import { createAnim } from "../../utils/CreateAnim"

export type Facing = "up" | "down" | "left" | "right";

export interface AttackEventPayload {
  owner: BaseActor;
  facing: Facing;
  range: number;
  size: number;
}

export type ActorEvents = {
  DAMAGED: "actor:damaged";
  HEALED: "actor:healed";
  DIED: "actor:died";
  ATTACK: "actor:attack";
};
export const ActorEvent: ActorEvents = {
  DAMAGED: "actor:damaged",
  HEALED: "actor:healed",
  DIED: "actor:died",
  ATTACK: "actor:attack",
};

export interface ActorConfig {
  key: string;                         // spritesheet key (es. "player")
  startFrame?: number;
  speed?: number;
  maxHP?: number;
  depthByY?: boolean;
  bodySize?: { w: number; h: number; ox?: number; oy?: number };
}

export abstract class BaseActor {
  protected scene: Phaser.Scene;
  protected sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

  protected speed: number;
  protected maxHP: number;
  protected hp: number;
  protected depthByY: boolean;

  protected facing: "down" | "left" | "right" | "up" = "down";
  protected isAttacking = false;
  protected isHit = false;
  protected isDead = false;
  private _stop:boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, cfg: ActorConfig) {
    this.scene = scene;
    this.speed = cfg.speed ?? 120;
    this.maxHP = cfg.maxHP ?? 5;
    this.hp = this.maxHP;
    this.depthByY = cfg.depthByY ?? true;
    this._stop=false;
    this.sprite = scene.physics.add.sprite(x, y, cfg.key, cfg.startFrame ?? 0);
    if (cfg.bodySize) {
      const { w, h, ox, oy } = cfg.bodySize;
      this.sprite.setSize(w, h).setOffset(ox ?? (this.sprite.width - w) / 2, oy ?? (this.sprite.height - h) / 2);
    } else {
      this.sprite.setSize(24, 30).setOffset(12, 18);
    }
    this.sprite.setCollideWorldBounds(true);
    this.createAnim();
  }

  // --------- Template Methods da overridare nei figli ----------
  /** Fornisce l’input di movimento normalizzato (-1..1). */
  protected abstract getMoveVector(): Phaser.Math.Vector2;
  /** Indica se l’attore vuole attaccare in questo frame. */
  protected abstract wantsAttack(): boolean;

  // Hook opzionali
  protected onAttackStart() { }
  protected onAttackEnd() { }
  protected onDamaged(_amount: number) { }
  protected onDeath() { }

  // --------- Loop principale ---------
  update(): void {
    if (this.isDead || this._stop) return;

    // prima dei calcoli (hook)
    this.beforeUpdate();

    // se in anim di attacco/hit, puoi decidere se bloccare il movimento
    if (this.isAttacking || this.isHit) return;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (!body) return;

    const dir = this.getMoveVector(); // <- fornito dalla sottoclasse
    let vx = Phaser.Math.Clamp(dir.x, -1, 1);
    let vy = Phaser.Math.Clamp(dir.y, -1, 1);

    if (vx !== 0 && vy !== 0) {
      const inv = 1 / Math.sqrt(2);
      vx *= inv; vy *= inv;
    }

    body.setVelocity(vx * this.speed, vy * this.speed);

    // facing
    if (Math.abs(vx) > Math.abs(vy)) this.facing = vx > 0 ? "right" : "left";
    else if (Math.abs(vy) > 0) this.facing = vy > 0 ? "down" : "up";

    // animazioni
    const base = this.sprite.texture.key;
    const mk = (k: string) => `${base}-${k}`;

    if (vx === 0 && vy === 0) {
      if (this.facing === "left") {
        this.sprite.setFlipX(true);
        this.safePlay(mk("idle-right"));
      } else {
        this.sprite.setFlipX(false);
        this.safePlay(mk(`idle-${this.facing}`));
      }
      body.setAcceleration(0);
    } else {
      if (this.facing === "left") {
        this.sprite.setFlipX(true);
        this.safePlay(mk("walk-right"));
      } else {
        this.sprite.setFlipX(false);
        this.safePlay(mk(`walk-${this.facing}`));
      }
    }

    if (this.depthByY) this.sprite.setDepth(this.sprite.y);

    // attacco
    if (this.wantsAttack()) this.attack();

    // dopo i calcoli (hook)
    this.afterUpdate();
  }

  protected beforeUpdate() { }
  protected afterUpdate() { }

  // --------- Combat ---------
  attack(): void {
    if (this.isDead || this.isAttacking || this.isHit) return;
    this.sprite.setVelocity(0,0)
    const base = this.sprite.texture.key;
    const mk = (k: string) => `${base}-${k}`;
    const key = this.facing === "left" ? mk("attack-right") : mk(`attack-${this.facing}`);

    this.isAttacking = true;
    this.sprite.setFlipX(this.facing === "left");
    this.safePlay(key);
    this.onAttackStart();

    const clearAttack = () => {
      if (!this.isAttacking) return;
      this.isAttacking = false;
      this.onAttackEnd();
    };

    this.sprite.once(`animationcomplete-${key}`, clearAttack);
    this.sprite.once(`animationstop-${key}`, clearAttack);

    // hit window
    this.scene.time.delayedCall(120, () => {
      this.scene.events.emit(ActorEvent.ATTACK, {
        owner: this, facing: this.facing, range: 20, size: 20
      } as AttackEventPayload);
    });

    // failsafe (se qualcosa interrompe l'anim in modo strano)
    this.scene.time.delayedCall(600, clearAttack);
  }

  damage(amount = 1, srcX?: number, srcY?: number): void {
    if (this.isDead || this.isHit) return;

    this.hp = Math.max(0, this.hp - amount);
    this.onDamaged(amount);

    if (this.hp <= 0) { this.die(); return; }

    // ---- HIT STUN ----
    this.isHit = true;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    // knockback (facoltativo)
    if (srcX !== undefined && srcY !== undefined) {
      const dir = new Phaser.Math.Vector2(this.sprite.x - srcX, this.sprite.y - srcY).normalize();
      body.setVelocity(dir.x * 50, dir.y * 50);
      this.flash();
    }

    const base = this.sprite.texture.key;
    const mk = (k: string) => `${base}-${k}`;
    const hitKey = mk("hit");

    // evita di riavviare l'anim se è già in play
    if (this.sprite.anims.currentAnim?.key !== hitKey) {
      this.safePlay(hitKey);
    }

    // listener robusti
    const clearHit = () => {
      if (!this.isHit) return;
      this.isHit = false;
      body.setVelocity(0, 0);
    };

    this.sprite.once(`animationcomplete-${hitKey}`, clearHit);
    this.sprite.once(`animationstop-${hitKey}`, clearHit);

    // failsafe nel caso l'evento non arrivi (ad es. anim interrotta weird)
    this.scene.time.delayedCall(300, clearHit);

    this.scene.events.emit(ActorEvent.DAMAGED, { hp: this.hp, maxHP: this.maxHP, who: this });
  }


  protected die(): void {
    if (this.isDead) return;
    this.isDead = true;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.enable = false;

    // gioca "hit" come death fallback (o overrida e usa "death")
    const base = this.sprite.texture.key;
    const mk = (k: string) => `${base}-${k}`;

    const key = mk("hit");
    const anim = this.scene.anims.get(key);
    if (anim) anim.hideOnComplete = false;

    this.safePlay(key);
    this.sprite.once(`animationcomplete-${key}`, () => {
      this.sprite.anims.stop();
      this.onDeath();
    });

    this.scene.events.emit(ActorEvent.DIED, { who: this });
  }

  // --------- Utils ---------
  protected safePlay(key: string) {
    if (this.scene.anims.exists(key)) this.sprite.play(key, true);
    else {
      // se manca, fermo l’anim corrente per evitare stati strani
      this.sprite.anims.stop();
      console.error("Missing anim")
    }
  }
  protected flash() {
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => this.sprite.clearTint());
  }


  protected createAnim() {
    const base = this.sprite.texture.key; // assume key = atlas del player
    const mk = (k: string) => `${base}-${k}`;

    createAnim(this.scene, mk(`idle-down`), 0, { fps: 6, textureKey: this.sprite.texture.key });
    createAnim(this.scene, mk(`idle-right`), 1, { fps: 6, textureKey: this.sprite.texture.key });
    createAnim(this.scene, mk(`idle-up`), 2, { fps: 6, textureKey: this.sprite.texture.key });

    // Move: solo i primi 6 frame della riga (se la riga è più lunga)
    createAnim(this.scene, mk('walk-down'), 3, { fps: 10, count: 6, textureKey: this.sprite.texture.key });
    createAnim(this.scene, mk('walk-right'), 4, { fps: 10, count: 6, textureKey: this.sprite.texture.key });
    createAnim(this.scene, mk('walk-up'), 5, { fps: 10, count: 6, textureKey: this.sprite.texture.key });

    // Attack: 4 frame, riproduci una volta
    createAnim(this.scene, mk('attack-down'), 6, { fps: 12, count: 4, repeat: 0, textureKey: this.sprite.texture.key });
    createAnim(this.scene, mk('attack-right'), 7, { fps: 12, count: 4, repeat: 0, textureKey: this.sprite.texture.key });
    createAnim(this.scene, mk('attack-up'), 8, { fps: 12, count: 4, repeat: 0, textureKey: this.sprite.texture.key });

    // hit: tutta la riga, una volta sola, con yoyo opzionale
    createAnim(this.scene, mk('hit'), 9, { fps: 8, repeat: 0, count: 3, textureKey: this.sprite.texture.key });
  }


  getSprite() { return this.sprite; }
  getFacing() { return this.facing; }
  getHP() { return this.hp; }
  getMaxHP() { return this.maxHP; }
  setSpeed(s: number) { this.speed = s; }
  isAlive() { return !this.isDead; }
  stop(){this._stop=true}
}
