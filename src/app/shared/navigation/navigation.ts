import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-navigation',
  imports: [CommonModule, RouterModule],
  templateUrl: './navigation.html',
  styleUrl: './navigation.scss',
})
export class Navigation {
  @Output() viewModeChange = new EventEmitter<string>();
  @Output() refreshRequested = new EventEmitter<void>();

  // State
  currentRoute: string = '';
  username: string = '';
  currentTime: string = '';
  showUserMenu: boolean = false;
  viewMode: string = 'table';
  isRefreshing: boolean = false;

  // Menu Items
  menuItems: MenuItem[] = [
    {
      label: 'Dashboard',
      icon: 'fa-chart-line',
      route: '/dashboard'
    },
    {
      label: 'iOS Management',
      icon: 'fa-mobile-alt',
      route: '/ios-management'
    }
    // ADD MORE MENU ITEMS HERE
    /*
    {
      label: 'Reports',
      icon: 'fa-file-alt',
      route: '/reports'
    },
    {
      label: 'Settings',
      icon: 'fa-cog',
      route: '/settings'
    }
    */
  ];

  private timeInterval: any;

  constructor(
    private router: Router,
    private authService: Auth
  ) { }

  ngOnInit(): void {
    // Get current user
    // this.username = this.authService.getUsername() || 'Admin';
    this.username = 'Admin';
    // Track route changes
    this.currentRoute = this.router.url;
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentRoute = event.url;
      this.showUserMenu = false; // Close user menu on route change
    });

    // Update time every second
    this.updateTime();
    this.timeInterval = setInterval(() => this.updateTime(), 1000);

    // Load saved view mode
    const savedViewMode = localStorage.getItem('viewMode');
    if (savedViewMode) {
      this.viewMode = savedViewMode;
    }
  }

  ngOnDestroy(): void {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
  }

  /**
   * Update current time
   */
  private updateTime(): void {
    this.currentTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * Get screen title based on current route
   */
  getScreenTitle(): string {
    const route = this.currentRoute;

    if (route.includes('/dashboard')) {
      return 'Service Dashboard';
    } else if (route.includes('/ios-management')) {
      return 'iOS Management';
    } else if (route.includes('/reports')) {
      return 'Reports';
    } else if (route.includes('/settings')) {
      return 'Settings';
    }

    return 'Dashboard';
  }

  /**
   * Check if menu item is visible based on roles
   */
  isMenuItemVisible(item: MenuItem): boolean {
    // if (!item.roles || item.roles.length === 0) {
    //   return true;
    // }
    // return item.roles.some(role => this.authService.hasRole(role));
    return true;
  }

  /**
   * Check if route is active
   */
  isActiveRoute(route: string): boolean {
    return this.currentRoute === route;
  }

  /**
   * Show view controls only on dashboard
   */
  showViewControls(): boolean {
    return this.currentRoute.includes('/dashboard');
  }

  /**
   * Set view mode
   */
  setViewMode(mode: string): void {
    this.viewMode = mode;
    localStorage.setItem('viewMode', mode);
    this.viewModeChange.emit(mode);
  }

  /**
   * Refresh data
   */
  refreshData(): void {
    this.isRefreshing = true;
    this.refreshRequested.emit();

    // Stop spinning after 1 second
    setTimeout(() => {
      this.isRefreshing = false;
    }, 1000);
  }

  /**
   * Toggle user menu
   */
  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  /**
   * Close user menu
   */
  closeUserMenu(): void {
    this.showUserMenu = false;
  }

  /**
   * Navigate to profile
   */
  goToProfile(): void {
    this.closeUserMenu();
    // TODO: Navigate to profile page
    alert('Profile page - Coming soon!');
  }

  /**
   * Navigate to settings
   */
  goToSettings(): void {
    this.closeUserMenu();
    // TODO: Navigate to settings page
    alert('Settings page - Coming soon!');
  }

  /**
   * Logout
   */
  logout(): void {
    this.closeUserMenu();
    if (confirm('Are you sure you want to logout?')) {
      this.authService.logout();
    }
  }
}

export interface MenuItem {
  label: string;
  icon: string;
  route: string;
  roles?: string[]; // Optional: restrict by roles
  badge?: number; // Optional: show notification badge
}
