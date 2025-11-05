import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navigation } from '../navigation';

@Component({
  selector: 'app-layout',
   imports: [CommonModule, RouterOutlet, Navigation],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {
/**
   * Handle view mode change from navigation
   */
  onViewModeChange(mode: string): void {
    // Emit event that child components can listen to
    window.dispatchEvent(new CustomEvent('viewModeChange', { detail: mode }));
  }

  /**
   * Handle refresh request from navigation
   */
  onRefreshRequested(): void {
    // Emit event that child components can listen to
    window.dispatchEvent(new CustomEvent('refreshRequested'));
  }
}
