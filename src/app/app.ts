import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GameCanvasComponent } from './game-canvas/game-canvas';

@Component({
  selector: 'app-root',
  imports: [GameCanvasComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('prova-gioco');
}
