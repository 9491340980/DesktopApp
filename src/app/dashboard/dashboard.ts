import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Auth } from '../services/auth';
import { StorageKey } from '../enums/app-constants.enum';
import { CryptoService } from '../services/crypto-service';

interface MenuItem {
  Title: string;
  OperationId: string;
  Category: string;
  Module: string;
  RouterLink: string;
  HasSubMenu: boolean;
  SubMenu?: SubMenuItem[];
  Icon?: string;
  AppEnabled?: boolean;
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

@Component({
  selector: 'app-dashboard',
 imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatGridListModule,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
 menuItems: MenuItem[] = [];
  filteredMenuItems: MenuItem[] = [];
  searchQuery: string = '';
  username: string = '';
  siteId: string = '';
  selectedModuleTitle: string | null = null;

  constructor(
    private router: Router,
    private authService: Auth,
    private cryto:CryptoService
  ) {}

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
          this.selectedModuleTitle = this.filteredMenuItems[0].Title;
          console.log(`Auto-expanded single module: ${this.selectedModuleTitle}`);
        }

        console.log('Dashboard - Filtered items:', this.filteredMenuItems.length);
      } catch (error) {
        console.error('Error parsing menu from localStorage:', error);
        this.menuItems = [];
        this.filteredMenuItems = [];
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
      'TESTING': 'science',
      'DEVICE': 'devices'
    };

    const key = moduleOrTitle.toUpperCase();
    return iconMap[key] || 'widgets';
  }

  private getDefaultSubMenuIcon(title: string): string {
    const titleUpper = title.toUpperCase();

    if (titleUpper.includes('CREATE') || titleUpper.includes('ADD')) return 'add_circle';
    if (titleUpper.includes('EDIT') || titleUpper.includes('UPDATE')) return 'edit';
    if (titleUpper.includes('DELETE') || titleUpper.includes('REMOVE')) return 'delete';
    if (titleUpper.includes('VIEW') || titleUpper.includes('LIST')) return 'visibility';
    if (titleUpper.includes('SEARCH') || titleUpper.includes('FIND')) return 'search';
    if (titleUpper.includes('REPORT')) return 'description';
    if (titleUpper.includes('PRINT')) return 'print';
    if (titleUpper.includes('EXPORT')) return 'file_download';
    if (titleUpper.includes('IMPORT')) return 'file_upload';
    if (titleUpper.includes('KILL')) return 'clear';
    if (titleUpper.includes('CLEAR')) return 'cleaning_services';
    if (titleUpper.includes('DOCK')) return 'warehouse';
    if (titleUpper.includes('INBOUND')) return 'input';
    if (titleUpper.includes('MANAGE')) return 'folder';
    if (titleUpper.includes('NCI')) return 'inventory';
    if (titleUpper.includes('EXCEPTION')) return 'error';
    if (titleUpper.includes('ACCESSORY')) return 'extension';
    if (titleUpper.includes('START') || titleUpper.includes('STOP')) return 'power_settings_new';
    if (titleUpper.includes('WINDOWS') || titleUpper.includes('SERVICE')) return 'settings_applications';

    return 'arrow_forward';
  }

  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery = input.value.toLowerCase();

    if (!this.searchQuery) {
      // Show only desktop app items
      this.filteredMenuItems = this.menuItems.filter(item => item.isDesktopApp === true);
      return;
    }

    // Search within desktop app items only
    this.filteredMenuItems = this.menuItems.filter(item => {
      if (item.isDesktopApp !== true) return false;

      const mainMatch = item.Title.toLowerCase().includes(this.searchQuery);
      const subMatch = item.SubMenu?.some(sub =>
        sub.isDesktopApp === true && sub.Title.toLowerCase().includes(this.searchQuery)
      );
      return mainMatch || subMatch;
    });
  }

  onMainMenuClick(item: MenuItem): void {
    if (this.selectedModuleTitle === item.Title) {
      console.log(`Closing ${item.Title}`);
      this.selectedModuleTitle = null;
    } else {
      console.log(`Opening ${item.Title}`);
      this.selectedModuleTitle = item.Title;

      if (item.HasSubMenu) {
        const subMenuItems = this.getFilteredSubMenu(item);
        console.log(`${item.Title} has ${subMenuItems.length} desktop app submenu items`);
      }
    }
  }

  onSubMenuClick(mainItem: MenuItem, subItem: SubMenuItem): void {
    if (subItem.RouterLink) {
      localStorage.setItem('currentOperation', JSON.stringify({
        operationId: subItem.OperationId,
        module: subItem.Module,
        category: subItem.Category,
        title: subItem.Title
      }));

      this.router.navigate([subItem.RouterLink]);
    }
  }

  isModuleSelected(item: MenuItem): boolean {
    return this.selectedModuleTitle === item.Title;
  }

  getFilteredSubMenu(item: MenuItem): SubMenuItem[] {
    if (!item.SubMenu) {
      return [];
    }

    // Show only submenu items where isDesktopApp = true
    let filtered = item.SubMenu.filter(sub => sub.isDesktopApp === true);

    // If search query present, filter by title too
    if (this.searchQuery) {
      filtered = filtered.filter(sub =>
        sub.Title.toLowerCase().includes(this.searchQuery)
      );
    }

    return filtered;
  }

  getMenuImagePath(item: MenuItem): string {
    return `assets/images/dashboard/${item.Title}.png`;
  }

  getSubMenuImagePath(mainTitle: string, subItem: SubMenuItem): string {
    return `assets/images/dashboard/sub-menu-icons/${subItem.Title}-${subItem.OperationId}.png`;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.filteredMenuItems = this.menuItems.filter(item => item.isDesktopApp === true);
  }

  closeSelectedModule(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    console.log('Closing all modules');
    this.selectedModuleTitle = null;
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
  AppEnabled?: boolean;
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
