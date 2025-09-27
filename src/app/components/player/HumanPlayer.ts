// HumanPlayer.ts
import Phaser from "phaser";
import { BaseActor, ActorConfig } from "../base/BaseActor";
import { throwError } from "rxjs";

type Keys = {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  attack?: Phaser.Input.Keyboard.Key;
};

export class HumanPlayer extends BaseActor {
  private keys!: Keys;
  private dir = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene, x: number, y: number, cfg: Omit<ActorConfig, "key"> & { key?: string } = {}) {
    super(scene, x, y, { key: cfg.key ?? "player", ...cfg });
    this.bindDefaultKeys();
  }

  bindKeys(keys: Keys) { this.keys = keys; }
  bindDefaultKeys() {
    const kb = this.scene.input.keyboard;
    if(kb==null){
        throwError(()=>new Error("cannot bind keyboard"));
        console.error("cannot bind keyboard")
        return;
    }
    this.keys = {
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      attack: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    };
  }

  protected getMoveVector(): Phaser.Math.Vector2 {
    this.dir.set(0, 0);
    if (this.keys.left.isDown) this.dir.x -= 1;
    if (this.keys.right.isDown) this.dir.x += 1;
    if (this.keys.up.isDown) this.dir.y -= 1;
    if (this.keys.down.isDown) this.dir.y += 1;
    return this.dir;
  }

  protected wantsAttack(): boolean {
    return !!this.keys.attack && Phaser.Input.Keyboard.JustDown(this.keys.attack);
  }
}
