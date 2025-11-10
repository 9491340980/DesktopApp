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
  username: string = '';
  siteId: string = '';
  expandedMenuTitle: string | null = null;
  isSidenavOpen: boolean = true;

  constructor(
    private authService: Auth,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadUserInfo();
    this.loadMenuItems();
  }

  private loadUserInfo(): void {
    const user = this.authService.currentUserValue;
    if (user) {
      this.username = user.username;
      this.siteId = user.siteId;
    }
  }

  private loadMenuItems(): void {
    const menuStr = localStorage.getItem('menu');

    if (menuStr) {
      try {
        this.menuItems = JSON.parse(menuStr);

        // Add default icons
        this.menuItems.forEach(item => {
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

  logout(): void {
    this.authService.logout();
  }

  getSubMenuCount(item: MenuItem): number {
    if (!item.SubMenu) return 0;
    // Show ALL submenu items count (don't filter by AppEnabled for display count)
    return item.SubMenu.length;
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
}

interface SubMenuItem {
  Title: string;
  OperationId: string;
  Category: string;
  Module: string;
  RouterLink: string;
  AppEnabled: boolean;
  Icon?: string;
}
