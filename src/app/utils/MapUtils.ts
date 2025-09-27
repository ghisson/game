function setupCamera(camera: Phaser.Cameras.Scene2D.CameraManager, map: any, player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody) {
    camera.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    camera.main.startFollow(player, true, 0.15, 0.15);
    camera.main.setZoom(2);
}

function setupRestart(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) return; // se non disponibile, esco

    const keyC = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);

    keyC.on('down', () => {
        scene.scene.restart();
    });
}
export function initMaps(camera: Phaser.Cameras.Scene2D.CameraManager, map: any, player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody, scene: Phaser.Scene) {
    setupCamera(camera, map, player);
    setupRestart(scene);
}
