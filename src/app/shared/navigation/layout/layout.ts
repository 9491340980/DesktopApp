import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { Auth } from '../../../services/auth';
import { StorageKey } from '../../../enums/app-constants.enum';
import { CryptoService } from '../../../services/crypto-service';
import { filter, takeUntil } from 'rxjs/operators';
import { PatchStatus, PatchStatusService } from '../../../services/patch-status.service';
import { Subject } from 'rxjs';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'app-layout',
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatToolbarModule,
    MatButtonModule,
    MatListModule,
    MatTooltipModule,
    MatMenuModule,
    MatBadgeModule,
    MatDividerModule,
    MatIconModule,
    MatProgressBarModule
  ],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {
  @ViewChild('sidenav') sidenav!: MatSidenav;

  menuItems: MenuItem[] = [];
  filteredMenuItems: MenuItem[] = [];
  username: string = '';
  siteId: string = '';
  expandedMenuTitle: string | null = null;
  isSidenavOpen: boolean = false;
  currentScreenTitle: string = 'Dashboard';

  // ✅ NEW: Patch Status Properties
  patchStatus: PatchStatus = { isPatching: false };
  private destroy$ = new Subject<void>();

  constructor(
    private authService: Auth,
    private router: Router,
    private crypto: CryptoService,
    private patchStatusService: PatchStatusService
  ) { }

  ngOnInit(): void {
    this.loadUserInfo();
    this.loadMenuItems();
    this.setupRouteListener();
    this.loadCurrentScreenTitle();
    this.setupPatchMonitoring(); // ✅ NEW: Start patch monitoring
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.patchStatusService.stopMonitoring();
  }

  // ✅ NEW: Setup patch status monitoring
  private setupPatchMonitoring(): void {
    // Subscribe to patch status changes
    this.patchStatusService.patchStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.patchStatus = status;
        console.log('Layout received patch status:', status);
      });

    // Start monitoring with 30-second interval
    this.patchStatusService.startMonitoring(30000);
  }

  private loadUserInfo(): void {
    let USERNAME: any = localStorage.getItem(StorageKey.USERNAME);
    let SITEID = localStorage.getItem(StorageKey.SITE_ID);
    this.username = this.crypto.decrypt(USERNAME) || '';
    this.siteId = SITEID || '';
  }

  navigateToDeviceDetect(){
      this.router.navigate(['/ios-management']);
  }

  private loadMenuItems(): void {
    const menuStr = localStorage.getItem('menu');

    if (menuStr) {
      try {
        this.menuItems = JSON.parse(menuStr);

        // TEMPORARY: Mark Utility and specific submenu as isDesktopApp = true
        this.menuItems.forEach(item => {
          // Mark only "Utility" module
          if (item.Title === 'Utility') {
            item.isDesktopApp = true;

            // Mark only OperationId 6850 in submenu
            if (item.SubMenu) {
              item.SubMenu.forEach(subItem => {
                if (subItem.OperationId === '6850') {
                  subItem.isDesktopApp = true;
                } else {
                  subItem.isDesktopApp = false;
                }
              });
            }
          } else {
            item.isDesktopApp = false;
          }

          // Add default icons
          if (!item.Icon) {
            item.Icon = this.getDefaultIcon(item.Module || item.Title);
          }

          if (item.SubMenu) {
            item.SubMenu.forEach(subItem => {
              if (!subItem.Icon) {
                subItem.Icon = this.getDefaultSubMenuIcon(subItem.Title);
              }
            });
          }
        });

        // Filter to show only items where isDesktopApp = true
        this.filteredMenuItems = this.menuItems.filter(item => item.isDesktopApp === true);

        // AUTO-EXPAND if only 1 module
        if (this.filteredMenuItems.length === 1 && this.filteredMenuItems[0].HasSubMenu) {
          this.expandedMenuTitle = this.filteredMenuItems[0].Title;
          console.log(`Auto-expanded single module in sidebar: ${this.expandedMenuTitle}`);
        }

        console.log('Filtered menu items:', this.filteredMenuItems);
        console.log('Utility submenu:', this.filteredMenuItems[0]?.SubMenu);
      } catch (error) {
        console.error('Error parsing menu:', error);
      }
    }
  }

  private setupRouteListener(): void {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.updateScreenTitle(event.urlAfterRedirects);
    });
  }

  private updateScreenTitle(url: string): void {
    // Check if there's operation info in localStorage
    const operationStr = localStorage.getItem('currentOperation');

    if (operationStr) {
      try {
        const operation = JSON.parse(operationStr);
        this.currentScreenTitle = operation.title || 'Dashboard';
        return;
      } catch (error) {
        console.error('Error parsing current operation:', error);
      }
    }

    // Fallback: Try to match URL to menu items
    const foundItem = this.findMenuItemByUrl(url);
    if (foundItem) {
      this.currentScreenTitle = foundItem.Title;
    } else {
      // Default based on route
      this.currentScreenTitle = this.getDefaultTitleFromUrl(url);
    }
  }

  private loadCurrentScreenTitle(): void {
    const currentUrl = this.router.url;
    this.updateScreenTitle(currentUrl);
  }

  private findMenuItemByUrl(url: string): MenuItem | SubMenuItem | null {
    // Remove leading slash and query params
    const cleanUrl = url.split('?')[0].replace(/^\//, '');

    // Search main menu items
    for (const item of this.menuItems) {
      const itemUrl = item.RouterLink?.replace(/^\//, '');
      if (itemUrl === cleanUrl) {
        return item;
      }

      // Search submenu items
      if (item.SubMenu) {
        for (const subItem of item.SubMenu) {
          const subItemUrl = subItem.RouterLink?.replace(/^\//, '');
          if (subItemUrl === cleanUrl) {
            return subItem;
          }
        }
      }
    }

    return null;
  }

  private getDefaultTitleFromUrl(url: string): string {
    const path = url.split('?')[0].replace(/^\//, '').split('/')[0];

    const titleMap: { [key: string]: string } = {
      'dashboard': 'Dashboard',
      'user-profile': 'User Profile',
      'service-dashboard': 'Service Dashboard',
      'utilities': 'Utilities',
      'settings': 'Settings',
      '': 'Dashboard'
    };

    return titleMap[path] || this.formatPathAsTitle(path);
  }

  private formatPathAsTitle(path: string): string {
    return path
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private getDefaultIcon(moduleOrTitle: string): string {
    const iconMap: { [key: string]: string } = {
      'RCV': 'inbox',
      'RECEIVING': 'inbox',
      'PUT': 'archive',
      'PUTAWAY': 'archive',
      'PICK': 'shopping_cart',
      'PICKING': 'shopping_cart',
      'SHIP': 'local_shipping',
      'SHIPPING': 'local_shipping',
      'INV': 'inventory_2',
      'INVENTORY': 'inventory_2',
      'QA': 'verified',
      'QUALITY': 'verified',
      'ADMIN': 'admin_panel_settings',
      'SETTINGS': 'settings',
      'REPORTS': 'assessment',
      'UTILITIES': 'build',
      'UTILITY': 'build',
      'MAINTENANCE': 'construction',
      'TESTING': 'science'
    };

    const key = (moduleOrTitle || '').toUpperCase();
    return iconMap[key] || 'widgets';
  }

  private getDefaultSubMenuIcon(title: string): string {
    const titleUpper = title.toUpperCase();

    if (titleUpper.includes('CREATE') || titleUpper.includes('ADD')) return 'add_circle_outline';
    if (titleUpper.includes('EDIT') || titleUpper.includes('UPDATE')) return 'edit';
    if (titleUpper.includes('DELETE') || titleUpper.includes('REMOVE')) return 'delete_outline';
    if (titleUpper.includes('VIEW') || titleUpper.includes('LIST')) return 'visibility';
    if (titleUpper.includes('SEARCH') || titleUpper.includes('FIND')) return 'search';
    if (titleUpper.includes('REPORT')) return 'description';
    if (titleUpper.includes('PRINT')) return 'print';
    if (titleUpper.includes('START') || titleUpper.includes('STOP')) return 'power_settings_new';
    if (titleUpper.includes('WINDOWS') || titleUpper.includes('SERVICE')) return 'settings_applications';

    return 'arrow_forward';
  }

  toggleSidenav(): void {
    this.sidenav.toggle();
    this.isSidenavOpen = this.sidenav.opened;
  }

  toggleMenu(title: string): void {
    if (this.expandedMenuTitle === title) {
      this.expandedMenuTitle = null;
    } else {
      this.expandedMenuTitle = title;
    }
  }

  isMenuExpanded(title: string): boolean {
    return this.expandedMenuTitle === title;
  }

  navigateToItem(item: MenuItem): void {
    if (!item.HasSubMenu && item.RouterLink) {
      this.storeOperationInfo(item);
      this.currentScreenTitle = item.Title;
      this.router.navigate([item.RouterLink]);
    }
  }

  navigateToSubItem(mainItem: MenuItem, subItem: SubMenuItem): void {
    if (subItem.RouterLink) {
      this.storeOperationInfo(subItem);
      this.currentScreenTitle = subItem.Title;
      this.router.navigate([subItem.RouterLink]);
    }
  }

  private storeOperationInfo(item: any): void {
    localStorage.setItem('currentOperation', JSON.stringify({
      operationId: item.OperationId,
      module: item.Module,
      category: item.Category,
      title: item.Title
    }));
  }

  navigateToDashboard(): void {
    this.currentScreenTitle = 'Dashboard';
    localStorage.removeItem('currentOperation');
    this.router.navigate(['/dashboard']);
  }

  navigateToUserProfile(): void {
    this.currentScreenTitle = 'User Profile';
    localStorage.setItem('currentOperation', JSON.stringify({
      operationId: 'USER_PROFILE',
      module: 'SETTINGS',
      category: 'USER',
      title: 'User Profile'
    }));
    this.router.navigate(['/user-profile']);
  }

  logout(): void {
    this.authService.logout();
  }

  getSubMenuCount(item: MenuItem): number {
    if (!item.SubMenu) return 0;
    return item.SubMenu.filter(sub => sub.isDesktopApp === true).length;
  }

  getFilteredSubMenu(item: MenuItem): SubMenuItem[] {
    if (!item.SubMenu) return [];
    return item.SubMenu.filter(sub => sub.isDesktopApp === true);
  }
}

interface MenuItem {
  Title: string;
  OperationId: string;
  Category: string;
  Module: string;
  RouterLink: string;
  HasSubMenu: boolean;
  SubMenu?: SubMenuItem[];
  Icon?: string;
  isDesktopApp?: boolean;
}

interface SubMenuItem {
  Title: string;
  OperationId: string;
  Category: string;
  Module: string;
  RouterLink: string;
  AppEnabled: boolean;
  Icon?: string;
  isDesktopApp?: boolean;
}
