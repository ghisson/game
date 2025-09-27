// BotPlayer.ts
import Phaser from "phaser";
import { BaseActor, ActorConfig } from "../base/BaseActor";

export interface BotConfig {
    sightRange?: number;
    attackRange?: number;
    attackCooldownMs?: number;
    wanderRadius?: number;
    speedScale?: number;
    losCheck?: boolean; // placeholder per futuri raycast
    slideAngleDeg?: number; // angolo di deviazione quando bloccato
    stuckMs?: number;       // ms di immobilità prima dell'unstick laterale
}

type BotState = "wander" | "chase" | "attack";

export class BotPlayer extends BaseActor {
    private target: BaseActor;
    private cfg: Required<BotConfig>;
    private state: BotState = "wander";

    private aiDir = new Phaser.Math.Vector2();
    private wanderTarget = new Phaser.Math.Vector2();
    private cooldownUntil = 0;
    private stuckTimer = 0;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        target: BaseActor,
        cfg: ActorConfig & BotConfig
    ) {
        super(scene, x, y, cfg);
        this.target = target;

        this.cfg = {
            sightRange: cfg.sightRange ?? 160,
            attackRange: cfg.attackRange ?? 40,
            attackCooldownMs: cfg.attackCooldownMs ?? 450,
            wanderRadius: cfg.wanderRadius ?? 80,
            speedScale: cfg.speedScale ?? 0.9,
            losCheck: cfg.losCheck ?? false,
            slideAngleDeg: cfg.slideAngleDeg ?? 60,
            stuckMs: cfg.stuckMs ?? 250,
        };

        this.pickNewWanderPoint();
    }

    // ========== Template Methods override ==========

    protected getMoveVector(): Phaser.Math.Vector2 {
        const s = this.getSprite();
        const t = this.target.getSprite();
        const dist = Phaser.Math.Distance.Between(s.x, s.y, t.x, t.y);

        // --- Transizioni di stato
        if (this.state === "wander" && dist <= this.cfg.sightRange /* && this.hasLOS() */) {
            this.state = "chase";
        }
        if (this.state === "chase" && dist > this.cfg.sightRange * 1.25) {
            this.state = "wander";
        }
        if (this.state === "chase" && dist <= this.cfg.attackRange) {
            this.state = "attack";
        }

        switch (this.state) {
            case "wander":
                this.updateWander(s);
                break;

            case "chase":
                this.moveTowards(t.x, t.y);
                break;

            case "attack":
                this.faceTarget();
                // Micro-reposition: se sei sul bordo del range, avanza leggermente
                if (dist > this.cfg.attackRange * 1.05) {
                    this.moveTowards(t.x, t.y);
                } else {
                    this.aiDir.set(0, 0);
                }
                // Se scivola troppo fuori dal range, torna a "chase"
                if (dist > this.cfg.attackRange * 1.25) {
                    this.state = "chase";
                }
                break;
        }

        // --- Failsafe: se bloccato per troppo tempo, imposta waypoint laterale
        this.handleUnstick();

        return this.aiDir;
    }

    protected wantsAttack(): boolean {
        if (this.state !== "attack") return false;
        return this.scene.time.now >= this.cooldownUntil;
    }

    protected override onAttackStart(): void {
        // imposta cooldown
        this.cooldownUntil = this.scene.time.now + this.cfg.attackCooldownMs;
    }

    // ========== Helpers AI ==========

    protected moveTowards(x: number, y: number) {
        const s = this.getSprite();
        this.aiDir.set(x - s.x, y - s.y);
        if (this.aiDir.lengthSq() > 1e-6) this.aiDir.normalize();
        this.aiDir.scale(this.cfg.speedScale);

        // Se il corpo risulta bloccato (o sta toccando), prova “slide” a ±angle
        const body = this.getBody();
        if (body && (!body.blocked.none || !body.touching.none)) {
            this.tryUnstuckSlide(this.aiDir);
        }
    }

    protected updateWander(s: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody) {
        const d = Phaser.Math.Distance.Between(s.x, s.y, this.wanderTarget.x, this.wanderTarget.y);
        if (d < 8) this.pickNewWanderPoint();
        this.moveTowards(this.wanderTarget.x, this.wanderTarget.y);
        // random jitter
        if (Phaser.Math.Between(0, 1000) < 5) this.pickNewWanderPoint();
    }

    protected pickNewWanderPoint() {
        const s = this.getSprite();
        const bounds = this.scene.physics.world.bounds;

        // prova alcuni punti e scegli il primo “valido”
        for (let i = 0; i < 8; i++) {
            const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const r = Phaser.Math.FloatBetween(this.cfg.wanderRadius * 0.3, this.cfg.wanderRadius);
            const nx = s.x + Math.cos(ang) * r;
            const ny = s.y + Math.sin(ang) * r;

            if (bounds.contains(nx, ny)) {
                this.wanderTarget.set(nx, ny);
                return;
            }
        }
        // fallback: resta dove sei
        this.wanderTarget.set(s.x, s.y);
    }

    protected faceTarget() {
        const s = this.getSprite();
        const t = this.target.getSprite();
        const dx = t.x - s.x, dy = t.y - s.y;
        // aggiorna facing (se la tua BaseActor lo usa per animazioni)
        (this as any)["facing"] = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    }

    private tryUnstuckSlide(base: Phaser.Math.Vector2) {
        // ruota la direzione base di ±slideAngleDeg e scegli una delle due
        const angle = Math.atan2(base.y, base.x);
        const delta = Phaser.Math.DegToRad(this.cfg.slideAngleDeg);
        const pickLeft = Math.random() < 0.5;

        const nx = Math.cos(angle + (pickLeft ? delta : -delta));
        const ny = Math.sin(angle + (pickLeft ? delta : -delta));

        this.aiDir.set(nx, ny).scale(this.cfg.speedScale * 0.85);
    }

    private handleUnstick() {
        const body = this.getBody();
        if (!body) return;

        const speed = body.velocity.length();
        const touchingSomething = (!body.blocked.none || !body.touching.none);

        if (speed < 5 && touchingSomething) {
            this.stuckTimer += this.scene.game.loop.delta;
            if (this.stuckTimer > this.cfg.stuckMs) {
                // crea un waypoint laterale per “aggirare”
                const side = Math.random() < 0.5 ? 1 : -1;
                const forward = this.aiDir.lengthSq() > 0 ? this.aiDir.clone().normalize() : new Phaser.Math.Vector2(1, 0);
                const lateral = new Phaser.Math.Vector2(-forward.y, forward.x).normalize().scale(this.cfg.wanderRadius * 0.6 * side);

                const s = this.getSprite();
                this.wanderTarget.set(s.x + lateral.x, s.y + lateral.y);

                // forza una micro-transizione: se eri in attack ma lontano, rientra in chase
                if (this.state === "attack") this.state = "chase";

                this.stuckTimer = 0;
            }
        } else {
            this.stuckTimer = 0;
        }
    }

    private getBody(): Phaser.Physics.Arcade.Body | null {
        const sp = this.getSprite();
        return (sp.body as Phaser.Physics.Arcade.Body) ?? null;
    }

    // hasLOS() { ... } // opzionale: raycast su tilemap se attivi losCheck
}
