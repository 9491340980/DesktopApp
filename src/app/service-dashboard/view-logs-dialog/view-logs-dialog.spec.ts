import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewLogsDialog } from './view-logs-dialog';

describe('ViewLogsDialog', () => {
  let component: ViewLogsDialog;
  let fixture: ComponentFixture<ViewLogsDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewLogsDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewLogsDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
