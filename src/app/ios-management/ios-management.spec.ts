import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IosManagement } from './ios-management';

describe('IosManagement', () => {
  let component: IosManagement;
  let fixture: ComponentFixture<IosManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IosManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IosManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
