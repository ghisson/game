import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameTest } from './game-test';

describe('GameTest', () => {
  let component: GameTest;
  let fixture: ComponentFixture<GameTest>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameTest]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GameTest);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
