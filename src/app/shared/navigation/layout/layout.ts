import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
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
    MatIconModule
  ],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {
  @ViewChild('sidenav') sidenav!: MatSidenav;

  menuItems: MenuItem[] = [];
  filteredMenuItems: MenuItem[] = []; // For display
  username: string = '';
  siteId: string = '';
  expandedMenuTitle: string | null = null;
  isSidenavOpen: boolean = false;

  constructor(
    private authService: Auth,
    private router: Router,
    private cryto:CryptoService
  ) { }

  ngOnInit(): void {
    this.loadUserInfo();
    this.loadMenuItems();
  }

  private loadUserInfo(): void {
    let USERNAME:any = localStorage.getItem(StorageKey.USERNAME);
    let SITEID = localStorage.getItem(StorageKey.SITE_ID);
    this.username = this.cryto.decrypt(USERNAME) || '';
    this.siteId = SITEID || '';
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
      this.router.navigate([item.RouterLink]);
    }
  }

  navigateToSubItem(mainItem: MenuItem, subItem: SubMenuItem): void {
    if (subItem.RouterLink) {
      this.storeOperationInfo(subItem);
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
    this.router.navigate(['/dashboard']);
  }

    navigateToUserProfile(): void {
    this.router.navigate(['/user-profile']);
  }

  logout(): void {
    this.authService.logout();
  }

  getSubMenuCount(item: MenuItem): number {
    if (!item.SubMenu) return 0;
    // Count only items where isDesktopApp = true
    return item.SubMenu.filter(sub => sub.isDesktopApp === true).length;
  }

  // Filter submenu to show only isDesktopApp items
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
  isDesktopApp?: boolean; // Added for filtering
}

interface SubMenuItem {
  Title: string;
  OperationId: string;
  Category: string;
  Module: string;
  RouterLink: string;
  AppEnabled: boolean;
  Icon?: string;
  isDesktopApp?: boolean; // Added for filtering
}
