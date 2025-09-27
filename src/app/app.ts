import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GameCanvasComponent } from './game-canvas/game-canvas';
import {GameTest} from "./game-test/game-test"
@Component({
  selector: 'app-root',
  imports: [GameTest],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('prova-gioco');
}
