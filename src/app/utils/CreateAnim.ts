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

export function createAnim(scene: Phaser.Scene,
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