import Phaser from "phaser";
import { throwError } from "rxjs";
import { createAnim } from "../../utils/CreateAnim"
export type PlayerEvents = {
    DAMAGED: "player:damaged";
    HEALED: "player:healed";
    DIED: "player:died";
    ATTACK: "player:attack";
};

export const PlayerEvent: PlayerEvents = {
    DAMAGED: "player:damaged",
    HEALED: "player:healed",
    DIED: "player:died",
    ATTACK: "player:attack",
};

export interface PlayerConfig {
    key?: string;                 // atlas/spritesheet key (es. 'player')
    startFrame?: number;         // frame iniziale
    speed?: number;              // velocità di movimento px/s
    maxHP?: number;              // vita massima
    depthByY?: boolean;          // se true setta depth = y ad ogni frame
    bodySize?: { w: number; h: number; ox?: number; oy?: number }; // hitbox
}

export class Player {
    public readonly sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    private scene: Phaser.Scene;
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd?: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key; attack?: Phaser.Input.Keyboard.Key; };
    private speed: number;
    private maxHP: number;
    private hp: number;
    private facing: "down" | "left" | "right" | "up" = "down";
    private depthByY: boolean;
    private depth = 10;
    private isAttacking = false
    private hit = false;
    private isDied = false;

    private aiEnabled = false;
    private aiDir = new Phaser.Math.Vector2(0, 0);
    private aiWantsAttack = false;
    constructor(scene: Phaser.Scene, x: number, y: number, cfg: PlayerConfig) {
        this.scene = scene;
        this.speed = cfg.speed ?? 120;
        this.maxHP = cfg.maxHP ?? 5;
        this.hp = this.maxHP;
        this.depthByY = cfg.depthByY ?? true;

        this.sprite = scene.physics.add.sprite(x ?? 96, y ?? 96, cfg.key ?? "player", cfg.startFrame ?? 0);
        this.sprite.setSize(24, 30).setOffset(12, 18); // hitbox un po' più bassa (opzionale)
        this.sprite.setDepth(this.depth); // sopra i muri bassi
        this.sprite.setCollideWorldBounds(true);
        this.createAnim();
        this.setWASDControls();
        //this.sprite.setOrigin(0.5, 0.5);

        /*// Hitbox “capsule”/rettangolo
        if (cfg.bodySize && this.sprite.body) {
          this.sprite.body
            .setSize(cfg.bodySize.w, cfg.bodySize.h)
            .setOffset(cfg.bodySize.ox ?? (this.sprite.width - cfg.bodySize.w) / 2,
                       cfg.bodySize.oy ?? (this.sprite.height - cfg.bodySize.h) / 2);
        } else {
          // default: più stretto in larghezza
          this.sprite.body.setSize(this.sprite.width * 0.5, this.sprite.height * 0.6);
          this.sprite.body.setOffset(this.sprite.width * 0.25, this.sprite.height * 0.4);
        }*/
    }

    setCursorControls() {
        this.cursors = this.scene?.input?.keyboard?.createCursorKeys();
    }

    enableAIControl(on = true) { this.aiEnabled = on; }
    setAIInput(x: number, y: number, wantsAttack = false) {
        this.aiDir.set(x, y);
        this.aiWantsAttack = wantsAttack;
    }

    setWASDControls() {
        const kb = this.scene.input.keyboard;
        if (kb == null) {
            throwError(() => new Error("Impossibile caricare kb"))
            console.error("Impossibile caricare kb")
            return;
        }

        this.wasd = {
            up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            attack: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        };
    }

    // Call in Scene.update()
    /*update() {
        if (this.isAttacking || this.hit) return;
        const body = this.sprite.body as Phaser.Physics.Arcade.Body;
        if (!body) return;

        // input
        const up = !!(this.cursors?.up.isDown || this.wasd?.up.isDown);
        const down = !!(this.cursors?.down.isDown || this.wasd?.down.isDown);
        const left = !!(this.cursors?.left.isDown || this.wasd?.left.isDown);
        const right = !!(this.cursors?.right.isDown || this.wasd?.right.isDown);

        let vx = 0, vy = 0;
        if (left) vx -= 1;
        if (right) vx += 1;
        if (up) vy -= 1;
        if (down) vy += 1;

        // diagonal normalize
        if (vx !== 0 && vy !== 0) {
            const inv = 1 / Math.sqrt(2);
            vx *= inv; vy *= inv;
        }

        body.setVelocity(vx * this.speed, vy * this.speed);

        // facing
        if (Math.abs(vx) > Math.abs(vy)) {
            this.facing = vx > 0 ? "right" : "left";
        } else if (Math.abs(vy) > 0) {
            this.facing = vy > 0 ? "down" : "up";
        }

        // animazioni
        const base = this.sprite.texture.key; // assume key = atlas del player
        const mk = (k: string) => `${base}-${k}`;
        if (vx === 0 && vy === 0) {
            if (this.facing === 'left') {
                this.sprite.setFlipX(true);
                this.sprite.play(mk('idle-right'), true); // usa right flippata
            } else {
                this.sprite.setFlipX(false);
                this.sprite.play(mk(`idle-${this.facing}`), true);

            }
            body.setAcceleration(0);
        } else {

            if (this.facing === 'left') {
                this.sprite.setFlipX(true);
                this.sprite.play(mk('walk-right'), true); // usa right flippata
            } else {
                this.sprite.setFlipX(false);
                const key = mk(`walk-${this.facing}`);
                this.sprite.play(key, true);
            }
        }

        // depth sorting per passare dietro/davanti
        if (this.depthByY) this.sprite.setDepth(this.sprite.y);

        // attacco
        if (Phaser.Input.Keyboard.JustDown(this.wasd?.attack ?? (this.cursors as any)?.space)) {
            this.attack();
        }
    }*/

    update() {
        if (this.isAttacking || this.hit || this.isDied) return;
        const body = this.sprite.body as Phaser.Physics.Arcade.Body;
        if (!body) return;

        let vx = 0, vy = 0;

        if (this.aiEnabled) {
            // input virtuale
            vx = Phaser.Math.Clamp(this.aiDir.x, -1, 1);
            vy = Phaser.Math.Clamp(this.aiDir.y, -1, 1);
        } else {
            // input tastiera (tuo codice attuale)
            const up = !!(this.cursors?.up.isDown || this.wasd?.up.isDown);
            const down = !!(this.cursors?.down.isDown || this.wasd?.down.isDown);
            const left = !!(this.cursors?.left.isDown || this.wasd?.left.isDown);
            const right = !!(this.cursors?.right.isDown || this.wasd?.right.isDown);
            if (left) vx -= 1; if (right) vx += 1;
            if (up) vy -= 1; if (down) vy += 1;
        }

        // normalize diagonale
        if (vx !== 0 && vy !== 0) { const inv = 1 / Math.sqrt(2); vx *= inv; vy *= inv; }
        body.setVelocity(vx * this.speed, vy * this.speed);

        // facing
        if (Math.abs(vx) > Math.abs(vy)) this.facing = vx > 0 ? "right" : "left";
        else if (Math.abs(vy) > 0) this.facing = vy > 0 ? "down" : "up";

        // animazioni (identico al tuo codice)
        const base = this.sprite.texture.key; const mk = (k: string) => `${base}-${k}`;
        if (vx === 0 && vy === 0) {
            if (this.facing === 'left') { this.sprite.setFlipX(true); this.sprite.play(mk('idle-right'), true); }
            else { this.sprite.setFlipX(false); this.sprite.play(mk(`idle-${this.facing}`), true); }
            body.setAcceleration(0);
        } else {
            if (this.facing === 'left') { this.sprite.setFlipX(true); this.sprite.play(mk('walk-right'), true); }
            else { this.sprite.setFlipX(false); this.sprite.play(mk(`walk-${this.facing}`), true); }
        }

        if (this.depthByY) this.sprite.setDepth(this.sprite.y);

        // attacco
        if (this.aiEnabled) {
            if (this.aiWantsAttack) this.attack();
        } else {
            if (Phaser.Input.Keyboard.JustDown(this.wasd?.attack ?? (this.cursors as any)?.space)) this.attack();
        }
    }


    attack() {
        const base = this.sprite.texture.key;
        const mk = (k: string) => `${base}-${k}`;

        // evita spam se è già in corso un'anim di attack
        const current = this.sprite.anims.currentAnim?.key ?? "";
        if (current.includes("attack") && this.sprite.anims.isPlaying) return;

        this.isAttacking = true;

        // determina la key da usare (sinistra = flip della right)
        const key = (this.facing === 'left') ? mk('attack-right') : mk(`attack-${this.facing}`);

        // flip coerente
        this.sprite.setFlipX(this.facing === 'left');

        // PLAY
        this.sprite.play(key, true);

        // quando FINISCE (o viene interrotta), sblocca
        this.sprite.once(`animationcomplete-${key}`, () => { this.isAttacking = false; });
        this.sprite.once(`animationstop-${key}`, () => { this.isAttacking = false; });

        // finestra di hit (regolala sul frame giusto se vuoi)
        this.scene.time.delayedCall(120, () => {
            this.scene.events.emit(PlayerEvent.ATTACK, {
                range: 20,
                size: 20,
                owner: this,
            });
        });
    }

    damage(amount = 1, x: number, y: number) {
        if (this.hp == 0) return;
        const base = this.sprite.texture.key; // assume key = atlas del player
        const mk = (k: string) => `${base}-${k}`;

        const current = this.sprite.anims.currentAnim?.key ?? "";
        if (current.includes("hit") && this.sprite.anims.isPlaying) return;

        this.hit = true;
        this.hp = Math.max(0, this.hp - amount);
        if (this.hp <= 0) {
            this.die();
            return;
        }
        this.flash();
        const dir = new Phaser.Math.Vector2(this.sprite.x - x, this.sprite.y - y).normalize();
        this.sprite.setVelocity(dir.x * 50, dir.y * 50);
        this.scene.events.emit(PlayerEvent.DAMAGED, { hp: this.hp, maxHP: this.maxHP, who: this });
        this.sprite.play(mk("hit"), true)

        this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
            this.hit = false
        });


    }

    heal(amount = 1) {
        this.hp = Math.min(this.maxHP, this.hp + amount);
        this.scene.events.emit(PlayerEvent.HEALED, { hp: this.hp, maxHP: this.maxHP, who: this });
    }

    private die() {
        const base = this.sprite.texture.key; // assume key = atlas del player
        const mk = (k: string) => `${base}-${k}`;

        (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        this.sprite.setTint(0xff5555);
        this.sprite.play(mk("hit"), true)
        this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
            this.isDied = true
            this.sprite.anims.stop();
        });

        this.scene.events.emit(PlayerEvent.DIED, { who: this });
    }

    private flash() {
        this.sprite.setTintFill(0xffffff);
        this.scene.time.delayedCall(80, () => this.sprite.clearTint());
    }

    // Utils
    setPosition(x: number, y: number) { this.sprite.setPosition(x, y); }
    getHP() { return this.hp; }
    getMaxHP() { return this.maxHP; }
    setSpeed(s: number) { this.speed = s; }
    getSpeed() { return this.speed; }
    destroy() { this.sprite.destroy(); }

    private createAnim() {
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
        createAnim(this.scene, mk('hit'), 9, { fps: 8, repeat: 0, textureKey: this.sprite.texture.key });
    }

    getSprite() {
        return this.sprite;
    }

    getFacing() {
        return this.facing;
    }
}
